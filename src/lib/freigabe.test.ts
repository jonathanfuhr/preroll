import { describe, expect, it } from 'vitest'
import {
  darfInternFreigeben,
  freigabeFortschritt,
  freigabeStand,
  istInterneStufe,
  offeneKundenstufe,
  offeneStufe,
} from './freigabe'

describe('Welche Freigabe ansteht', () => {
  it('nennt für jede Phase außer Final ihre eigene Stufe', () => {
    expect(offeneStufe('ENTWURF')).toBe('ENTWURF')
    expect(offeneStufe('KONZEPT')).toBe('KONZEPT')
    expect(offeneStufe('PRODUKTION')).toBe('PRODUKTION')
    expect(offeneStufe('VORSCHAU')).toBe('VORSCHAU')
    expect(offeneStufe('KORREKTUR')).toBe('KORREKTUR')
  })

  it('lässt bei Final nichts offen — dort ist nichts mehr abzusegnen', () => {
    expect(offeneStufe('FINAL')).toBeNull()
  })

  it('trennt intern von extern über die Phase, nicht über ein Feld', () => {
    expect(istInterneStufe('ENTWURF')).toBe(true)
    expect(istInterneStufe('PRODUKTION')).toBe(true)
    expect(istInterneStufe('KORREKTUR')).toBe(true)
    expect(istInterneStufe('KONZEPT')).toBe(false)
    expect(istInterneStufe('VORSCHAU')).toBe(false)
  })

  /*
    Der Kunde wird in einer Arbeitsphase um nichts gebeten: Wir arbeiten
    gerade, er sieht den Stand davor.
  */
  it('verlangt vom Kunden nur in den sichtbaren Phasen etwas', () => {
    expect(offeneKundenstufe('KONZEPT')).toBe('KONZEPT')
    expect(offeneKundenstufe('VORSCHAU')).toBe('VORSCHAU')
    expect(offeneKundenstufe('ENTWURF')).toBeNull()
    expect(offeneKundenstufe('PRODUKTION')).toBeNull()
    expect(offeneKundenstufe('KORREKTUR')).toBeNull()
    expect(offeneKundenstufe('FINAL')).toBeNull()
  })
})

describe('Wer intern freigeben darf', () => {
  it('lässt nur Administration und Projektmanagement', () => {
    expect(darfInternFreigeben('ADMIN')).toBe(true)
    expect(darfInternFreigeben('PROJEKTMANAGER')).toBe(true)
    expect(darfInternFreigeben('DESIGNER')).toBe(false)
    expect(darfInternFreigeben('EDITOR')).toBe(false)
  })
})

describe('Der Stand eines Beitrags', () => {
  it('meldet die interne Stufe erledigt, sobald sie vorliegt', () => {
    expect(freigabeStand('PRODUKTION', ['PRODUKTION']).erledigt).toBe(true)
    expect(freigabeStand('PRODUKTION', ['KONZEPT']).erledigt).toBe(false)
  })

  /*
    Auf der Kundenseite dürfen die internen Freigaben nirgends auftauchen —
    weder als Aufgabe noch als erteilter Eintrag.
  */
  it('blendet in der Kundensicht die internen Stufen aus', () => {
    const stand = freigabeStand('PRODUKTION', ['ENTWURF', 'KONZEPT', 'PRODUKTION'], true)
    expect(stand.offen).toBeNull()
    expect(stand.erteilt).toEqual(['KONZEPT'])
  })

  it('zählt in der Kundensicht eine Arbeitsphase als nichts Offenes', () => {
    const posts = [
      { status: 'PRODUKTION' as const, freigaben: [] },
      { status: 'KONZEPT' as const, freigaben: [] },
    ]
    expect(freigabeFortschritt(posts, true)).toMatchObject({ erledigt: 1, gesamt: 2 })
    // Intern zählt dieselbe Lage anders: Dort steht die Produktionsfreigabe aus.
    expect(freigabeFortschritt(posts)).toMatchObject({ erledigt: 0, gesamt: 2 })
  })
})
