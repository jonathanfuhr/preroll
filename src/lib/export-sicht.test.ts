import { describe, expect, it } from 'vitest'
import { feedVorschau, istAbgelaufen, postsImZeitraum, type SichtPost } from './export-sicht'

// Zeiträume kommen als reine Datumswerte aus der Datenbank: UTC-Mitternacht.
const regeln = {
  zeitraumVon: new Date('2026-08-01T00:00:00.000Z'),
  zeitraumBis: new Date('2026-08-31T00:00:00.000Z'),
  konzepteMitzeigen: false,
}

const posts: SichtPost[] = [
  { id: 'juli-a', typ: 'BEITRAG', status: 'FINAL', postenAm: new Date(2026, 6, 10, 10, 0) },
  { id: 'juli-b', typ: 'REEL', status: 'FINAL', postenAm: new Date(2026, 6, 24, 10, 0) },
  { id: 'aug-reel', typ: 'REEL', status: 'VORSCHAU', postenAm: new Date(2026, 7, 5, 11, 0) },
  { id: 'aug-karussell', typ: 'KARUSSELL', status: 'VORSCHAU', postenAm: new Date(2026, 7, 11, 10, 0) },
  { id: 'aug-konzept', typ: 'BEITRAG', status: 'KONZEPT', postenAm: new Date(2026, 7, 20, 17, 30) },
  { id: 'sept', typ: 'BEITRAG', status: 'KONZEPT', postenAm: new Date(2026, 8, 3, 9, 0) },
]

describe('postsImZeitraum', () => {
  it('zeigt nur freigegebene Posts des Zeitraums', () => {
    const sichtbar = postsImZeitraum(posts, regeln).map((p) => p.id)
    expect(sichtbar).toEqual(['aug-reel', 'aug-karussell'])
  })

  it('nimmt Konzepte mit, wenn die Option gesetzt ist', () => {
    const sichtbar = postsImZeitraum(posts, { ...regeln, konzepteMitzeigen: true }).map((p) => p.id)
    expect(sichtbar).toEqual(['aug-reel', 'aug-karussell', 'aug-konzept'])
  })

  it('schließt den letzten Tag des Zeitraums ein', () => {
    const spaet: SichtPost[] = [
      { id: 'letzter', typ: 'BEITRAG', status: 'FINAL', postenAm: new Date(2026, 7, 31, 23, 0) },
    ]
    expect(postsImZeitraum(spaet, regeln)).toHaveLength(1)
  })
})

describe('feedVorschau', () => {
  it('nimmt ältere veröffentlichte Posts mit auf', () => {
    const kacheln = feedVorschau(posts, regeln).map((p) => p.id)
    expect(kacheln).toContain('juli-a')
    expect(kacheln).toContain('juli-b')
  })

  it('zeigt nichts, was nach dem letzten Post des Zeitraums liegt', () => {
    const kacheln = feedVorschau(posts, regeln).map((p) => p.id)
    expect(kacheln).not.toContain('sept')
    // Das Konzept vom 20.08. liegt nach dem letzten freigegebenen Post (11.08.).
    expect(kacheln).not.toContain('aug-konzept')
  })

  it('lässt ungeplante Posts außen vor — ohne Termin gehört nichts in einen Export', () => {
    const mitUngeplantem = [
      ...posts,
      { id: 'ohne-termin', typ: 'REEL' as const, status: 'FINAL' as const, postenAm: null },
    ]
    expect(feedVorschau(mitUngeplantem, regeln).map((p) => p.id)).not.toContain('ohne-termin')
    expect(postsImZeitraum(mitUngeplantem, regeln).map((p) => p.id)).not.toContain('ohne-termin')
  })

  it('sortiert neueste zuerst — die erste Kachel landet oben links', () => {
    const kacheln = feedVorschau(posts, regeln).map((p) => p.id)
    expect(kacheln).toEqual(['aug-karussell', 'aug-reel', 'juli-b', 'juli-a'])
  })

  it('behält ältere Posts auch dann, wenn im Zeitraum nichts freigegeben ist', () => {
    const nurKonzepte = posts.filter(
      (p) => p.status === 'KONZEPT' || p.postenAm! < regeln.zeitraumVon,
    )
    const kacheln = feedVorschau(nurKonzepte, regeln).map((p) => p.id)
    expect(kacheln).toEqual(['juli-b', 'juli-a'])
  })
})

describe('istAbgelaufen', () => {
  it('gilt bis zum Ende des Ablauftages', () => {
    const bis = new Date('2026-09-30T00:00:00.000Z')
    expect(istAbgelaufen(bis, new Date(2026, 8, 30, 22, 0))).toBe(false)
    expect(istAbgelaufen(bis, new Date(2026, 9, 1, 0, 1))).toBe(true)
  })

  it('läuft ohne Datum nie ab', () => {
    expect(istAbgelaufen(null)).toBe(false)
  })
})
