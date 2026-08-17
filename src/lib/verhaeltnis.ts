import type { PostTyp, Verhaeltnis } from '@prisma/client'

/**
 * Das Seitenverhältnis eines Beitrags.
 *
 * Bis hierher hing es am Typ: Reel bedeutete 9:16, alles andere hochkant.
 * Das trägt nicht mehr — dasselbe Karussell kann quadratisch für den Feed
 * oder hochkant fürs Raster gedacht sein, und ein Video ist nicht immer ein
 * Reel. Der Typ sagt jetzt nur noch, **woraus** ein Beitrag besteht (ein
 * Bild, mehrere Bilder, ein Video); das Verhältnis steht daneben.
 *
 * Bewusst ein fester Satz statt freier Zahlen: Diese vier sind das, was die
 * Plattformen zeigen. Ein krummes Wunschformat wäre kein Freiheitsgewinn,
 * sondern ein stiller Zuschnitt beim Hochladen.
 */

export const VERHAELTNIS_WERT: Record<Verhaeltnis, number> = {
  HOCH_4_5: 4 / 5,
  HOCH_3_4: 3 / 4,
  QUADRAT_1_1: 1,
  VERTIKAL_9_16: 9 / 16,
  QUER_16_9: 16 / 9,
}

export const VERHAELTNIS_TEXT: Record<Verhaeltnis, string> = {
  HOCH_4_5: '4:5',
  HOCH_3_4: '3:4',
  QUADRAT_1_1: '1:1',
  VERTIKAL_9_16: '9:16',
  QUER_16_9: '16:9',
}

/** Die übliche Pixelgröße — steht als Hinweis an den Ablagen. */
export const VERHAELTNIS_MASSE: Record<Verhaeltnis, string> = {
  HOCH_4_5: '1080 × 1350',
  HOCH_3_4: '1080 × 1440',
  QUADRAT_1_1: '1080 × 1080',
  VERTIKAL_9_16: '1080 × 1920',
  QUER_16_9: '1920 × 1080',
}

/**
 * Was je Typ zur Wahl steht — das Erste ist der Standard.
 *
 * **Hochkant heißt 4:5.** Zwischenzeitlich stand hier 3:4, weil Instagrams
 * Profilraster seit 2025 so aussieht und dieses Werkzeug im Raster plant. Das
 * war einen Schritt zu weit gedacht: Posten lässt sich nur bis 4:5. Ein in 3:4
 * gestaltetes Bild wird schon beim Veröffentlichen beschnitten — der Verlust
 * liegt also nicht erst im Raster, sondern im Beitrag selbst, und den sieht
 * der Kunde.
 *
 * Der Rasterausschnitt bleibt 3:4. Er entsteht aber an der **Kachel**, nicht
 * an der Datei: Wer die Wirkung im Raster prüfen will, sieht sie in der
 * Feed-Vorschau; gestaltet wird in dem Format, das ankommt.
 *
 * 3:4 bleibt wählbar, damit der Bestand aus jener Zeit speicherbar bleibt —
 * es steht deshalb hinten, nicht vorn.
 *
 * Ein Beitrag quer gibt es nicht: Im Feed schrumpft er auf einen Streifen,
 * und im Raster bliebe von ihm ein Ausschnitt. Beim Karussell kommt 9:16
 * dazu, weil TikTok-Foto-Posts so aussehen.
 */
export const ERLAUBT: Record<PostTyp, Verhaeltnis[]> = {
  BEITRAG: ['HOCH_4_5', 'QUADRAT_1_1', 'HOCH_3_4'],
  KARUSSELL: ['HOCH_4_5', 'QUADRAT_1_1', 'VERTIKAL_9_16', 'HOCH_3_4'],
  REEL: ['VERTIKAL_9_16', 'QUADRAT_1_1', 'QUER_16_9'],
}

export function standardVerhaeltnis(typ: PostTyp): Verhaeltnis {
  return ERLAUBT[typ][0]
}

export function istErlaubt(typ: PostTyp, verhaeltnis: Verhaeltnis): boolean {
  return ERLAUBT[typ].includes(verhaeltnis)
}

/**
 * Wie ein Beitrag heißt.
 *
 * Ein Video im Hochformat ist ein Reel — so heißt es auf Instagram, und so
 * nennt es das Team. Dasselbe Video quer oder quadratisch ist keines mehr;
 * dann ist es schlicht ein Video. Der Typ in der Datenbank bleibt derselbe,
 * nur das Wort ändert sich.
 */
export function postBezeichnung(typ: PostTyp, verhaeltnis: Verhaeltnis): string {
  if (typ === 'REEL') return verhaeltnis === 'VERTIKAL_9_16' ? 'Reel' : 'Video'
  return typ === 'KARUSSELL' ? 'Karussell' : 'Beitrag'
}

/** Bezeichnung samt Format — „Reel · 9:16“, „Video · 16:9“. */
export function postBeschriftung(typ: PostTyp, verhaeltnis: Verhaeltnis): string {
  return `${postBezeichnung(typ, verhaeltnis)} · ${VERHAELTNIS_TEXT[verhaeltnis]}`
}

/**
 * Höhe der Medienfläche im Geräterahmen. Der Schirm ist 320 px breit; die
 * Höhe folgt dem Verhältnis, damit die Vorschau nicht lügt.
 */
export function flaechenHoehe(verhaeltnis: Verhaeltnis, breite = 320): number {
  return Math.round(breite / VERHAELTNIS_WERT[verhaeltnis])
}
