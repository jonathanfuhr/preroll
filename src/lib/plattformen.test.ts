import { describe, expect, it } from 'vitest'
import {
  effektivePlattformen,
  GEBAUTE_PLATTFORMEN,
  moeglichePlattformen,
  plattformenAusFormular,
  sortierePlattformen,
  zielPlattformen,
} from './plattformen'

const BEIDE = { fbSeitenId: 'seite-1', igKontoId: 'ig-1' }
const NUR_FB = { fbSeitenId: 'seite-1', igKontoId: null }
const KEINER = { fbSeitenId: null, igKontoId: null }

describe('sortierePlattformen', () => {
  it('gibt immer dieselbe Reihenfolge, egal wie die Werte hereinkommen', () => {
    expect(sortierePlattformen(['INSTAGRAM', 'FACEBOOK'])).toEqual(['FACEBOOK', 'INSTAGRAM'])
    expect(sortierePlattformen(['FACEBOOK', 'INSTAGRAM'])).toEqual(['FACEBOOK', 'INSTAGRAM'])
  })

  it('wirft Doppelungen und Unbekanntes heraus', () => {
    expect(sortierePlattformen(['FACEBOOK', 'FACEBOOK'])).toEqual(['FACEBOOK'])
    expect(sortierePlattformen([])).toEqual([])
  })
})

describe('zielPlattformen', () => {
  it('nimmt nur, was gewählt **und** zugeordnet ist', () => {
    expect(zielPlattformen(['FACEBOOK', 'INSTAGRAM'], BEIDE)).toEqual(['FACEBOOK', 'INSTAGRAM'])
    expect(zielPlattformen(['INSTAGRAM'], BEIDE)).toEqual(['INSTAGRAM'])
  })

  it('lässt eine gewählte Plattform ohne Kanal einfach weg', () => {
    // Kein Fehlschlag: Es ist nicht misslungen, es war nie möglich.
    expect(zielPlattformen(['FACEBOOK', 'INSTAGRAM'], NUR_FB)).toEqual(['FACEBOOK'])
    expect(zielPlattformen(['FACEBOOK', 'INSTAGRAM'], KEINER)).toEqual([])
  })

  it('ergibt nichts, wenn nichts gewählt ist — auch bei bester Zuordnung', () => {
    expect(zielPlattformen([], BEIDE)).toEqual([])
  })

  it('führt noch nicht gebaute Plattformen nicht als Ziel', () => {
    expect(zielPlattformen(['LINKEDIN', 'YOUTUBE'], BEIDE)).toEqual([])
    expect(zielPlattformen(['LINKEDIN', 'INSTAGRAM'], BEIDE)).toEqual(['INSTAGRAM'])
  })
})

describe('moeglichePlattformen', () => {
  it('sind die, für die ein Kanal zugeordnet ist', () => {
    expect(moeglichePlattformen(BEIDE)).toEqual(['FACEBOOK', 'INSTAGRAM'])
    expect(moeglichePlattformen(NUR_FB)).toEqual(['FACEBOOK'])
    expect(moeglichePlattformen(KEINER)).toEqual([])
  })
})

describe('effektivePlattformen', () => {
  it('schneidet die Wahl des Kunden auf das Eingerichtete', () => {
    expect(effektivePlattformen({ plattformen: ['FACEBOOK', 'INSTAGRAM'], ...NUR_FB })).toEqual([
      'FACEBOOK',
    ])
  })

  it('lässt eine Wahl stehen, die gerade keinen Kanal hat — sie kommt zurück', () => {
    // Die Wahl bleibt in der Datenbank; wirksam ist sie nur mit Kanal. Wird
    // die Seite wieder zugeordnet, steht die alte Wahl ohne Zutun wieder da.
    const kunde = { plattformen: ['FACEBOOK', 'INSTAGRAM'] as const }
    expect(effektivePlattformen({ ...kunde, ...KEINER })).toEqual([])
    expect(effektivePlattformen({ ...kunde, ...BEIDE })).toEqual(['FACEBOOK', 'INSTAGRAM'])
  })

  it('gibt nichts, wenn der Kunde nichts gewählt hat', () => {
    expect(effektivePlattformen({ plattformen: [], ...BEIDE })).toEqual([])
  })
})

describe('plattformenAusFormular', () => {
  function formular(werte: string[]): FormData {
    const f = new FormData()
    for (const w of werte) f.append('plattformen', w)
    return f
  }

  it('liest die angehakten Kästchen', () => {
    expect(plattformenAusFormular(formular(['INSTAGRAM']))).toEqual(['INSTAGRAM'])
    expect(plattformenAusFormular(formular(['INSTAGRAM', 'FACEBOOK']))).toEqual([
      'FACEBOOK',
      'INSTAGRAM',
    ])
  })

  it('nimmt nichts an, was es nicht gibt oder was nicht gebaut ist', () => {
    expect(plattformenAusFormular(formular(['MYSPACE', 'INSTAGRAM']))).toEqual(['INSTAGRAM'])
    expect(plattformenAusFormular(formular(['LINKEDIN']))).toEqual([])
  })

  it('gibt bei einem leeren Formular eine leere Wahl zurück', () => {
    expect(plattformenAusFormular(new FormData())).toEqual([])
  })

  it('liest auch ein anders benanntes Feld', () => {
    const f = new FormData()
    f.append('ziele', 'FACEBOOK')
    expect(plattformenAusFormular(f, 'ziele')).toEqual(['FACEBOOK'])
  })
})

describe('GEBAUTE_PLATTFORMEN', () => {
  it('sind heute Facebook und Instagram', () => {
    // Zieht LinkedIn oder YouTube ein, ist das hier die Stelle, an der es
    // auffällt — samt der Auswahl, die sich dann automatisch mitändert.
    expect(GEBAUTE_PLATTFORMEN).toEqual(['FACEBOOK', 'INSTAGRAM'])
  })
})
