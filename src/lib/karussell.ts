import { VERHAELTNIS } from './format'

/**
 * Auftrennen eines durchgehenden Karussell-Motivs in einzelne Slides.
 *
 * Regeln aus dem Konzept:
 *  - Slide-Standardformat ist 1080 × 1350 (4:5).
 *  - Ist die Breite ein eindeutiges Vielfaches der Höhe im 4:5-Raster, wird die
 *    Slide-Anzahl automatisch erkannt und gleichmäßig aufgetrennt.
 *  - Geht die Rechnung nicht glatt auf, gibt es bewusst keine manuellen
 *    Schnittkanten, sondern eine Fehlermeldung.
 *  - Ein Slide darf nie schmaler als 4:5 werden (Instagram-Grenze).
 *  - Die Anzahl bleibt überschreibbar, solange das Ergebnis aufgeht.
 */

export type Auftrennung =
  | {
      ok: true
      anzahl: number
      slideBreite: number
      slideHoehe: number
      /** true, wenn jeder Slide exakt 4:5 misst. */
      exakt: boolean
    }
  | { ok: false; fehler: string }

/** Slide-Anzahl, bei der jeder Slide exakt 4:5 misst — oder null. */
export function erkenneSlideAnzahl(breite: number, hoehe: number): number | null {
  if (breite <= 0 || hoehe <= 0) return null
  const exakt = breite / (hoehe * VERHAELTNIS.hochkant)
  const gerundet = Math.round(exakt)
  if (gerundet < 1) return null
  // Ein halbes Pixel Toleranz für Canva-Rundungen.
  return Math.abs(exakt - gerundet) < 0.002 ? gerundet : null
}

/** Mehr Slides als das ergäbe Streifen schmaler als 4:5. */
export function maximaleSlideAnzahl(breite: number, hoehe: number): number {
  if (breite <= 0 || hoehe <= 0) return 0
  return Math.floor(breite / (hoehe * VERHAELTNIS.hochkant) + 0.002)
}

export function berechneAuftrennung(
  breite: number,
  hoehe: number,
  gewuenschteAnzahl?: number,
): Auftrennung {
  if (breite <= 0 || hoehe <= 0) {
    return { ok: false, fehler: 'Die Bildmaße konnten nicht gelesen werden.' }
  }

  const erkannt = erkenneSlideAnzahl(breite, hoehe)
  const anzahl = gewuenschteAnzahl ?? erkannt

  if (!anzahl) {
    return {
      ok: false,
      fehler:
        `Die Bildbreite passt nicht ins 4:5-Raster: ${breite} × ${hoehe} px ergibt keine ` +
        'ganze Zahl an Slides. Bitte die Bildgröße prüfen — ein Gesamtbild sollte ein ' +
        'Vielfaches von 1080 × 1350 px sein.',
    }
  }

  if (anzahl < 1) {
    return { ok: false, fehler: 'Ein Karussell braucht mindestens einen Slide.' }
  }

  if (anzahl > maximaleSlideAnzahl(breite, hoehe)) {
    return {
      ok: false,
      fehler:
        `Bei ${anzahl} Slides wäre jeder Slide schmaler als 4:5 — das lässt Instagram ` +
        'nicht zu. Bitte weniger Slides wählen.',
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
 * Mittiger 4:5-Ausschnitt eines 9:16-Thumbnails — so zeigt Instagram
 * Reels im Profilraster.
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
