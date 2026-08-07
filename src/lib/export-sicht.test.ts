import { describe, expect, it } from 'vitest'
import { feedVorschau, postsImZeitraum, type SichtPost } from './export-sicht'

// Zeiträume kommen als reine Datumswerte aus der Datenbank: UTC-Mitternacht.
const regeln = {
  zeitraumVon: new Date('2026-08-01T00:00:00.000Z'),
  zeitraumBis: new Date('2026-08-31T00:00:00.000Z'),
}

const posts: SichtPost[] = [
  { id: 'juli-a', typ: 'BEITRAG', status: 'FINAL', postenAm: new Date(2026, 6, 10, 10, 0) },
  { id: 'juli-b', typ: 'REEL', status: 'FINAL', postenAm: new Date(2026, 6, 24, 10, 0) },
  { id: 'aug-reel', typ: 'REEL', status: 'VORSCHAU', postenAm: new Date(2026, 7, 5, 11, 0) },
  { id: 'aug-karussell', typ: 'KARUSSELL', status: 'VORSCHAU', postenAm: new Date(2026, 7, 11, 10, 0) },
  { id: 'aug-konzept', typ: 'BEITRAG', status: 'KONZEPT', postenAm: new Date(2026, 7, 20, 17, 30) },
  { id: 'aug-entwurf', typ: 'BEITRAG', status: 'ENTWURF', postenAm: new Date(2026, 7, 25, 9, 0) },
  { id: 'sept', typ: 'BEITRAG', status: 'KONZEPT', postenAm: new Date(2026, 8, 3, 9, 0) },
]

describe('postsImZeitraum', () => {
  it('zeigt alles im Monat außer Entwürfen', () => {
    // Konzepte gehören dazu — dafür ist die Freigabe schließlich da. Was noch
    // nicht vorzeigbar ist, steht auf ENTWURF und verlässt das Haus nicht.
    const sichtbar = postsImZeitraum(posts, regeln).map((p) => p.id)
    expect(sichtbar).toEqual(['aug-reel', 'aug-karussell', 'aug-konzept'])
  })

  it('lässt Entwürfe unter keinen Umständen durch', () => {
    const nurEntwuerfe: SichtPost[] = [
      { id: 'e1', typ: 'BEITRAG', status: 'ENTWURF', postenAm: new Date(2026, 7, 6, 9, 0) },
    ]
    expect(postsImZeitraum(nurEntwuerfe, regeln)).toHaveLength(0)
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
  })

  it('lässt Entwürfe auch aus dem Raster heraus', () => {
    expect(feedVorschau(posts, regeln).map((p) => p.id)).not.toContain('aug-entwurf')
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
    expect(kacheln).toEqual(['aug-konzept', 'aug-karussell', 'aug-reel', 'juli-b', 'juli-a'])
  })

  it('behält ältere Posts auch dann, wenn im Monat nur Entwürfe liegen', () => {
    const nurEntwuerfe = posts.filter(
      (p) => p.status === 'ENTWURF' || p.postenAm! < regeln.zeitraumVon,
    )
    const kacheln = feedVorschau(nurEntwuerfe, regeln).map((p) => p.id)
    expect(kacheln).toEqual(['juli-b', 'juli-a'])
  })
})
