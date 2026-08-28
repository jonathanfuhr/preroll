import { describe, expect, it } from 'vitest'
import { istStandinhalt, standAnwenden, standAusPost, type StandQuelle } from './post-stand'
import { fuerKundensicht } from './stand-anwenden'

function medium(id: string, mimeTyp = 'image/jpeg') {
  return { id, mimeTyp, thumbPfad: null }
}

function post(ueberschreiben: Partial<StandQuelle> = {}): StandQuelle {
  return {
    titel: 'Recruiting-Reel',
    kurzbeschreibung: null,
    caption: 'Wir suchen Verstärkung.',
    typ: 'REEL',
    verhaeltnis: 'VERTIKAL_9_16',
    laenge: '30 s',
    ziel: 'Bewerbungen',
    stil: 'nah',
    inhalte: null,
    szenenplanAktiv: true,
    plattformen: ['INSTAGRAM'],
    klappeVersionId: null,
    szenen: [
      {
        id: 's1',
        position: 0,
        abschnitt: 'Hook',
        bildSzene: 'Werkstatt',
        sprechertext: 'Wir suchen dich.',
        texteinblendung: null,
      },
    ],
    medien: [
      { rolle: 'MEDIUM', position: 0, mediumId: 'm1', medium: medium('m1', 'video/mp4') },
    ],
    varianten: [],
    ...ueberschreiben,
  }
}

describe('Stand schreiben und zurücklegen', () => {
  it('legt zurück, was es geschrieben hat', () => {
    const p = post()
    const zurueck = standAnwenden(p, standAusPost(p))
    expect(zurueck.titel).toBe(p.titel)
    expect(zurueck.caption).toBe(p.caption)
    expect(zurueck.szenen).toEqual(p.szenen)
    expect(zurueck.medien.map((m) => m.mediumId)).toEqual(['m1'])
    expect(zurueck.medien[0].medium.mimeTyp).toBe('video/mp4')
  })

  it('hält die Fassungen samt ihrer Medien und Klappe-Bezüge', () => {
    const p = post({
      varianten: [
        {
          id: 'v1',
          plattformen: ['LINKEDIN'],
          caption: 'Anders für LinkedIn.',
          verhaeltnis: 'QUADRAT_1_1',
          position: 0,
          klappeVersionId: 'k9',
          medien: [
            { rolle: 'MEDIUM', position: 0, mediumId: 'm2', medium: medium('m2') },
          ],
        },
      ],
    })
    const zurueck = standAnwenden(p, standAusPost(p))
    expect(zurueck.varianten[0].caption).toBe('Anders für LinkedIn.')
    expect(zurueck.varianten[0].verhaeltnis).toBe('QUADRAT_1_1')
    expect(zurueck.varianten[0].klappeVersionId).toBe('k9')
    expect(zurueck.varianten[0].medien[0].mediumId).toBe('m2')
  })

  /*
    Der Kern der Sache: Was nach dem Einfrieren am Beitrag geändert wird,
    darf beim Kunden nicht ankommen.
  */
  it('zeigt in einer Arbeitsphase den alten Inhalt, nicht den neuen', () => {
    const alt = standAusPost(post({ caption: 'Wie beim Konzept besprochen.' }))
    const jetzt = { ...post({ caption: 'Halb umgeschrieben …' }), status: 'PRODUKTION' as const }

    const sicht = fuerKundensicht(jetzt, [{ phase: 'KONZEPT', inhalt: alt }])
    expect(sicht.caption).toBe('Wie beim Konzept besprochen.')
  })

  it('liest in einer sichtbaren Phase live, auch wenn ein Stand daliegt', () => {
    const alt = standAusPost(post({ caption: 'Alt.' }))
    const jetzt = { ...post({ caption: 'Frisch getippt.' }), status: 'KONZEPT' as const }

    const sicht = fuerKundensicht(jetzt, [{ phase: 'KONZEPT', inhalt: alt }])
    expect(sicht.caption).toBe('Frisch getippt.')
  })

  it('nimmt in der Korrektur den Vorschau-Stand, nicht den vom Konzept', () => {
    const konzept = standAusPost(post({ caption: 'Konzept.' }))
    const vorschau = standAusPost(post({ caption: 'Vorschau.' }))
    const jetzt = { ...post({ caption: 'In Arbeit.' }), status: 'KORREKTUR' as const }

    const sicht = fuerKundensicht(jetzt, [
      { phase: 'KONZEPT', inhalt: konzept },
      { phase: 'VORSCHAU', inhalt: vorschau },
    ])
    expect(sicht.caption).toBe('Vorschau.')
  })

  /*
    Ein Beitrag, der ohne Umweg über das Konzept in die Produktion gesetzt
    wurde, hat keinen Stand. Dann ist der aktuelle Inhalt die ehrlichste
    Auskunft — besser als eine leere Seite.
  */
  it('fällt ohne passenden Stand auf den Live-Inhalt zurück', () => {
    const jetzt = { ...post({ caption: 'Nur live.' }), status: 'PRODUKTION' as const }
    expect(fuerKundensicht(jetzt, []).caption).toBe('Nur live.')
  })

  it('fällt bei einem unbrauchbaren Datensatz auf live zurück', () => {
    const jetzt = { ...post({ caption: 'Nur live.' }), status: 'PRODUKTION' as const }
    const sicht = fuerKundensicht(jetzt, [{ phase: 'KONZEPT', inhalt: { kaputt: true } }])
    expect(sicht.caption).toBe('Nur live.')
  })

  it('erkennt einen brauchbaren Stand', () => {
    expect(istStandinhalt(standAusPost(post()))).toBe(true)
    expect(istStandinhalt(null)).toBe(false)
    expect(istStandinhalt({ fassung: 2 })).toBe(false)
  })
})
