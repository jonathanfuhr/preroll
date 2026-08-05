import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { Readable } from 'node:stream'
import type { NextRequest } from 'next/server'
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

  const kopfzeilen = new Headers({
    'content-type': typ,
    'content-length': String(groesse),
    // Der Inhalt unter einer Kennung ändert sich nie — Medien werden ersetzt,
    // nicht überschrieben.
    'cache-control': 'private, max-age=31536000, immutable',
  })

  // Videos brauchen Bereichsanfragen, damit im Browser gespult werden kann.
  const bereich = anfrage.headers.get('range')
  if (bereich && typ.startsWith('video/')) {
    const treffer = /bytes=(\d*)-(\d*)/.exec(bereich)
    if (treffer) {
      const start = treffer[1] ? Number(treffer[1]) : 0
      const ende = treffer[2] ? Number(treffer[2]) : groesse - 1
      if (start >= groesse || ende >= groesse || start > ende) {
        return new Response('Bereich ungültig', {
          status: 416,
          headers: { 'content-range': `bytes */${groesse}` },
        })
      }
      kopfzeilen.set('content-range', `bytes ${start}-${ende}/${groesse}`)
      kopfzeilen.set('content-length', String(ende - start + 1))
      kopfzeilen.set('accept-ranges', 'bytes')
      const strom = Readable.toWeb(createReadStream(pfad, { start, end: ende }))
      return new Response(strom as ReadableStream, { status: 206, headers: kopfzeilen })
    }
  }

  if (typ.startsWith('video/')) kopfzeilen.set('accept-ranges', 'bytes')

  const strom = Readable.toWeb(createReadStream(pfad))
  return new Response(strom as ReadableStream, { headers: kopfzeilen })
}
