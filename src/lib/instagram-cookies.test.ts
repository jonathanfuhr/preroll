import { describe, expect, it } from 'vitest'
import { alsCookiedatei, sitzungsumfang } from './instagram-cookies'

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

describe('sitzungsumfang', () => {
  const zeile = (n: string, w: string) => `.instagram.com\tTRUE\t/\tTRUE\t9999999999\t${n}\t${w}`

  /*
    Der Fall aus der Produktion: nur `sessionid`. Trägt die Reel-Downloads,
    taugt für die Kennzahlen nicht — und das sah man der Sitzung vorher nicht
    an, weil in den Einstellungen bloß „Hinterlegt" stand.
  */
  it('erkennt eine Sitzung ohne csrftoken als unvollständig', () => {
    const u = sitzungsumfang(zeile('sessionid', 'abc'))
    expect(u).toMatchObject({ sessionid: true, csrftoken: false, namen: ['sessionid'] })
  })

  it('erkennt eine vollständige Sitzung', () => {
    const u = sitzungsumfang([zeile('sessionid', 'abc'), zeile('csrftoken', 'xyz')].join('\n'))
    expect(u).toMatchObject({ sessionid: true, csrftoken: true })
    expect(u!.namen).toEqual(['sessionid', 'csrftoken'])
  })

  it('gibt ohne Hinterlegung und ohne sessionid nichts zurück', () => {
    expect(sitzungsumfang(null)).toBeNull()
    expect(sitzungsumfang('')).toBeNull()
    // Ohne sessionid ließe sich gar nichts abrufen — `cookieKopfzeile` sagt schon nein.
    expect(sitzungsumfang(zeile('csrftoken', 'xyz'))).toBeNull()
  })
})
