import { describe, expect, it } from 'vitest'
import { reelVideoQuelle } from './reel-video'

const video = (mediumId: string) => ({
  rolle: 'MEDIUM' as const,
  mediumId,
  medium: { mimeTyp: 'video/mp4' },
})

describe('reelVideoQuelle', () => {
  it('nimmt das eigene Video — hochgeladen oder von einem Link geladen', () => {
    expect(reelVideoQuelle({ medien: [video('m1')], klappeVersionId: null })).toEqual({
      url: '/api/medien/m1',
      herkunft: 'MEDIUM',
    })
  })

  it('lässt das MEDIUM gewinnen, auch wenn eine Klappe-Fassung bekannt ist', () => {
    expect(reelVideoQuelle({ medien: [video('m1')], klappeVersionId: 'f9' })).toEqual({
      url: '/api/medien/m1',
      herkunft: 'MEDIUM',
    })
  })

  it('bettet ohne eigenes Video die Klappe-Fassung als Stream ein', () => {
    expect(reelVideoQuelle({ medien: [], klappeVersionId: 'f9' })).toEqual({
      url: '/api/klappe/f9',
      herkunft: 'KLAPPE',
    })
  })

  it('zählt ein Bild im MEDIUM-Platz nicht als Reel-Video', () => {
    const bild = { rolle: 'MEDIUM' as const, mediumId: 'b1', medium: { mimeTyp: 'image/jpeg' } }
    expect(reelVideoQuelle({ medien: [bild], klappeVersionId: 'f9' })?.herkunft).toBe('KLAPPE')
  })

  it('gibt ohne beides nichts zurück — auch nicht für Thumbnails', () => {
    const thumb = { rolle: 'THUMBNAIL' as const, mediumId: 't1', medium: { mimeTyp: 'image/jpeg' } }
    expect(reelVideoQuelle({ medien: [thumb], klappeVersionId: null })).toBeNull()
  })
})
