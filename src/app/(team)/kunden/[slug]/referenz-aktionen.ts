'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { aktuellerNutzer } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { loescheMedium } from '@/lib/medien'
import { brichReferenzDownloadAb, starteReferenzDownload } from '@/lib/referenz-auftrag'

/**
 * Stößt den Download an und kehrt sofort zurück. Gearbeitet wird im
 * Hintergrund — der Editor zeigt den Fortschritt und lässt sich derweil
 * schließen. Warum kein Worker: siehe `src/lib/referenz-auftrag.ts`.
 */
export async function referenzvideoLaden(postId: string) {
  const nutzer = await aktuellerNutzer()
  if (!nutzer) redirect('/anmelden')

  const post = await prisma.post.findUniqueOrThrow({
    where: { id: postId },
    select: { referenzVideoUrl: true, kunde: { select: { slug: true } } },
  })

  if (!post.referenzVideoUrl) {
    redirect(`/kunden/${post.kunde.slug}/posts/${postId}?referenz=kein-link`)
  }

  await starteReferenzDownload(postId)
  revalidatePath(`/kunden/${post.kunde.slug}`, 'layout')
}

export async function referenzvideoEntfernen(postId: string) {
  const nutzer = await aktuellerNutzer()
  if (!nutzer) redirect('/anmelden')

  const post = await prisma.post.findUniqueOrThrow({
    where: { id: postId },
    include: { kunde: true, referenzVideoMedium: true },
  })

  await brichReferenzDownloadAb(postId)
  await prisma.post.update({
    where: { id: postId },
    data: {
      referenzVideoMediumId: null,
      referenzVideoPfad: null,
      referenzVideoStand: null,
      referenzVideoFortschritt: 0,
      referenzVideoMeldung: null,
    },
  })
  if (post.referenzVideoMedium) await loescheMedium(post.referenzVideoMedium).catch(() => {})

  revalidatePath(`/kunden/${post.kunde.slug}`, 'layout')
}

/**
 * Link übernehmen und in einem Zug herunterladen — im Medien-Dialog will man
 * beides nicht getrennt anstoßen.
 */
export async function referenzvideoSetzen(postId: string, formular: FormData) {
  const nutzer = await aktuellerNutzer()
  if (!nutzer) redirect('/anmelden')

  const url = String(formular.get('referenzVideoUrl') ?? '').trim()
  const titel = String(formular.get('referenzVideoTitel') ?? '').trim()

  const post = await prisma.post.findUniqueOrThrow({
    where: { id: postId },
    select: { kunde: { select: { slug: true } } },
  })

  await prisma.post.update({
    where: { id: postId },
    data: {
      referenzVideoUrl: url === '' ? null : url,
      referenzVideoTitel: titel === '' ? null : titel,
    },
  })

  if (url === '') {
    revalidatePath(`/kunden/${post.kunde.slug}`, 'layout')
    return
  }

  await referenzvideoLaden(postId)
}
