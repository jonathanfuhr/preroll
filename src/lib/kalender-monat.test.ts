import { describe, expect, it } from 'vitest'
import { alsMonatsschluessel, ausMonatsschluessel, versetzterMonat } from './kalender-monat'

describe('ausMonatsschluessel', () => {
  it('liest einen Monat als ersten Tag in Ortszeit', () => {
    const monat = ausMonatsschluessel('2026-08')
    expect(monat).toEqual(new Date(2026, 7, 1))
    expect(monat?.getHours()).toBe(0)
  })

  it('weist einen Monat über zwölf ab, statt ins Folgejahr zu rutschen', () => {
    // `new Date(2026, 12, 1)` wäre klaglos der Januar 2027 — die Adresse
    // zeigte dann etwas anderes als der Kalender.
    expect(ausMonatsschluessel('2026-13')).toBeNull()
    expect(ausMonatsschluessel('2026-00')).toBeNull()
  })

  it('weist alles ab, was kein Monat ist', () => {
    for (const wert of ['', '2026', '2026-8', 'August', '26-08', '2026-08-01', 'abc']) {
      expect(ausMonatsschluessel(wert)).toBeNull()
    }
  })

  it('verträgt fehlende Angaben', () => {
    expect(ausMonatsschluessel(undefined)).toBeNull()
    expect(ausMonatsschluessel(null)).toBeNull()
  })

  it('übergeht Leerzeichen drumherum', () => {
    expect(ausMonatsschluessel(' 2026-08 ')).toEqual(new Date(2026, 7, 1))
  })
})

describe('alsMonatsschluessel', () => {
  it('füllt den Monat auf zwei Stellen auf', () => {
    expect(alsMonatsschluessel(new Date(2026, 0, 15))).toBe('2026-01')
    expect(alsMonatsschluessel(new Date(2026, 11, 31))).toBe('2026-12')
  })

  it('ist die Umkehrung des Einlesens', () => {
    for (const wert of ['2026-01', '2026-08', '2026-12', '2030-03']) {
      expect(alsMonatsschluessel(ausMonatsschluessel(wert)!)).toBe(wert)
    }
  })
})

describe('versetzterMonat', () => {
  it('geht vor und zurück', () => {
    const august = new Date(2026, 7, 1)
    expect(alsMonatsschluessel(versetzterMonat(august, 1))).toBe('2026-09')
    expect(alsMonatsschluessel(versetzterMonat(august, -1))).toBe('2026-07')
  })

  it('geht über den Jahreswechsel', () => {
    expect(alsMonatsschluessel(versetzterMonat(new Date(2026, 11, 1), 1))).toBe('2027-01')
    expect(alsMonatsschluessel(versetzterMonat(new Date(2026, 0, 1), -1))).toBe('2025-12')
  })

  it('landet immer auf dem Ersten, egal von welchem Tag aus', () => {
    expect(versetzterMonat(new Date(2026, 0, 31), 1)).toEqual(new Date(2026, 1, 1))
  })
})
