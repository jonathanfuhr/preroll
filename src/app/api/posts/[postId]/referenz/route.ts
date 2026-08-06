import type { NextRequest } from 'next/server'
import { aktuellerNutzer } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { medienUrl } from '@/lib/urls'

/**
 * Stand des Referenzvideo-Downloads. Der Editor fragt hier im Sekundentakt
 * nach, solange etwas läuft — schlicht und ausreichend für eine Handvoll
 * Downloads am Tag; ein offener Kanal wäre mehr Technik als Nutzen.
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
      referenzVideoStand: true,
      referenzVideoFortschritt: true,
      referenzVideoMeldung: true,
      referenzVideoMediumId: true,
      referenzVideoTitel: true,
    },
  })
  if (!post) return Response.json({ fehler: 'Post nicht gefunden.' }, { status: 404 })

  return Response.json({
    stand: post.referenzVideoStand,
    fortschritt: post.referenzVideoFortschritt,
    meldung: post.referenzVideoMeldung,
    titel: post.referenzVideoTitel,
    mediumUrl: medienUrl(post.referenzVideoMediumId),
  })
}
