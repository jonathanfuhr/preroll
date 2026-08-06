'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { aktuellerNutzer } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { brichVideoDownloadAb, starteVideoDownload } from '@/lib/video-download'

/**
 * Link übernehmen und in einem Zug herunterladen — im Medien-Dialog will man
 * beides nicht getrennt anstoßen. Das Ergebnis landet als MEDIUM am Post,
 * derselbe Platz wie beim Upload. Gearbeitet wird im Hintergrund; der Editor
 * zeigt den Fortschritt und lässt sich derweil schließen. Warum kein Worker:
 * siehe `src/lib/video-download.ts`.
 *
 * Ein leeres Feld räumt nur den Link und den Download-Stand — ein bereits
 * geladenes Video bleibt am Post, bis es jemand ersetzt.
 */
export async function videoVonLinkLaden(postId: string, formular: FormData) {
  const nutzer = await aktuellerNutzer()
  if (!nutzer) redirect('/anmelden')

  const url = String(formular.get('videoDownloadUrl') ?? '').trim()

  const post = await prisma.post.findUniqueOrThrow({
    where: { id: postId },
    select: { kunde: { select: { slug: true } } },
  })

  // Ein noch laufender Download gehört zum alten Link — er würde sonst später
  // fertig werden und den neuen Stand überschreiben.
  await brichVideoDownloadAb(postId)

  await prisma.post.update({
    where: { id: postId },
    data:
      url === ''
        ? {
            videoDownloadUrl: null,
            videoDownloadStand: null,
            videoDownloadFortschritt: 0,
            videoDownloadMeldung: null,
          }
        : { videoDownloadUrl: url },
  })

  if (url !== '') await starteVideoDownload(postId)
  revalidatePath(`/kunden/${post.kunde.slug}`, 'layout')
}
