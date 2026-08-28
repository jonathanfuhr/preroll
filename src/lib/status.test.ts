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
    expect(anzeigePhase('ENTWURF', null, [], JETZT)).toBe('ENTWURF')
    expect(abgeleiteteStufe('ENTWURF', null, JETZT)).toBe('KONZEPT')
  })

  it('macht aus Final nach dem Termin „Gepostet"', () => {
    expect(anzeigePhase('FINAL', new Date(2026, 7, 14, 10, 0), [], JETZT)).toBe('GEPOSTET')
  })

  it('lässt Final stehen, solange der Termin in der Zukunft liegt', () => {
    expect(anzeigePhase('FINAL', new Date(2026, 7, 16, 10, 0), [], JETZT)).toBe('FINAL')
  })

  it('bleibt ohne Termin auf Final — ungeplant ist nicht veröffentlicht', () => {
    expect(anzeigePhase('FINAL', null, [], JETZT)).toBe('FINAL')
  })

  it('rührt die frühen Phasen nicht an, auch wenn der Termin vorbei ist', () => {
    const vergangen = new Date(2026, 7, 1, 10, 0)
    expect(anzeigePhase('ENTWURF', vergangen, [], JETZT)).toBe('ENTWURF')
    expect(anzeigePhase('KONZEPT', vergangen, [], JETZT)).toBe('KONZEPT')
    expect(anzeigePhase('VORSCHAU', vergangen, [], JETZT)).toBe('VORSCHAU')
  })

  it('wird wieder zu Final, wenn der Termin nach vorn verlegt wird', () => {
    // Genau deshalb ist „Gepostet" nicht gespeichert: Ein fünfter Wert in der
    // Datenbank stünde nach dem Verschieben falsch.
    const post = 'FINAL' as const
    expect(anzeigePhase(post, new Date(2026, 7, 1), [], JETZT)).toBe('GEPOSTET')
    expect(anzeigePhase(post, new Date(2026, 8, 1), [], JETZT)).toBe('FINAL')
  })

  it('deckt sich mit der Kundensicht, sobald kein Entwurf im Spiel ist', () => {
    const termine = [null, new Date(2026, 7, 1), new Date(2026, 8, 1)]
    for (const status of ['KONZEPT', 'VORSCHAU', 'FINAL'] as const) {
      for (const termin of termine) {
        expect(anzeigePhase(status, termin, [], JETZT)).toBe(abgeleiteteStufe(status, termin, JETZT))
      }
    }
  })
})

