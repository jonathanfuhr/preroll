import type { PostStatus } from '@prisma/client'

/**
 * Welche Phasen der Kunde sieht — und welche nur nach innen wirken.
 *
 * Zwischen Konzept und Vorschau wird gedreht und gestaltet, zwischen Vorschau
 * und Final nachgebessert. Vorher schaute der Kunde dabei live zu: Ein halb
 * ausgetauschtes Karussell, eine Caption mitten im Umschreiben, ein Bild, das
 * gerade durch ein besseres ersetzt wird. Das ist keine Arbeitsgrundlage,
 * sondern eine Einladung zur Rückfrage.
 *
 * Deshalb zwei Sorten Phase:
 *
 * - **sichtbar** (Konzept, Vorschau, Final) — beim Eintritt wird der Stand
 *   festgeschrieben; der Kunde sieht genau diesen.
 * - **Arbeit** (Entwurf, Produktion, Korrektur) — der Kunde sieht weiter den
 *   Stand der **vorangehenden** sichtbaren Phase.
 *
 * Dass die Vorgängerin gilt und nicht „der letzte Stand", ist der Punkt, an
 * dem eine einfachere Lösung falsch wird: Von Vorschau zurück auf Produktion
 * soll der Kunde wieder das **Konzept** sehen, nicht die Vorschau, die er
 * gerade kommentiert hat.
 *
 * `ENTWURF` ist auch eine Arbeitsphase, hat aber keine Vorgängerin — er
 * verlässt das Haus ohnehin nie (`postsImZeitraum` siebt ihn aus).
 */

/** Die Phasen in der Reihenfolge, in der ein Beitrag sie durchläuft. */
export const PHASENFOLGE = [
  'ENTWURF',
  'KONZEPT',
  'PRODUKTION',
  'VORSCHAU',
  'KORREKTUR',
  'FINAL',
] as const satisfies readonly PostStatus[]

/** Phasen, deren Eintritt einen Stand festschreibt. */
export const SICHTBARE_PHASEN = ['KONZEPT', 'VORSCHAU', 'FINAL'] as const
export type SichtbarePhase = (typeof SICHTBARE_PHASEN)[number]

/** Phasen, in denen gearbeitet wird und der Kunde den Stand davor sieht. */
export const ARBEITSPHASEN = ['ENTWURF', 'PRODUKTION', 'KORREKTUR'] as const
export type Arbeitsphase = (typeof ARBEITSPHASEN)[number]

export function istSichtbarePhase(phase: PostStatus): phase is SichtbarePhase {
  return (SICHTBARE_PHASEN as readonly PostStatus[]).includes(phase)
}

export function istArbeitsphase(phase: PostStatus): phase is Arbeitsphase {
  return !istSichtbarePhase(phase)
}

/**
 * Welcher Stand in dieser Phase gilt.
 *
 * In einer sichtbaren Phase ihr eigener; in einer Arbeitsphase der der
 * vorangehenden sichtbaren. Im Entwurf gibt es keine — dort ist noch nichts
 * gezeigt worden.
 */
export function geltendePhase(phase: PostStatus): SichtbarePhase | null {
  if (istSichtbarePhase(phase)) return phase

  const i = PHASENFOLGE.indexOf(phase as (typeof PHASENFOLGE)[number])
  for (let j = i - 1; j >= 0; j--) {
    const vor = PHASENFOLGE[j]
    if (istSichtbarePhase(vor)) return vor
  }
  return null
}

/**
 * Was in der Oberfläche neben dem Etikett steht, solange gearbeitet wird —
 * „Produktion · Kunde sieht Konzept". Ohne den Zusatz wäre die neue Phase eine
 * Angabe über uns; mit ihm ist sie eine Angabe über den Kunden, und genau
 * darum geht es.
 */
export function arbeitsphaseHinweis(phase: PostStatus): string | null {
  if (istSichtbarePhase(phase)) return null
  const gilt = geltendePhase(phase)
  if (!gilt) return 'Kunde sieht nichts'
  return `Kunde sieht ${gilt === 'KONZEPT' ? 'Konzept' : gilt === 'VORSCHAU' ? 'Vorschau' : 'Final'}`
}
