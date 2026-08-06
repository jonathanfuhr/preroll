import { describe, expect, it } from 'vitest'
import { teileCaption } from './post-sektion'

describe('teileCaption', () => {
  it('trennt einen abschließenden Hashtag-Block ab', () => {
    const { text, hashtags } = teileCaption(
      'Wir suchen Verstärkung!\n\nJetzt bewerben.\n\n#galabau #jobs #wendlingen',
    )
    expect(text).toBe('Wir suchen Verstärkung!\n\nJetzt bewerben.')
    expect(hashtags).toBe('#galabau #jobs #wendlingen')
  })

  it('fasst mehrere Hashtag-Zeilen zusammen', () => {
    const { text, hashtags } = teileCaption('Text\n\n#eins #zwei\n#drei')
    expect(text).toBe('Text')
    expect(hashtags).toBe('#eins #zwei #drei')
  })

  it('lässt Hashtags mitten im Text stehen', () => {
    const { text, hashtags } = teileCaption('Heute bei #Werkstatt war einiges los.')
    expect(text).toBe('Heute bei #Werkstatt war einiges los.')
    expect(hashtags).toBe('')
  })

  it('kommt ohne Hashtags zurecht', () => {
    const { text, hashtags } = teileCaption('Nur Fließtext.')
    expect(text).toBe('Nur Fließtext.')
    expect(hashtags).toBe('')
  })

  it('kommt mit leerer Caption zurecht', () => {
    expect(teileCaption('')).toEqual({ text: '', hashtags: '' })
  })
})
