import { describe, expect, it } from 'vitest'
import { klappeVideoBeschreibung, klappeVideoName } from './klappe-namen'

describe('klappeVideoName', () => {
  it('stellt das Datum voran, damit die Liste in Klappe chronologisch bleibt', () => {
    expect(klappeVideoName(new Date(2026, 7, 5, 11, 0), 'Recruiting-Reel')).toBe(
      '260805 Recruiting-Reel',
    )
  })

  it('füllt einstellige Werte auf', () => {
    expect(klappeVideoName(new Date(2026, 0, 9, 7, 5), 'Jahresrückblick')).toBe(
      '260109 Jahresrückblick',
    )
  })
})

describe('klappeVideoBeschreibung', () => {
  it('nennt Herkunft, Kunde und Termin', () => {
    const text = klappeVideoBeschreibung(new Date(2026, 7, 5, 11, 0), 'Beispiel Handwerk GmbH')
    expect(text).toContain('Preroll')
    expect(text).toContain('Beispiel Handwerk GmbH')
    expect(text).toContain('2026')
  })
})
