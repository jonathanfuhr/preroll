import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { Readable } from 'node:stream'
import type { NextRequest } from 'next/server'
import { leseBereich } from '@/lib/bereich'
import { prisma } from '@/lib/db'
import { absoluterPfad } from '@/lib/medien'

/**
 * Liefert ein Medium aus. Die Kennung ist eine nicht erratbare cuid und wirkt
 * damit wie ein signierter Link — nötig, weil Kunden die Export-Seite ohne
 * Anmeldung öffnen können. Die Datei selbst liegt außerhalb von `public/`.
 */
export async function GET(
  anfrage: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const variante = anfrage.nextUrl.searchParams.get('v')

  const medium = await prisma.medium.findUnique({ where: { id } })
  if (!medium) return new Response('Nicht gefunden', { status: 404 })

  const relativ = variante === 'thumb' && medium.thumbPfad ? medium.thumbPfad : medium.pfad
  const typ = variante === 'thumb' && medium.thumbPfad ? 'image/jpeg' : medium.mimeTyp

  let pfad: string
  try {
    pfad = absoluterPfad(relativ)
  } catch {
    return new Response('Ungültiger Pfad', { status: 400 })
  }

  let groesse: number
  try {
    groesse = (await stat(pfad)).size
  } catch {
    return new Response('Datei fehlt', { status: 404 })
  }

  const istVorschau = variante === 'thumb' && Boolean(medium.thumbPfad)

  const kopfzeilen = new Headers({
    'content-type': typ,
    'content-length': String(groesse),
    /*
      Das Original unter einer Kennung ändert sich nie — Medien werden
      ersetzt, nicht überschrieben. Das Vorschaubild schon: Ändert sich der
      Rasterausschnitt, wird es neu erzeugt und liegt unter derselben
      Adresse. Mit `immutable` hätte es danach niemand je zu sehen bekommen.

      Deshalb dort ein kurzer Vorrat plus Kennzeichen: Der Browser fragt
      nach, bekommt fast immer ein 304 zurück und lädt nur, wenn wirklich
      neu zugeschnitten wurde.
    */
    'cache-control': istVorschau
      ? 'private, max-age=300, must-revalidate'
      : 'private, max-age=31536000, immutable',
  })

  if (istVorschau) {
    // Der Pfad trägt bei jedem Neuzuschnitt einen neuen Zufallsnamen — er
    // ist damit genau das Kennzeichen, das sich ändern muss.
    const kennzeichen = `"${medium.thumbPfad}"`
    if (anfrage.headers.get('if-none-match') === kennzeichen) {
      return new Response(null, { status: 304, headers: { etag: kennzeichen } })
    }
    kopfzeilen.set('etag', kennzeichen)
  }

  /*
    Videos brauchen Bereichsanfragen, damit im Browser gespult werden kann —
    und damit der Player überhaupt anfängt: Ein MP4 ohne `faststart` trägt sein
    `moov`-Kästchen am Dateiende, und danach fragt er mit `bytes=-100000`.

    Ausgewertet wird das in `leseBereich`, geprüft und mit dem Grund. Die
    frühere Auswertung hier las die leere Zahl vor dem Bindestrich als 0 und
    lieferte den Dateianfang — der Player fand die Metadaten nie und blieb
    stehen, ohne dass irgendwo ein Fehler auftauchte.
  */
  if (typ.startsWith('video/')) {
    const bereich = leseBereich(anfrage.headers.get('range'), groesse)

    if (bereich === 'ungueltig') {
      return new Response('Bereich ungültig', {
        status: 416,
        headers: { 'content-range': `bytes */${groesse}` },
      })
    }

    if (bereich) {
      kopfzeilen.set('content-range', `bytes ${bereich.start}-${bereich.ende}/${groesse}`)
      kopfzeilen.set('content-length', String(bereich.ende - bereich.start + 1))
      kopfzeilen.set('accept-ranges', 'bytes')
      const strom = Readable.toWeb(
        createReadStream(pfad, { start: bereich.start, end: bereich.ende }),
      )
      return new Response(strom as ReadableStream, { status: 206, headers: kopfzeilen })
    }
  }

  if (typ.startsWith('video/')) kopfzeilen.set('accept-ranges', 'bytes')

  const strom = Readable.toWeb(createReadStream(pfad))
  return new Response(strom as ReadableStream, { headers: kopfzeilen })
}
