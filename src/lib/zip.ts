import type { MediumRolle, Plattform, PostStatus, PostTyp, Verhaeltnis } from '@prisma/client'
import { zipDateiname, zipStempel } from './format'
import { PLATTFORM_TEXT, sortierePlattformen } from './plattformen'
import { fassungFuer, type Variante } from './varianten'
import { postBezeichnung } from './verhaeltnis'

/**
 * Was in ein ZIP kommt und unter welchem Namen — getrennt vom Schreiben.
 *
 * Der Aufbau folgt dem Beitrag, nicht der Kalenderwoche. Nach KW gegliedert
 * lagen die Dateien mehrerer Beiträge nebeneinander, und wer sie in einen
 * Zeitplaner zog, musste sie am Zeitstempel auseinanderhalten. Ein Ordner je
 * Beitrag ist die Einheit, in der auch gearbeitet wird.
 *
 * Die Namen der Dateien bleiben unverändert — sie sind eindeutig, und wer sie
 * aus dem Ordner zieht, hat den Termin weiterhin am Namen.
 */

export type ZipMedium = {
  rolle: MediumRolle
  position: number
  medium: { pfad: string; dateiname: string }
}

export type ZipPost = {
  id: string
  typ: PostTyp
  verhaeltnis: Verhaeltnis
  status: PostStatus
  titel: string
  caption: string
  postenAm: Date
  klappeVersionId: string | null
  medien: ZipMedium[]
  /** Wohin der Beitrag geht — nur nötig, wenn nach Plattform getrennt wird. */
  plattformen?: Plattform[]
  /** Abweichende Fassungen je Plattform, sonst leer. */
  varianten?: Variante<ZipMedium>[]
}

export type ZipEintrag =
  /** Eine Datei aus der Medienablage; `quelle` ist der Pfad unterhalb der Wurzel. */
  | { pfad: string; art: 'datei'; quelle: string }
  | { pfad: string; art: 'text'; inhalt: string }
  /** Fertig erzeugter Inhalt, etwa das Kommentar-PDF. */
  | { pfad: string; art: 'puffer'; inhalt: Buffer }
  /** Wird erst beim Schreiben geholt — siehe `klappeMedienUrl`. */
  | { pfad: string; art: 'klappe'; fassungId: string; fassung: 'original' | 'proxy' }

/** Ordnername eines Beitrags: `260805_1100_Reel`. */
export function zipPostOrdner(post: {
  typ: PostTyp
  verhaeltnis: Verhaeltnis
  postenAm: Date
}): string {
  return `${zipStempel(post.postenAm)}_${postBezeichnung(post.typ, post.verhaeltnis)}`
}

export function zipEintraege(
  posts: ZipPost[],
  optionen: {
    mitCaptions: boolean
    klappeFassung?: 'original' | 'proxy'
    /**
     * Für welche Plattformen exportiert wird.
     *
     * Leer heißt „wie bisher": ein Ordner je Beitrag, das Hauptformat, keine
     * Plattformebene. Mit **einer** Plattform bleibt es bei dieser Struktur —
     * ein Ordner, in dem nur „Instagram" steht, ist eine Ebene ohne Aussage.
     * Erst ab zwei kommt sie dazu, weil dann dieselben Beiträge mehrfach
     * vorkommen und nur der Ordner sie auseinanderhält.
     */
    plattformen?: readonly Plattform[]
  },
): ZipEintrag[] {
  const ziele = sortierePlattformen(optionen.plattformen ?? [])
  if (ziele.length === 0) return fuerFassung(posts, optionen, null, '')

  const mitOrdner = ziele.length > 1
  const eintraege: ZipEintrag[] = []

  for (const plattform of ziele) {
    // Nur Beiträge, die diese Plattform auch ansteuern. Ein Beitrag, der
    // ausdrücklich nicht auf Facebook geht, hat im Facebook-Ordner nichts
    // verloren — auch nicht „sicherheitshalber".
    const passend = posts.filter((p) => (p.plattformen ?? []).includes(plattform))
    const wurzel = mitOrdner ? `${PLATTFORM_TEXT[plattform]}/` : ''
    eintraege.push(...fuerFassung(passend, optionen, plattform, wurzel))
  }

  return eintraege
}

/**
 * Die Einträge für **eine** Sicht auf die Beiträge: entweder das Hauptformat
 * (`plattform === null`) oder die Fassung einer Plattform.
 *
 * Gerechnet wird die Fassung mit `fassungFuer` — derselben Regel, nach der die
 * Kundenseite anzeigt. Ein zweiter Weg im ZIP hieße, dass der Kunde etwas
 * freigibt und etwas anderes ins Archiv kommt.
 */
function fuerFassung(
  posts: ZipPost[],
  optionen: { mitCaptions: boolean; klappeFassung?: 'original' | 'proxy' },
  plattform: Plattform | null,
  wurzel: string,
): ZipEintrag[] {
  const eintraege: ZipEintrag[] = []

  for (const post of posts) {
    const fassung = plattform
      ? fassungFuer(post, post.varianten ?? [], plattform)
      : null

    const verhaeltnis = fassung?.verhaeltnis ?? post.verhaeltnis
    const medien = fassung?.medien ?? post.medien
    const caption = fassung?.caption ?? post.caption
    const ordner = `${wurzel}${zipPostOrdner({ ...post, verhaeltnis })}`

    for (const eintrag of medien) {
      const basis = zipDateiname(
        post.postenAm,
        post.typ,
        eintrag.rolle,
        eintrag.position,
        verhaeltnis,
      )
      const endung = eintrag.medium.dateiname.split('.').pop() ?? 'jpg'
      eintraege.push({
        pfad: `${ordner}/${basis}.${endung}`,
        art: 'datei',
        quelle: eintrag.medium.pfad,
      })
    }

    // Ein Reel, dessen Video nur als Klappe-Fassung vorliegt, kommt im Moment
    // des Abrufs von dort. Liegt ein eigenes Video am Beitrag, gilt das — sonst
    // lägen zwei Videos im Ordner und keines wäre erkennbar das gültige.
    const hatEigenesMedium = medien.some((m) => m.rolle === 'MEDIUM')
    if (post.typ === 'REEL' && post.klappeVersionId && !hatEigenesMedium) {
      eintraege.push({
        // Die Endung kennt erst die Antwort aus Klappe.
        pfad: `${ordner}/${zipDateiname(post.postenAm, 'REEL', 'MEDIUM', 0, verhaeltnis)}`,
        art: 'klappe',
        fassungId: post.klappeVersionId,
        // Das Team bekommt das Original, der Kunde die Abspielfassung.
        fassung: optionen.klappeFassung ?? 'original',
      })
    }

    if (optionen.mitCaptions) {
      eintraege.push({
        pfad: `${ordner}/${zipStempel(post.postenAm)}_Caption.txt`,
        art: 'text',
        inhalt: captionText({ ...post, caption, verhaeltnis }),
      })
    }
  }

  return eintraege
}

function captionText(post: ZipPost): string {
  return [
    post.titel,
    '',
    `Typ: ${postBezeichnung(post.typ, post.verhaeltnis)}`,
    `Termin: ${post.postenAm.toLocaleString('de-DE')}`,
    `Status: ${post.status}`,
    '',
    post.caption,
  ].join('\n')
}
