import { describe, expect, it } from 'vitest'
import {
  abgeleiteteStufe,
  ANZEIGEPHASEN,
  anzeigePhase,
  naechstePhase,
  PHASEN,
  STUFEN,
  stufenErklaerung,
} from './status'

const JETZT = new Date(2026, 7, 15, 12, 0)

describe('abgeleiteteStufe', () => {
  it('lässt Konzept und Vorschau unangetastet — auch wenn der Termin vorbei ist', () => {
    const vergangen = new Date(2026, 7, 1, 10, 0)
    expect(abgeleiteteStufe('KONZEPT', vergangen, JETZT)).toBe('KONZEPT')
    expect(abgeleiteteStufe('VORSCHAU', vergangen, JETZT)).toBe('VORSCHAU')
  })

  it('macht aus Final nach dem Termin „Gepostet"', () => {
    expect(abgeleiteteStufe('FINAL', new Date(2026, 7, 14, 10, 0), JETZT)).toBe('GEPOSTET')
  })

  it('lässt Final stehen, solange der Termin in der Zukunft liegt', () => {
    expect(abgeleiteteStufe('FINAL', new Date(2026, 7, 16, 10, 0), JETZT)).toBe('FINAL')
  })

  it('zählt den Termin selbst schon als gepostet', () => {
    expect(abgeleiteteStufe('FINAL', JETZT, JETZT)).toBe('GEPOSTET')
  })

  it('bleibt ohne Termin auf Final — ungeplant ist nicht veröffentlicht', () => {
    expect(abgeleiteteStufe('FINAL', null, JETZT)).toBe('FINAL')
  })
})

describe('anzeigePhase', () => {
  it('behält den Entwurf, anders als die Kundensicht', () => {
    // Der Unterschied zwischen beiden Rechnungen: Beim Kunden wird ein
    // Entwurf zu „Konzept", intern bleibt er ein Entwurf.
    expect(anzeigePhase('ENTWURF', null, JETZT)).toBe('ENTWURF')
    expect(abgeleiteteStufe('ENTWURF', null, JETZT)).toBe('KONZEPT')
  })

  it('macht aus Final nach dem Termin „Gepostet"', () => {
    expect(anzeigePhase('FINAL', new Date(2026, 7, 14, 10, 0), JETZT)).toBe('GEPOSTET')
  })

  it('lässt Final stehen, solange der Termin in der Zukunft liegt', () => {
    expect(anzeigePhase('FINAL', new Date(2026, 7, 16, 10, 0), JETZT)).toBe('FINAL')
  })

  it('bleibt ohne Termin auf Final — ungeplant ist nicht veröffentlicht', () => {
    expect(anzeigePhase('FINAL', null, JETZT)).toBe('FINAL')
  })

  it('rührt die frühen Phasen nicht an, auch wenn der Termin vorbei ist', () => {
    const vergangen = new Date(2026, 7, 1, 10, 0)
    expect(anzeigePhase('ENTWURF', vergangen, JETZT)).toBe('ENTWURF')
    expect(anzeigePhase('KONZEPT', vergangen, JETZT)).toBe('KONZEPT')
    expect(anzeigePhase('VORSCHAU', vergangen, JETZT)).toBe('VORSCHAU')
  })

  it('wird wieder zu Final, wenn der Termin nach vorn verlegt wird', () => {
    // Genau deshalb ist „Gepostet" nicht gespeichert: Ein fünfter Wert in der
    // Datenbank stünde nach dem Verschieben falsch.
    const post = 'FINAL' as const
    expect(anzeigePhase(post, new Date(2026, 7, 1), JETZT)).toBe('GEPOSTET')
    expect(anzeigePhase(post, new Date(2026, 8, 1), JETZT)).toBe('FINAL')
  })

  it('deckt sich mit der Kundensicht, sobald kein Entwurf im Spiel ist', () => {
    const termine = [null, new Date(2026, 7, 1), new Date(2026, 8, 1)]
    for (const status of ['KONZEPT', 'VORSCHAU', 'FINAL'] as const) {
      for (const termin of termine) {
        expect(anzeigePhase(status, termin, JETZT)).toBe(abgeleiteteStufe(status, termin, JETZT))
      }
    }
  })
})

describe('ANZEIGEPHASEN', () => {
  it('sind die setzbaren Phasen plus Gepostet', () => {
    expect(ANZEIGEPHASEN).toEqual([...PHASEN, 'GEPOSTET'])
  })

  it('lassen „Gepostet" nicht setzen — es wird gerechnet', () => {
    // `naechstePhase` führt nur durch die Phasen, die es in der Datenbank
    // gibt. Bei Final ist Schluss.
    expect(naechstePhase('FINAL')).toBeNull()
  })
})

describe('stufenErklaerung', () => {
  it('nennt die Freigabe nur, wo es eine gibt', () => {
    expect(stufenErklaerung('KONZEPT', true)).toContain('Ihre Freigabe')
    expect(stufenErklaerung('KONZEPT', false)).not.toContain('Freigabe')
    expect(stufenErklaerung('VORSCHAU', true)).toContain('Ihre Freigabe')
    expect(stufenErklaerung('VORSCHAU', false)).not.toContain('Freigabe')
  })

  it('erklärt die späten Stufen unabhängig von der Freigabepflicht gleich', () => {
    expect(stufenErklaerung('FINAL', true)).toBe(stufenErklaerung('FINAL', false))
    expect(stufenErklaerung('GEPOSTET', true)).toBe(stufenErklaerung('GEPOSTET', false))
  })
})

describe('naechstePhase', () => {
  it('schiebt vom Entwurf bis zum Final durch', () => {
    expect(naechstePhase('ENTWURF')).toBe('KONZEPT')
    expect(naechstePhase('KONZEPT')).toBe('VORSCHAU')
    expect(naechstePhase('VORSCHAU')).toBe('FINAL')
  })

  it('endet bei Final — „Gepostet" wird berechnet, nicht gesetzt', () => {
    expect(naechstePhase('FINAL')).toBeNull()
  })
})

describe('abgeleiteteStufe mit Entwurf', () => {
  it('macht daraus die erste Stufe — beim Kunden gibt es keinen Entwurf', () => {
    // Entwürfe erreichen ihn ohnehin nicht; steht hier doch einer, ist
    // „Konzept" die ehrlichste Antwort.
    expect(abgeleiteteStufe('ENTWURF', null, JETZT)).toBe('KONZEPT')
    expect(abgeleiteteStufe('ENTWURF', new Date(2026, 7, 1), JETZT)).toBe('KONZEPT')
  })

  it('hat in der Zeitleiste kein Gegenstück', () => {
    expect(STUFEN).not.toContain('ENTWURF')
  })
})
