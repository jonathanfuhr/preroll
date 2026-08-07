/**
 * Der Monat des Gesamtkalenders steht in der Adresse (`?monat=2026-08`).
 *
 * Anders als der Kundenfilter, der im Browser arbeitet: Für einen anderen
 * Monat müssen andere Zeilen geladen werden, und so lässt sich ein bestimmter
 * Monat auch verschicken oder als Lesezeichen ablegen.
 *
 * Gerechnet wird in **Ortszeit**, nicht in UTC. `Post.postenAm` ist ein
 * Zeitpunkt, kein reines Datum, und der Kalender zeichnet die Tage so, wie sie
 * hier gelten — ein Beitrag am 1. um 00:30 Uhr gehört in die Zelle des Ersten,
 * nicht in die des Vortags.
 */

/** `2026-08` in den ersten Tag des Monats. Unbrauchbares ergibt `null`. */
export function ausMonatsschluessel(wert: string | undefined | null): Date | null {
  if (!wert) return null

  const treffer = /^(\d{4})-(\d{2})$/.exec(wert.trim())
  if (!treffer) return null

  const jahr = Number(treffer[1])
  const nummer = Number(treffer[2])
  // Ohne diese Schranke macht `new Date(2026, 12, 1)` klaglos den Januar 2027
  // — die Adresse zeigte dann etwas anderes an als der Kalender.
  if (nummer < 1 || nummer > 12) return null

  return new Date(jahr, nummer - 1, 1)
}

/** Der Schlüssel zu einem Datum: `2026-08`. */
export function alsMonatsschluessel(monat: Date): string {
  return `${monat.getFullYear()}-${String(monat.getMonth() + 1).padStart(2, '0')}`
}

/** Monate weiter oder zurück. Der Jahreswechsel ergibt sich von selbst. */
export function versetzterMonat(monat: Date, schritte: number): Date {
  return new Date(monat.getFullYear(), monat.getMonth() + schritte, 1)
}
