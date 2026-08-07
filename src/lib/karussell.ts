import type { Verhaeltnis } from '@prisma/client'
import { VERHAELTNIS } from './format'
import { VERHAELTNIS_MASSE, VERHAELTNIS_TEXT, VERHAELTNIS_WERT } from './verhaeltnis'

/**
 * Auftrennen eines durchgehenden Karussell-Motivs in einzelne Slides.
 *
 * Regeln aus dem Konzept:
 *  - Das Slide-Format kommt vom Beitrag (3:4, 1:1 oder 9:16).
 *  - Ist die Breite ein eindeutiges Vielfaches der Höhe in diesem Raster, wird die
 *    Slide-Anzahl automatisch erkannt und gleichmäßig aufgetrennt.
 *  - Geht die Rechnung nicht glatt auf, gibt es bewusst keine manuellen
 *    Schnittkanten, sondern eine Fehlermeldung.
 *  - Ein Slide darf nie schmaler als das Zielformat werden.
 *  - Die Anzahl bleibt überschreibbar, solange das Ergebnis aufgeht.
 */

export type Auftrennung =
  | {
      ok: true
      anzahl: number
      slideBreite: number
      slideHoehe: number
      /** true, wenn jeder Slide exakt 3:4 misst. */
      exakt: boolean
    }
  | { ok: false; fehler: string }

/** Slide-Anzahl, bei der jeder Slide exakt 3:4 misst — oder null. */
export function erkenneSlideAnzahl(
  breite: number,
  hoehe: number,
  verhaeltnis: Verhaeltnis = 'HOCH_3_4',
): number | null {
  const ziel = VERHAELTNIS_WERT[verhaeltnis]
  if (breite <= 0 || hoehe <= 0) return null
  const exakt = breite / (hoehe * ziel)
  const gerundet = Math.round(exakt)
  if (gerundet < 1) return null
  // Ein halbes Pixel Toleranz für Canva-Rundungen.
  return Math.abs(exakt - gerundet) < 0.002 ? gerundet : null
}

/** Mehr Slides als das ergäbe Streifen schmaler als 3:4. */
export function maximaleSlideAnzahl(
  breite: number,
  hoehe: number,
  verhaeltnis: Verhaeltnis = 'HOCH_3_4',
): number {
  if (breite <= 0 || hoehe <= 0) return 0
  const ziel = VERHAELTNIS_WERT[verhaeltnis]
  return Math.floor(breite / (hoehe * ziel) + 0.002)
}

export function berechneAuftrennung(
  breite: number,
  hoehe: number,
  gewuenschteAnzahl?: number,
  verhaeltnis: Verhaeltnis = 'HOCH_3_4',
): Auftrennung {
  if (breite <= 0 || hoehe <= 0) {
    return { ok: false, fehler: 'Die Bildmaße konnten nicht gelesen werden.' }
  }

  const erkannt = erkenneSlideAnzahl(breite, hoehe, verhaeltnis)
  const anzahl = gewuenschteAnzahl ?? erkannt

  if (!anzahl) {
    return {
      ok: false,
      fehler:
        `Die Bildbreite passt nicht ins ${VERHAELTNIS_TEXT[verhaeltnis]}-Raster: ` +
        `${breite} × ${hoehe} px ergibt keine ganze Zahl an Slides. Bitte die Bildgröße ` +
        `prüfen — ein Gesamtbild sollte ein Vielfaches von ${VERHAELTNIS_MASSE[verhaeltnis]} px sein.`,
    }
  }

  if (anzahl < 1) {
    return { ok: false, fehler: 'Ein Karussell braucht mindestens einen Slide.' }
  }

  if (anzahl > maximaleSlideAnzahl(breite, hoehe, verhaeltnis)) {
    return {
      ok: false,
      fehler:
        `Bei ${anzahl} Slides wäre jeder Slide schmaler als ` +
        `${VERHAELTNIS_TEXT[verhaeltnis]} — das lässt Instagram nicht zu. ` +
        'Bitte weniger Slides wählen.',
    }
  }

  if (breite % anzahl !== 0) {
    return {
      ok: false,
      fehler:
        `${breite} px lassen sich nicht gleichmäßig auf ${anzahl} Slides aufteilen. ` +
        'Bitte die Bildgröße prüfen.',
    }
  }

  const slideBreite = breite / anzahl
  return {
    ok: true,
    anzahl,
    slideBreite,
    slideHoehe: hoehe,
    exakt: erkannt === anzahl,
  }
}

/** Schnittfenster für sharp.extract(), von links nach rechts. */
export function schnittfenster(
  breite: number,
  hoehe: number,
  anzahl: number,
): Array<{ left: number; top: number; width: number; height: number }> {
  const slideBreite = breite / anzahl
  return Array.from({ length: anzahl }, (_, i) => ({
    left: Math.round(i * slideBreite),
    top: 0,
    width: Math.round(slideBreite),
    height: hoehe,
  }))
}

/**
 * Beschneiden fürs Raster — oder nicht?
 *
 * **Nur was höher ist als das Raster.** Ein Reel-Thumbnail liegt in 9:16 vor
 * und muss beschnitten werden, sonst passt es nirgends hin; genau so zeigt
 * Instagram Reels im Profil. Ein Beitrag in 4:5 ist dagegen *breiter* als
 * 3:4 — ihn zu beschneiden hieße, seitlich etwas wegzunehmen, was jemand
 * bewusst gestaltet hat. Das Vorschaubild behält deshalb alles; wie die
 * Kachel es zeigt, entscheidet die Anzeige.
 *
 * Nebenbei fallen damit auch Logos und Profilbilder heraus — die sind
 * quadratisch oder breiter und standen nie im Raster.
 */
export function brauchtZuschnitt(
  breite: number,
  hoehe: number,
  ziel = VERHAELTNIS.hochkant,
): boolean {
  if (!breite || !hoehe) return false
  // Ein Prozent Spiel, damit ein krummer Export nicht um zwei Pixel schneidet.
  return breite / hoehe < ziel * 0.99
}

/**
 * Mittiger 3:4-Ausschnitt eines 9:16-Thumbnails — so zeigt Instagram Reels
 * im Profilraster. Das Raster ist seit 2025 3:4, vorher quadratisch.
 */
export function mittigerAusschnitt(
  breite: number,
  hoehe: number,
  ziel = VERHAELTNIS.hochkant,
): { left: number; top: number; width: number; height: number } {
  const ist = breite / hoehe
  if (ist > ziel) {
    // Zu breit — links und rechts beschneiden.
    const width = Math.round(hoehe * ziel)
    return { left: Math.round((breite - width) / 2), top: 0, width, height: hoehe }
  }
  // Zu hoch — oben und unten beschneiden.
  const height = Math.round(breite / ziel)
  return { left: 0, top: Math.round((hoehe - height) / 2), width: breite, height }
}
