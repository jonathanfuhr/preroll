import type { NextRequest } from 'next/server'
import { POST_MEDIEN } from '@/lib/abfragen'
import { aktuellerGast, aktuellerNutzer } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { zipDateiname, zipStempel } from '@/lib/format'
import { reelVideoQuelle } from '@/lib/reel-video'
import { postBezeichnung } from '@/lib/verhaeltnis'
import type { ZipEintrag } from '@/lib/zip'
import { archivAntwort, schreibeArchiv } from '@/lib/zip-schreiben'

/**
 * Ein einzelner Post als ZIP — Slides, Reel, Thumbnail und die Caption als
 * Textdatei.
 *
 * Neben dem Zeitraum-Export, der einen ganzen Monat auf einmal ausgibt: Wer
 * nur einen Beitrag einplanen will, soll nicht alles herunterladen und darin
 * suchen müssen.
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
    if (!post.kunde.zipFuerKunden) {
      return new Response('Für diesen Kunden ist der Download nicht freigegeben.', { status: 403 })
    }
    // Und nur Finales — ein Konzept, das noch umgebaut wird, gehört nicht in
    // fremde Ordner.
    if (post.status !== 'FINAL') return new Response('Noch nicht final.', { status: 403 })

    const erlaubt = await prisma.exportGast.findFirst({
      where: { gastId: gast.id, export: { kundeId: post.kundeId } },
    })
    if (!erlaubt) return new Response('Kein Zugriff.', { status: 403 })
  }

  // Ohne Termin gibt es keinen Zeitstempel — dann trägt der Titel die Namen.
  const stempel = post.postenAm
    ? zipStempel(post.postenAm)
    : post.titel.replace(/[^\w\-]+/g, '_').slice(0, 40)

  const eintraege: ZipEintrag[] = []

  for (const eintrag of post.medien) {
    const endung = eintrag.medium.dateiname.split('.').pop() ?? 'jpg'
    const basis = post.postenAm
      ? zipDateiname(post.postenAm, post.typ, eintrag.rolle, eintrag.position, post.verhaeltnis)
      : `${stempel}_${eintrag.rolle}${eintrag.rolle === 'SLIDE' ? `_${eintrag.position + 1}` : ''}`

    eintraege.push({ pfad: `${basis}.${endung}`, art: 'datei', quelle: eintrag.medium.pfad })
  }

  // Liegt das Reel nur als Klappe-Fassung vor, hängt am Post kein MEDIUM —
  // dann kommt das Video im Moment des Exports von Klappe. Kunden bekommen
  // die Abspielfassung, das Team das Original.
  if (post.typ === 'REEL' && reelVideoQuelle(post)?.herkunft === 'KLAPPE') {
    eintraege.push({
      pfad: `${stempel}_Reel`,
      art: 'klappe',
      fassungId: post.klappeVersionId!,
      fassung: nutzer ? 'original' : 'proxy',
    })
  }

  eintraege.push({
    pfad: `${stempel}_Caption.txt`,
    art: 'text',
    inhalt: [
      post.titel,
      '',
      `Typ: ${postBezeichnung(post.typ, post.verhaeltnis)}`,
      post.postenAm ? `Termin: ${post.postenAm.toLocaleString('de-DE')}` : 'Termin: noch offen',
      post.laenge ? `Länge: ${post.laenge}` : null,
      '',
      post.caption,
    ]
      .filter((z) => z !== null)
      .join('\n'),
  })

  const wurzel = `${post.kunde.slug}_${stempel}`
  return archivAntwort(schreibeArchiv(eintraege, { wurzel }), `${wurzel}.zip`)
}
