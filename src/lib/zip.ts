import type { MediumRolle, Plattform, PostStatus, PostTyp, Verhaeltnis } from '@prisma/client'
import { zipRollenname, zipStempel } from './format'
import { PLATTFORM_TEXT, sortierePlattformen } from './plattformen'
import { abgeleiteteStufe, PHASE_TEXT, STUFE_TEXT } from './status'
import { fassungFuer, type Hauptbeitrag, type Variante } from './varianten'
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
  /** Ungeplant heißt: kein Zeitstempel — dann trägt der Titel die Namen. */
  postenAm: Date | null
  laenge?: string | null
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

/**
 * Was ein Beitrag im Namen trägt: seinen Termin — oder, ungeplant, seinen
 * Titel. Ungeplante gibt es nur im Haus (`postsImZeitraum` siebt sie aus),
 * aber der Export eines einzelnen Beitrags kommt auch aus dem Editor.
 */
function namensstamm(post: { postenAm: Date | null; titel: string }): string {
  return post.postenAm
    ? zipStempel(post.postenAm)
    : post.titel.replace(/[^\w-]+/g, '_').slice(0, 40) || 'Beitrag'
}

/**
 * `_nichtFinal` an Ordner **und** Dateinamen, solange der Beitrag nicht final
 * ist.
 *
 * Herunterladen darf der Kunde alles, was er sieht — das Konzept so gut wie
 * die fertige Fassung. Nur soll ihm niemand aus Versehen einen Zwischenstand
 * einplanen: Der Ordner allein genügt dafür nicht, denn die Dateien werden
 * einzeln daraus gezogen. Der Hinweis fällt weg, sobald der Beitrag final
 * ist — dann ist die Datei die, die rausgeht.
 */
export function nichtFinalZusatz(status: PostStatus): string {
  return status === 'FINAL' ? '' : '_nichtFinal'
}

/** Ordnername eines Beitrags: `260805_1100_Reel`, ggf. mit `_nichtFinal`. */
export function zipPostOrdner(post: {
  typ: PostTyp
  verhaeltnis: Verhaeltnis
  status: PostStatus
  postenAm: Date | null
  titel: string
}): string {
  const name = `${namensstamm(post)}_${postBezeichnung(post.typ, post.verhaeltnis)}`
  return `${name}${nichtFinalZusatz(post.status)}`
}

export type ZipOptionen = {
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
  /**
   * Ohne Ordner je Beitrag — für den Export eines **einzelnen** Beitrags.
   * Dieselbe Überlegung wie bei der Plattformebene: Ein Ordner, in dem nur
   * ein Beitrag steht, ist eine Ebene ohne Aussage.
   */
  ohnePostOrdner?: boolean
  /**
   * Die Textdatei spricht die Sprache des Kunden: vier Stufen statt sechs.
   * Die Wörter „Produktion" und „Korrektur" stehen auf seiner Seite nirgends
   * — in einer Datei, die er auf die Platte legt, erst recht nicht.
   */
  alsKundensicht?: boolean
}

export function zipEintraege(posts: ZipPost[], optionen: ZipOptionen): ZipEintrag[] {
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
  optionen: ZipOptionen,
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
    // Der Video-Platz der Fassung, nicht der des Beitrags: Eine Fassung mit
    // eigenem Klappe-Schnitt bekäme sonst im ZIP das Video der anderen.
    const klappeVersionId = fassung ? fassung.klappeVersionId : post.klappeVersionId

    const stamm = namensstamm(post)
    const zusatz = nichtFinalZusatz(post.status)
    const ordner = optionen.ohnePostOrdner
      ? wurzel
      : `${wurzel}${zipPostOrdner({ ...post, verhaeltnis })}/`

    for (const eintrag of medien) {
      const rolle = zipRollenname(post.typ, eintrag.rolle, eintrag.position, verhaeltnis)
      const endung = eintrag.medium.dateiname.split('.').pop() ?? 'jpg'
      eintraege.push({
        pfad: `${ordner}${stamm}_${rolle}${zusatz}.${endung}`,
        art: 'datei',
        quelle: eintrag.medium.pfad,
      })
    }

    // Ein Reel, dessen Video nur als Klappe-Fassung vorliegt, kommt im Moment
    // des Abrufs von dort. Liegt ein eigenes Video am Beitrag, gilt das — sonst
    // lägen zwei Videos im Ordner und keines wäre erkennbar das gültige.
    const hatEigenesMedium = medien.some((m) => m.rolle === 'MEDIUM')
    if (post.typ === 'REEL' && klappeVersionId && !hatEigenesMedium) {
      eintraege.push({
        // Die Endung kennt erst die Antwort aus Klappe.
        pfad: `${ordner}${stamm}_${zipRollenname(post.typ, 'MEDIUM', 0, verhaeltnis)}${zusatz}`,
        art: 'klappe',
        fassungId: klappeVersionId,
        // Das Team bekommt das Original, der Kunde die Abspielfassung.
        fassung: optionen.klappeFassung ?? 'original',
      })
    }

    if (optionen.mitCaptions) {
      eintraege.push({
        pfad: `${ordner}${stamm}_Caption${zusatz}.txt`,
        art: 'text',
        inhalt: captionText({ ...post, caption, verhaeltnis }, optionen.alsKundensicht ?? false),
      })
    }
  }

  return eintraege
}

