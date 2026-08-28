import type { MediumRolle, Plattform, PostTyp, Verhaeltnis } from '@prisma/client'

/**
 * Der festgeschriebene Stand eines Beitrags — alles, was die Kundenseite
 * **aus dem Beitrag** rendert, so wie es beim Eintritt in eine sichtbare
 * Phase aussah.
 *
 * ## Was nicht hineingehört
 *
 * **Der Termin.** Wird ein Beitrag in der Produktion umgeplant, soll der Kunde
 * den neuen Termin sehen — sonst stünde der Beitrag in seinem Kalender an
 * einem Tag, an dem er nicht mehr erscheint. Der Termin ist Planung, keine
 * Gestaltung, und wird deshalb immer live gelesen.
 *
 * **Kommentare und Freigaben.** Das eine ist ein Gespräch, das andere ein
 * Zustand; beides läuft weiter, während gearbeitet wird.
 *
 * **Logo, Handle, Followerzahlen.** Die gehören zum Kunden, nicht zum Beitrag.
 *
 * ## Dateien werden nicht kopiert
 *
 * Der Stand hält **Kennungen**. Die Datei bleibt ohnehin in der Bibliothek,
 * auch wenn sie am Beitrag ersetzt wird — das ist eine bestehende Regel und
 * trägt hier. `mimeTyp` reist trotzdem mit: Ohne ihn müsste jedes Lesen eines
 * Standes die Medien nachladen, nur um zu wissen, ob ein Reel-Platz ein Video
 * enthält.
 */

/** Ein Medium, wie es im Stand steht — Kennung plus das, was zum Anzeigen reicht. */
export type StandMedium = {
  rolle: MediumRolle
  position: number
  mediumId: string
  mimeTyp: string
  thumbPfad: string | null
}

export type StandVariante = {
  id: string
  plattformen: Plattform[]
  caption: string | null
  verhaeltnis: Verhaeltnis | null
  position: number
  klappeVersionId: string | null
  medien: StandMedium[]
}

export type StandSzene = {
  id: string
  position: number
  abschnitt: string
  bildSzene: string | null
  sprechertext: string | null
  texteinblendung: string | null
}

/**
 * `fassung` ist die Version des Formats, nicht die des Beitrags. Sie steht da,
 * damit ein alter Stand nach einer Erweiterung erkennbar bleibt: Ein Feld, das
 * es damals nicht gab, ist dann kein Fehler, sondern ein älterer Schnitt.
 */
export type Standinhalt = {
  fassung: 1
  titel: string
  kurzbeschreibung: string | null
  caption: string
  typ: PostTyp
  verhaeltnis: Verhaeltnis
  laenge: string | null
  ziel: string | null
  stil: string | null
  inhalte: string | null
  szenenplanAktiv: boolean
  plattformen: Plattform[]
  klappeVersionId: string | null
  szenen: StandSzene[]
  medien: StandMedium[]
  varianten: StandVariante[]
}

/** Die Form, aus der ein Stand entsteht — und in die er zurückgelegt wird. */
export type StandQuelle = {
  titel: string
  kurzbeschreibung: string | null
  caption: string
  typ: PostTyp
  verhaeltnis: Verhaeltnis
  laenge: string | null
  ziel: string | null
  stil: string | null
  inhalte: string | null
  szenenplanAktiv: boolean
  plattformen: Plattform[]
  klappeVersionId: string | null
  szenen: StandSzene[]
  medien: Array<{
    rolle: MediumRolle
    position: number
    mediumId: string
    medium: { id: string; mimeTyp: string; thumbPfad: string | null }
  }>
  varianten: Array<{
    id: string
    plattformen: Plattform[]
    caption: string | null
    verhaeltnis: Verhaeltnis | null
    position: number
    klappeVersionId: string | null
    medien: Array<{
      rolle: MediumRolle
      position: number
      mediumId: string
      medium: { id: string; mimeTyp: string; thumbPfad: string | null }
    }>
  }>
}

