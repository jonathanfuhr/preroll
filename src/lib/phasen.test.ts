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

/*
  Zwei Fragen, die beim Durchgehen aufkamen und leicht falsch beantwortet
  werden — deshalb hier festgehalten statt nur im Kopf.
*/
describe('Der Rückweg durch die Phasen', () => {
  /**
   * Von der Vorschau zurück in die Produktion sieht der Kunde wieder das
   * **Konzept**, nicht die Vorschau. Das ist der Punkt, an dem ein einzelner
   * „letzter Stand" je Beitrag die falsche Antwort gäbe.
   */
  it('zeigt in der Produktion immer den Konzept-Stand, egal woher man kommt', () => {
    expect(geltendePhase('PRODUKTION')).toBe('KONZEPT')
  })

  /**
   * Eingefroren wird nur beim Verlassen einer **sichtbaren** Phase. Wer aus
   * einer Arbeitsphase heraus die Phase wechselt, schreibt keinen Stand — die
   * halbfertige Arbeit darf nie zu dem werden, was der Kunde später als
   * freigegebenen Stand sieht.
   */
  it('friert beim Verlassen einer Arbeitsphase nichts ein', () => {
    expect(istSichtbarePhase('PRODUKTION')).toBe(false)
    expect(istSichtbarePhase('KORREKTUR')).toBe(false)
    expect(istSichtbarePhase('ENTWURF')).toBe(false)
  })
})
