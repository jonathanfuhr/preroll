import { describe, expect, it } from 'vitest'
import { KUNDENFARBEN, kundenFarbe } from './kunde-farbe'

describe('kundenFarbe', () => {
  it('gibt demselben Kunden immer dieselbe Farbe', () => {
    // Der eigentliche Sinn: Eine Farbe, die sich bei jedem Laden ändert, ist
    // keine Wiedererkennung, sondern Flackern.
    const einmal = kundenFarbe('cafe-morgenrot')
    for (let i = 0; i < 50; i++) {
      expect(kundenFarbe('cafe-morgenrot')).toBe(einmal)
    }
  })

  it('bleibt in der Palette', () => {
    for (const slug of ['a', 'nordlicht-immobilien', 'x'.repeat(300), 'ä-ö-ü', '']) {
      expect(KUNDENFARBEN).toContain(kundenFarbe(slug))
    }
  })

  it('verteilt eine Handvoll Kunden auf verschiedene Farben', () => {
    const slugs = [
      'autohaus-brenner',
      'beispiel-handwerk',
      'cafe-morgenrot',
      'nordlicht-immobilien',
      'physio-am-park',
      'steuerkanzlei-weber',
    ]
    const farben = new Set(slugs.map(kundenFarbe))
    // Kollisionen sind bei zwölf Farben möglich und hingenommen — der Name
    // steht daneben. Dass sechs Kunden aber auf einer oder zwei Farben landen,
    // wäre ein kaputter Streuwert.
    expect(farben.size).toBeGreaterThanOrEqual(5)
  })

  it('unterscheidet Slugs, die sich nur in einem Zeichen unterscheiden', () => {
    // Ein schwacher Streuwert (etwa die Quersumme) gäbe hier dasselbe.
    const nah = ['kunde-a', 'kunde-b', 'kunde-c', 'kunde-d']
    expect(new Set(nah.map(kundenFarbe)).size).toBeGreaterThanOrEqual(3)
  })

  it('hat zwölf verschiedene Farben in der Palette', () => {
    expect(new Set(KUNDENFARBEN).size).toBe(KUNDENFARBEN.length)
    expect(KUNDENFARBEN).toHaveLength(12)
  })
})
