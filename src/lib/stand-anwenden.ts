import { istArbeitsphase, geltendePhase } from './phasen'
import { istStandinhalt, standAnwenden, type StandQuelle } from './post-stand'
import type { PostStatus } from '@prisma/client'

/**
 * Die Kundensicht auf einen Beitrag: live, solange die Phase sichtbar ist —
 * und der eingefrorene Stand, sobald gearbeitet wird.
 *
 * Angewendet **einmal**, direkt hinter der Abfrage. Alles danach — Kalender,
 * Profilraster, Geräterahmen, ZIP — bekommt dieselbe Form wie immer und muss
 * von Ständen nichts wissen. Jede Anzeige selbst entscheiden zu lassen, wäre
 * ein Dutzend Stellen, an denen eine den Stand vergisst und der Kunde doch
 * die halbfertige Arbeit sieht.
 *
 * **Ohne Stand gilt live.** Ein Beitrag, der ohne Umweg über Konzept in die
 * Produktion gesetzt wurde, hat keinen — dann ist der aktuelle Inhalt die
 * ehrlichste Auskunft. Dasselbe gilt für einen Datensatz, mit dem sich nichts
 * anfangen lässt: Lieber der falsche Zeitpunkt als eine leere Seite.
 */
export function fuerKundensicht<T extends StandQuelle & { status: PostStatus }>(
  post: T,
  staende: ReadonlyArray<{ phase: PostStatus; inhalt: unknown }>,
): T {
  if (!istArbeitsphase(post.status)) return post

  const gilt = geltendePhase(post.status)
  if (!gilt) return post

  const stand = staende.find((s) => s.phase === gilt)
  if (!stand || !istStandinhalt(stand.inhalt)) return post

  return standAnwenden(post, stand.inhalt)
}
