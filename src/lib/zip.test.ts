import { describe, expect, it } from 'vitest'
import { zipEintraege, zipPlattformwahl, zipPostOrdner } from './zip'
import type { ZipPost } from './zip'
import type { MediumRolle, Plattform } from '@prisma/client'

/**
 * Der ZIP-Aufbau.
 *
 * Zwei Anlässe: Die Gliederung nach Kalenderwoche half niemandem — wer eine
 * Woche aufklappte, fand die Dateien mehrerer Beiträge nebeneinander und musste
 * sie am Zeitstempel auseinanderhalten. Und ein Beitrag mit einer Klappe-Fassung
 * legte den ganzen Abruf lahm, weil das Video über die öffentliche Adresse kam.
 */

function post(teil: Partial<ZipPost> = {}): ZipPost {
  return {
    id: 'p1',
    typ: 'BEITRAG',
    verhaeltnis: 'HOCH_3_4',
    status: 'FINAL',
    titel: 'Vorher / Nachher',
    caption: 'Aus alt wird neu. #handwerk',
    postenAm: new Date(2026, 7, 5, 11, 0),
    klappeVersionId: null,
    medien: [
      { rolle: 'MEDIUM', position: 0, medium: { pfad: '2026/08/aaa.jpg', dateiname: 'bild.jpg' } },
    ],
    ...teil,
  }
}

describe('zipPostOrdner', () => {
  it('nennt den Ordner nach Termin und Bezeichnung', () => {
    expect(zipPostOrdner(post())).toBe('260805_1100_Beitrag')
  })

  it('unterscheidet Reel und Video wie überall sonst', () => {
    expect(zipPostOrdner(post({ typ: 'REEL', verhaeltnis: 'VERTIKAL_9_16' }))).toBe(
      '260805_1100_Reel',
    )
    expect(zipPostOrdner(post({ typ: 'REEL', verhaeltnis: 'QUER_16_9' }))).toBe('260805_1100_Video')
  })
})

