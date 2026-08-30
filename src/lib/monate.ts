import type { PostStatus } from '@prisma/client'
import { alsMonat, monatsgrenzen, monatsTitel } from './datum'

/**
 * Welche Monate ein Kunde hat — abgeleitet aus seinen Beiträgen.
 *
 * Vorher war jeder Monat eine Zeile in der Datenbank (`Export` mit Zeitraum),
 * und die Navigation des Kunden war die Liste dieser Zeilen. Das hieß: Ein
 * Monat, für den niemand eine Freigabe angelegt hatte, war für den Kunden
 * unerreichbar — auch wenn Beiträge darin standen. Umgekehrt stand ein leerer
 * Monat in der Leiste, weil jemand ihn angelegt hatte.
 *
 * Der Monat ist keine Eigenschaft des Zugangs, sondern eine Sicht auf die
 * Beiträge. Also wird er aus ihnen gerechnet: Ein Monat existiert, sobald er
 * einen vorzeigbaren Beitrag mit Termin enthält.
 */

export type MonatMitStand = {
  /** `2026-08` — der Wert in der Adresse. */
  monat: string
  /** „August 2026" — die Beschriftung. */
  titel: string
  von: Date
  bis: Date
}

type ZaehlbarerPost = {
  postenAm: Date | null
  status: PostStatus
}

/**
 * Die Monate eines Kunden, neueste zuerst.
 *
 * `ENTWURF` zählt nicht mit: Solche Beiträge verlassen das Haus nie, und ein
 * Monat, der nur aus ihnen besteht, wäre beim Kunden eine leere Seite.
 */
export function monateAusPosts(
  posts: ZaehlbarerPost[],
  mitEntwuerfen = false,
): MonatMitStand[] {
  const gesehen = new Set<string>()

  for (const post of posts) {
    if (!post.postenAm) continue
    if (post.status === 'ENTWURF' && !mitEntwuerfen) continue
    gesehen.add(alsMonat(post.postenAm))
  }

  return [...gesehen]
    .sort()
    .reverse()
    .map((monat) => {
      const grenzen = monatsgrenzen(monat)!
      return { monat, titel: monatsTitel(grenzen.von), von: grenzen.von, bis: grenzen.bis }
    })
}

/**
 * Welcher Monat gezeigt wird, wenn die Adresse keinen nennt.
 *
 * Der **neueste**, in dem etwas steht. Wer einen Freigabelink bekommt, will
 * den Plan sehen, für den er ihn bekommen hat — und das ist der aktuellste.
 * Die älteren stehen daneben in der Leiste.
 *
 * Gibt es überhaupt keinen Monat mit Beiträgen, tritt der laufende an seine
 * Stelle: Eine Seite mit leerem Kalender ist verständlicher als eine
 * Fehlermeldung.
 */
export function gewaehlterMonat(
  monate: MonatMitStand[],
  gewuenscht: string | undefined,
  heute: Date,
): MonatMitStand {
  const treffer = gewuenscht && monate.find((m) => m.monat === gewuenscht)
  if (treffer) return treffer

  if (monate.length > 0) return monate[0]

  const jetzt = alsMonat(heute)
  const grenzen = monatsgrenzen(jetzt)!
  return { monat: jetzt, titel: monatsTitel(grenzen.von), von: grenzen.von, bis: grenzen.bis }
}
