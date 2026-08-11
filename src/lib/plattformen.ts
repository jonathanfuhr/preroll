import type { Plattform } from '@prisma/client'

/**
 * Die Plattformen, auf die Preroll veröffentlicht.
 *
 * `gebaut` trennt, was heute funktioniert, von dem, was im Datenmodell schon
 * einen Platz hat. LinkedIn und YouTube stehen im Enum, damit sie später ohne
 * Migration danebenpassen — in der Oberfläche haben sie bis dahin nichts
 * verloren. Wer eine Auswahl baut, filtert auf `gebaut`; wer einen
 * gespeicherten Wert anzeigt, nimmt `PLATTFORM_TEXT` und trifft damit auch
 * die noch nicht gebauten.
 */
export type PlattformInfo = {
  name: string
  gebaut: boolean
}

export const PLATTFORMEN: Record<Plattform, PlattformInfo> = {
  FACEBOOK: { name: 'Facebook', gebaut: true },
  INSTAGRAM: { name: 'Instagram', gebaut: true },
  LINKEDIN: { name: 'LinkedIn', gebaut: false },
  YOUTUBE: { name: 'YouTube', gebaut: false },
}

export const PLATTFORM_TEXT: Record<Plattform, string> = {
  FACEBOOK: 'Facebook',
  INSTAGRAM: 'Instagram',
  LINKEDIN: 'LinkedIn',
  YOUTUBE: 'YouTube',
}

/** Was heute wirklich bespielt werden kann. */
export const GEBAUTE_PLATTFORMEN = (Object.keys(PLATTFORMEN) as Plattform[]).filter(
  (p) => PLATTFORMEN[p].gebaut,
)

/**
 * Immer dieselbe Reihenfolge, egal wie die Werte in die Datenbank kamen.
 * Zwei Beiträge mit denselben Plattformen sollen nicht einmal „Instagram,
 * Facebook" und einmal „Facebook, Instagram" anzeigen — das liest sich wie
 * ein Unterschied, wo keiner ist.
 */
const REIHENFOLGE = Object.keys(PLATTFORMEN) as Plattform[]

export function sortierePlattformen(werte: readonly Plattform[]): Plattform[] {
  return REIHENFOLGE.filter((p) => werte.includes(p))
}

/**
 * Die angehakten Plattformen aus einem Formular — gefiltert auf das, was es
 * wirklich gibt und was gebaut ist.
 *
 * Ein leeres Ergebnis ist eine gültige Antwort und heißt „Preroll postet das
 * nicht". Wo das von „Feld war gar nicht im Formular" unterschieden werden
 * muss, steht daneben ein verstecktes Merkerfeld — dieselbe Linie wie beim
 * Referenz-Link im Medien-Dialog.
 */
export function plattformenAusFormular(formular: FormData, feld = 'plattformen'): Plattform[] {
  const roh = formular.getAll(feld).map(String)
  return GEBAUTE_PLATTFORMEN.filter((p) => roh.includes(p))
}

/**
 * Wohin ein Beitrag wirklich geht: die Wahl, geschnitten mit dem, was der
 * Zugang hergibt.
 *
 * Die Wahl am Beitrag ist die **Absicht**, die Zuordnung am Kunden die
 * **Möglichkeit**. Ein angehaktes Facebook ohne zugeordnete Seite ergibt
 * deshalb keine Veröffentlichung — und auch keinen Fehlschlag; es passiert
 * schlicht nichts, und in den Stammdaten steht, warum. Ein Fehlschlag wäre
 * hier die falsche Auskunft: Nicht das Posten ist misslungen, es war nie
 * eines möglich.
 *
 * LinkedIn und YouTube fallen bis auf Weiteres heraus. Sie stehen im Enum,
 * damit sie später ohne Migration danebenpassen — ein Ziel sind sie erst,
 * wenn es dafür auch einen Zugang gibt.
 */
export function zielPlattformen(
  gewaehlt: readonly Plattform[],
  kanaele: { fbSeitenId: string | null; igKontoId: string | null },
): Plattform[] {
  return sortierePlattformen(gewaehlt).filter((p) => {
    if (p === 'FACEBOOK') return Boolean(kanaele.fbSeitenId)
    if (p === 'INSTAGRAM') return Boolean(kanaele.igKontoId)
    return false
  })
}

/**
 * Facebook und Instagram teilen sich einen Zugang: Das Instagram-Konto hängt
 * an der Facebook-Seite, und der Seiten-Token bedient beide. Wer später
 * LinkedIn ergänzt, bekommt hier einen eigenen Eintrag — die Zuordnung
 * „welcher Zugang bedient welche Plattform" gehört an eine Stelle.
 */
export function zugangsPlattform(plattform: Plattform): Plattform {
  return plattform === 'INSTAGRAM' ? 'FACEBOOK' : plattform
}
