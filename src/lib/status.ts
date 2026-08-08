import type { PostStatus } from '@prisma/client'

/**
 * Der Stand eines Beitrags, wie ihn der Kunde sieht — vier Stufen statt drei.
 *
 * „Gepostet" wird **berechnet, nicht gespeichert**: Ein Beitrag gilt als
 * veröffentlicht, wenn er auf Final steht und sein Termin vorbei ist. Ein
 * fünfter Wert in der Datenbank müsste irgendwo nachgezogen werden — und
 * könnte dann falsch stehen. So geht er nie mit der Wirklichkeit auseinander;
 * wird ein Termin zurück in die Zukunft gelegt, steht der Beitrag wieder auf
 * Final, was der Sache entspricht.
 */
export const STUFEN = ['KONZEPT', 'VORSCHAU', 'FINAL', 'GEPOSTET'] as const
export type Stufe = (typeof STUFEN)[number]

/**
 * `ENTWURF` hat hier bewusst **kein** Gegenstück. Ein Entwurf verlässt das
 * Haus nicht — für den Kunden beginnt der Weg beim Konzept, und eine
 * Zeitleiste mit einer Stufe, die er nie zu sehen bekommt, wäre nur eine
 * Frage mehr. Aussortiert wird schon in `postsImZeitraum`.
 */

export const STUFE_TEXT: Record<Stufe, string> = {
  KONZEPT: 'Konzept',
  VORSCHAU: 'Vorschau',
  FINAL: 'Final',
  GEPOSTET: 'Gepostet',
}

/**
 * Dieselbe Rechnung fürs Backend — fünf Werte statt vier, weil der Entwurf
 * hier dazugehört.
 *
 * „Gepostet" gab es lange nur beim Kunden. Intern stand ein Beitrag von der
 * Freigabe bis in alle Ewigkeit auf „Final", und ein Monatsrückblick sah aus,
 * als warte alles noch auf seinen Termin. Gerechnet wird deshalb an **einer**
 * Stelle, und `abgeleiteteStufe` ist nur noch die Kundensicht darauf.
 *
 * Weiterhin **nicht gespeichert**: Ein fünfter Wert in `PostStatus` müsste von
 * irgendwem gesetzt werden und stünde falsch, sobald ein Termin nachträglich
 * verschoben wird. So ergibt ein Termin in der Zukunft automatisch wieder
 * „Final" — was der Sache entspricht.
 */
export const ANZEIGEPHASEN = ['ENTWURF', 'KONZEPT', 'VORSCHAU', 'FINAL', 'GEPOSTET'] as const
export type Anzeigephase = (typeof ANZEIGEPHASEN)[number]

export const ANZEIGEPHASE_TEXT: Record<Anzeigephase, string> = {
  ENTWURF: 'Entwurf',
  KONZEPT: 'Konzept',
  VORSCHAU: 'Vorschau',
  FINAL: 'Final',
  GEPOSTET: 'Gepostet',
}

export function anzeigePhase(
  status: PostStatus,
  postenAm: Date | null,
  jetzt = new Date(),
): Anzeigephase {
  if (status !== 'FINAL' || !postenAm) return status
  return postenAm <= jetzt ? 'GEPOSTET' : 'FINAL'
}

export function abgeleiteteStufe(
  status: PostStatus,
  postenAm: Date | null,
  jetzt = new Date(),
): Stufe {
  const phase = anzeigePhase(status, postenAm, jetzt)
  // Entwürfe erreichen den Kunden nie; steht hier doch einer, ist die erste
  // Stufe die ehrlichste Antwort.
  return phase === 'ENTWURF' ? 'KONZEPT' : phase
}

/**
 * Was hinter jeder Stufe steckt — für die Erklärungsbox an der Zeitleiste.
 *
 * Bei Kunden ohne Freigabepflicht (eigene Kanäle) fällt der Satz über die
 * Freigabe weg: Dort gibt es niemanden, der freigeben müsste.
 */
export function stufenErklaerung(stufe: Stufe, mitFreigaben: boolean): string {
  switch (stufe) {
    case 'KONZEPT':
      return mitFreigaben
        ? 'Die Idee steht, gedreht ist noch nicht. Sie sehen Text und Ablauf — Bild und Video kommen nach dem Dreh. Ihre Freigabe hier heißt: So darf es produziert werden.'
        : 'Die Idee steht, gedreht ist noch nicht. Sie sehen Text und Ablauf — Bild und Video kommen nach dem Dreh.'
    case 'VORSCHAU':
      return mitFreigaben
        ? 'Gedreht und gestaltet. Der Beitrag steht so, wie er später erscheinen wird. Ihre Freigabe hier ist die letzte vor der Veröffentlichung.'
        : 'Gedreht und gestaltet. Der Beitrag steht so, wie er später erscheinen wird.'
    case 'FINAL':
      return 'Freigegeben und eingeplant. Wir ändern nichts mehr — der Beitrag wartet auf seinen Termin.'
    case 'GEPOSTET':
      return 'Veröffentlicht. Der Beitrag ist am geplanten Termin online gegangen.'
  }
}

/**
 * Die Reihenfolge, in der ein Beitrag durchs Haus geht. `GEPOSTET` fehlt
 * hier: Das wird berechnet, nicht gesetzt.
 */
export const PHASEN = ['ENTWURF', 'KONZEPT', 'VORSCHAU', 'FINAL'] as const

export const PHASE_TEXT: Record<PostStatus, string> = {
  ENTWURF: 'Entwurf',
  KONZEPT: 'Konzept',
  VORSCHAU: 'Vorschau',
  FINAL: 'Final',
}

/** Die nächste Phase — oder null, wenn der Beitrag am Ende angekommen ist. */
export function naechstePhase(status: PostStatus): PostStatus | null {
  const i = PHASEN.indexOf(status as (typeof PHASEN)[number])
  return i >= 0 && i < PHASEN.length - 1 ? PHASEN[i + 1] : null
}
