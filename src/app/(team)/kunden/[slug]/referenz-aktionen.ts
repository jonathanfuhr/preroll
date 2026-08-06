'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { aktuellerNutzer } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { loescheMedium } from '@/lib/medien'
import { ladeReferenzvideo } from '@/lib/referenzvideo'

/**
 * Lädt das Referenzvideo herunter und legt es lokal ab. Eingebettet wird
 * danach die eigene Kopie — Instagram und YouTube sperren Einbettungen
 * unvorhersehbar, und ein Video, das in der Kundenvorschau nicht läuft, ist
 * schlimmer als keines.
 */
export async function referenzvideoLaden(postId: string) {
  const nutzer = await aktuellerNutzer()
  if (!nutzer) redirect('/anmelden')

  const post = await prisma.post.findUniqueOrThrow({
    where: { id: postId },
    include: { kunde: true, referenzVideoMedium: true },
  })

  if (!post.referenzVideoUrl) {
    redirect(`/kunden/${post.kunde.slug}/posts/${postId}?referenz=kein-link`)
  }

  const ergebnis = await ladeReferenzvideo({
    url: post.referenzVideoUrl,
    kundeId: post.kundeId,
    hochgeladenVonId: nutzer.id,
  })

  if (!ergebnis.ok) {
    redirect(
      `/kunden/${post.kunde.slug}/posts/${postId}?referenz=fehler&meldung=${encodeURIComponent(ergebnis.fehler)}`,
    )
  }

  // Eine frühere Kopie ersetzen, damit die Bibliothek nicht zuwächst.
  const alt = post.referenzVideoMedium
  await prisma.post.update({
    where: { id: postId },
    data: {
      referenzVideoMediumId: ergebnis.medium.id,
      referenzVideoPfad: ergebnis.medium.pfad,
      referenzVideoTitel: post.referenzVideoTitel ?? ergebnis.titel,
    },
  })
  if (alt) await loescheMedium(alt).catch(() => {})

  revalidatePath(`/kunden/${post.kunde.slug}`, 'layout')
}

export async function referenzvideoEntfernen(postId: string) {
  const nutzer = await aktuellerNutzer()
  if (!nutzer) redirect('/anmelden')

  const post = await prisma.post.findUniqueOrThrow({
    where: { id: postId },
    include: { kunde: true, referenzVideoMedium: true },
  })

  await prisma.post.update({
    where: { id: postId },
    data: { referenzVideoMediumId: null, referenzVideoPfad: null },
  })
  if (post.referenzVideoMedium) await loescheMedium(post.referenzVideoMedium).catch(() => {})

  revalidatePath(`/kunden/${post.kunde.slug}`, 'layout')
}
