import { describe, expect, it } from 'vitest'
import {
  kalenderwoche,
  kalenderwochenJahr,
  pruefeFormat,
  verhaeltnisText,
  zipDateiname,
  zipStempel,
} from './format'

describe('pruefeFormat', () => {
  it('lässt ein korrektes 4:5-Beitragsbild durch', () => {
    expect(pruefeFormat('HOCH_4_5', 'MEDIUM', 1080, 1350)).toBeNull()
  })

  it('lässt ein 3:4-Bild an einem 3:4-Beitrag weiterhin durch', () => {
    // Der Bestand aus der Zeit, als 3:4 als Standard galt.
    expect(pruefeFormat('HOCH_3_4', 'MEDIUM', 1080, 1440)).toBeNull()
  })

  it('lässt ein korrektes 9:16-Reel durch', () => {
    expect(pruefeFormat('VERTIKAL_9_16', 'MEDIUM', 1080, 1920)).toBeNull()
  })

  it('erwartet beim Thumbnail dasselbe wie beim Medium — es zeigt ja dasselbe Bild', () => {
    expect(pruefeFormat('VERTIKAL_9_16', 'THUMBNAIL', 1080, 1920)).toBeNull()
    expect(pruefeFormat('QUER_16_9', 'THUMBNAIL', 1920, 1080)).toBeNull()
    // Ein hochkantes Thumbnail zu einem Querformat-Video wäre ein Versehen.
    expect(pruefeFormat('QUER_16_9', 'THUMBNAIL', 1080, 1920)).not.toBeNull()
  })

  it('warnt bei quadratischem Beitragsbild', () => {
    const hinweis = pruefeFormat('HOCH_4_5', 'MEDIUM', 1080, 1080)
    expect(hinweis).not.toBeNull()
    expect(hinweis?.erwartet).toBe('4:5')
    expect(hinweis?.erkannt).toBe('1:1')
  })

  it('warnt bei einem 3:4-Bild im Reel', () => {
    const hinweis = pruefeFormat('VERTIKAL_9_16', 'MEDIUM', 1080, 1440)
    expect(hinweis?.erwartet).toBe('9:16')
  })

  it('verträgt ein Prozent Abweichung', () => {
    expect(pruefeFormat('HOCH_4_5', 'MEDIUM', 1080, 1345)).toBeNull()
  })

  it('warnt bei einem 3:4-Bild an einem 4:5-Beitrag — blockiert es aber nicht', () => {
    // Der häufigste Fall nach der Umstellung: eine Canva-Vorlage, die noch im
    // alten Maß liegt. Instagram beschneidet so ein Bild beim Posten oben und
    // unten, deshalb der Hinweis — gewarnt, nicht verhindert.
    const hinweis = pruefeFormat('HOCH_4_5', 'MEDIUM', 1080, 1440)
    expect(hinweis?.erkannt).toBe('3:4')
    expect(hinweis?.erwartet).toBe('4:5')
    expect(hinweis?.text).toContain('erwartet wird 4:5')
  })

  it('gibt bei fehlenden Maßen keinen Hinweis', () => {
    expect(pruefeFormat('HOCH_4_5', 'MEDIUM', 0, 0)).toBeNull()
  })
})

describe('verhaeltnisText', () => {
  it('kürzt gängige Verhältnisse', () => {
    expect(verhaeltnisText(1080, 1440)).toBe('3:4')
    expect(verhaeltnisText(1080, 1920)).toBe('9:16')
    expect(verhaeltnisText(1920, 1080)).toBe('16:9')
  })

  it('weicht bei krummen Werten auf eine Dezimalzahl aus', () => {
    expect(verhaeltnisText(1153, 1441)).toContain(':')
  })
})

describe('zipDateiname', () => {
  const am = new Date(2026, 7, 5, 11, 0) // 05.08.2026, 11:00

  it('benennt einen Beitrag', () => {
    expect(zipDateiname(am, 'BEITRAG', 'MEDIUM')).toBe('260805_1100_Post')
  })

  it('benennt ein Reel und dessen Thumbnail', () => {
    expect(zipDateiname(am, 'REEL', 'MEDIUM', 0, 'VERTIKAL_9_16')).toBe('260805_1100_Reel')
    expect(zipDateiname(am, 'REEL', 'THUMBNAIL', 0, 'VERTIKAL_9_16')).toBe(
      '260805_1100_Reel_Thumbnail',
    )
  })

  it('nennt dasselbe Video quer nur Video — wie in der Oberfläche', () => {
    expect(zipDateiname(am, 'REEL', 'MEDIUM', 0, 'QUER_16_9')).toBe('260805_1100_Video')
    expect(zipDateiname(am, 'REEL', 'THUMBNAIL', 0, 'QUADRAT_1_1')).toBe(
      '260805_1100_Video_Thumbnail',
    )
  })

  it('nummeriert Karussell-Slides ab 1', () => {
    expect(zipDateiname(am, 'KARUSSELL', 'SLIDE', 0)).toBe('260805_1100_Carousel_Slide1')
    expect(zipDateiname(am, 'KARUSSELL', 'SLIDE', 3)).toBe('260805_1100_Carousel_Slide4')
  })

  it('füllt einstellige Werte auf', () => {
    expect(zipDateiname(new Date(2026, 0, 9, 7, 5), 'BEITRAG', 'MEDIUM')).toBe('260109_0705_Post')
  })
})

describe('kalenderwoche', () => {
  it('bestimmt die KW nach ISO 8601', () => {
    expect(kalenderwoche(new Date(2026, 7, 5))).toBe(32)
    expect(kalenderwoche(new Date(2026, 0, 1))).toBe(1)
  })

  it('ordnet den Jahreswechsel der richtigen Woche zu', () => {
    // 01.01.2027 ist ein Freitag und gehört zur KW 53 von 2026.
    const silvester = new Date(2027, 0, 1)
    expect(kalenderwoche(silvester)).toBe(53)
    expect(kalenderwochenJahr(silvester)).toBe(2026)
  })
})

describe('zipStempel', () => {
  it('benennt die Caption nach dem Post, nicht nach einem Slide', () => {
    const am = new Date(2026, 7, 11, 10, 0)
    expect(`${zipStempel(am)}_Caption.txt`).toBe('260811_1000_Caption.txt')
    // Zur Abgrenzung: das Medium desselben Karussells trägt die Slide-Nummer.
    expect(zipDateiname(am, 'KARUSSELL', 'SLIDE', 0)).toBe('260811_1000_Carousel_Slide1')
  })
})
