import type { PostStatus, PostTyp } from '@prisma/client'
import { beginnLokal, endeLokal } from './datum'

export type SichtPost = {
  id: string
  typ: PostTyp
  status: PostStatus
  /** Ungeplante Posts (ohne Termin) tauchen in keinem Export auf. */
  postenAm: Date | null
}

/** Ein Post mit Termin — nach dem Aussieben steht das Datum fest. */
type Geplant<T> = T & { postenAm: Date }

function nurGeplante<T extends SichtPost>(posts: T[]): Array<Geplant<T>> {
  return posts.filter((p): p is Geplant<T> => p.postenAm !== null)
}

export type Sichtregeln = {
  zeitraumVon: Date
  zeitraumBis: Date
  /**
   * Entwürfe mitnehmen. Nur für die **interne** Review-Seite: Beim Kunden
   * verlässt ein Entwurf das Haus nie. Ausdrücklich ein Schalter und keine
   * zweite Funktion — sonst stünden zwei fast gleiche Filter nebeneinander,
   * und eine Änderung an der Sichtbarkeit müsste an beide gedacht werden.
   */
  mitEntwuerfen?: boolean
}

// Zeiträume sind reine Datumswerte; Posting-Termine echte Zeitstempel.
// Für den Vergleich zählen die Tagesgrenzen in Ortszeit.
const tagesbeginn = beginnLokal
const tagesende = endeLokal

/**
 * Konzepte werden immer gezeigt — dafür ist die Freigabe schließlich da.
 * Was noch nicht gezeigt werden soll, steht auf `ENTWURF` und verlässt das
 * Haus gar nicht. Früher entschied das ein Schalter je Link; das war eine
 * Einstellung an der falschen Stelle, denn ob ein Beitrag vorzeigbar ist,
 * hängt am Beitrag, nicht am Monat.
 */
function sichtbarerStatus(status: PostStatus, mitEntwuerfen = false): boolean {
  return mitEntwuerfen || status !== 'ENTWURF'
}

/**
 * Die Posts, die als eigene Sektion auf der Export-Seite erscheinen:
 * alles im Zeitraum, dessen Status freigegeben ist.
 */
export function postsImZeitraum<T extends SichtPost>(
  posts: T[],
  regeln: Sichtregeln,
): Array<Geplant<T>> {
  const von = tagesbeginn(regeln.zeitraumVon)
  const bis = tagesende(regeln.zeitraumBis)

  return nurGeplante(posts)
    .filter((p) => p.postenAm >= von && p.postenAm <= bis)
    .filter((p) => sichtbarerStatus(p.status, regeln.mitEntwuerfen))
    .sort((a, b) => a.postenAm.getTime() - b.postenAm.getTime())
}

/**
 * Die Kacheln der Feed-Vorschau. Zeigt auch ältere, bereits veröffentlichte
 * Posts — aber nichts, was zeitlich nach dem letzten Post des Zeitraums liegt.
 * So sieht der Kunde, wie sein Profil nach der geplanten Periode aussehen wird.
 *
 * **Nur Instagram-Beiträge**, sobald `nurFuer` mitgegeben wird. Das Raster ist
 * ein Instagram-Profil; ein Beitrag, der nur auf LinkedIn erscheint, hat darin
 * nichts zu suchen — er würde ein Profil zeigen, das es nicht gibt. Ohne
 * Angabe zählt alles, damit die interne Planung unverändert bleibt.
 *
 * Neueste zuerst, damit die erste Kachel oben links landet.
 */
export function feedVorschau<T extends SichtPost>(
  posts: T[],
  regeln: Sichtregeln,
  nurFuer?: (post: T) => boolean,
): Array<Geplant<T>> {
  const gefiltert = nurFuer ? posts.filter(nurFuer) : posts
  const sichtbareImZeitraum = postsImZeitraum(gefiltert, regeln)

  // Ohne freigegebene Posts im Zeitraum gäbe es keine Obergrenze — dann zählt
  // das Ende des Zeitraums.
  const letzterImZeitraum =
    sichtbareImZeitraum.at(-1)?.postenAm ?? tagesende(regeln.zeitraumBis)

  const von = tagesbeginn(regeln.zeitraumVon)

  return nurGeplante(gefiltert)
    .filter((p) => p.postenAm <= letzterImZeitraum)
    // Vor dem Zeitraum: alles zeigen, das ist bereits veröffentlicht.
    // Im Zeitraum: nur, was freigegeben ist.
    .filter((p) => p.postenAm < von || sichtbarerStatus(p.status, regeln.mitEntwuerfen))
    .sort((a, b) => b.postenAm.getTime() - a.postenAm.getTime())
}
