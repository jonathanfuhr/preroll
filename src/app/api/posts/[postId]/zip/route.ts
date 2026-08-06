import { createReadStream } from 'node:fs'
import { PassThrough, Readable } from 'node:stream'
import { ZipArchive } from 'archiver'
import type { NextRequest } from 'next/server'
import { POST_MEDIEN } from '@/lib/abfragen'
import { aktuellerGast, aktuellerNutzer } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { zipDateiname, zipStempel } from '@/lib/format'
import { absoluterPfad } from '@/lib/medien'

/**
 * Ein einzelner Post als ZIP — Slides, Reel, Thumbnail und die Caption als
 * Textdatei.
 *
 * Neben dem Zeitraum-Export, der einen ganzen Monat auf einmal ausgibt: Wer
 * nur einen Beitrag einplanen will, soll nicht alles herunterladen und
 * darin suchen müssen.
 *
 * Ungeplante Posts haben keinen Zeitstempel für die Dateinamen — dann tritt
 * der Titel an seine Stelle.
 */
export async function GET(
  _anfrage: NextRequest,
  { params }: { params: Promise<{ postId: string }> },
) {
  // Das Team kommt immer heran; ein Gast nur, wenn der Post in einem Link
  // steht, zu dem er eingeladen ist.
  const [nutzer, gast] = await Promise.all([aktuellerNutzer(), aktuellerGast()])
  if (!nutzer && !gast) return new Response('Nicht angemeldet.', { status: 401 })

  const { postId } = await params
  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: { kunde: true, medien: POST_MEDIEN },
  })
  if (!post) return new Response('Post nicht gefunden.', { status: 404 })

  if (!nutzer && gast) {
    const erlaubt = await prisma.exportGast.findFirst({
      where: { gastId: gast.id, export: { kundeId: post.kundeId } },
    })
    if (!erlaubt) return new Response('Kein Zugriff.', { status: 403 })
  }

  const archiv = new ZipArchive({ zlib: { level: 6 } })
  const durchlauf = new PassThrough()
  archiv.pipe(durchlauf)
  archiv.on('warning', (fehler: Error) => console.warn('[zip]', fehler.message))
  archiv.on('error', (fehler: Error) => durchlauf.destroy(fehler))

  // Ohne Termin gibt es keinen Zeitstempel — dann trägt der Titel die Namen.
  const stempel = post.postenAm
    ? zipStempel(post.postenAm)
    : post.titel.replace(/[^\w\-]+/g, '_').slice(0, 40)

  for (const eintrag of post.medien) {
    const endung = eintrag.medium.dateiname.split('.').pop() ?? 'jpg'
    const basis = post.postenAm
      ? zipDateiname(post.postenAm, post.typ, eintrag.rolle, eintrag.position)
      : `${stempel}_${eintrag.rolle}${eintrag.rolle === 'SLIDE' ? `_${eintrag.position + 1}` : ''}`

    try {
      archiv.append(createReadStream(absoluterPfad(eintrag.medium.pfad)), {
        name: `${basis}.${endung}`,
      })
    } catch {
      // Fehlende Datei überspringen — der Rest bleibt brauchbar.
    }
  }

  const zeilen = [
    post.titel,
    '',
    `Typ: ${post.typ}`,
    post.postenAm ? `Termin: ${post.postenAm.toLocaleString('de-DE')}` : 'Termin: noch offen',
    post.laenge ? `Länge: ${post.laenge}` : null,
    '',
    post.caption,
  ].filter((z) => z !== null)

  archiv.append(Buffer.from(zeilen.join('\n'), 'utf8'), { name: `${stempel}_Caption.txt` })

  void archiv.finalize()

  const dateiname = `${post.kunde.slug}_${stempel}.zip`
  return new Response(Readable.toWeb(durchlauf) as ReadableStream, {
    headers: {
      'content-type': 'application/zip',
      'content-disposition': `attachment; filename="${dateiname}"`,
    },
  })
}
