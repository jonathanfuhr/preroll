import { beforeAll, describe, expect, it } from 'vitest'
import { medienFuerPost, type PostMaterial } from './veroeffentlichung-medien'

beforeAll(() => {
  process.env.SESSION_SECRET ??= 'test-geheimnis'
})

function bild(mediumId: string, position = 0, rolle: 'MEDIUM' | 'SLIDE' = 'MEDIUM') {
  return { rolle, position, mediumId, medium: { mimeTyp: 'image/png' } }
}

function video(mediumId: string) {
  return { rolle: 'MEDIUM' as const, position: 0, mediumId, medium: { mimeTyp: 'video/mp4' } }
}

describe('medienFuerPost — Beitrag', () => {
  it('nimmt das eine Bild und fordert JPEG an', () => {
    const post: PostMaterial = { typ: 'BEITRAG', klappeVersionId: null, medien: [bild('a')] }
    const ergebnis = medienFuerPost(post)

    expect(ergebnis.ok).toBe(true)
    if (!ergebnis.ok) return
    expect(ergebnis.medien).toHaveLength(1)
    expect(ergebnis.medien[0].istVideo).toBe(false)
    // Instagram nimmt für Bilder nur JPEG — ein PNG aus Canva muss gewandelt
    // werden, sonst weist Meta den Beitrag ab.
    expect(ergebnis.medien[0].url).toContain('f=jpeg')
    expect(ergebnis.medien[0].url).toContain('/api/medien/oeffentlich/a')
  })

  it('meldet einen Beitrag ohne Bild statt ihn leer zu posten', () => {
    expect(medienFuerPost({ typ: 'BEITRAG', klappeVersionId: null, medien: [] })).toEqual({
      ok: false,
      fehler: 'Der Beitrag hat kein Bild.',
    })
  })
})

describe('medienFuerPost — Karussell', () => {
  it('sortiert die Slides nach Position, nicht nach Fundreihenfolge', () => {
    const post: PostMaterial = {
      typ: 'KARUSSELL',
      klappeVersionId: null,
      medien: [bild('c', 2, 'SLIDE'), bild('a', 0, 'SLIDE'), bild('b', 1, 'SLIDE')],
    }
    const ergebnis = medienFuerPost(post)

    expect(ergebnis.ok).toBe(true)
    if (!ergebnis.ok) return
    const kennungen = ergebnis.medien.map((m) => new URL(m.url).pathname.split('/').pop())
    expect(kennungen).toEqual(['a', 'b', 'c'])
  })

  it('lässt das Reel-Thumbnail und andere Rollen liegen', () => {
    const post: PostMaterial = {
      typ: 'KARUSSELL',
      klappeVersionId: null,
      medien: [
        bild('slide', 0, 'SLIDE'),
        { rolle: 'THUMBNAIL', position: 0, mediumId: 'thumb', medium: { mimeTyp: 'image/jpeg' } },
      ],
    }
    const ergebnis = medienFuerPost(post)

    expect(ergebnis.ok).toBe(true)
    if (!ergebnis.ok) return
    expect(ergebnis.medien).toHaveLength(1)
    expect(ergebnis.medien[0].url).toContain('/slide?')
  })

  it('meldet ein Karussell ohne Slides', () => {
    expect(medienFuerPost({ typ: 'KARUSSELL', klappeVersionId: null, medien: [] })).toEqual({
      ok: false,
      fehler: 'Das Karussell hat keine Slides.',
    })
  })
})

describe('medienFuerPost — Reel', () => {
  it('nimmt das eigene Video im Original, nicht als JPEG', () => {
    const post: PostMaterial = { typ: 'REEL', klappeVersionId: null, medien: [video('v')] }
    const ergebnis = medienFuerPost(post)

    expect(ergebnis.ok).toBe(true)
    if (!ergebnis.ok) return
    expect(ergebnis.medien[0].istVideo).toBe(true)
    expect(ergebnis.medien[0].url).toContain('f=original')
  })

  it('greift auf die Klappe-Fassung zurück, wenn kein eigenes Video hängt', () => {
    const post: PostMaterial = { typ: 'REEL', klappeVersionId: 'fassung7', medien: [] }
    const ergebnis = medienFuerPost(post)

    expect(ergebnis.ok).toBe(true)
    if (!ergebnis.ok) return
    expect(ergebnis.medien[0].url).toContain('/api/klappe/oeffentlich/fassung7')
  })

  it('lässt das eigene Video gewinnen — die zuletzt getroffene Wahl zählt', () => {
    const post: PostMaterial = { typ: 'REEL', klappeVersionId: 'fassung7', medien: [video('v')] }
    const ergebnis = medienFuerPost(post)

    expect(ergebnis.ok).toBe(true)
    if (!ergebnis.ok) return
    expect(ergebnis.medien[0].url).toContain('/api/medien/oeffentlich/v')
  })

  it('lässt sich von einem Thumbnail nicht für ein Video halten', () => {
    const post: PostMaterial = {
      typ: 'REEL',
      klappeVersionId: null,
      medien: [
        { rolle: 'THUMBNAIL', position: 0, mediumId: 'thumb', medium: { mimeTyp: 'image/jpeg' } },
      ],
    }
    expect(medienFuerPost(post)).toEqual({ ok: false, fehler: 'Der Beitrag hat kein Video.' })
  })

  it('meldet ein Reel, dessen MEDIUM ein Bild ist', () => {
    // Kommt vor, wenn jemand versehentlich ein Standbild in den Video-Platz
    // legt. Lieber eine Meldung als ein Reel ohne Bewegtbild.
    const post: PostMaterial = { typ: 'REEL', klappeVersionId: null, medien: [bild('b')] }
    expect(medienFuerPost(post)).toEqual({ ok: false, fehler: 'Der Beitrag hat kein Video.' })
  })
})