function medienAus(
  medien: StandQuelle['medien'],
): StandMedium[] {
  return medien.map((m) => ({
    rolle: m.rolle,
    position: m.position,
    mediumId: m.mediumId,
    mimeTyp: m.medium.mimeTyp,
    thumbPfad: m.medium.thumbPfad,
  }))
}

/** Schreibt den Stand aus einem geladenen Beitrag. */
export function standAusPost(post: StandQuelle): Standinhalt {
  return {
    fassung: 1,
    titel: post.titel,
    kurzbeschreibung: post.kurzbeschreibung,
    caption: post.caption,
    typ: post.typ,
    verhaeltnis: post.verhaeltnis,
    laenge: post.laenge,
    ziel: post.ziel,
    stil: post.stil,
    inhalte: post.inhalte,
    szenenplanAktiv: post.szenenplanAktiv,
    plattformen: post.plattformen,
    klappeVersionId: post.klappeVersionId,
    szenen: post.szenen.map((s) => ({ ...s })),
    medien: medienAus(post.medien),
    varianten: post.varianten.map((v) => ({
      id: v.id,
      plattformen: v.plattformen,
      caption: v.caption,
      verhaeltnis: v.verhaeltnis,
      position: v.position,
      klappeVersionId: v.klappeVersionId,
      medien: medienAus(v.medien),
    })),
  }
}

function medienZurueck(medien: StandMedium[]) {
  return medien.map((m) => ({
    rolle: m.rolle,
    position: m.position,
    mediumId: m.mediumId,
    medium: { id: m.mediumId, mimeTyp: m.mimeTyp, thumbPfad: m.thumbPfad },
  }))
}

/**
 * Legt den Stand über einen geladenen Beitrag.
 *
 * **Ersetzt wird nur der Inhalt.** Kennung, Termin, Phase, Freigaben und
 * Kommentare bleiben live — der Beitrag ist derselbe, nur sein Innenleben ist
 * das von damals. So bleibt alles, was danach kommt (Geräterahmen, Raster,
 * Kalender, ZIP), unverändert: Es bekommt dieselbe Form wie immer und muss
 * nichts von Ständen wissen.
 */
export function standAnwenden<T extends StandQuelle>(post: T, stand: Standinhalt): T {
  return {
    ...post,
    titel: stand.titel,
    kurzbeschreibung: stand.kurzbeschreibung,
    caption: stand.caption,
    typ: stand.typ,
    verhaeltnis: stand.verhaeltnis,
    laenge: stand.laenge,
    ziel: stand.ziel,
    stil: stand.stil,
    inhalte: stand.inhalte,
    szenenplanAktiv: stand.szenenplanAktiv,
    plattformen: stand.plattformen,
    klappeVersionId: stand.klappeVersionId,
    szenen: stand.szenen.map((s) => ({ ...s })),
    medien: medienZurueck(stand.medien),
    varianten: stand.varianten.map((v) => ({
      ...v,
      medien: medienZurueck(v.medien),
    })),
  } as T
}

/**
 * Ist das JSON aus der Datenbank ein Stand, mit dem sich rendern lässt?
 *
 * Geprüft wird grob und an einer Stelle: Ein Stand kommt aus dem eigenen
 * Schreiben, nicht von außen. Die Prüfung fängt den Fall ab, dass ein
 * Datensatz aus einer früheren Fassung stammt oder von Hand verändert wurde —
 * dann gilt der Beitrag live, statt dass die Seite abstürzt.
 */
export function istStandinhalt(roh: unknown): roh is Standinhalt {
  if (typeof roh !== 'object' || roh === null) return false
  const x = roh as Record<string, unknown>
  return (
    x.fassung === 1 &&
    typeof x.titel === 'string' &&
    typeof x.caption === 'string' &&
    Array.isArray(x.medien) &&
    Array.isArray(x.varianten) &&
    Array.isArray(x.szenen)
  )
}
