import { describe, expect, it } from 'vitest'
import {
  fassungFuer,
  fassungenFuerAnzeige,
  freiePlattformen,
  varianteFuer,
  type Hauptbeitrag,
  type Variante,
  type VariantenMedium,
} from './varianten'

/**
 * Die Erbregel ist der Kern von Punkt 9 — und die Stelle, an der ein Fehler
 * bedeutet, dass auf einer Plattform etwas anderes rausgeht als gedacht.
 */

function medium(id: string, teil: Partial<VariantenMedium> = {}): VariantenMedium {
  return {
    rolle: 'MEDIUM',
    position: 0,
    mediumId: id,
    medium: { mimeTyp: 'image/jpeg' },
    ...teil,
  }
}

const POST: Hauptbeitrag = {
  caption: 'Aus alt wird neu. #handwerk',
  verhaeltnis: 'HOCH_4_5',
  medien: [medium('haupt-1')],
  klappeVersionId: null,
}

function variante(teil: Partial<Variante> = {}): Variante {
  return {
    id: 'v1',
    plattformen: ['LINKEDIN'],
    caption: null,
    verhaeltnis: null,
    medien: [],
    klappeVersionId: null,
    position: 0,
    ...teil,
  }
}

describe('fassungFuer — leer heißt geerbt', () => {
  it('nimmt ohne Variante alles vom Beitrag', () => {
    const f = fassungFuer(POST, [], 'INSTAGRAM')

    expect(f.varianteId).toBeNull()
    expect(f.caption).toBe(POST.caption)
    expect(f.medien).toEqual(POST.medien)
    expect(f.eigeneCaption).toBe(false)
    expect(f.eigeneMedien).toBe(false)
  })

  it('erbt das Medium, wenn nur die Caption abweicht', () => {
    const f = fassungFuer(POST, [variante({ caption: 'Fachkräfte gesucht.' })], 'LINKEDIN')

    expect(f.caption).toBe('Fachkräfte gesucht.')
    expect(f.medien).toEqual(POST.medien)
    expect(f.eigeneCaption).toBe(true)
    expect(f.eigeneMedien).toBe(false)
  })

  it('erbt die Caption, wenn nur das Medium abweicht', () => {
    const eigen = [medium('var-1')]
    const f = fassungFuer(POST, [variante({ medien: eigen })], 'LINKEDIN')

    expect(f.caption).toBe(POST.caption)
    expect(f.medien).toEqual(eigen)
    expect(f.eigeneCaption).toBe(false)
    expect(f.eigeneMedien).toBe(true)
  })

  it('behandelt eine Caption aus Leerzeichen wie leer', () => {
    // Sonst stünde beim Kunden eine leere Fassung, weil jemand ins Feld
    // geklickt und wieder herausgeklickt hat.
    const f = fassungFuer(POST, [variante({ caption: '   \n ' })], 'LINKEDIN')

    expect(f.caption).toBe(POST.caption)
    expect(f.eigeneCaption).toBe(false)
  })

  it('lässt eine Plattform ohne passende Variante unberührt', () => {
    const f = fassungFuer(POST, [variante({ plattformen: ['LINKEDIN'] })], 'INSTAGRAM')
    expect(f.varianteId).toBeNull()
  })

  it('nimmt ein eigenes Verhältnis nur mit eigenen Medien', () => {
    // Ein anderes Verhältnis ohne eigenes Bild wäre eine Fläche, für die das
    // geerbte Bild nicht gemacht ist.
    const ohne = fassungFuer(POST, [variante({ verhaeltnis: 'QUADRAT_1_1' })], 'LINKEDIN')
    expect(ohne.verhaeltnis).toBe('HOCH_4_5')

    const mit = fassungFuer(
      POST,
      [variante({ verhaeltnis: 'QUADRAT_1_1', medien: [medium('var-1')] })],
      'LINKEDIN',
    )
    expect(mit.verhaeltnis).toBe('QUADRAT_1_1')
  })

  it('ersetzt Medien als Ganzes, nicht Stück für Stück', () => {
    // Ein Karussell, dessen zweiter Slide aus der Variante und dessen dritter
    // aus dem Beitrag kommt, hätte niemand so gemeint.
    const post: Hauptbeitrag = {
      ...POST,
      medien: [
        medium('h1', { rolle: 'SLIDE', position: 0 }),
        medium('h2', { rolle: 'SLIDE', position: 1 }),
        medium('h3', { rolle: 'SLIDE', position: 2 }),
      ],
    }
    const f = fassungFuer(
      post,
      [variante({ medien: [medium('v1', { rolle: 'SLIDE', position: 0 })] })],
      'LINKEDIN',
    )

    expect(f.medien.map((m) => m.mediumId)).toEqual(['v1'])
  })

  /*
    Der Video-Platz zählt als Ganzes — mit allen drei Quellen. Eine Fassung,
    deren Video aus Klappe kommt, hat kein eigenes Medium; nur die Medienliste
    zu prüfen schöbe ihr das Video des Beitrags unter.
  */
  it('nimmt die Klappe-Fassung der Variante statt der des Beitrags', () => {
    const post: Hauptbeitrag = { ...POST, medien: [], klappeVersionId: 'haupt-schnitt' }
    const f = fassungFuer(post, [variante({ klappeVersionId: 'linkedin-schnitt' })], 'LINKEDIN')

    expect(f.klappeVersionId).toBe('linkedin-schnitt')
    expect(f.eigeneMedien).toBe(true)
  })

  it('erbt die Klappe-Fassung, solange die Variante nichts Eigenes hat', () => {
    const post: Hauptbeitrag = { ...POST, medien: [], klappeVersionId: 'haupt-schnitt' }
    const f = fassungFuer(post, [variante({ caption: 'Nur anderer Text' })], 'LINKEDIN')

    expect(f.klappeVersionId).toBe('haupt-schnitt')
    expect(f.eigeneMedien).toBe(false)
  })

  it('lässt ein eigenes Video die Klappe-Fassung des Beitrags verdrängen', () => {
    const post: Hauptbeitrag = { ...POST, medien: [], klappeVersionId: 'haupt-schnitt' }
    const f = fassungFuer(post, [variante({ medien: [medium('eigenes-video')] })], 'LINKEDIN')

    expect(f.klappeVersionId).toBeNull()
    expect(f.medien.map((m) => m.mediumId)).toEqual(['eigenes-video'])
  })
})

