import { describe, expect, it } from 'vitest'
import {
  ERLAUBT,
  flaechenHoehe,
  istErlaubt,
  postBeschriftung,
  postBezeichnung,
  standardVerhaeltnis,
  VERHAELTNIS_WERT,
} from './verhaeltnis'

describe('Was je Typ zur Wahl steht', () => {
  it('nennt hochkant als Standard — und hochkant heißt 4:5', () => {
    // Instagram nimmt beim Posten nichts Höheres an. 3:4 stand hier einmal,
    // weil das Profilraster so aussieht; das war einen Schritt zu weit.
    expect(standardVerhaeltnis('BEITRAG')).toBe('HOCH_4_5')
    expect(standardVerhaeltnis('KARUSSELL')).toBe('HOCH_4_5')
    expect(standardVerhaeltnis('REEL')).toBe('VERTIKAL_9_16')
  })

  it('lässt beim Beitrag 4:5, 1:1 und den Bestand in 3:4 zu, sonst nichts', () => {
    expect(ERLAUBT.BEITRAG).toEqual(['HOCH_4_5', 'QUADRAT_1_1', 'HOCH_3_4'])
    // Quer gibt es nicht: Im Feed bliebe ein Streifen, im Raster ein Ausschnitt.
    expect(istErlaubt('BEITRAG', 'QUER_16_9')).toBe(false)
    expect(istErlaubt('BEITRAG', 'VERTIKAL_9_16')).toBe(false)
  })

  it('lässt 3:4 weiter speichern, damit der Bestand nicht festfährt', () => {
    expect(istErlaubt('BEITRAG', 'HOCH_3_4')).toBe(true)
    expect(istErlaubt('KARUSSELL', 'HOCH_3_4')).toBe(true)
    // Aber nicht als Standard — es steht hinten in der Wahl.
    expect(ERLAUBT.BEITRAG.indexOf('HOCH_3_4')).toBeGreaterThan(0)
  })

  it('lässt beim Karussell zusätzlich 9:16 zu — wie TikTok-Foto-Posts', () => {
    expect(istErlaubt('KARUSSELL', 'VERTIKAL_9_16')).toBe(true)
    expect(istErlaubt('KARUSSELL', 'QUER_16_9')).toBe(false)
  })

  it('lässt beim Reel 9:16, 1:1 und 16:9 zu', () => {
    expect(ERLAUBT.REEL).toEqual(['VERTIKAL_9_16', 'QUADRAT_1_1', 'QUER_16_9'])
    expect(istErlaubt('REEL', 'HOCH_3_4')).toBe(false)
    expect(istErlaubt('REEL', 'HOCH_4_5')).toBe(false)
  })
})

describe('Wie ein Beitrag heißt', () => {
  it('nennt ein hochkantes Video Reel', () => {
    expect(postBezeichnung('REEL', 'VERTIKAL_9_16')).toBe('Reel')
  })

  it('nennt dasselbe Video quer oder quadratisch nur noch Video', () => {
    expect(postBezeichnung('REEL', 'QUER_16_9')).toBe('Video')
    expect(postBezeichnung('REEL', 'QUADRAT_1_1')).toBe('Video')
  })

  it('lässt Beitrag und Karussell unberührt vom Format', () => {
    expect(postBezeichnung('BEITRAG', 'QUADRAT_1_1')).toBe('Beitrag')
    expect(postBezeichnung('KARUSSELL', 'VERTIKAL_9_16')).toBe('Karussell')
  })

  it('hängt für die Kopfzeile das Format an', () => {
    expect(postBeschriftung('REEL', 'VERTIKAL_9_16')).toBe('Reel · 9:16')
    expect(postBeschriftung('REEL', 'QUER_16_9')).toBe('Video · 16:9')
    expect(postBeschriftung('KARUSSELL', 'QUADRAT_1_1')).toBe('Karussell · 1:1')
  })
})

describe('Höhe der Medienfläche im Geräterahmen', () => {
  it('folgt dem Verhältnis, damit die Vorschau nicht lügt', () => {
    expect(flaechenHoehe('QUADRAT_1_1')).toBe(320)
    expect(flaechenHoehe('HOCH_4_5')).toBe(400)
    expect(flaechenHoehe('HOCH_3_4')).toBe(427)
    expect(flaechenHoehe('VERTIKAL_9_16')).toBe(569)
    expect(flaechenHoehe('QUER_16_9')).toBe(180)
  })
})

describe('Die Zahlenwerte', () => {
  it('stimmen mit den Namen überein', () => {
    expect(VERHAELTNIS_WERT.HOCH_4_5).toBeCloseTo(0.8)
    expect(VERHAELTNIS_WERT.HOCH_3_4).toBeCloseTo(0.75)
    expect(VERHAELTNIS_WERT.QUADRAT_1_1).toBe(1)
    expect(VERHAELTNIS_WERT.VERTIKAL_9_16).toBeCloseTo(0.5625)
    expect(VERHAELTNIS_WERT.QUER_16_9).toBeCloseTo(1.778, 3)
  })

  it('macht 4:5 zum breiteren der beiden hochkanten Formate', () => {
    // Daran hängt, was im Raster beschnitten wird: 4:5 ist weniger hoch als
    // 3:4, verliert dort also seitlich — und zwar erst an der Kachel.
    expect(VERHAELTNIS_WERT.HOCH_4_5).toBeGreaterThan(VERHAELTNIS_WERT.HOCH_3_4)
  })
})
