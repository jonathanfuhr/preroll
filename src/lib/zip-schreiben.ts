import 'server-only'
import { createReadStream } from 'node:fs'
import fs from 'node:fs/promises'
import { PassThrough, Readable } from 'node:stream'
import { ZipArchive } from 'archiver'
import { klappeVideoFuersZip } from './klappe'
import { absoluterPfad } from './medien'
import type { ZipEintrag } from './zip'

/**
 * Schreibt die vorgemerkten Einträge in ein Archiv.
 *
 * Zwei Regeln, die aus einem Fehlersuchtag stammen:
 *
 * **Nichts wird gepackt.** Videos und JPEG sind komprimiert; sie ein zweites
 * Mal durch zlib zu schicken kostete Minuten CPU und sparte nichts. Bei einem
 * 115-MB-Reel war das der Unterschied zwischen einem Download, der läuft, und
 * einem, der stillsteht, bis der Proxy davor ihn abräumt. Nur Text wird
 * gepackt — dort lohnt es.
 *
 * **Ein fehlender Eintrag darf das Archiv nicht mitnehmen.** Vorher wurde
 * `createReadStream` direkt angehängt, in einem `try` — das fängt nichts, denn
 * der Fehler kommt später und asynchron. Eine gelöschte Datei riss damit den
 * ganzen Abruf mit. Jetzt wird vorher nachgesehen, und was fehlt, landet als
 * Zeile in `Hinweise.txt`: Wer das Archiv öffnet, soll wissen, dass etwas fehlt,
 * statt es für vollständig zu halten.
 */
export function schreibeArchiv(
  eintraege: ZipEintrag[],
  optionen: { wurzel: string },
): NodeJS.ReadableStream {
  const archiv = new ZipArchive()
  const durchlauf = new PassThrough()
  archiv.pipe(durchlauf)

  archiv.on('warning', (fehler: Error) => console.warn('[zip]', fehler.message))
  archiv.on('error', (fehler: Error) => durchlauf.destroy(fehler))

  // Der Aufbau läuft außerhalb der Antwort weiter — der Browser bekommt die
  // Kopfzeilen sofort und danach die Bytes, so wie sie entstehen.
  void (async () => {
    const hinweise: string[] = []
    const wegzuraeumen: string[] = []

    try {
      for (const eintrag of eintraege) {
        const name = `${optionen.wurzel}/${eintrag.pfad}`

        if (eintrag.art === 'text' || eintrag.art === 'puffer') {
          archiv.append(eintrag.inhalt, { name })
          continue
        }

        if (eintrag.art === 'datei') {
          const pfad = absoluterPfad(eintrag.quelle)
          if (!(await liegtDa(pfad))) {
            hinweise.push(`${eintrag.pfad} — Datei fehlt in der Ablage`)
            continue
          }
          archiv.append(createReadStream(pfad), { name, store: true })
          continue
        }

        const fassung = await klappeVideoFuersZip(eintrag.fassungId, eintrag.fassung)
        if (!fassung) {
          hinweise.push(`${eintrag.pfad} — Fassung aus Klappe nicht abrufbar`)
          continue
        }
        wegzuraeumen.push(fassung.pfad)
        archiv.append(createReadStream(fassung.pfad), {
          name: `${name}.${fassung.endung}`,
          store: true,
        })
      }

      if (hinweise.length > 0) {
        archiv.append(
          ['Diese Dateien fehlen im Archiv:', '', ...hinweise.map((z) => `· ${z}`)].join('\n'),
          { name: `${optionen.wurzel}/Hinweise.txt` },
        )
      }

      await archiv.finalize()
    } catch (fehler) {
      durchlauf.destroy(fehler as Error)
    } finally {
      for (const pfad of wegzuraeumen) await fs.rm(pfad, { force: true }).catch(() => undefined)
    }
  })()

  return durchlauf
}

/** Antwort mit dem Archiv als Strom. */
export function archivAntwort(strom: NodeJS.ReadableStream, dateiname: string): Response {
  return new Response(Readable.toWeb(strom as Readable) as ReadableStream, {
    headers: {
      'content-type': 'application/zip',
      'content-disposition': `attachment; filename="${dateiname}"`,
      // Ein Proxy, der auf das Ende wartet, um zu puffern, würde denselben
      // Stillstand erzeugen, den wir gerade beseitigt haben.
      'cache-control': 'no-store',
      'x-accel-buffering': 'no',
    },
  })
}

async function liegtDa(pfad: string): Promise<boolean> {
  try {
    await fs.access(pfad)
    return true
  } catch {
    return false
  }
}
