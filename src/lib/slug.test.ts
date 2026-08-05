import { describe, expect, it } from 'vitest'
import { initialen, slugify } from './slug'

describe('slugify', () => {
  it('macht aus einem Kundennamen einen Pfad', () => {
    expect(slugify('Beispiel Handwerk GmbH')).toBe('beispiel-handwerk')
  })

  it('schreibt Umlaute aus', () => {
    expect(slugify('Grünflächen Müller')).toBe('gruenflaechen-mueller')
    expect(slugify('Straßenbau Weiß')).toBe('strassenbau-weiss')
  })

  it('wirft Sonderzeichen weg', () => {
    expect(slugify('Meier & Söhne GmbH / Co. KG')).toBe('meier-soehne-gmbh-co-kg')
  })

  it('lässt keine Bindestriche am Rand stehen', () => {
    expect(slugify('  --Test--  ')).toBe('test')
  })
})

describe('initialen', () => {
  it('nimmt erstes und letztes Wort', () => {
    expect(initialen('Helena Avdijaj')).toBe('HA')
    expect(initialen('Anna Maria Schmidt')).toBe('AS')
  })

  it('kommt mit einem einzelnen Wort zurecht', () => {
    expect(initialen('Marco')).toBe('MA')
  })

  it('fällt bei leerem Namen auf Fragezeichen zurück', () => {
    expect(initialen('   ')).toBe('??')
  })
})
