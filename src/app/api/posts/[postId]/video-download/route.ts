import type { NextRequest } from 'next/server'
import { aktuellerNutzer } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { leseVideoPlatz, platzAus } from '@/lib/video-platz'

/**
 * Stand des Video-Downloads. Der Editor fragt hier im Sekundentakt nach,
 * solange etwas läuft — schlicht und ausreichend für eine Handvoll Downloads
 * am Tag; ein offener Kanal wäre mehr Technik als Nutzen. Ist der Download
 * fertig, hängt das Video als MEDIUM am Video-Platz; die Seite lädt dann
 * einmal nach, mehr braucht es hier nicht.
 *
 * `?variante=` fragt nach dem Platz einer Fassung. Sie hat ihren eigenen —
 * sonst zeigte der Balken einer LinkedIn-Fassung den Fortschritt des
 * Instagram-Videos.
 */
export async function GET(
  anfrage: NextRequest,
  { params }: { params: Promise<{ postId: string }> },
) {
  if (!(await aktuellerNutzer())) {
    return Response.json({ fehler: 'Nicht angemeldet.' }, { status: 401 })
  }

  const { postId } = await params
  const varianteId = anfrage.nextUrl.searchParams.get('variante')

  // Die Fassung muss zu diesem Beitrag gehören — sonst ließe sich über eine
  // fremde Kennung der Stand eines anderen Kunden abfragen.
  if (varianteId) {
    const gehoert = await prisma.postVariante.findFirst({
      where: { id: varianteId, postId },
      select: { id: true },
    })
    if (!gehoert) return Response.json({ fehler: 'Fassung nicht gefunden.' }, { status: 404 })
  }

  const stand = await leseVideoPlatz(platzAus(postId, varianteId))
  if (!stand) return Response.json({ fehler: 'Post nicht gefunden.' }, { status: 404 })

  return Response.json({
    stand: stand.videoDownloadStand,
    fortschritt: stand.videoDownloadFortschritt,
    meldung: stand.videoDownloadMeldung,
  })
}
