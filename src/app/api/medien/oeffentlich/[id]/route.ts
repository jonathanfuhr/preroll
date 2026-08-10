import { createReadStream } from 'node:fs'
import { readFile, stat } from 'node:fs/promises'
import { Readable } from 'node:stream'
import type { NextRequest } from 'next/server'
import sharp from 'sharp'
import { prisma } from '@/lib/db'
import { absoluterPfad } from '@/lib/medien'
import { pruefeUnterschrift } from '@/lib/medien-signatur'

/**
 * Dieselbe Datei wie unter `/api/medien/<id>`, aber signiert und befristet.
 *
 * Gebraucht wird das genau einmal: Beim Posten übergibt man Meta keine Datei,
 * sondern eine Adresse, und die Graph API holt sie sich selbst ab. Eine solche
 * Adresse landet im Protokoll eines fremden Dienstes — deshalb läuft sie ab.
 *
 * `f=jpeg` wandelt beim Ausliefern um: Instagram nimmt für Bilder **nur**
 * JPEG an, und ein PNG aus Canva ist im Bestand keine Seltenheit. Umgewandelt
 * wird im Vorbeigehen und nichts davon gespeichert — das Original bleibt, was
 * es ist.
 */
export async function GET(
  anfrage: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const suche = anfrage.nextUrl.searchParams

  const geprueft = pruefeUnterschrift(
    'medium',
    id,
    suche.get('bis'),
    suche.get('f'),
    suche.get('sig'),
  )
  if (!geprueft.ok) {
    // Der Grund darf hier stehen: Wer keine gültige Unterschrift hat, erfährt
    // nichts über das Medium, und „abgelaufen" spart bei der Fehlersuche Zeit.
    return new Response(geprueft.grund === 'abgelaufen' ? 'Abgelaufen' : 'Ungültig', {
      status: 403,
    })
  }

  const medium = await prisma.medium.findUnique({ where: { id } })
  if (!medium) return new Response('Nicht gefunden', { status: 404 })

  let pfad: string
  try {
    pfad = absoluterPfad(medium.pfad)
  } catch {
    return new Response('Ungültiger Pfad', { status: 400 })
  }

  // Kein Zwischenspeichern: Die Adresse ist kurzlebig, und ihr Inhalt hat in
  // keinem fremden Cache etwas verloren.
  const kopfzeilen = new Headers({ 'cache-control': 'no-store' })

  if (geprueft.format === 'jpeg' && medium.mimeTyp !== 'image/jpeg') {
    try {
      // Flächig weiß hinterlegen, sonst wird jede transparente Stelle schwarz.
      const jpeg = await sharp(await readFile(pfad))
        .flatten({ background: '#ffffff' })
        .jpeg({ quality: 92 })
        .toBuffer()
      kopfzeilen.set('content-type', 'image/jpeg')
      kopfzeilen.set('content-length', String(jpeg.byteLength))
      return new Response(new Uint8Array(jpeg), { headers: kopfzeilen })
    } catch {
      return new Response('Umwandlung fehlgeschlagen', { status: 500 })
    }
  }

  let groesse: number
  try {
    groesse = (await stat(pfad)).size
  } catch {
    return new Response('Datei fehlt', { status: 404 })
  }

  kopfzeilen.set('content-type', medium.mimeTyp)
  kopfzeilen.set('content-length', String(groesse))

  // Meta lädt Videos mit Bereichsanfragen — ohne das bricht der Abruf ab.
  const bereich = anfrage.headers.get('range')
  if (bereich && medium.mimeTyp.startsWith('video/')) {
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
      const teil = Readable.toWeb(createReadStream(pfad, { start, end: ende }))
      return new Response(teil as ReadableStream, { status: 206, headers: kopfzeilen })
    }
  }

  if (medium.mimeTyp.startsWith('video/')) kopfzeilen.set('accept-ranges', 'bytes')

  const strom = Readable.toWeb(createReadStream(pfad))
  return new Response(strom as ReadableStream, { headers: kopfzeilen })
}
