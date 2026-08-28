import { describe, expect, it } from 'vitest'
import {
  ARBEITSPHASEN,
  arbeitsphaseHinweis,
  geltendePhase,
  istArbeitsphase,
  istSichtbarePhase,
  PHASENFOLGE,
  SICHTBARE_PHASEN,
} from './phasen'

describe('Phasen', () => {
  it('teilt jede Phase in genau eine Sorte', () => {
    for (const phase of PHASENFOLGE) {
      expect(istSichtbarePhase(phase) !== istArbeitsphase(phase)).toBe(true)
    }
    expect([...SICHTBARE_PHASEN, ...ARBEITSPHASEN].sort()).toEqual([...PHASENFOLGE].sort())
  })

  it('gibt in einer sichtbaren Phase ihren eigenen Stand', () => {
    expect(geltendePhase('KONZEPT')).toBe('KONZEPT')
    expect(geltendePhase('VORSCHAU')).toBe('VORSCHAU')
    expect(geltendePhase('FINAL')).toBe('FINAL')
  })

  it('zeigt in einer Arbeitsphase den Stand der Vorgängerin', () => {
    expect(geltendePhase('PRODUKTION')).toBe('KONZEPT')
    expect(geltendePhase('KORREKTUR')).toBe('VORSCHAU')
  })

  /*
    Der Punkt, an dem ein einzelner „letzter Stand" je Beitrag falsch wäre:
    Zurück von Vorschau auf Produktion muss wieder das Konzept gelten.
  */
  it('zeigt auf dem Rückweg wieder die frühere Stufe', () => {
    expect(geltendePhase('PRODUKTION')).not.toBe('VORSCHAU')
  })

  it('hat im Entwurf keinen Stand', () => {
    expect(geltendePhase('ENTWURF')).toBeNull()
  })

  it('sagt neben dem Etikett, was der Kunde sieht', () => {
    expect(arbeitsphaseHinweis('PRODUKTION')).toBe('Kunde sieht Konzept')
    expect(arbeitsphaseHinweis('KORREKTUR')).toBe('Kunde sieht Vorschau')
    expect(arbeitsphaseHinweis('ENTWURF')).toBe('Kunde sieht nichts')
    expect(arbeitsphaseHinweis('VORSCHAU')).toBeNull()
  })
})
