import { describe, expect, it } from 'vitest'
import { cookieKopfzeile, cookieWert } from './instagram-cookies'
import { deuteFehler, normalisiereHandle, werteAusAntwort } from './instagram-profil'

describe('normalisiereHandle', () => {
  it('nimmt den blanken Namen', () => {
    expect(normalisiereHandle('beispiel_handwerk')).toBe('beispiel_handwerk')
  })

  it('wirft @ und Profil-Adresse weg — beides wird oft hineinkopiert', () => {
    expect(normalisiereHandle('@beispiel')).toBe('beispiel')
    expect(normalisiereHandle('https://www.instagram.com/beispiel/')).toBe('beispiel')
    expect(normalisiereHandle('instagram.com/beispiel')).toBe('beispiel')
  })

  it('schneidet Anhängsel hinter dem Namen ab', () => {
    expect(normalisiereHandle('https://instagram.com/beispiel/reels/')).toBe('beispiel')
    expect(normalisiereHandle('https://instagram.com/beispiel?hl=de')).toBe('beispiel')
  })
})

describe('werteAusAntwort', () => {
  const antwort = {
    data: {
      user: {
        edge_followed_by: { count: 1240 },
        edge_follow: { count: 312 },
        edge_owner_to_timeline_media: { count: 87 },
        biography: 'Handwerk aus Leidenschaft',
        external_url: 'https://beispiel-handwerk.de',
        profile_pic_url: 'https://cdn/klein.jpg',
        profile_pic_url_hd: 'https://cdn/gross.jpg',
        is_private: false,
      },
    },
  }

  it('liest die drei Zahlen aus ihren Zählobjekten', () => {
    const w = werteAusAntwort(antwort)!
    expect([w.follower, w.gefolgt, w.beitraege]).toEqual([1240, 312, 87])
  })

  it('nimmt das große Profilbild, wenn es eines gibt', () => {
    expect(werteAusAntwort(antwort)!.profilbildUrl).toBe('https://cdn/gross.jpg')
  })

  it('fällt auf das kleine zurück', () => {
    const ohne = { data: { user: { ...antwort.data.user, profile_pic_url_hd: null } } }
    expect(werteAusAntwort(ohne)!.profilbildUrl).toBe('https://cdn/klein.jpg')
  })

  it('macht aus leeren Texten null statt leerer Zeichenkette', () => {
    const leer = { data: { user: { ...antwort.data.user, biography: '   ', external_url: '' } } }
    const w = werteAusAntwort(leer)!
    expect([w.bio, w.website]).toEqual([null, null])
  })

  it('meldet ein privates Profil', () => {
    const privat = { data: { user: { ...antwort.data.user, is_private: true } } }
    expect(werteAusAntwort(privat)!.privat).toBe(true)
  })

  it('gibt null zurück, wenn die Form nicht stimmt — daran scheitert es zuerst', () => {
    expect(werteAusAntwort({})).toBeNull()
    expect(werteAusAntwort({ data: {} })).toBeNull()
    expect(werteAusAntwort('Anmeldeseite statt JSON')).toBeNull()
  })

  it('lässt fehlende Zähler null, statt sie zu 0 zu erfinden', () => {
    const w = werteAusAntwort({ data: { user: { biography: 'nur Text' } } })!
    expect([w.follower, w.gefolgt, w.beitraege]).toEqual([null, null, null])
  })
})

describe('cookieKopfzeile', () => {
  const datei = [
    '# Netscape HTTP Cookie File',
    '.instagram.com\tTRUE\t/\tTRUE\t1799999999\tsessionid\tABC123',
    '.instagram.com\tTRUE\t/\tTRUE\t1799999999\tds_user_id\t42',
    '.instagram.com\tTRUE\t/\tTRUE\t1799999999\tirrelevant\tweg',
  ].join('\n')

  it('baut aus der Datei die Kurzform für den HTTP-Kopf', () => {
    expect(cookieKopfzeile(datei)).toBe('sessionid=ABC123; ds_user_id=42')
  })

  it('lässt Kommentarzeilen und Unbrauchbares weg', () => {
    expect(cookieKopfzeile(datei)).not.toContain('irrelevant')
    expect(cookieKopfzeile(datei)).not.toContain('#')
  })

  it('liest die HttpOnly-Marke, die Browser-Erweiterungen davorschreiben', () => {
    // Ausgerechnet `sessionid` ist HttpOnly. Wer die Zeile für einen
    // Kommentar hält, wirft genau das weg, worauf es ankommt.
    const export_ = [
      '# Netscape HTTP Cookie File',
      '#HttpOnly_.instagram.com\tTRUE\t/\tTRUE\t1799999999\tsessionid\tABC123',
      '.instagram.com\tTRUE\t/\tFALSE\t1799999999\tcsrftoken\tCSRF9',
    ].join('\n')
    expect(cookieKopfzeile(export_)).toBe('sessionid=ABC123; csrftoken=CSRF9')
  })

  it('gibt ohne sessionid nichts zurück — damit ließe sich nichts abrufen', () => {
    const ohne = '.instagram.com\tTRUE\t/\tTRUE\t1799999999\tds_user_id\t42'
    expect(cookieKopfzeile(ohne)).toBeNull()
    expect(cookieKopfzeile('')).toBeNull()
    expect(cookieKopfzeile(null)).toBeNull()
  })
})

