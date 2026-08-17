import { describe, expect, it } from 'vitest'
import { autorisierungsUrl, brauchtErneuerung, deuteTokenAntwort, SCOPES } from './linkedin-token'

/**
 * Geprüft wird, was sich ohne echten Zugang prüfen lässt: die Deutung der
 * Token-Antwort und die Frage, wann erneuert werden muss.
 *
 * Beides ist teuer, wenn es falsch ist. Ein falsch gerechnetes `gueltigBis`
 * fällt erst in 60 Tagen auf — mitten in einer Veröffentlichung, die niemand
 * beobachtet.
 */

const JETZT = new Date('2026-08-17T12:00:00.000Z')

describe('deuteTokenAntwort', () => {
  it('rechnet die Gültigkeit aus expires_in', () => {
    const satz = deuteTokenAntwort(
      { access_token: 'abc', expires_in: 5184000, refresh_token: 'ref' },
      JETZT,
    )

    expect(satz.ok).toBe(true)
    if (!satz.ok) return
    expect(satz.daten.token).toBe('abc')
    expect(satz.daten.auffrischToken).toBe('ref')
    // 5.184.000 s sind 60 Tage.
    expect(satz.daten.gueltigBis.toISOString()).toBe('2026-10-16T12:00:00.000Z')
  })

  it('nimmt ohne Angabe die dokumentierten 60 Tage', () => {
    // Lieber zu früh erneuern als zu spät: Ein zu früher Lauf kostet einen
    // Aufruf, ein zu später den Beitrag.
    const satz = deuteTokenAntwort({ access_token: 'abc' }, JETZT)

    expect(satz.ok).toBe(true)
    if (satz.ok) expect(satz.daten.gueltigBis.toISOString()).toBe('2026-10-16T12:00:00.000Z')
  })

  it('erlaubt ein fehlendes Auffrischungstoken', () => {
    // LinkedIn schickt es nicht immer mit — dann gilt das bisherige weiter.
    const satz = deuteTokenAntwort({ access_token: 'abc', expires_in: 3600 }, JETZT)

    expect(satz.ok).toBe(true)
    if (satz.ok) expect(satz.daten.auffrischToken).toBeNull()
  })

  it('nennt den Grund, wenn kein Token kommt — und zeigt auf den Zugang', () => {
    const satz = deuteTokenAntwort(
      { error: 'invalid_grant', error_description: 'Der Code ist verbraucht.' },
      JETZT,
    )

    expect(satz.ok).toBe(false)
    if (satz.ok) return
    expect(satz.fehler.text).toBe('Der Code ist verbraucht.')
    // Nur beim Zugang wird die Administration benachrichtigt — sie allein kann
    // ihn erneuern.
    expect(satz.fehler.zugangHin).toBe(true)
  })

  it('fällt auf den Fehlercode zurück, wenn keine Beschreibung kommt', () => {
    const satz = deuteTokenAntwort({ error: 'invalid_client' }, JETZT)
    expect(satz.ok).toBe(false)
    if (!satz.ok) expect(satz.fehler.text).toBe('invalid_client')
  })
})

describe('brauchtErneuerung', () => {
  it('erneuert mit einer Woche Vorlauf', () => {
    expect(brauchtErneuerung(new Date('2026-08-20T12:00:00Z'), JETZT)).toBe(true)
  })

  it('lässt ein Token in Ruhe, das noch lange gilt', () => {
    expect(brauchtErneuerung(new Date('2026-10-16T12:00:00Z'), JETZT)).toBe(false)
  })

  it('erneuert auch ein bereits abgelaufenes', () => {
    expect(brauchtErneuerung(new Date('2026-08-01T12:00:00Z'), JETZT)).toBe(true)
  })

  it('tut ohne Ablaufdatum nichts — dann weiß niemand, wann es fällig wäre', () => {
    expect(brauchtErneuerung(null, JETZT)).toBe(false)
  })
})

describe('autorisierungsUrl', () => {
  it('trägt Kennung, Rücksprungadresse, Zustand und die Rechte', () => {
    const url = new URL(autorisierungsUrl('client-1', 'https://preroll.example/rueck', 'zufall'))

    expect(url.origin + url.pathname).toBe('https://www.linkedin.com/oauth/v2/authorization')
    expect(url.searchParams.get('response_type')).toBe('code')
    expect(url.searchParams.get('client_id')).toBe('client-1')
    expect(url.searchParams.get('redirect_uri')).toBe('https://preroll.example/rueck')
    expect(url.searchParams.get('state')).toBe('zufall')
    expect(url.searchParams.get('scope')).toBe(SCOPES.join(' '))
  })

  it('verlangt das Schreibrecht für Organisationen — ohne es geht kein Beitrag raus', () => {
    expect(SCOPES).toContain('w_organization_social')
  })
})
