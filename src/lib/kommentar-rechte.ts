import type { Rolle } from '@prisma/client'

/**
 * Wer einen Kommentar ändern oder löschen darf: **die eigene Person, sonst
 * nur die Administration.** Ein Kommentar ist eine Äußerung — wer sie
 * nachträglich umschreibt, legt jemandem Worte in den Mund. Das Aufräumen
 * bleibt trotzdem möglich, deshalb die Ausnahme für Admins.
 *
 * „Erledigt" fällt bewusst nicht darunter: Es sagt nichts über den Text,
 * sondern über die Arbeit daran, und die macht das Team.
 */
export type KommentarBesitz = { nutzerId: string | null; gastId: string | null }

export type Betrachter =
  | { art: 'nutzer'; id: string; rolle: Rolle }
  | { art: 'gast'; id: string }

export function darfBearbeiten(kommentar: KommentarBesitz, wer: Betrachter): boolean {
  if (wer.art === 'gast') return kommentar.gastId === wer.id
  return kommentar.nutzerId === wer.id || wer.rolle === 'ADMIN'
}

/** Löschen folgt derselben Regel — wer ändern darf, darf auch löschen. */
export const darfLoeschen = darfBearbeiten

/** Den Stand einer Rückmeldung setzt nur das Team. */
export function darfErledigen(wer: Betrachter): boolean {
  return wer.art === 'nutzer'
}
