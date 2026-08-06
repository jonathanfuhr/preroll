import type { NextRequest } from 'next/server'
import { aktuellerNutzer } from '@/lib/auth'
import { prisma } from '@/lib/db'

/**
 * Stand des Video-Downloads. Der Editor fragt hier im Sekundentakt nach,
 * solange etwas läuft — schlicht und ausreichend für eine Handvoll Downloads
 * am Tag; ein offener Kanal wäre mehr Technik als Nutzen. Ist der Download
 * fertig, hängt das Video als MEDIUM am Post; die Seite lädt dann einmal
 * nach, mehr braucht es hier nicht.
 */
export async function GET(
  _anfrage: NextRequest,
  { params }: { params: Promise<{ postId: string }> },
) {
  if (!(await aktuellerNutzer())) {
    return Response.json({ fehler: 'Nicht angemeldet.' }, { status: 401 })
  }

  const { postId } = await params
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: {
      videoDownloadStand: true,
      videoDownloadFortschritt: true,
      videoDownloadMeldung: true,
    },
  })
  if (!post) return Response.json({ fehler: 'Post nicht gefunden.' }, { status: 404 })

  return Response.json({
    stand: post.videoDownloadStand,
    fortschritt: post.videoDownloadFortschritt,
    meldung: post.videoDownloadMeldung,
  })
}
