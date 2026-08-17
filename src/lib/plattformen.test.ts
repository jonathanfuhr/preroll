import { describe, expect, it } from 'vitest'
import {
  angezeigtePlattformen,
  modusFuer,
  postenZiele,
  wahlAusFormular,
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
  it('sind die, für die ein Kanal zugeordnet ist — nur die dürfen „posten"', () => {
    expect(moeglichePlattformen(BEIDE)).toEqual(['FACEBOOK', 'INSTAGRAM'])
    expect(moeglichePlattformen(NUR_FB)).toEqual(['FACEBOOK'])
    expect(moeglichePlattformen(KEINER)).toEqual([])
  })
})

describe('effektivePlattformen', () => {
  it('ist alles, was der Kunde bespielt — Kanal hin oder her', () => {
    // Fürs Planen braucht es keinen Kanal. Genau das war vorher nicht
    // ausdrückbar: „für Instagram planen, von Hand posten".
    expect(effektivePlattformen({ plattformen: ['FACEBOOK', 'INSTAGRAM'] })).toEqual([
      'FACEBOOK',
      'INSTAGRAM',
    ])
  })

  it('gibt nichts, wenn der Kunde nichts gewählt hat', () => {
    expect(effektivePlattformen({ plattformen: [] })).toEqual([])
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
    // YouTube steht im Enum, ist aber nicht gebaut.
    expect(plattformenAusFormular(formular(['YOUTUBE']))).toEqual([])
  })

  it('nimmt LinkedIn an, seit es gebaut ist', () => {
    expect(plattformenAusFormular(formular(['LINKEDIN']))).toEqual(['LINKEDIN'])
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
  it('sind heute Facebook, Instagram und LinkedIn', () => {
    // Zieht YouTube ein, ist das hier die Stelle, an der es auffällt — samt
    // der Auswahl, die sich dann automatisch mitändert.
    expect(GEBAUTE_PLATTFORMEN).toEqual(['FACEBOOK', 'INSTAGRAM', 'LINKEDIN'])
  })
})

describe('LinkedIn hängt an seiner eigenen Zuordnung', () => {
  const MIT_LI = { fbSeitenId: null, igKontoId: null, liOrganisationId: 'org-1' }

  it('gilt, sobald eine Organisation zugeordnet ist', () => {
    expect(zielPlattformen(['LINKEDIN'], MIT_LI)).toEqual(['LINKEDIN'])
  })

  it('fällt ohne Organisation weg, auch wenn eine Facebook-Seite hängt', () => {
    // Die beiden Anbieter haben nichts miteinander zu tun: Eine Facebook-Seite
    // ist keine LinkedIn-Seite.
    expect(zielPlattformen(['LINKEDIN'], BEIDE)).toEqual([])
  })

  it('lässt Meta unberührt, wenn nur LinkedIn hängt', () => {
    expect(zielPlattformen(['FACEBOOK', 'INSTAGRAM', 'LINKEDIN'], MIT_LI)).toEqual(['LINKEDIN'])
  })

  it('steht in der festen Reihenfolge hinter Meta', () => {
    expect(
      zielPlattformen(['LINKEDIN', 'INSTAGRAM', 'FACEBOOK'], { ...BEIDE, liOrganisationId: 'org-1' }),
    ).toEqual(['FACEBOOK', 'INSTAGRAM', 'LINKEDIN'])
  })
})

describe('angezeigtePlattformen', () => {
  const post = { plattformen: ['FACEBOOK', 'INSTAGRAM'] as const }

  it('zeigt, was der Kunde bespielt — mit Kanal oder ohne', () => {
    expect(angezeigtePlattformen(post, { plattformen: ['FACEBOOK', 'INSTAGRAM'] })).toEqual([
      'FACEBOOK',
      'INSTAGRAM',
    ])
  })

  it('lässt weg, was der Kunde abgeschaltet hat — die rohe Wahl bleibt stehen', () => {
    expect(angezeigtePlattformen(post, { plattformen: ['FACEBOOK'] })).toEqual(['FACEBOOK'])
    expect(angezeigtePlattformen(post, { plattformen: [] })).toEqual([])
  })

  it('hängt nicht am Kanal — geplant ist geplant, auch wenn von Hand gepostet wird', () => {
    expect(angezeigtePlattformen(post, { plattformen: ['INSTAGRAM'] })).toEqual(['INSTAGRAM'])
  })
})

describe('modusFuer', () => {
  const kunde = { plattformen: ['FACEBOOK', 'INSTAGRAM'], postenPlattformen: ['FACEBOOK'] } as const

  it('nennt die drei Zustände', () => {
    expect(modusFuer(kunde, 'FACEBOOK')).toBe('POSTEN')
    expect(modusFuer(kunde, 'INSTAGRAM')).toBe('PLANEN')
    expect(modusFuer(kunde, 'LINKEDIN')).toBe('AUS')
  })
})

describe('wahlAusFormular', () => {
  const formular = (werte: Record<string, string>) => {
    const f = new FormData()
    for (const [k, v] of Object.entries(werte)) f.set(k, v)
    return f
  }

  it('trennt Planen von Posten', () => {
    const wahl = wahlAusFormular(
      formular({ modus_FACEBOOK: 'POSTEN', modus_INSTAGRAM: 'PLANEN', modus_LINKEDIN: 'AUS' }),
      BEIDE,
    )
    expect(wahl.plattformen).toEqual(['FACEBOOK', 'INSTAGRAM'])
    expect(wahl.postenPlattformen).toEqual(['FACEBOOK'])
  })

  it('stuft „posten" ohne Kanal auf „planen" herunter, statt abzuweisen', () => {
    // Passiert, wenn jemand in einem Zug den Kanal entfernt und den Modus
    // stehen lässt. Die Absicht ist eindeutig: geplant bleibt geplant.
    const wahl = wahlAusFormular(formular({ modus_INSTAGRAM: 'POSTEN' }), NUR_FB)
    expect(wahl.plattformen).toEqual(['INSTAGRAM'])
    expect(wahl.postenPlattformen).toEqual([])
  })

  it('nimmt ein fehlendes Feld als „aus"', () => {
    expect(wahlAusFormular(formular({}), BEIDE).plattformen).toEqual([])
  })
})

describe('postenZiele', () => {
  const post = { plattformen: ['FACEBOOK', 'INSTAGRAM'] as const }

  it('verlangt alle drei: Beitrag, Modus und Kanal', () => {
    const kunde = {
      plattformen: ['FACEBOOK', 'INSTAGRAM'],
      postenPlattformen: ['FACEBOOK', 'INSTAGRAM'],
      ...BEIDE,
    } as const
    expect(postenZiele(post, kunde)).toEqual(['FACEBOOK', 'INSTAGRAM'])
  })

  it('postet nicht, wo der Kunde nur plant', () => {
    const kunde = {
      plattformen: ['FACEBOOK', 'INSTAGRAM'],
      postenPlattformen: ['FACEBOOK'],
      ...BEIDE,
    } as const
    expect(postenZiele(post, kunde)).toEqual(['FACEBOOK'])
  })

  it('postet nicht ohne Kanal, auch wenn der Modus es sagt', () => {
    const kunde = {
      plattformen: ['FACEBOOK', 'INSTAGRAM'],
      postenPlattformen: ['FACEBOOK', 'INSTAGRAM'],
      ...NUR_FB,
    } as const
    expect(postenZiele(post, kunde)).toEqual(['FACEBOOK'])
  })
})