function captionText(post: ZipPost, alsKundensicht: boolean): string {
  const stand = alsKundensicht
    ? STUFE_TEXT[abgeleiteteStufe(post.status, post.postenAm)]
    : PHASE_TEXT[post.status]

  return [
    post.titel,
    '',
    `Typ: ${postBezeichnung(post.typ, post.verhaeltnis)}`,
    post.postenAm ? `Termin: ${post.postenAm.toLocaleString('de-DE')}` : 'Termin: noch offen',
    post.laenge ? `Länge: ${post.laenge}` : null,
    `Status: ${stand}`,
    '',
    post.caption,
  ]
    .filter((zeile) => zeile !== null)
    .join('\n')
}

/**
 * Braucht der Download eine Plattformwahl — und wenn ja, worüber?
 *
 * Gefragt wird nur, wenn es etwas zu entscheiden gibt: Sind die Beiträge auf
 * allen Plattformen gleich, ist die Wahl eine Frage ohne Unterschied, und der
 * Download liefert das Hauptformat, ein Ordner je Beitrag. Weicht dagegen
 * irgendwo eine Fassung ab, hängt es von der Plattform ab, welche Datei die
 * richtige ist.
 *
 * Zwei Stufen der Antwort:
 *
 * · `wahl: false, plattformen: []` — alles gleich, nichts zu fragen.
 * · `wahl: false, plattformen: ['LINKEDIN']` — es weicht etwas ab, aber es
 *   gibt nur **eine** Plattform. Ein Fenster mit einem Kästchen wäre ein
 *   Klick ohne Entscheidung; genommen wird ihre Fassung.
 * · `wahl: true` — mehrere Plattformen mit unterschiedlichem Inhalt.
 *
 * Abgeglichen wird mit `fassungFuer`, nicht mit einer eigenen Regel: Ob eine
 * Fassung wirklich abweicht, entscheidet dieselbe Stelle, die sie später auch
 * ins Archiv legt. Eine leere Fassung erbt alles und zählt deshalb nicht.
 */
export function zipPlattformwahl(
  posts: Array<
    Hauptbeitrag<unknown> & {
      plattformen: readonly Plattform[]
      /*
        `unknown[]` statt der echten Medienzeile: Gefragt ist hier nur, **ob**
        eine Fassung eigene Medien hat, nie was darin steht. Mit einem
        Typparameter müssten Beitrag und Fassung dieselbe Medienzeile tragen —
        sie kommen aber aus zwei Tabellen und unterscheiden sich in genau
        einer Spalte.
      */
      varianten: Array<Variante<unknown>>
    }
  >,
): { wahl: boolean; plattformen: Plattform[] } {
  const alle = new Set<Plattform>()
  let abweichung = false

  for (const post of posts) {
    for (const plattform of post.plattformen) {
      alle.add(plattform)
      const fassung = fassungFuer(post, post.varianten, plattform)
      if (fassung.eigeneCaption || fassung.eigeneMedien) abweichung = true
    }
  }

  const plattformen = sortierePlattformen([...alle])
  if (!abweichung) return { wahl: false, plattformen: [] }
  return { wahl: plattformen.length > 1, plattformen }
}