describe('zipEintraege', () => {
  it('legt die Dateien eines Beitrags in seinen eigenen Ordner, nicht in die KW', () => {
    const eintraege = zipEintraege([post()], { mitCaptions: false })

    expect(eintraege).toHaveLength(1)
    expect(eintraege[0].pfad).toBe('260805_1100_Beitrag/260805_1100_Post.jpg')
    // Die alte Gliederung nach Kalenderwoche darf nirgends mehr auftauchen.
    expect(eintraege.some((e) => /(^|\/)KW\d\d\//.test(e.pfad))).toBe(false)
  })

  it('hält zwei Beiträge desselben Tages auseinander', () => {
    const eintraege = zipEintraege(
      [
        post({ id: 'a', postenAm: new Date(2026, 7, 5, 11, 0) }),
        post({ id: 'b', postenAm: new Date(2026, 7, 5, 17, 30) }),
      ],
      { mitCaptions: false },
    )

    const ordner = new Set(eintraege.map((e) => e.pfad.split('/')[0]))
    expect(ordner).toEqual(new Set(['260805_1100_Beitrag', '260805_1730_Beitrag']))
  })

  it('legt die Caption in den Ordner ihres Beitrags', () => {
    const eintraege = zipEintraege([post()], { mitCaptions: true })

    const caption = eintraege.find((e) => e.pfad.endsWith('_Caption.txt'))
    expect(caption?.pfad).toBe('260805_1100_Beitrag/260805_1100_Caption.txt')
    expect(caption?.art).toBe('text')
    if (caption?.art === 'text') {
      expect(caption.inhalt).toContain('Aus alt wird neu.')
      expect(caption.inhalt).toContain('Vorher / Nachher')
    }
  })

  it('nummeriert Karussell-Slides innerhalb des Post-Ordners', () => {
    const eintraege = zipEintraege(
      [
        post({
          typ: 'KARUSSELL',
          medien: [
            { rolle: 'SLIDE', position: 0, medium: { pfad: '2026/08/s1.jpg', dateiname: 's1.jpg' } },
            { rolle: 'SLIDE', position: 1, medium: { pfad: '2026/08/s2.jpg', dateiname: 's2.jpg' } },
          ],
        }),
      ],
      { mitCaptions: false },
    )

    expect(eintraege.map((e) => e.pfad)).toEqual([
      '260805_1100_Karussell/260805_1100_Carousel_Slide1.jpg',
      '260805_1100_Karussell/260805_1100_Carousel_Slide2.jpg',
    ])
  })

  it('merkt eine Klappe-Fassung als eigenen Eintrag vor', () => {
    const eintraege = zipEintraege(
      [
        post({
          typ: 'REEL',
          verhaeltnis: 'VERTIKAL_9_16',
          klappeVersionId: 'f-1',
          medien: [
            {
              rolle: 'THUMBNAIL',
              position: 0,
              medium: { pfad: '2026/08/t.jpg', dateiname: 't.jpg' },
            },
          ],
        }),
      ],
      { mitCaptions: false },
    )

    const klappe = eintraege.find((e) => e.art === 'klappe')
    expect(klappe?.pfad).toBe('260805_1100_Reel/260805_1100_Reel')
    if (klappe?.art === 'klappe') expect(klappe.fassungId).toBe('f-1')
  })

  it('lässt eine Klappe-Fassung weg, wenn ein eigenes Video hochgeladen wurde', () => {
    // Sonst lägen zwei Videos im Ordner, und keines wäre erkennbar das gültige.
    const eintraege = zipEintraege(
      [
        post({
          typ: 'REEL',
          verhaeltnis: 'VERTIKAL_9_16',
          klappeVersionId: 'f-1',
          medien: [
            {
              rolle: 'MEDIUM',
              position: 0,
              medium: { pfad: '2026/08/v.mp4', dateiname: 'v.mp4' },
            },
          ],
        }),
      ],
      { mitCaptions: false },
    )

    expect(eintraege.some((e) => e.art === 'klappe')).toBe(false)
    expect(eintraege.map((e) => e.pfad)).toEqual(['260805_1100_Reel/260805_1100_Reel.mp4'])
  })
})

describe('zipEintraege je Plattform', () => {
  const medium = (name: string, rolle: MediumRolle = 'MEDIUM', position = 0) => ({
    rolle,
    position,
    medium: { pfad: `p/${name}`, dateiname: `${name}.jpg` },
  })

  const post = {
    id: 'p1',
    typ: 'BEITRAG' as const,
    verhaeltnis: 'HOCH_4_5' as const,
    status: 'FINAL' as const,
    titel: 'Ein Beitrag',
    caption: 'Haupttext',
    postenAm: new Date('2026-08-11T10:00:00'),
    klappeVersionId: null,
    medien: [medium('haupt')],
    plattformen: ['FACEBOOK', 'INSTAGRAM'] as Plattform[],
    varianten: [
      {
        id: 'v1',
        plattformen: ['INSTAGRAM'] as Plattform[],
        caption: 'Für Instagram',
        verhaeltnis: null,
        klappeVersionId: null,
        position: 0,
        medien: [medium('insta')],
      },
    ],
  }

  it('bleibt ohne Plattformwahl beim Ordner je Beitrag', () => {
    const e = zipEintraege([post], { mitCaptions: false })
    expect(e.map((x) => x.pfad)).toEqual(['260811_1000_Beitrag/260811_1000_Post.jpg'])
  })

  it('legt bei einer Plattform keine zusätzliche Ebene an', () => {
    // Ein Ordner, in dem nur „Instagram" steht, ist eine Ebene ohne Aussage.
    const e = zipEintraege([post], { mitCaptions: false, plattformen: ['INSTAGRAM'] })
    expect(e.map((x) => x.pfad)).toEqual(['260811_1000_Beitrag/260811_1000_Post.jpg'])
  })

  it('trennt ab zwei Plattformen nach Ordnern', () => {
    const e = zipEintraege([post], {
      mitCaptions: false,
      plattformen: ['FACEBOOK', 'INSTAGRAM'],
    })
    expect(e.map((x) => x.pfad)).toEqual([
      'Facebook/260811_1000_Beitrag/260811_1000_Post.jpg',
      'Instagram/260811_1000_Beitrag/260811_1000_Post.jpg',
    ])
  })

  it('nimmt je Plattform ihre Fassung — Medium und Caption', () => {
    const e = zipEintraege([post], {
      mitCaptions: true,
      plattformen: ['FACEBOOK', 'INSTAGRAM'],
    })
    const fb = e.find((x) => x.pfad.startsWith('Facebook/') && x.art === 'datei')
    const ig = e.find((x) => x.pfad.startsWith('Instagram/') && x.art === 'datei')
    expect(fb).toMatchObject({ quelle: 'p/haupt' })
    expect(ig).toMatchObject({ quelle: 'p/insta' })

    const igText = e.find((x) => x.pfad.startsWith('Instagram/') && x.art === 'text')
    expect(igText?.art === 'text' && igText.inhalt).toContain('Für Instagram')
  })

  it('lässt einen Beitrag weg, der die Plattform nicht ansteuert', () => {
    const nurFb = { ...post, plattformen: ['FACEBOOK'] as Plattform[] }
    const e = zipEintraege([nurFb], {
      mitCaptions: false,
      plattformen: ['FACEBOOK', 'INSTAGRAM'],
    })
    expect(e.every((x) => x.pfad.startsWith('Facebook/'))).toBe(true)
    expect(e).toHaveLength(1)
  })
})

/**
 * Der Kunde darf herunterladen, was er sieht — auch das Konzept. Ohne
 * Kennzeichnung wäre das die Einladung, einen Zwischenstand einzuplanen: Wer
 * eine Datei aus dem Ordner in seinen Zeitplaner zieht, sieht den Ordnernamen
 * nicht mehr.
 */
describe('nichtFinal im Namen', () => {
  it('markiert Ordner und Dateien eines Beitrags, der noch nicht final ist', () => {
    const e = zipEintraege([post({ status: 'KONZEPT' })], { mitCaptions: true })

    expect(e.map((x) => x.pfad)).toEqual([
      '260805_1100_Beitrag_nichtFinal/260805_1100_Post_nichtFinal.jpg',
      '260805_1100_Beitrag_nichtFinal/260805_1100_Caption_nichtFinal.txt',
    ])
  })

  it('lässt den Hinweis weg, sobald der Beitrag final ist', () => {
    const e = zipEintraege([post({ status: 'FINAL' })], { mitCaptions: false })
    expect(e[0].pfad).not.toContain('nichtFinal')
  })

  it('markiert auch eine Klappe-Fassung, deren Endung erst später dazukommt', () => {
    const e = zipEintraege(
      [post({ status: 'VORSCHAU', typ: 'REEL', verhaeltnis: 'VERTIKAL_9_16', klappeVersionId: 'f-1', medien: [] })],
      { mitCaptions: false },
    )
    expect(e[0].pfad).toBe('260805_1100_Reel_nichtFinal/260805_1100_Reel_nichtFinal')
  })

  it('trägt den Hinweis auch im Ordnernamen', () => {
    expect(zipPostOrdner(post({ status: 'PRODUKTION' }))).toBe('260805_1100_Beitrag_nichtFinal')
  })
})

describe('ein einzelner Beitrag', () => {
  it('kommt ohne Ordner je Beitrag — bei einem wäre er eine Ebene ohne Aussage', () => {
    const e = zipEintraege([post()], { mitCaptions: true, ohnePostOrdner: true })
    expect(e.map((x) => x.pfad)).toEqual(['260805_1100_Post.jpg', '260805_1100_Caption.txt'])
  })

  it('behält die Plattformebene, sobald zwei gewählt sind', () => {
    const e = zipEintraege(
      [{ ...post(), plattformen: ['FACEBOOK', 'INSTAGRAM'] as Plattform[] }],
      { mitCaptions: false, ohnePostOrdner: true, plattformen: ['FACEBOOK', 'INSTAGRAM'] },
    )
    expect(e.map((x) => x.pfad)).toEqual([
      'Facebook/260805_1100_Post.jpg',
      'Instagram/260805_1100_Post.jpg',
    ])
  })

  it('nimmt den Titel, wenn der Beitrag ungeplant ist', () => {
    // Aus dem Editor heraus lässt sich auch ein Beitrag ohne Termin holen —
    // dann gibt es keinen Zeitstempel, der die Dateien benennen könnte.
    const e = zipEintraege([post({ postenAm: null, titel: 'Vorher / Nachher' })], {
      mitCaptions: false,
      ohnePostOrdner: true,
    })
    expect(e[0].pfad).toBe('Vorher_Nachher_Post.jpg')
  })
})

describe('die Textdatei zur Caption', () => {
  it('nennt dem Kunden seine vier Stufen, nicht unsere sechs', () => {
    // „Produktion" und „Korrektur" stehen auf seiner Seite nirgends — in einer
    // Datei, die er auf die Platte legt, erst recht nicht.
    const e = zipEintraege([post({ status: 'PRODUKTION' })], {
      mitCaptions: true,
      alsKundensicht: true,
    })
    const text = e.find((x) => x.art === 'text')
    expect(text?.art === 'text' && text.inhalt).toContain('Status: Konzept')
  })

  it('nennt dem Haus die wirkliche Phase', () => {
    const e = zipEintraege([post({ status: 'PRODUKTION' })], { mitCaptions: true })
    const text = e.find((x) => x.art === 'text')
    expect(text?.art === 'text' && text.inhalt).toContain('Status: Produktion')
  })
})

/**
 * Gefragt wird nur, wenn es etwas zu entscheiden gibt. Ein Fenster mit
 * Kästchen, die alle dasselbe liefern, wäre ein Klick ohne Entscheidung.
 */
describe('zipPlattformwahl', () => {
  const basis = {
    caption: 'Haupttext',
    verhaeltnis: 'HOCH_4_5' as const,
    medien: [{}],
    klappeVersionId: null,
  }

  it('fragt nicht, wenn alle Plattformen dasselbe bekommen', () => {
    const wahl = zipPlattformwahl([
      { ...basis, plattformen: ['INSTAGRAM', 'FACEBOOK'] as Plattform[], varianten: [] },
    ])
    expect(wahl).toEqual({ wahl: false, plattformen: [] })
  })

  it('fragt, sobald eine Fassung abweicht', () => {
    const wahl = zipPlattformwahl([
      {
        ...basis,
        plattformen: ['INSTAGRAM', 'LINKEDIN'] as Plattform[],
        varianten: [
          {
            id: 'v1',
            plattformen: ['LINKEDIN'] as Plattform[],
            caption: 'Anders auf LinkedIn',
            verhaeltnis: null,
            klappeVersionId: null,
            position: 0,
            medien: [],
          },
        ],
      },
    ])
    expect(wahl).toEqual({ wahl: true, plattformen: ['INSTAGRAM', 'LINKEDIN'] })
  })

  it('fragt nicht bei einer leeren Fassung — sie erbt ohnehin alles', () => {
    const wahl = zipPlattformwahl([
      {
        ...basis,
        plattformen: ['INSTAGRAM', 'LINKEDIN'] as Plattform[],
        varianten: [
          {
            id: 'v1',
            plattformen: ['LINKEDIN'] as Plattform[],
            caption: '  ',
            verhaeltnis: null,
            klappeVersionId: null,
            position: 0,
            medien: [],
          },
        ],
      },
    ])
    expect(wahl).toEqual({ wahl: false, plattformen: [] })
  })

  it('nimmt bei nur einer Plattform deren Fassung, ohne zu fragen', () => {
    // Ein Fenster mit einem Kästchen ist ein Klick ohne Entscheidung — die
    // Adresse trägt die Plattform trotzdem, sonst käme das Hauptformat.
    const wahl = zipPlattformwahl([
      {
        ...basis,
        plattformen: ['LINKEDIN'] as Plattform[],
        varianten: [
          {
            id: 'v1',
            plattformen: ['LINKEDIN'] as Plattform[],
            caption: 'Anders auf LinkedIn',
            verhaeltnis: null,
            klappeVersionId: null,
            position: 0,
            medien: [],
          },
        ],
      },
    ])
    expect(wahl).toEqual({ wahl: false, plattformen: ['LINKEDIN'] })
  })

  it('übergeht eine Fassung für eine Plattform, die der Beitrag nicht ansteuert', () => {
    const wahl = zipPlattformwahl([
      {
        ...basis,
        plattformen: ['INSTAGRAM'] as Plattform[],
        varianten: [
          {
            id: 'v1',
            plattformen: ['LINKEDIN'] as Plattform[],
            caption: 'Anders auf LinkedIn',
            verhaeltnis: null,
            klappeVersionId: null,
            position: 0,
            medien: [],
          },
        ],
      },
    ])
    expect(wahl).toEqual({ wahl: false, plattformen: [] })
  })
})
