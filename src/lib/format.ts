import type { MediumRolle, PostTyp } from '@prisma/client'

/** Erwartete Seitenverhältnisse laut Konzept. */
export const VERHAELTNIS = {
  hochkant: 4 / 5, // Beiträge und Karussell-Slides
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

export function erwartetesVerhaeltnis(typ: PostTyp, rolle: MediumRolle): number {
  if (rolle === 'THUMBNAIL') return VERHAELTNIS.reel
  if (typ === 'REEL') return VERHAELTNIS.reel
  return VERHAELTNIS.hochkant
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
  typ: PostTyp,
  rolle: MediumRolle,
  breite: number,
  hoehe: number,
): Formathinweis | null {
  if (!breite || !hoehe) return null

  const erwartet = erwartetesVerhaeltnis(typ, rolle)
  const ist = breite / hoehe
  if (Math.abs(ist - erwartet) <= erwartet * TOLERANZ) return null

  const erwartetText = erwartet === VERHAELTNIS.reel ? '9:16' : '4:5'
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
): string {
  const stempel = zipStempel(postenAm)

  if (rolle === 'THUMBNAIL') return `${stempel}_Reel_Thumbnail`
  if (typ === 'REEL') return `${stempel}_Reel`
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
