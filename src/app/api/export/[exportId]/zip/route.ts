import { createReadStream } from 'node:fs'
import { PassThrough, Readable } from 'node:stream'
import { ZipArchive } from 'archiver'
import type { NextRequest } from 'next/server'
import { POST_MEDIEN } from '@/lib/abfragen'
import { aktuellerNutzer } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { postsImZeitraum } from '@/lib/export-sicht'
import { kalenderwoche, zipDateiname, zipStempel } from '@/lib/format'
import { klappeVideoFuersZip } from '@/lib/klappe'
import { absoluterPfad } from '@/lib/medien'
import { reelVideoQuelle } from '@/lib/reel-video'
import { kommentarPdf } from '@/lib/pdf'

/**
 * Alle Medien eines Zeitraums als ZIP — solange es keine direkte Anbindung an
 * die Meta Business Suite gibt, ist das der Weg in den Scheduler.
 *
 * Dateinamen nach Posting-Datum und -Uhrzeit (`JJMMTT_HHMM_…`). Da nie zwei
 * Posts exakt zeitgleich erscheinen, sind sie ohne Zusatz eindeutig.
 */
export async function GET(
  anfrage: NextRequest,
  { params }: { params: Promise<{ exportId: string }> },
) {
  const nutzer = await aktuellerNutzer()
  if (!nutzer) return new Response('Nicht angemeldet.', { status: 401 })

  const { exportId } = await params
  const exp = await prisma.export.findUnique({
    where: { id: exportId },
    include: { kunde: true },
  })
  if (!exp) return new Response('Export nicht gefunden.', { status: 404 })

  const suche = anfrage.nextUrl.searchParams
  const mitCaptions = suche.get('captions') !== '0'
  const mitKommentaren = suche.get('kommentare') === '1'

  const alle = await prisma.post.findMany({
    where: { kundeId: exp.kundeId },
    orderBy: { postenAm: 'asc' },
    include: { medien: POST_MEDIEN },
  })

  // Fürs ZIP zählt der Zeitraum, nicht der Freigabestatus — das Team exportiert
  // auch, was der Kunde noch nicht gesehen hat.
  const posts = postsImZeitraum(alle, {
    zeitraumVon: exp.zeitraumVon,
    zeitraumBis: exp.zeitraumBis,
    konzepteMitzeigen: true,
  })

  // Archiver 8 bietet Klassen statt der früheren Factory-Funktion.
  const archiv = new ZipArchive({ zlib: { level: 6 } })
  const durchlauf = new PassThrough()
  archiv.pipe(durchlauf)

  archiv.on('warning', (fehler: Error) => console.warn('[zip]', fehler.message))
  archiv.on('error', (fehler: Error) => durchlauf.destroy(fehler))

  for (const post of posts) {
    const ordner = `KW${String(kalenderwoche(post.postenAm)).padStart(2, '0')}`

    for (const eintrag of post.medien) {
      const basis = zipDateiname(post.postenAm, post.typ, eintrag.rolle, eintrag.position, post.verhaeltnis)
      const endung = eintrag.medium.dateiname.split('.').pop() ?? 'jpg'

      try {
        archiv.append(createReadStream(absoluterPfad(eintrag.medium.pfad)), {
          name: `${ordner}/${basis}.${endung}`,
        })
      } catch {
        // Fehlende Datei überspringen — der Rest des Archivs bleibt brauchbar.
      }
    }

    // Reels, deren Video nur als Klappe-Fassung vorliegt, kommen im Moment
    // des Exports von dort — die Route steht nur dem Team offen, also das
    // Original.
    if (post.typ === 'REEL' && reelVideoQuelle(post)?.herkunft === 'KLAPPE') {
      const fassung = await klappeVideoFuersZip(post.klappeVersionId!, 'original')
      if (fassung) {
        archiv.append(fassung.strom, {
          name: `${ordner}/${zipStempel(post.postenAm)}_Reel.${fassung.endung}`,
        })
      } else {
        console.warn('[zip] Klappe-Fassung nicht abrufbar:', post.klappeVersionId)
      }
    }

    if (mitCaptions) {
      const zeilen = [
        post.titel,
        '',
        `Typ: ${post.typ}`,
        `Termin: ${post.postenAm.toLocaleString('de-DE')}`,
        `Status: ${post.status}`,
        '',
        post.caption,
      ]
      archiv.append(zeilen.join('\n'), {
        // Die Caption gehört zum Post, nicht zu einem einzelnen Slide.
        name: `${ordner}/${zipStempel(post.postenAm)}_Caption.txt`,
      })
    }
  }

  if (mitKommentaren) {
    const kommentare = await prisma.kommentar.findMany({
      where: { exportId: exp.id },
      orderBy: { erstelltAm: 'asc' },
      include: { post: true },
    })
    if (kommentare.length > 0) {
      archiv.append(await kommentarPdf(exp.kunde.name, kommentare), {
        name: 'Kommentarverlauf.pdf',
      })
    }
  }

  void archiv.finalize()

  const name = `${exp.kunde.slug}_${exp.zeitraumVon.toISOString().slice(0, 7)}.zip`
  return new Response(Readable.toWeb(durchlauf) as ReadableStream, {
    headers: {
      'content-type': 'application/zip',
      'content-disposition': `attachment; filename="${name}"`,
    },
  })
}
