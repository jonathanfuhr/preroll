import { describe, expect, it } from 'vitest'
import { alsCookiedatei } from './instagram-cookies'

describe('alsCookiedatei', () => {
  it('nimmt eine echte cookies.txt unverändert', () => {
    const datei = '# Netscape HTTP Cookie File\n.instagram.com\tTRUE\t/\tTRUE\t123\tsessionid\tabc'
    expect(alsCookiedatei(datei)).toBe(datei)
  })

  it('baut aus einem nackten sessionid-Wert eine Datei', () => {
    const datei = alsCookiedatei('12345%3Aabcdef%3A28')!
    expect(datei).toContain('# Netscape HTTP Cookie File')
    expect(datei).toContain('.instagram.com')
    expect(datei).toContain('\tsessionid\t12345%3Aabcdef%3A28')
  })

  it('versteht „name=wert" und mehrere Paare', () => {
    const datei = alsCookiedatei('sessionid=abc; ds_user_id=42')!
    expect(datei).toContain('\tsessionid\tabc')
    expect(datei).toContain('\tds_user_id\t42')
  })

  it('lässt sich von Leerzeichen und Zeilenumbrüchen nicht stören', () => {
    const datei = alsCookiedatei('  sessionid = abc ;  ds_user_id = 42  ')!
    expect(datei).toContain('\tsessionid\tabc')
    expect(datei).toContain('\tds_user_id\t42')
  })

  it('gibt bei leerer Eingabe nichts zurück — sonst würde eine Sitzung gelöscht', () => {
    expect(alsCookiedatei('')).toBeNull()
    expect(alsCookiedatei('   \n  ')).toBeNull()
  })
})
