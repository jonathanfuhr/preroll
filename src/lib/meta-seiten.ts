import type { MetaSeite } from './meta'

/**
 * Die Seiten mehrerer Meta-Zugänge zu **einer** Liste zusammenlegen.
 *
 * Steht hier und nicht in `plattform-zugang.ts`, weil das dort `server-only`
 * ist und damit weder von vitest noch von einem Skript aus erreichbar wäre —
 * dieselbe Linie wie bei `instagram-profil.ts`. Was rechnet, soll prüfbar
 * sein; was die Datenbank anfasst, bleibt daneben.
 */

export type SeiteMitZugang = MetaSeite & {
  zugangId: string
  zugangName: string
}

export type ZugangsSeiten = {
  zugangId: string
  zugangName: string
  seiten: readonly MetaSeite[]
}

/**
 * **Doppelte Seiten fallen weg.** Ist dieselbe Seite zwei Systemnutzern
 * zugewiesen, stünde sie sonst zweimal zur Wahl, ohne dass ein Unterschied
 * sichtbar wäre. Es gewinnt der zuerst übergebene Zugang — bei der üblichen
 * Sortierung nach Alter also der ältere. Willkürlich, aber beständig:
 * Dieselbe Seite landet bei jedem Aufruf am selben Zugang, statt je nach
 * Antwortzeit mal hier und mal dort.
 *
 * Sortiert wird am Ende nach Seitennamen, nicht nach Zugang: Wer einen
 * Kunden einrichtet, sucht seine Seite — aus welchem Portfolio sie kommt,
 * erfährt er daneben, aber danach sucht er nicht.
 */
export function fasseSeitenZusammen(zugaenge: readonly ZugangsSeiten[]): SeiteMitZugang[] {
  const gesehen = new Set<string>()
  const alle: SeiteMitZugang[] = []

  for (const { zugangId, zugangName, seiten } of zugaenge) {
    for (const seite of seiten) {
      if (gesehen.has(seite.id)) continue
      gesehen.add(seite.id)
      alle.push({ ...seite, zugangId, zugangName })
    }
  }

  return alle.sort((a, b) => a.name.localeCompare(b.name, 'de'))
}
