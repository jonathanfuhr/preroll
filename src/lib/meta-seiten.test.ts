import { describe, expect, it } from 'vitest'
import { fasseSeitenZusammen } from './meta-seiten'

const seite = (id: string, name: string) => ({
  id,
  name,
  token: `tok-${id}`,
  igKontoId: null,
  igName: null,
})

describe('fasseSeitenZusammen', () => {
  it('legt die Seiten aller Zugänge in eine Liste', () => {
    const alle = fasseSeitenZusammen([
      { zugangId: 'a', zugangName: 'Nord', seiten: [seite('1', 'Bäckerei Sonne')] },
      { zugangId: 'b', zugangName: 'Süd', seiten: [seite('2', 'Autohaus Vogel')] },
    ])

    expect(alle.map((s) => s.name)).toEqual(['Autohaus Vogel', 'Bäckerei Sonne'])
    expect(alle.map((s) => s.zugangName)).toEqual(['Süd', 'Nord'])
  })

  it('nennt zu jeder Seite ihren Zugang', () => {
    const [erste] = fasseSeitenZusammen([
      { zugangId: 'a', zugangName: 'Nord', seiten: [seite('1', 'Bäckerei Sonne')] },
    ])
    expect(erste.zugangId).toBe('a')
    expect(erste.zugangName).toBe('Nord')
  })

  it('zeigt eine doppelt zugewiesene Seite nur einmal — am zuerst genannten Zugang', () => {
    const alle = fasseSeitenZusammen([
      { zugangId: 'alt', zugangName: 'Nord', seiten: [seite('1', 'Bäckerei Sonne')] },
      { zugangId: 'neu', zugangName: 'Süd', seiten: [seite('1', 'Bäckerei Sonne')] },
    ])

    expect(alle).toHaveLength(1)
    expect(alle[0].zugangId).toBe('alt')
  })

  it('sortiert nach Seitennamen, nicht nach Zugang', () => {
    const alle = fasseSeitenZusammen([
      { zugangId: 'a', zugangName: 'Nord', seiten: [seite('1', 'Zahnarzt Weiß'), seite('2', 'Apotheke Adler')] },
    ])
    expect(alle.map((s) => s.name)).toEqual(['Apotheke Adler', 'Zahnarzt Weiß'])
  })

  it('kommt mit gar keinem Zugang zurecht', () => {
    expect(fasseSeitenZusammen([])).toEqual([])
  })
})