describe('anzeigePhase mit Veröffentlichungen', () => {
  const vergangen = new Date(2026, 7, 1, 10, 0)
  const kuenftig = new Date(2026, 8, 1, 10, 0)

  it('meldet einen Fehlschlag, statt „Gepostet" zu behaupten', () => {
    expect(
      anzeigePhase('FINAL', vergangen, [{ stand: 'FEHLGESCHLAGEN' }], JETZT),
    ).toBe('FEHLGESCHLAGEN')
  })

  it('lässt beim Kreuzposten den Fehlschlag gewinnen', () => {
    // Facebook durch, Instagram gescheitert: halb draußen ist ein Zustand,
    // der jemanden braucht.
    expect(
      anzeigePhase('FINAL', vergangen, [{ stand: 'ERFOLGT' }, { stand: 'FEHLGESCHLAGEN' }], JETZT),
    ).toBe('FEHLGESCHLAGEN')
  })

  it('bleibt auf Final, solange noch nichts raus ist — auch nach dem Termin', () => {
    // Der eigentliche Gewinn: Ein Beitrag, der in der Warteschlange hängt,
    // behauptete bisher „Gepostet", sobald die Minute vorbei war.
    expect(anzeigePhase('FINAL', vergangen, [{ stand: 'GEPLANT' }], JETZT)).toBe('FINAL')
    expect(anzeigePhase('FINAL', vergangen, [{ stand: 'LAEUFT' }], JETZT)).toBe('FINAL')
  })

  it('zählt erst als gepostet, wenn alle Plattformen durch sind', () => {
    expect(
      anzeigePhase('FINAL', vergangen, [{ stand: 'ERFOLGT' }, { stand: 'GEPLANT' }], JETZT),
    ).toBe('FINAL')
    expect(
      anzeigePhase('FINAL', vergangen, [{ stand: 'ERFOLGT' }, { stand: 'ERFOLGT' }], JETZT),
    ).toBe('GEPOSTET')
  })

  it('lässt bei übergebenen Terminen wieder die Uhr entscheiden', () => {
    // `UEBERGEBEN` heißt: Die Plattform hat den Termin. Ob sie ihn schon
    // eingelöst hat, weiß Preroll nicht — nur, wann er war.
    expect(anzeigePhase('FINAL', vergangen, [{ stand: 'UEBERGEBEN' }], JETZT)).toBe('GEPOSTET')
    expect(anzeigePhase('FINAL', kuenftig, [{ stand: 'UEBERGEBEN' }], JETZT)).toBe('FINAL')
  })

  it('rührt frühe Phasen nicht an, egal was in der Warteschlange steht', () => {
    expect(anzeigePhase('KONZEPT', vergangen, [{ stand: 'FEHLGESCHLAGEN' }], JETZT)).toBe('KONZEPT')
  })

  it('hält die Kundensicht davon frei', () => {
    // Dass eine Veröffentlichung schiefging, ist unser Problem, nicht seins.
    expect(abgeleiteteStufe('FINAL', vergangen, JETZT)).toBe('GEPOSTET')
    expect(STUFEN).not.toContain('FEHLGESCHLAGEN')
  })
})

describe('ANZEIGEPHASEN', () => {
  it('sind die setzbaren Phasen plus die beiden gerechneten', () => {
    expect(ANZEIGEPHASEN).toEqual([...PHASEN, 'GEPOSTET', 'FEHLGESCHLAGEN'])
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
    // Zwischen den sichtbaren Phasen liegt je eine Arbeitsphase.
    expect(naechstePhase('KONZEPT')).toBe('PRODUKTION')
    expect(naechstePhase('PRODUKTION')).toBe('VORSCHAU')
    expect(naechstePhase('VORSCHAU')).toBe('KORREKTUR')
    expect(naechstePhase('KORREKTUR')).toBe('FINAL')
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

describe('abgeleiteteStufe bei den Arbeitsphasen', () => {
  /*
    Beim Kunden gibt es die Arbeitsphasen nicht. Er sieht in ihnen den Stand
    der Phase davor — und die Leiste soll genau diese Stufe zeigen, nicht
    „Produktion". Das wäre eine Auskunft über unseren Betrieb.
  */
  it('bildet Produktion auf Konzept und Korrektur auf Vorschau ab', () => {
    const kuenftig = new Date(Date.now() + 86400_000)
    expect(abgeleiteteStufe('PRODUKTION', kuenftig)).toBe('KONZEPT')
    expect(abgeleiteteStufe('KORREKTUR', kuenftig)).toBe('VORSCHAU')
  })

  it('lässt die sichtbaren Phasen unverändert', () => {
    const kuenftig = new Date(Date.now() + 86400_000)
    expect(abgeleiteteStufe('KONZEPT', kuenftig)).toBe('KONZEPT')
    expect(abgeleiteteStufe('VORSCHAU', kuenftig)).toBe('VORSCHAU')
    expect(abgeleiteteStufe('FINAL', kuenftig)).toBe('FINAL')
  })

  /*
    Eine Arbeitsphase mit vergangenem Termin ist **nicht** gepostet —
    veröffentlicht wird nur Finales.
  */
  it('macht aus einer Arbeitsphase mit vergangenem Termin kein „Gepostet"', () => {
    const vergangen = new Date(Date.now() - 86400_000)
    expect(abgeleiteteStufe('KORREKTUR', vergangen)).toBe('VORSCHAU')
  })
})
