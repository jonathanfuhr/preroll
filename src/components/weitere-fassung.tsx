import type { Plattform, Verhaeltnis } from '@prisma/client'

/**
 * Eine abweichende Fassung, wie der Kunde sie sieht.
 *
 * Nur noch ein Typ, kein Bauteil mehr: Seit jede Fassung ihre **eigene Zeile**
 * bekommt — Vorschau links, Text rechts daneben —, wird sie von derselben
 * Stelle gebaut wie das Hauptformat. Ein Sonderweg daneben hätte bedeutet,
 * dass eine Abweichung anders aussieht als der Beitrag, von dem sie abweicht.
 */
export type AnzeigeFassung = {
  plattformen: Plattform[]
  /** Der öffentliche Name auf diesen Plattformen — @handle oder /company/…. */
  handles: string[]
  caption: string
  verhaeltnis: Verhaeltnis
  medien: string[]
  istVideo: boolean
  thumbnail: string | null
  eigeneCaption: boolean
  eigeneMedien: boolean
}