describe('varianteFuer', () => {
  it('findet die Variante über die Plattform', () => {
    const v = variante({ plattformen: ['LINKEDIN', 'FACEBOOK'] })
    expect(varianteFuer([v], 'FACEBOOK')?.id).toBe('v1')
    expect(varianteFuer([v], 'INSTAGRAM')).toBeNull()
  })

  it('entscheidet sich bei Doppelung für die erste nach Position', () => {
    // Soll beim Speichern nicht vorkommen. Eine Anzeige, die an einer
    // widersprüchlichen Eingabe abstürzt, wäre trotzdem schlechter.
    const a = variante({ id: 'spaet', position: 2 })
    const b = variante({ id: 'frueh', position: 1 })
    expect(varianteFuer([a, b], 'LINKEDIN')?.id).toBe('frueh')
  })
})

describe('fassungenFuerAnzeige', () => {
  it('stellt das Hauptformat voran und nennt seine Plattformen', () => {
    const f = fassungenFuerAnzeige(POST, [], ['INSTAGRAM', 'FACEBOOK'])

    expect(f).toHaveLength(1)
    expect(f[0].varianteId).toBeNull()
    expect(f[0].plattformen).toEqual(['FACEBOOK', 'INSTAGRAM'])
  })

  it('fasst eine Variante für zwei Plattformen zu einer Zeile zusammen', () => {
    // Zweimal derselbe Text unter zwei Überschriften liest sich wie ein
    // Unterschied, wo keiner ist.
    const v = variante({ plattformen: ['LINKEDIN', 'FACEBOOK'], caption: 'Sachlicher.' })
    const f = fassungenFuerAnzeige(POST, [v], ['INSTAGRAM', 'FACEBOOK', 'LINKEDIN'])

    expect(f).toHaveLength(2)
    expect(f[0].plattformen).toEqual(['INSTAGRAM'])
    expect(f[1].plattformen).toEqual(['FACEBOOK', 'LINKEDIN'])
    expect(f[1].caption).toBe('Sachlicher.')
  })

  it('hält zwei verschiedene Varianten auseinander', () => {
    const f = fassungenFuerAnzeige(
      POST,
      [
        variante({ id: 'a', plattformen: ['LINKEDIN'], caption: 'A', position: 0 }),
        variante({ id: 'b', plattformen: ['FACEBOOK'], caption: 'B', position: 1 }),
      ],
      ['INSTAGRAM', 'FACEBOOK', 'LINKEDIN'],
    )

    expect(f.map((x) => x.varianteId)).toEqual([null, 'b', 'a'])
  })

  it('behält das Hauptformat, auch wenn jede Plattform abweicht', () => {
    // Eine Abweichung ohne Bezugspunkt wäre nicht verständlich.
    const v = variante({ plattformen: ['INSTAGRAM'], caption: 'Anders.' })
    const f = fassungenFuerAnzeige(POST, [v], ['INSTAGRAM'])

    expect(f).toHaveLength(2)
    expect(f[0].varianteId).toBeNull()
    expect(f[0].plattformen).toEqual([])
  })

  it('lässt eine Variante für eine Plattform ohne Kanal ganz weg', () => {
    // Sonst versprächen wir dem Kunden eine Fassung, die nie irgendwo auftaucht.
    const v = variante({ plattformen: ['LINKEDIN'], caption: 'Anders.' })
    const f = fassungenFuerAnzeige(POST, [v], ['INSTAGRAM'])

    expect(f).toHaveLength(1)
    expect(f[0].varianteId).toBeNull()
  })

  it('gibt ohne Ziele nichts zurück', () => {
    expect(fassungenFuerAnzeige(POST, [variante()], [])).toEqual([])
  })
})

describe('freiePlattformen', () => {
  const MOEGLICH = ['FACEBOOK', 'INSTAGRAM', 'LINKEDIN'] as const

  it('lässt nur, was in keiner anderen Variante steht', () => {
    const v = variante({ plattformen: ['LINKEDIN'] })
    expect(freiePlattformen(MOEGLICH, [v])).toEqual(['FACEBOOK', 'INSTAGRAM'])
  })

  it('rechnet die eigene Variante beim Bearbeiten heraus', () => {
    // Sonst könnte niemand die Variante speichern, in der er gerade steht.
    const v = variante({ id: 'v1', plattformen: ['LINKEDIN'] })
    expect(freiePlattformen(MOEGLICH, [v], 'v1')).toEqual([
      'FACEBOOK',
      'INSTAGRAM',
      'LINKEDIN',
    ])
  })

  it('gibt nichts zurück, wenn alles belegt ist', () => {
    const v = variante({ plattformen: ['FACEBOOK', 'INSTAGRAM', 'LINKEDIN'] })
    expect(freiePlattformen(MOEGLICH, [v])).toEqual([])
  })
})
