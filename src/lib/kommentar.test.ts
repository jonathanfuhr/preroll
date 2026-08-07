import { describe, expect, it } from 'vitest'
import { darfBearbeiten, darfErledigen, darfLoeschen } from './kommentar-rechte'
import {
  alsKlartext,
  erwaehnungMarke,
  erwaehnungenAus,
  istIntern,
  zerlegeText,
} from './kommentar-text'

describe('Erwähnungen im Text', () => {
  const marke = erwaehnungMarke('nutzer', 'n1', 'Helena Avdijaj')

  it('findet Kennung und Namen wieder', () => {
    expect(erwaehnungenAus(`Hallo ${marke}, schaust du drauf?`)).toEqual([
      { art: 'nutzer', id: 'n1', name: 'Helena Avdijaj' },
    ])
  })

  it('unterscheidet Team und Gast', () => {
    const text = `${marke} und ${erwaehnungMarke('gast', 'g1', 'M. Beispiel')}`
    expect(erwaehnungenAus(text).map((e) => e.art)).toEqual(['nutzer', 'gast'])
  })

  it('nennt dieselbe Person nur einmal — sonst gäbe es zwei Mails', () => {
    expect(erwaehnungenAus(`${marke} ${marke}`)).toHaveLength(1)
  })

  it('lässt ein einfaches @ in Ruhe', () => {
    expect(erwaehnungenAus('Schreib an @helena oder per Mail')).toEqual([])
  })

  it('macht für Mail und PDF wieder lesbaren Text daraus', () => {
    expect(alsKlartext(`Hallo ${marke}!`)).toBe('Hallo @Helena Avdijaj!')
  })

  it('wirft Klammern aus dem Namen — sie würden das Muster zerlegen', () => {
    const heikel = erwaehnungMarke('nutzer', 'n2', 'Ka[rl] (Design)')
    expect(erwaehnungenAus(heikel)).toEqual([{ art: 'nutzer', id: 'n2', name: 'Karl Design' }])
  })

  it('zerlegt in Text und Erwähnung, in der Reihenfolge des Textes', () => {
    const stuecke = zerlegeText(`Hi ${marke} bitte`)
    expect(stuecke.map((s) => s.art)).toEqual(['text', 'erwaehnung', 'text'])
    expect(stuecke[0]).toEqual({ art: 'text', inhalt: 'Hi ' })
    expect(stuecke[2]).toEqual({ art: 'text', inhalt: ' bitte' })
  })

  it('behält Text ohne Erwähnung als ein Stück', () => {
    expect(zerlegeText('Nur Text')).toEqual([{ art: 'text', inhalt: 'Nur Text' }])
  })
})

describe('Rechte an einem Kommentar', () => {
  const vonHelena = { nutzerId: 'n1', gastId: null }
  const vomGast = { nutzerId: null, gastId: 'g1' }

  const helena = { art: 'nutzer', id: 'n1', rolle: 'DESIGNER' } as const
  const kollege = { art: 'nutzer', id: 'n2', rolle: 'DESIGNER' } as const
  const chefin = { art: 'nutzer', id: 'n3', rolle: 'ADMIN' } as const
  const gast = { art: 'gast', id: 'g1' } as const
  const andererGast = { art: 'gast', id: 'g2' } as const

  it('lässt jeden an den eigenen Kommentar', () => {
    expect(darfBearbeiten(vonHelena, helena)).toBe(true)
    expect(darfBearbeiten(vomGast, gast)).toBe(true)
  })

  it('hält Kolleginnen und Kollegen von fremden Kommentaren fern', () => {
    expect(darfBearbeiten(vonHelena, kollege)).toBe(false)
    expect(darfBearbeiten(vomGast, andererGast)).toBe(false)
  })

  it('lässt die Administration überall aufräumen', () => {
    expect(darfBearbeiten(vonHelena, chefin)).toBe(true)
    expect(darfLoeschen(vomGast, chefin)).toBe(true)
  })

  it('macht aus einem Gast keinen Admin — auch nicht mit fremder Kennung', () => {
    expect(darfBearbeiten({ nutzerId: 'n1', gastId: null }, { art: 'gast', id: 'n1' })).toBe(false)
  })

  it('erledigt nur das Team', () => {
    expect(darfErledigen(kollege)).toBe(true)
    expect(darfErledigen(gast)).toBe(false)
  })
})

describe('#intern', () => {
  it('erkennt die Marke am Anfang und mitten im Text', () => {
    expect(istIntern('#intern kurz abstimmen')).toBe(true)
    expect(istIntern('Machen wir das so? #intern')).toBe(true)
    expect(istIntern('#INTERN')).toBe(true)
  })

  it('lässt gewöhnlichen Text in Ruhe', () => {
    expect(istIntern('Bitte das Logo tauschen')).toBe(false)
    expect(istIntern('#interne Abstimmung folgt')).toBe(false)
    expect(istIntern('siehe www.beispiel.de/#intern')).toBe(false)
  })
})
