import type { PostStatus, PostTyp } from '@prisma/client'
import { beginnLokal, endeLokal } from './datum'

export type SichtPost = {
  id: string
  typ: PostTyp
  status: PostStatus
  postenAm: Date
}

export type Sichtregeln = {
  zeitraumVon: Date
  zeitraumBis: Date
  konzepteMitzeigen: boolean
}

// Zeiträume sind reine Datumswerte; Posting-Termine echte Zeitstempel.
// Für den Vergleich zählen die Tagesgrenzen in Ortszeit.
const tagesbeginn = beginnLokal
const tagesende = endeLokal

function sichtbarerStatus(status: PostStatus, konzepteMitzeigen: boolean): boolean {
  return status === 'VORSCHAU' || status === 'FINAL' || konzepteMitzeigen
}

/**
 * Die Posts, die als eigene Sektion auf der Export-Seite erscheinen:
 * alles im Zeitraum, dessen Status freigegeben ist.
 */
export function postsImZeitraum<T extends SichtPost>(posts: T[], regeln: Sichtregeln): T[] {
  const von = tagesbeginn(regeln.zeitraumVon)
  const bis = tagesende(regeln.zeitraumBis)

  return posts
    .filter((p) => p.postenAm >= von && p.postenAm <= bis)
    .filter((p) => sichtbarerStatus(p.status, regeln.konzepteMitzeigen))
    .sort((a, b) => a.postenAm.getTime() - b.postenAm.getTime())
}

/**
 * Die Kacheln der Feed-Vorschau. Zeigt auch ältere, bereits veröffentlichte
 * Posts — aber nichts, was zeitlich nach dem letzten Post des Zeitraums liegt.
 * So sieht der Kunde, wie sein Profil nach der geplanten Periode aussehen wird.
 *
 * Neueste zuerst, damit die erste Kachel oben links landet.
 */
export function feedVorschau<T extends SichtPost>(posts: T[], regeln: Sichtregeln): T[] {
  const sichtbareImZeitraum = postsImZeitraum(posts, regeln)

  // Ohne freigegebene Posts im Zeitraum gäbe es keine Obergrenze — dann zählt
  // das Ende des Zeitraums.
  const letzterImZeitraum =
    sichtbareImZeitraum.at(-1)?.postenAm ?? tagesende(regeln.zeitraumBis)

  const von = tagesbeginn(regeln.zeitraumVon)

  return posts
    .filter((p) => p.postenAm <= letzterImZeitraum)
    // Vor dem Zeitraum: alles zeigen, das ist bereits veröffentlicht.
    // Im Zeitraum: nur, was freigegeben ist.
    .filter((p) => p.postenAm < von || sichtbarerStatus(p.status, regeln.konzepteMitzeigen))
    .sort((a, b) => b.postenAm.getTime() - a.postenAm.getTime())
}

/** Ein Link ist nur bis zum Ablaufdatum begehbar. */
export function istAbgelaufen(gueltigBis: Date | null, jetzt = new Date()): boolean {
  if (!gueltigBis) return false
  return tagesende(gueltigBis) < jetzt
}