describe('cookieWert', () => {
  const kopf = 'sessionid=ABC123; csrftoken=CSRF9; ds_user_id=42'

  it('holt einen einzelnen Wert heraus — Instagram will csrftoken doppelt', () => {
    expect(cookieWert(kopf, 'csrftoken')).toBe('CSRF9')
    expect(cookieWert(kopf, 'sessionid')).toBe('ABC123')
  })

  it('gibt null für Unbekanntes und für nichts', () => {
    expect(cookieWert(kopf, 'gibtsnicht')).toBeNull()
    expect(cookieWert(null, 'csrftoken')).toBeNull()
  })

  it('zerlegt Werte mit Gleichheitszeichen nicht', () => {
    expect(cookieWert('sessionid=abc==def', 'sessionid')).toBe('abc==def')
  })
})

describe('deuteFehler', () => {
  const SCHEMA =
    'Asset asset://laser.provider/ig_business_category_subvertical has been deleted. You cannot use this schema'

  /*
    Der Fall, der diese Funktion nötig gemacht hat: Instagram liefert für einen
    Teil der Business-Konten 400 mit einem Fehler aus dem eigenen Haus —
    nachgemessen an @adidas und @puma, während @nike im selben Moment
    einwandfrei antwortete. Vorher stand in den Stammdaten „abgewiesen (400)",
    und man suchte den Fehler beim Handle oder bei der hinterlegten Sitzung.
  */
  it('erkennt Instagrams eigenen Schema-Fehler und sagt, dass der Handle stimmt', () => {
    const satz = deuteFehler(400, SCHEMA, 'adensports', false)
    expect(satz).toMatch(/@adensports/)
    expect(satz).toMatch(/Fehler aus dem eigenen Haus/)
    expect(satz).toMatch(/Handle stimmt/)
    expect(satz).not.toMatch(/abgewiesen \(400\)/)
  })

  it('nennt Drosselung als vorübergehend — als Status wie im Text', () => {
    expect(deuteFehler(429, undefined, 'x', false)).toMatch(/bremst/)
    expect(deuteFehler(401, 'Please wait a few minutes before you try again.', 'x', false)).toMatch(
      /bremst/,
    )
  })

  it('unterscheidet ein fehlendes Profil von einem abgewiesenen Abruf', () => {
    expect(deuteFehler(404, undefined, 'gibtsnicht', false)).toMatch(/gibt es nicht/)
  })

  /* Der Rohtext von Instagram reist mit — ohne ihn beginnt das Raten. */
  it('hängt die Meldung an den allgemeinen Fall an', () => {
    expect(deuteFehler(403, 'useragent mismatch', 'x', false)).toMatch(/403: useragent mismatch/)
  })

  it('sagt dazu, wenn auch die hinterlegte Sitzung nicht half', () => {
    expect(deuteFehler(403, undefined, 'x', true)).toMatch(/hinterlegten Sitzung/)
    expect(deuteFehler(403, undefined, 'x', false)).not.toMatch(/hinterlegten Sitzung/)
  })
})

describe('deuteFehler bei Umleitungen', () => {
  /*
    Nachgemessen in Produktion: Mit hinterlegter Sitzung antwortet der
    Endpunkt mit 302 auf **dieselbe** Adresse. `fetch` folgte dem im Kreis und
    warf, woraus „Instagram war nicht erreichbar" wurde — während der anonyme
    Versuch Sekunden vorher sauber geantwortet hatte.
  */
  it('erklärt eine Umleitung als abgelehnte Sitzung, nicht als Ausfall', () => {
    const satz = deuteFehler(302, undefined, 'x', true)
    expect(satz).toMatch(/Sitzung/)
    expect(satz).toMatch(/Umleitung/)
    expect(satz).not.toMatch(/nicht erreichbar/)
  })
})
