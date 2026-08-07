import type { MediumRolle, PostTyp, Verhaeltnis } from '@prisma/client'
import { VERHAELTNIS_TEXT, VERHAELTNIS_WERT } from './verhaeltnis'

/**
 * Erwartete Seitenverhältnisse.
 *
 * **Hochkant ist 3:4 (1080 × 1440), nicht mehr 4:5.** Instagram hat das
 * Profilraster 2025 von quadratisch auf 3:4 umgestellt; ein 4:5-Bild wird
 * dort seither links und rechts beschnitten. Wer im Raster plant — und
 * genau das tut dieses Werkzeug —, gestaltet deshalb gleich in 3:4: Der
 * Ausschnitt im Raster ist dann das ganze Bild.
 *
 * Der Preis ist bewusst in Kauf genommen: 4:5 gilt anderswo weiter als
 * Standard. Im Feed werden beide unbeschnitten gezeigt, im Raster nur 3:4.
 */
export const VERHAELTNIS = {
  hochkant: 3 / 4, // Beiträge, Karussell-Slides und der Rasterausschnitt
  reel: 9 / 16, // Reels und Reel-Thumbnails
} as const

/** Toleranz für Rundungsfehler aus Canva-Exporten (~1 %). */
const TOLERANZ = 0.01

export function verhaeltnisText(breite: number, hoehe: number): string {
  if (hoehe === 0) return '—'
  const teiler = groessterGemeinsamerTeiler(breite, hoehe)
  const b = breite / teiler
  const h = hoehe / teiler
  // Bei krummen Werten lieber dezimal als ein unleserliches 1153:1441.
  if (b > 32 || h > 32) return `${(breite / hoehe).toFixed(2)} : 1`
  return `${b}:${h}`
}

function groessterGemeinsamerTeiler(a: number, b: number): number {
  return b === 0 ? a : groessterGemeinsamerTeiler(b, a % b)
}

/**
 * Erwartet wird das Verhältnis des Beitrags — für das Medium wie für sein
 * Thumbnail. Ein 16:9-Video hätte ein hochkantes Vorschaubild nicht nötig;
 * das Thumbnail zeigt dasselbe Bild wie das Video.
 */
export function erwartetesVerhaeltnis(verhaeltnis: Verhaeltnis, _rolle: MediumRolle): number {
  return VERHAELTNIS_WERT[verhaeltnis]
}

export type Formathinweis = {
  erkannt: string
  erwartet: string
  text: string
}

/**
 * Transparente Pixel in einer Post-Grafik sind praktisch immer ein Versehen —
 * Instagram legt sie auf Schwarz oder Weiß, je nach Ansicht. Meist stammt das
 * aus einem PNG-Export ohne Hintergrund.
 */
export function transparenzHinweis(hatTransparenz: boolean, dateiname: string): string | null {
  if (!hatTransparenz) return null
  return (
    `${dateiname} enthält transparente Stellen. Instagram füllt die je nach Ansicht ` +
    'schwarz oder weiß — meist stammt das aus einem PNG-Export ohne Hintergrund. ' +
    'Bitte mit Hintergrund neu exportieren.'
  )
}

/**
 * Prüft das Seitenverhältnis eines Uploads. Kein harter Block — nur ein
 * deutlicher Hinweis, damit fehlerhafte Canva-Exporte sofort auffallen.
 */
export function pruefeFormat(
  verhaeltnis: Verhaeltnis,
  rolle: MediumRolle,
  breite: number,
  hoehe: number,
): Formathinweis | null {
  if (!breite || !hoehe) return null

  const erwartet = erwartetesVerhaeltnis(verhaeltnis, rolle)
  const ist = breite / hoehe
  if (Math.abs(ist - erwartet) <= erwartet * TOLERANZ) return null

  const erwartetText = VERHAELTNIS_TEXT[verhaeltnis]
  const erkanntText = verhaeltnisText(breite, hoehe)

  return {
    erkannt: erkanntText,
    erwartet: erwartetText,
    text: `Format ${erkanntText} erkannt, erwartet wird ${erwartetText}. Bitte den Export aus Canva prüfen.`,
  }
}

/**
 * Zeitstempel JJMMTT_HHMM. Da nie zwei Posts exakt zeitgleich veröffentlicht
 * werden, ist er je Post eindeutig.
 */
export function zipStempel(postenAm: Date): string {
  const jj = String(postenAm.getFullYear() % 100).padStart(2, '0')
  const mm = String(postenAm.getMonth() + 1).padStart(2, '0')
  const tt = String(postenAm.getDate()).padStart(2, '0')
  const hh = String(postenAm.getHours()).padStart(2, '0')
  const mi = String(postenAm.getMinutes()).padStart(2, '0')
  return `${jj}${mm}${tt}_${hh}${mi}`
}

/** Dateiname eines Mediums fürs ZIP: JJMMTT_HHMM_Typ. */
export function zipDateiname(
  postenAm: Date,
  typ: PostTyp,
  rolle: MediumRolle,
  position = 0,
  verhaeltnis: Verhaeltnis = 'HOCH_3_4',
): string {
  const stempel = zipStempel(postenAm)

  // Ein hochkantes Video heißt Reel, dasselbe quer nur Video — im Dateinamen
  // wie in der Oberfläche. Wer die ZIP in den Scheduler zieht, soll am Namen
  // sehen, wohin die Datei gehört.
  const videowort = verhaeltnis === 'VERTIKAL_9_16' ? 'Reel' : 'Video'

  if (rolle === 'THUMBNAIL') return `${stempel}_${videowort}_Thumbnail`
  if (typ === 'REEL') return `${stempel}_${videowort}`
  if (typ === 'KARUSSELL') return `${stempel}_Carousel_Slide${position + 1}`
  return `${stempel}_Post`
}

/** ISO-Kalenderwoche — die Export-Seite gliedert nach KW. */
export function kalenderwoche(datum: Date): number {
  const d = new Date(Date.UTC(datum.getFullYear(), datum.getMonth(), datum.getDate()))
  // Donnerstag derselben Woche bestimmt nach ISO 8601 das Jahr.
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))
  const jahresbeginn = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.getTime() - jahresbeginn.getTime()) / 86400000 + 1) / 7)
}

/** Jahr, zu dem die ISO-Kalenderwoche gehört (weicht am Jahreswechsel ab). */
export function kalenderwochenJahr(datum: Date): number {
  const d = new Date(Date.UTC(datum.getFullYear(), datum.getMonth(), datum.getDate()))
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))
  return d.getUTCFullYear()
}
