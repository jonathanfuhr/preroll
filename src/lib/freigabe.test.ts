import { describe, expect, it } from 'vitest'
import { freigabeBeschriftung, freigabeFortschritt, freigabeStand, offeneStufe } from './freigabe'

describe('offeneStufe', () => {
  it('verlangt beim Konzept die Konzept-Freigabe', () => {
    expect(offeneStufe('KONZEPT')).toBe('KONZEPT')
  })

  it('verlangt bei der Vorschau die Vorschau-Freigabe', () => {
    expect(offeneStufe('VORSCHAU')).toBe('VORSCHAU')
  })

  it('lässt bei Final nichts mehr offen', () => {
    expect(offeneStufe('FINAL')).toBeNull()
  })
})

describe('freigabeBeschriftung', () => {
  it('beschriftet den Knopf nach der Stufe', () => {
    expect(freigabeBeschriftung('KONZEPT')).toBe('Konzept freigeben')
    expect(freigabeBeschriftung('VORSCHAU')).toBe('Vorschau freigeben')
  })
})

describe('freigabeStand', () => {
  it('meldet die Konzept-Freigabe als offen, solange sie fehlt', () => {
    expect(freigabeStand('KONZEPT', [])).toEqual({
      offen: 'KONZEPT',
      erledigt: false,
      erteilt: [],
    })
  })

  it('meldet sie als erledigt, sobald sie vorliegt', () => {
    expect(freigabeStand('KONZEPT', ['KONZEPT'])).toEqual({
      offen: 'KONZEPT',
      erledigt: true,
      erteilt: ['KONZEPT'],
    })
  })

  it('verlangt nach dem Wechsel auf Vorschau erneut eine Freigabe', () => {
    const stand = freigabeStand('VORSCHAU', ['KONZEPT'])
    expect(stand.offen).toBe('VORSCHAU')
    expect(stand.erledigt).toBe(false)
    // Die Konzept-Freigabe bleibt sichtbar.
    expect(stand.erteilt).toEqual(['KONZEPT'])
  })

  it('führt beide Stufen auf, wenn beide erteilt sind', () => {
    const stand = freigabeStand('VORSCHAU', ['VORSCHAU', 'KONZEPT'])
    expect(stand.erteilt).toEqual(['KONZEPT', 'VORSCHAU'])
    expect(stand.erledigt).toBe(true)
  })

  it('lässt bei Final nichts offen, auch ohne erteilte Stufen', () => {
    expect(freigabeStand('FINAL', []).offen).toBeNull()
  })
})

describe('freigabeFortschritt', () => {
  it('zählt Posts mit erteilter Freigabe', () => {
    const stand = freigabeFortschritt([
      { status: 'KONZEPT', freigaben: [{ stufe: 'KONZEPT' }] },
      { status: 'KONZEPT', freigaben: [] },
      { status: 'VORSCHAU', freigaben: [{ stufe: 'KONZEPT' }] },
    ])
    expect(stand).toEqual({ erledigt: 1, gesamt: 3, vollstaendig: false })
  })

  it('zählt Final-Posts als erledigt', () => {
    const stand = freigabeFortschritt([
      { status: 'FINAL', freigaben: [] },
      { status: 'VORSCHAU', freigaben: [{ stufe: 'VORSCHAU' }] },
    ])
    expect(stand).toEqual({ erledigt: 2, gesamt: 2, vollstaendig: true })
  })

  it('ist ohne Posts nicht vollständig', () => {
    expect(freigabeFortschritt([]).vollstaendig).toBe(false)
  })
})
