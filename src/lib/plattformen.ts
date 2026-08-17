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
  LINKEDIN: { name: 'LinkedIn', gebaut: true },
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
 * YouTube fällt bis auf Weiteres heraus. Es steht im Enum, damit es später
 * ohne Migration danebenpasst — ein Ziel ist es erst, wenn es dafür auch einen
 * Zugang gibt.
 *
 * LinkedIn hängt an einer eigenen Zuordnung (`liOrganisationId`) und nicht am
 * Meta-Kanal. Die beiden Anbieter haben nichts miteinander zu tun: Wer eine
 * Facebook-Seite zugeordnet hat, hat damit keine LinkedIn-Seite, und
 * umgekehrt.
 */
export type Kanaele = {
  fbSeitenId: string | null
  igKontoId: string | null
  /** Optional, damit alte Aufrufstellen ohne LinkedIn weiter übersetzen. */
  liOrganisationId?: string | null
}

export function zielPlattformen(
  gewaehlt: readonly Plattform[],
  kanaele: Kanaele,
): Plattform[] {
  return sortierePlattformen(gewaehlt).filter((p) => {
    if (p === 'FACEBOOK') return Boolean(kanaele.fbSeitenId)
    if (p === 'INSTAGRAM') return Boolean(kanaele.igKontoId)
    if (p === 'LINKEDIN') return Boolean(kanaele.liOrganisationId)
    return false
  })
}

/**
 * Was eine Plattform bei diesem Kunden ist.
 *
 * Drei Zustände, weil zwei zu wenig waren: Bis hierher hieß „gewählt"
 * zugleich „Preroll postet das", und wählbar war nur, wofür ein Kanal
 * zugeordnet war. Damit ließ sich der Normalfall nicht ausdrücken — für
 * Instagram planen und von Hand posten. Genau dafür ist `PLANEN` da.
 *
 * `POSTEN` setzt einen Kanal voraus; ohne ihn wäre es ein Versprechen, das
 * niemand halten kann.
 */
export type PlattformModus = 'AUS' | 'PLANEN' | 'POSTEN'

export const MODUS_TEXT: Record<PlattformModus, string> = {
  AUS: 'aus',
  PLANEN: 'nur planen',
  POSTEN: 'planen und posten',
}

export type Plattformwahl = {
  plattformen: readonly Plattform[]
  postenPlattformen: readonly Plattform[]
}

export function modusFuer(kunde: Plattformwahl, plattform: Plattform): PlattformModus {
  if (kunde.postenPlattformen.includes(plattform)) return 'POSTEN'
  if (kunde.plattformen.includes(plattform)) return 'PLANEN'
  return 'AUS'
}

/**
 * Die Wahl aus einem Formular mit einem Auswahlfeld je Plattform.
 *
 * `POSTEN` ohne Kanal wird auf `PLANEN` heruntergestuft, nicht abgewiesen:
 * Das passiert, wenn jemand in einem Zug den Kanal entfernt und den Modus
 * stehen lässt. Ein Fehler wäre hier lästig und die Absicht ist eindeutig —
 * die Plattform bleibt geplant, nur eben von Hand.
 */
export function wahlAusFormular(formular: FormData, kanaele: Kanaele): {
  plattformen: Plattform[]
  postenPlattformen: Plattform[]
} {
  const mitKanal = moeglichePlattformen(kanaele)
  const plattformen: Plattform[] = []
  const postenPlattformen: Plattform[] = []

  for (const p of GEBAUTE_PLATTFORMEN) {
    const modus = String(formular.get(`modus_${p}`) ?? 'AUS')
    if (modus === 'AUS') continue
    plattformen.push(p)
    if (modus === 'POSTEN' && mitKanal.includes(p)) postenPlattformen.push(p)
  }

  return { plattformen: sortierePlattformen(plattformen), postenPlattformen: sortierePlattformen(postenPlattformen) }
}

/**
 * Was an einem Beitrag **angezeigt** wird.
 *
 * Die Marken sind eine Aussage über die Planung: „erscheint auf Instagram und
 * Facebook". Ob Preroll das selbst postet oder jemand von Hand, ändert daran
 * nichts — der Kunde soll sehen, wo sein Beitrag erscheint, nicht wer ihn
 * hochlädt. Deshalb zählt hier `plattformen`, nicht `postenPlattformen`.
 *
 * Gezeigt wird trotzdem nicht `post.plattformen` roh: Die rohe Wahl ist die
 * Absicht und bleibt stehen, auch wenn der Kunde die Plattform später
 * abschaltet. Angezeigt wird der Schnitt mit dem, was heute gilt.
 */
export function angezeigtePlattformen(
  post: { plattformen: readonly Plattform[] },
  kunde: { plattformen: readonly Plattform[] },
): Plattform[] {
  return sortierePlattformen(post.plattformen).filter((p) => kunde.plattformen.includes(p))
}

/**
 * Was bei diesem Kunden einen Kanal hat — und damit für `POSTEN` in Frage
 * kommt. Fürs Planen braucht es keinen.
 */
export function moeglichePlattformen(kanaele: Kanaele): Plattform[] {
  return zielPlattformen(GEBAUTE_PLATTFORMEN, kanaele)
}

/**
 * Was ein Beitrag dieses Kunden überhaupt ansteuern darf: alles, was der
 * Kunde bespielt — mit oder ohne Kanal. Mehr als sein Kunde kann ein Beitrag
 * nie.
 */
export function effektivePlattformen(kunde: { plattformen: readonly Plattform[] }): Plattform[] {
  return sortierePlattformen(kunde.plattformen)
}

/**
 * Wohin Preroll für diesen Beitrag **selbst** postet.
 *
 * Drei Bedingungen, alle nötig: Der Beitrag muss die Plattform wollen, der
 * Kunde muss sie auf „planen und posten" stehen haben, und der Kanal muss da
 * sein. Abgeleitet statt nachgeführt — fällt eine der drei weg, schrumpft das
 * Ergebnis von selbst und steht wieder da, sobald sie zurück ist.
 */
export function postenZiele(
  post: { plattformen: readonly Plattform[] },
  kunde: Plattformwahl & Kanaele,
): Plattform[] {
  return zielPlattformen(post.plattformen, kunde).filter((p) =>
    kunde.postenPlattformen.includes(p),
  )
}

/**
 * Facebook und Instagram teilen sich einen Zugang: Das Instagram-Konto hängt
 * an der Facebook-Seite, und der Seiten-Token bedient beide. LinkedIn hat
 * seinen eigenen — die Zuordnung „welcher Zugang bedient welche Plattform"
 * gehört an eine Stelle.
 */
export function zugangsPlattform(plattform: Plattform): Plattform {
  return plattform === 'INSTAGRAM' ? 'FACEBOOK' : plattform
}
