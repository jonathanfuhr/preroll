import { describe, expect, it } from 'vitest'
import { formatiereDauer, laengeAnzeige } from './videolaenge'

describe('Dauer formatieren', () => {
  it('bleibt unter einer Minute bei Sekunden', () => {
    expect(formatiereDauer(31)).toBe('31 Sek')
    expect(formatiereDauer(30.4)).toBe('30 Sek')
    expect(formatiereDauer(59.6)).toBe('1:00 Min')
  })

  it('schreibt längere Videos als Minuten', () => {
    expect(formatiereDauer(60)).toBe('1:00 Min')
    expect(formatiereDauer(105)).toBe('1:45 Min')
  })

  /* Ein Video ist nie null Sekunden lang — „0 Sek" sähe nach Fehler aus. */
  it('rundet nie auf null', () => {
    expect(formatiereDauer(0.2)).toBe('1 Sek')
  })
})

describe('Länge anzeigen', () => {
  it('schränkt in den frühen Phasen ein', () => {
    expect(laengeAnzeige('31 Sek', 'ENTWURF')).toBe('ca. 31 Sek')
    expect(laengeAnzeige('31 Sek', 'KONZEPT')).toBe('ca. 31 Sek')
  })

  it('nennt sie ab der Produktion genau', () => {
    expect(laengeAnzeige('31 Sek', 'PRODUKTION')).toBe('31 Sek')
    expect(laengeAnzeige('31 Sek', 'VORSCHAU')).toBe('31 Sek')
    expect(laengeAnzeige('31 Sek', 'KORREKTUR')).toBe('31 Sek')
    expect(laengeAnzeige('31 Sek', 'FINAL')).toBe('31 Sek')
  })

  /* Von Hand geschriebene Einschränkungen bleiben stehen. */
  it('setzt kein zweites „ca." davor', () => {
    expect(laengeAnzeige('ca. 30 Sek', 'KONZEPT')).toBe('ca. 30 Sek')
    expect(laengeAnzeige('etwa eine Minute', 'KONZEPT')).toBe('etwa eine Minute')
    expect(laengeAnzeige('~40 Sek', 'ENTWURF')).toBe('~40 Sek')
  })

  it('macht aus leer nichts', () => {
    expect(laengeAnzeige(null, 'KONZEPT')).toBeNull()
    expect(laengeAnzeige('   ', 'KONZEPT')).toBeNull()
  })
})
