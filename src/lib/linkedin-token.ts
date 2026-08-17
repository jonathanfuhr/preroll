/**
 * Die rechnenden Teile der LinkedIn-Anbindung — ohne `server-only`, damit sie
 * prüfbar bleiben.
 *
 * Dieselbe Trennung wie bei `veroeffentlichung-medien.ts` neben
 * `veroeffentlichung.ts`: Hier wird nur gerechnet, nichts abgerufen. Und
 * genau hier wäre ein Fehler teuer — ein falsch gerechnetes `gueltigBis`
 * fällt erst in 60 Tagen auf, mitten in einer Veröffentlichung, die niemand
 * beobachtet.
 */

/** Der Autorisierungs-Endpunkt. Die REST-Adresse steht in `linkedin.ts`. */
const AUTH = 'https://www.linkedin.com/oauth/v2'

export type LinkedInFehler = {
  text: string
  /** Zeigt auf den Zugang statt auf den Beitrag — dann meldet Preroll die Administration. */
  zugangHin: boolean
}

export type LinkedInAntwort<T> = { ok: true; daten: T } | { ok: false; fehler: LinkedInFehler }

export type LinkedInOrganisation = {
  /** Die nackte Zahl, ohne `urn:li:organization:`. */
  id: string
  name: string
  /** Der Teil hinter /company/ — nur zur Anzeige. */
  handle: string | null
}

export const SCOPES = ['w_organization_social', 'r_organization_social', 'rw_organization_admin']

export function autorisierungsUrl(clientId: string, redirectUri: string, state: string): string {
  const ziel = new URL(`${AUTH}/authorization`)
  ziel.searchParams.set('response_type', 'code')
  ziel.searchParams.set('client_id', clientId)
  ziel.searchParams.set('redirect_uri', redirectUri)
  ziel.searchParams.set('state', state)
  ziel.searchParams.set('scope', SCOPES.join(' '))
  return ziel.toString()
}

export type TokenSatz = {
  token: string
  auffrischToken: string | null
  gueltigBis: Date
}

/**
 * Deutet die Antwort des Token-Endpunkts.
 *
 * Rein gehalten und getestet, weil hier der Fehler teuer wäre: Ein falsch
 * gerechnetes `gueltigBis` fällt erst in 60 Tagen auf — mitten in einer
 * Veröffentlichung, die niemand beobachtet.
 */
export function deuteTokenAntwort(
  roh: {
    access_token?: string
    expires_in?: number
    refresh_token?: string
    error_description?: string
    error?: string
  },
  jetzt: Date,
): LinkedInAntwort<TokenSatz> {
  if (!roh.access_token) {
    return {
      ok: false,
      fehler: {
        text: roh.error_description ?? roh.error ?? 'LinkedIn hat kein Token zurückgegeben.',
        zugangHin: true,
      },
    }
  }

  // Ohne Angabe die dokumentierten 60 Tage. Lieber zu früh erneuern als zu
  // spät: Ein zu früher Lauf kostet einen Aufruf, ein zu später den Beitrag.
  const sekunden = roh.expires_in ?? 60 * 86400
  return {
    ok: true,
    daten: {
      token: roh.access_token,
      auffrischToken: roh.refresh_token ?? null,
      gueltigBis: new Date(jetzt.getTime() + sekunden * 1000),
    },
  }
}

/** Muss der Token erneuert werden? Eine Woche Vorlauf, damit nichts knapp wird. */
export function brauchtErneuerung(gueltigBis: Date | null, jetzt = new Date()): boolean {
  if (!gueltigBis) return false
  return gueltigBis.getTime() - jetzt.getTime() < 7 * 86400_000
}
