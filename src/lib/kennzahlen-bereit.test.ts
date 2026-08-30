import { describe, expect, it } from 'vitest'
import {
  ABRUFBARE_PLATTFORMEN,
  ABRUF_BEDINGUNG,
  istAbrufbar,
  UEBER_HANDLE,
  type Abrufkontext,
} from './kennzahlen-bereit'

const LEER: Abrufkontext = { handle: null, fbSeitenId: null, fbSeitenToken: null, igKontoId: null }

describe('welche Plattformen Preroll selbst abruft', () => {
  /*
    Kommt eine dazu oder fällt eine weg, ist das hier die Stelle, an der es
    auffällt — und nicht erst daran, dass ein Lauf still nichts mehr holt.
  */
  it('sind heute Instagram, TikTok und Facebook', () => {
    expect(ABRUFBARE_PLATTFORMEN).toEqual(['INSTAGRAM', 'TIKTOK', 'FACEBOOK'])
    expect(istAbrufbar('LINKEDIN')).toBe(false)
    expect(istAbrufbar('YOUTUBE')).toBe(false)
  })

  it('nennt je Plattform ihre Quelle fürs Protokoll', () => {
    expect(ABRUF_BEDINGUNG.INSTAGRAM.quelle).toBe('INSTAGRAM_WEB')
    expect(ABRUF_BEDINGUNG.TIKTOK.quelle).toBe('TIKTOK_WEB')
    // Facebook geht den dokumentierten Weg — das steht auch im Protokoll.
    expect(ABRUF_BEDINGUNG.FACEBOOK.quelle).toBe('GRAPH_API')
  })
})

describe('woran ein Abruf hängt', () => {
  it('braucht bei Instagram und TikTok einen Handle', () => {
    for (const p of ['INSTAGRAM', 'TIKTOK'] as const) {
      expect(ABRUF_BEDINGUNG[p].bereit(LEER)).toBe(false)
      expect(ABRUF_BEDINGUNG[p].bereit({ ...LEER, handle: 'beispiel' })).toBe(true)
      // Ein Handle aus Leerzeichen ist keiner.
      expect(ABRUF_BEDINGUNG[p].bereit({ ...LEER, handle: '   ' })).toBe(false)
      // Eine Facebook-Seite hilft ihnen nicht.
      expect(
        ABRUF_BEDINGUNG[p].bereit({ handle: null, fbSeitenId: '1', fbSeitenToken: 't', igKontoId: null }),
      ).toBe(false)
    }
  })

  /*
    Facebook wird über die Seite gefragt, nicht über einen Namen. Ein Handle
    allein reicht deshalb nicht — und ohne Token nützt auch die Seite nichts.
  */
  it('braucht bei Facebook Seite und Token, nicht den Handle', () => {
    const b = ABRUF_BEDINGUNG.FACEBOOK.bereit
    expect(b(LEER)).toBe(false)
    expect(b({ ...LEER, handle: 'Beispiel Handwerk' })).toBe(false)
    expect(b({ ...LEER, fbSeitenId: '123' })).toBe(false)
    expect(b({ ...LEER, fbSeitenToken: 'geheim' })).toBe(false)
    expect(b({ handle: null, fbSeitenId: '123', fbSeitenToken: 'geheim', igKontoId: null })).toBe(true)
  })

  it('sagt in einem Satz, was fehlt', () => {
    expect(ABRUF_BEDINGUNG.FACEBOOK.fehlt).toMatch(/Seite zugeordnet/)
    expect(ABRUF_BEDINGUNG.TIKTOK.fehlt).toMatch(/TikTok-Handle/)
  })
})

describe('UEBER_HANDLE', () => {
  /*
    Die Warteschlange bildet die Bedingung in SQL nach und braucht dafür die
    Trennung. Abgeleitet statt abgetippt: Eine neue Plattform sortiert sich
    von selbst ein.
  */
  it('trennt die Handle-Plattformen von Facebook', () => {
    expect(UEBER_HANDLE).toEqual(['INSTAGRAM', 'TIKTOK'])
  })
})

describe('Instagram: zwei Wege, einer genügt', () => {
  const leer = { handle: null, fbSeitenId: null, fbSeitenToken: null, igKontoId: null }
  const ig = ABRUF_BEDINGUNG.INSTAGRAM

  it('reicht ein Handle allein', () => {
    expect(ig.bereit({ ...leer, handle: 'thdvideo' })).toBe(true)
  })

  /*
    Der Fall, der vorher durchfiel: Konto zugeordnet, Handle nie eingetippt —
    ausgerechnet der Kunde mit dem besseren Weg wäre ausgesperrt gewesen.
  */
  it('reicht ein zugeordnetes Konto allein', () => {
    expect(ig.bereit({ ...leer, igKontoId: '17841400000000000', fbSeitenToken: 'tok' })).toBe(true)
  })

  it('genügt eine Kontokennung ohne Token nicht — ohne Token keine Anfrage', () => {
    expect(ig.bereit({ ...leer, igKontoId: '17841400000000000' })).toBe(false)
  })

  it('bleibt ohne beides unbereit', () => {
    expect(ig.bereit(leer)).toBe(false)
  })
})
