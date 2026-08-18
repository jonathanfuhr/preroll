import { describe, expect, it } from 'vitest'
import { datenblockAus, normalisiereHandle, statusAus, werteAusSeite } from './tiktok-profil'

/*
  Geprüft wird die Textarbeit, nicht der Abruf: Genau hier bricht es zuerst,
  wenn TikTok die Seite umbaut. Die Beispiele sind auf das eingedampft, was
  wirklich gelesen wird — die echte Seite bringt 390 kB mit.
*/

function seite(daten: unknown): string {
  return `<html><head></head><body><script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application/json">${JSON.stringify(daten)}</script></body></html>`
}

const HEUTE = {
  __DEFAULT_SCOPE__: {
    'webapp.user-detail': {
      userInfo: {
        user: {
          uniqueId: 'beispiel.handwerk',
          nickname: 'Beispiel Handwerk',
          signature: 'Wir bauen.',
          avatarLarger: 'https://p16.tiktokcdn.com/gross.jpeg',
          privateAccount: false,
        },
        stats: { followerCount: 95300000, followingCount: 0, heartCount: 462800000, videoCount: 1489 },
        statsV2: {
          followerCount: '95315669',
          followingCount: '0',
          heartCount: '462793441',
          videoCount: '1489',
        },
      },
    },
  },
}

describe('normalisiereHandle', () => {
  it('nimmt alles, was jemand kopieren könnte', () => {
    for (const eingabe of [
      '@beispiel.handwerk',
      'beispiel.handwerk',
      'https://www.tiktok.com/@beispiel.handwerk',
      'tiktok.com/@beispiel.handwerk?lang=de',
      '  @beispiel.handwerk  ',
    ]) {
      expect(normalisiereHandle(eingabe)).toBe('beispiel.handwerk')
    }
  })
})

describe('werteAusSeite', () => {
  it('liest Profil und Zahlen aus dem heutigen Datenblock', () => {
    const w = werteAusSeite(seite(HEUTE))
    expect(w).toEqual({
      handle: 'beispiel.handwerk',
      name: 'Beispiel Handwerk',
      bio: 'Wir bauen.',
      follower: 95315669,
      gefolgt: 0,
      beitraege: 1489,
      likes: 462793441,
      profilbildUrl: 'https://p16.tiktokcdn.com/gross.jpeg',
      privat: false,
    })
  })

  /*
    Der Grund für `statsV2`: `stats` rundet. In einer Verlaufskurve wären
    gerundete Zahlen wertlos — sie bewegten sich erst nach Hunderttausenden.
  */
  it('nimmt die genauen Zahlen, nicht die gerundeten', () => {
    expect(werteAusSeite(seite(HEUTE))?.follower).toBe(95315669)
  })

  it('fällt auf die gerundeten zurück, wenn es nur die gibt', () => {
    const ohneV2 = structuredClone(HEUTE) as typeof HEUTE & Record<string, never>
    delete (ohneV2.__DEFAULT_SCOPE__['webapp.user-detail'].userInfo as Record<string, unknown>)
      .statsV2
    expect(werteAusSeite(seite(ohneV2))?.follower).toBe(95300000)
  })

  it('liest auch das alte SIGI_STATE', () => {
    const alt = `<script id="SIGI_STATE" type="application/json">${JSON.stringify({
      UserModule: {
        users: { 'alte.seite': { uniqueId: 'alte.seite', nickname: 'Alt' } },
        stats: { 'alte.seite': { followerCount: 120, followingCount: 4, heartCount: 900, videoCount: 12 } },
      },
    })}</script>`
    const w = werteAusSeite(alt)
    expect(w?.handle).toBe('alte.seite')
    expect(w?.follower).toBe(120)
    expect(w?.likes).toBe(900)
  })

  it('gibt null zurück, wo kein Profil steht', () => {
    expect(werteAusSeite('<html><body>Verify to continue</body></html>')).toBeNull()
    expect(werteAusSeite(seite({ __DEFAULT_SCOPE__: {} }))).toBeNull()
  })

  it('lässt sich von kaputtem JSON nicht aus der Ruhe bringen', () => {
    expect(datenblockAus('<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__">{kaputt</script>')).toBeNull()
  })

  /*
    Ein privates Konto zeigt seine Zahlen trotzdem — nur die Videos nicht.
    Das ist kein Fehlerfall, sondern eine Auskunft für die Stammdaten.
  */
  it('merkt sich, dass ein Konto privat ist', () => {
    const privat = structuredClone(HEUTE)
    privat.__DEFAULT_SCOPE__['webapp.user-detail'].userInfo.user.privateAccount = true
    expect(werteAusSeite(seite(privat))?.privat).toBe(true)
  })
})

describe('statusAus', () => {
  /*
    TikTok antwortet für ein Konto, das es nicht gibt, mit **200** und einer
    Seite ohne `userInfo` — dafür mit einem Statuscode. Ohne diese
    Unterscheidung hieße jeder Fehlschlag „Sperrseite", und wer sich im Handle
    vertippt, suchte den Fehler bei TikTok statt bei sich.
  */
  it('liest den Grund, den TikTok selbst nennt', () => {
    const html = seite({
      __DEFAULT_SCOPE__: {
        'webapp.user-detail': { statusCode: 10221, statusMsg: 'user banned', needFix: false },
      },
    })
    expect(statusAus(html)).toEqual({ code: 10221, text: 'user banned' })
    expect(werteAusSeite(html)).toBeNull()
  })

  it('schweigt, wo ein Profil steht', () => {
    expect(statusAus(seite(HEUTE))).toBeNull()
  })

  it('schweigt bei einer Sperrseite ohne Datenblock', () => {
    expect(statusAus('<html><body>Verify to continue</body></html>')).toBeNull()
  })
})
