import type { MediumRolle } from '@prisma/client'
import { medienUrl } from './urls'

/**
 * Der eine Video-Platz eines Reels — gefüllt auf einem von drei Wegen:
 * Upload und Link-Download hängen ein MEDIUM an den Post, Klappe wird nicht
 * kopiert, sondern als Stream eingebettet (`/api/klappe`).
 *
 * Das MEDIUM gewinnt: Wer hochlädt oder von einem Link lädt, ersetzt die Wahl
 * davor. Umgekehrt räumt „Aus Klappe holen" das MEDIUM weg (`holeFassung`) —
 * so zeigt der Platz immer die zuletzt getroffene Entscheidung, ohne dass
 * irgendwo ein Zeitstempel verglichen werden müsste.
 */
export type VideoQuelle = { url: string; herkunft: 'MEDIUM' | 'KLAPPE' }

export function reelVideoQuelle(post: {
  medien: Array<{ rolle: MediumRolle; mediumId: string; medium: { mimeTyp: string } }>
  klappeVersionId: string | null
}): VideoQuelle | null {
  const eigenes = post.medien.find(
    (m) => m.rolle === 'MEDIUM' && m.medium.mimeTyp.startsWith('video/'),
  )
  if (eigenes) return { url: medienUrl(eigenes.mediumId)!, herkunft: 'MEDIUM' }

  if (post.klappeVersionId) {
    return { url: `/api/klappe/${post.klappeVersionId}`, herkunft: 'KLAPPE' }
  }

  return null
}
