import { describe, expect, it } from 'vitest'
import { hatWirkung, kundenwirkung, wirkungSaetze } from './kundenwirkung'

const KUENFTIG = new Date(Date.now() + 30 * 86400_000)

function w(vorher: Parameters<typeof kundenwirkung>[0], nachher: Parameters<typeof kundenwirkung>[1]) {
  return kundenwirkung(vorher, nachher, KUENFTIG)
}

describe('Was der Kunde von einem Phasenwechsel merkt', () => {
  it('sagt nichts, wenn sich die Phase nicht ändert', () => {
    expect(hatWirkung(w('KONZEPT', 'KONZEPT'))).toBe(false)
  })

  /*
    Der Entwurf verlässt das Haus nie — das ist die ganze Nachricht, über
    Stufen zu reden wäre daneben.
  */
  it('meldet Verschwinden und Erscheinen beim Entwurf', () => {
    expect(w('VORSCHAU', 'ENTWURF')).toMatchObject({ sichtbarkeit: 'verschwindet', stufe: null })
    expect(w('ENTWURF', 'KONZEPT')).toMatchObject({ sichtbarkeit: 'erscheint' })
    expect(wirkungSaetze(w('VORSCHAU', 'ENTWURF'))).toHaveLength(1)
  })

  it('friert ein, wenn die Arbeitsphase auf die eben verlassene zeigt', () => {
    expect(w('KONZEPT', 'PRODUKTION').inhalt).toBe('friert-ein')
    expect(w('VORSCHAU', 'KORREKTUR').inhalt).toBe('friert-ein')
  })

  /*
    Der Fall, um den es eigentlich geht: Von der Vorschau in die Produktion
    sieht der Kunde wieder das Konzept — für ihn ein Sprung rückwärts.
  */
  it('warnt vor dem Sprung zurück', () => {
    expect(w('VORSCHAU', 'PRODUKTION').inhalt).toBe('springt-zurueck')
    expect(w('FINAL', 'PRODUKTION').inhalt).toBe('springt-zurueck')
    expect(w('KORREKTUR', 'PRODUKTION').inhalt).toBe('springt-zurueck')
  })

  it('meldet die Rückkehr zum aktuellen Stand', () => {
    expect(w('PRODUKTION', 'KONZEPT').inhalt).toBe('wird-live')
    expect(w('KORREKTUR', 'FINAL').inhalt).toBe('wird-live')
  })

  it('lässt den Inhalt in Ruhe, wenn beide Phasen sichtbar sind', () => {
    expect(w('KONZEPT', 'VORSCHAU').inhalt).toBeNull()
    expect(w('VORSCHAU', 'FINAL').inhalt).toBeNull()
  })

  it('nennt den Wechsel der Stufe in der Zeitleiste', () => {
    expect(w('KONZEPT', 'VORSCHAU').stufe).toEqual({ vorher: 'KONZEPT', nachher: 'VORSCHAU' })
    // Produktion bildet der Kunde auf Konzept ab — seine Stufe bleibt gleich.
    expect(w('KONZEPT', 'PRODUKTION').stufe).toBeNull()
  })

  /*
    Ein Wechsel, der beim Kunden wirklich nichts bewirkt, darf keine Rückfrage
    auslösen — sonst klickt man sie weg, ohne sie zu lesen.
  */
  it('bleibt still, wo beim Kunden nichts geschieht', () => {
    expect(hatWirkung(w('KORREKTUR', 'PRODUKTION'))).toBe(true) // springt zurück
    expect(hatWirkung(w('KONZEPT', 'PRODUKTION'))).toBe(true) // friert ein
    // Gleiche Stufe, gleicher Stand, beides sichtbar: hier gibt es nichts zu melden.
    expect(hatWirkung(kundenwirkung('FINAL', 'FINAL', KUENFTIG))).toBe(false)
  })

  it('formuliert jede Wirkung als Satz über den Kunden', () => {
    const saetze = wirkungSaetze(w('VORSCHAU', 'PRODUKTION'))
    expect(saetze.join(' ')).toMatch(/früheren Stand/)
    expect(saetze.every((s) => s.trim().endsWith('.'))).toBe(true)
  })
})
