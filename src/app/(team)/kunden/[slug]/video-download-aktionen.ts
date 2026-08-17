'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { aktuellerNutzer } from '@/lib/auth'
import { brichVideoDownloadAb, starteVideoDownload } from '@/lib/video-download'
import { leseVideoPlatz, platzAus, schreibeVideoPlatz } from '@/lib/video-platz'

/**
 * Link übernehmen und in einem Zug herunterladen — im Medien-Dialog will man
 * beides nicht getrennt anstoßen. Das Ergebnis landet als MEDIUM am
 * Video-Platz, derselbe Platz wie beim Upload. Gearbeitet wird im Hintergrund;
 * der Editor zeigt den Fortschritt und lässt sich derweil schließen. Warum kein
 * Worker: siehe `src/lib/video-download.ts`.
 *
 * Der Platz ist der Beitrag oder eine seiner Fassungen — jede hat ihren
 * eigenen Link. Über den Beitrag geführt zöge ein Download für LinkedIn das
 * Instagram-Video mit um.
 *
 * Ein leeres Feld räumt nur den Link und den Download-Stand — ein bereits
 * geladenes Video bleibt liegen, bis es jemand ersetzt.
 */
export async function videoVonLinkLaden(
  postId: string,
  varianteId: string | null,
  formular: FormData,
) {
  const nutzer = await aktuellerNutzer()
  if (!nutzer) redirect('/anmelden')

  const url = String(formular.get('videoDownloadUrl') ?? '').trim()
  const platz = platzAus(postId, varianteId)

  const stand = await leseVideoPlatz(platz)
  if (!stand) return

  // Ein noch laufender Download gehört zum alten Link — er würde sonst später
  // fertig werden und den neuen Stand überschreiben.
  await brichVideoDownloadAb(platz)

  await schreibeVideoPlatz(
    platz,
    url === ''
      ? {
          videoDownloadUrl: null,
          videoDownloadStand: null,
          videoDownloadFortschritt: 0,
          videoDownloadMeldung: null,
        }
      : { videoDownloadUrl: url },
  )

  if (url !== '') await starteVideoDownload(platz)
  revalidatePath(`/kunden/${stand.kundeSlug}`, 'layout')
}
