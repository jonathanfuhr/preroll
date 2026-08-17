import { describe, expect, it } from 'vitest'
import { gewaehlterMonat, monateAusPosts } from './monate'

/**
 * Die Monate des Kunden kommen aus seinen Beiträgen, nicht aus einer Tabelle.
 *
 * Vorher war jeder Monat eine Freigabe-Zeile: Ein Monat ohne angelegte
 * Freigabe war für den Kunden unerreichbar, obwohl Beiträge darin standen —
 * und ein angelegter, aber leerer Monat stand in der Leiste.
 */

function post(tag: string, status: 'ENTWURF' | 'KONZEPT' | 'VORSCHAU' | 'FINAL' = 'KONZEPT') {
  return { postenAm: new Date(tag), status } as const
}

describe('monateAusPosts', () => {
  it('nennt jeden Monat einmal, neueste zuerst', () => {
    const monate = monateAusPosts([
      post('2026-07-03T10:00:00'),
      post('2026-08-05T10:00:00'),
      post('2026-08-21T10:00:00'),
      post('2026-06-30T10:00:00'),
    ])

    expect(monate.map((m) => m.monat)).toEqual(['2026-08', '2026-07', '2026-06'])
    expect(monate[0].titel).toBe('August 2026')
  })

  it('liefert zu jedem Monat seine Grenzen', () => {
    const [august] = monateAusPosts([post('2026-08-05T10:00:00')])

    expect(august.von.getDate()).toBe(1)
    expect(august.bis.getDate()).toBe(31)
    expect(august.von.getMonth()).toBe(7)
  })

  it('lässt Entwürfe außen vor — sie verlassen das Haus nie', () => {
    const monate = monateAusPosts([
      post('2026-09-02T10:00:00', 'ENTWURF'),
      post('2026-08-05T10:00:00'),
    ])

    // Ein Monat, der nur aus Entwürfen besteht, wäre beim Kunden leer.
    expect(monate.map((m) => m.monat)).toEqual(['2026-08'])
  })

  it('lässt ungeplante Beiträge außen vor', () => {
    const monate = monateAusPosts([
      { postenAm: null, status: 'KONZEPT' },
      post('2026-08-05T10:00:00'),
    ])

    expect(monate.map((m) => m.monat)).toEqual(['2026-08'])
  })

  it('gibt bei nichts Zählbarem eine leere Liste zurück', () => {
    expect(monateAusPosts([])).toEqual([])
    expect(monateAusPosts([post('2026-08-05T10:00:00', 'ENTWURF')])).toEqual([])
  })
})

describe('gewaehlterMonat', () => {
  const monate = monateAusPosts([
    post('2026-06-05T10:00:00'),
    post('2026-07-05T10:00:00'),
    post('2026-08-05T10:00:00'),
  ])

  it('nimmt den gewünschten Monat, wenn es ihn gibt', () => {
    expect(gewaehlterMonat(monate, '2026-07', new Date('2026-08-17T09:00:00')).monat).toBe('2026-07')
  })

  it('nimmt ohne Wunsch den neuesten — dafür kam der Link', () => {
    expect(gewaehlterMonat(monate, undefined, new Date('2026-08-17T09:00:00')).monat).toBe('2026-08')
  })

  it('ignoriert einen Monat, den es nicht gibt, statt zu scheitern', () => {
    // Etwa ein alter Lesezeichen-Link oder ein Tippfehler in der Adresse.
    expect(gewaehlterMonat(monate, '2025-01', new Date('2026-08-17T09:00:00')).monat).toBe('2026-08')
    expect(gewaehlterMonat(monate, 'unsinn', new Date('2026-08-17T09:00:00')).monat).toBe('2026-08')
  })

  it('fällt ohne jeden Monat auf den laufenden zurück', () => {
    // Eine Seite mit leerem Kalender ist verständlicher als eine Fehlermeldung.
    const leer = gewaehlterMonat([], undefined, new Date('2026-08-17T09:00:00'))
    expect(leer.monat).toBe('2026-08')
    expect(leer.titel).toBe('August 2026')
  })
})
