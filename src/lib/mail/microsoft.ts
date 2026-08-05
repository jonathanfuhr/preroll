import 'server-only'
import type { Mail, Versandergebnis } from './typen'

export type MicrosoftKonfiguration = {
  tenantId: string
  clientId: string
  clientSecret: string
  /** Postfach, aus dem gesendet wird — UPN oder Objekt-ID. */
  postfach: string
}

type TokenAntwort = { access_token: string; expires_in: number }

// Ein Token gilt rund eine Stunde; wir halten es im Prozess vor.
let zwischengespeichert: { token: string; laeuftAbAm: number } | null = null

async function holeToken(k: MicrosoftKonfiguration): Promise<string> {
  if (zwischengespeichert && zwischengespeichert.laeuftAbAm > Date.now() + 60_000) {
    return zwischengespeichert.token
  }

  const antwort = await fetch(
    `https://login.microsoftonline.com/${encodeURIComponent(k.tenantId)}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: k.clientId,
        client_secret: k.clientSecret,
        scope: 'https://graph.microsoft.com/.default',
        grant_type: 'client_credentials',
      }),
    },
  )

  if (!antwort.ok) {
    throw new Error(`Token abgelehnt (${antwort.status}): ${await antwort.text()}`)
  }

  const daten = (await antwort.json()) as TokenAntwort
  zwischengespeichert = {
    token: daten.access_token,
    laeuftAbAm: Date.now() + daten.expires_in * 1000,
  }
  return daten.access_token
}

/**
 * Versand über Microsoft Graph (`sendMail`) mit App-Berechtigung.
 * Voraussetzung im Entra Admin Center: App-Registrierung mit der
 * Anwendungsberechtigung `Mail.Send` und erteilter Administratorzustimmung.
 */
export async function sendeUeberMicrosoft(
  konfiguration: MicrosoftKonfiguration,
  mail: Mail,
): Promise<Versandergebnis> {
  try {
    const token = await holeToken(konfiguration)

    const antwort = await fetch(
      `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(konfiguration.postfach)}/sendMail`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          message: {
            subject: mail.betreff,
            body: {
              contentType: mail.html ? 'HTML' : 'Text',
              content: mail.html ?? mail.text,
            },
            toRecipients: [{ emailAddress: { address: mail.an } }],
          },
          saveToSentItems: true,
        }),
      },
    )

    if (!antwort.ok) {
      // Ein abgelaufenes Token nicht weiter verwenden.
      if (antwort.status === 401) zwischengespeichert = null
      return {
        ok: false,
        transport: 'Microsoft 365',
        fehler: `Graph antwortete ${antwort.status}: ${await antwort.text()}`,
      }
    }

    return { ok: true, transport: 'Microsoft 365' }
  } catch (fehler) {
    return { ok: false, transport: 'Microsoft 365', fehler: (fehler as Error).message }
  }
}

/** Nur für Tests — leert den Token-Zwischenspeicher. */
export function verwerfeMicrosoftToken(): void {
  zwischengespeichert = null
}
