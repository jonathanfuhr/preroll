import { describe, expect, it } from 'vitest'
import { leseBereich } from './bereich'

/**
 * Anlass: Auf der Kundenseite lud kein Reel. Kein Fehler im Log, kein Fehler
 * im Browser — nur ein Player, der nicht anfing.
 *
 * Die Ursache war diese Auswertung. Ein MP4 ohne `faststart` trägt sein
 * `moov`-Kästchen am Dateiende; der Player fragt es mit `bytes=-100000` ab. Die
 * alte Fassung las die leere Zahl vor dem Bindestrich als 0 und lieferte die
 * **ersten** 100 000 Bytes. Dort steht das Kästchen nicht, also fragte der
 * Player weiter.
 */

const GROESSE = 1_000_000

describe('leseBereich', () => {
  it('liest ein Suffix als die letzten Bytes — nicht als die ersten', () => {
    expect(leseBereich('bytes=-100000', GROESSE)).toEqual({ start: 900_000, ende: 999_999 })
  })

  it('kappt ein Suffix, das größer ist als die Datei', () => {
    expect(leseBereich('bytes=-5000000', GROESSE)).toEqual({ start: 0, ende: 999_999 })
  })

  it('liest einen gewöhnlichen Ausschnitt', () => {
    expect(leseBereich('bytes=0-1023', GROESSE)).toEqual({ start: 0, ende: 1023 })
    expect(leseBereich('bytes=500-1500', GROESSE)).toEqual({ start: 500, ende: 1500 })
  })

  it('liest ein offenes Ende bis zum Dateiende', () => {
    expect(leseBereich('bytes=999000-', GROESSE)).toEqual({ start: 999_000, ende: 999_999 })
  })

  it('kappt ein Ende jenseits der Datei statt abzuweisen', () => {
    // Manche Player fragen großzügig. Das ist kein Fehler, sondern eine
    // Obergrenze — RFC 7233 lässt das ausdrücklich zu.
    expect(leseBereich('bytes=0-9999999', GROESSE)).toEqual({ start: 0, ende: 999_999 })
  })

  it('weist einen Beginn hinter dem Dateiende ab', () => {
    expect(leseBereich('bytes=2000000-', GROESSE)).toBe('ungueltig')
    expect(leseBereich('bytes=900-800', GROESSE)).toBe('ungueltig')
    expect(leseBereich('bytes=-0', GROESSE)).toBe('ungueltig')
  })

  it('liefert ohne Kopfzeile die ganze Datei', () => {
    expect(leseBereich(null, GROESSE)).toBeNull()
    expect(leseBereich('', GROESSE)).toBeNull()
  })

  it('gibt bei unverständlicher Kopfzeile die ganze Datei statt eines Fehlers', () => {
    // Freundlicher als ein 416: Wer die Kopfzeile nicht richtig setzt, bekommt
    // wenigstens das Video.
    expect(leseBereich('bytes=abc-def', GROESSE)).toBeNull()
    expect(leseBereich('items=0-10', GROESSE)).toBeNull()
    expect(leseBereich('bytes=-', GROESSE)).toBeNull()
    // Mehrere Bereiche beantworten wir ganz, statt einen davon herauszugreifen.
    expect(leseBereich('bytes=0-100,200-300', GROESSE)).toBeNull()
  })

  it('verträgt eine leere Datei', () => {
    expect(leseBereich('bytes=0-100', 0)).toBeNull()
  })
})
