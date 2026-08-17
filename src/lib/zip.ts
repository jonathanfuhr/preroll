import type { MediumRolle, PostStatus, PostTyp, Verhaeltnis } from '@prisma/client'
import { zipDateiname, zipStempel } from './format'
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
  optionen: { mitCaptions: boolean; klappeFassung?: 'original' | 'proxy' },
): ZipEintrag[] {
  const eintraege: ZipEintrag[] = []

  for (const post of posts) {
    const ordner = zipPostOrdner(post)

    for (const eintrag of post.medien) {
      const basis = zipDateiname(
        post.postenAm,
        post.typ,
        eintrag.rolle,
        eintrag.position,
        post.verhaeltnis,
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
    const hatEigenesMedium = post.medien.some((m) => m.rolle === 'MEDIUM')
    if (post.typ === 'REEL' && post.klappeVersionId && !hatEigenesMedium) {
      eintraege.push({
        // Die Endung kennt erst die Antwort aus Klappe.
        pfad: `${ordner}/${zipDateiname(post.postenAm, 'REEL', 'MEDIUM', 0, post.verhaeltnis)}`,
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
        inhalt: captionText(post),
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
