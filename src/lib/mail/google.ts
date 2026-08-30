import 'server-only'
import { absenderKopf, type Absender, type Mail, type Versandergebnis } from './typen'

export type GoogleKonfiguration = {
  clientId: string
  clientSecret: string
  /** Langlebiges Refresh-Token des sendenden Kontos. */
  refreshToken: string
  absender: string
}

type TokenAntwort = { access_token: string; expires_in: number }

let zwischengespeichert: { token: string; laeuftAbAm: number } | null = null

async function holeToken(k: GoogleKonfiguration): Promise<string> {
  if (zwischengespeichert && zwischengespeichert.laeuftAbAm > Date.now() + 60_000) {
    return zwischengespeichert.token
  }

  const antwort = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: k.clientId,
      client_secret: k.clientSecret,
      refresh_token: k.refreshToken,
      grant_type: 'refresh_token',
    }),
  })

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

/** RFC-2047-Kodierung, damit Umlaute im Betreff ankommen. */
function kodiereKopfzeile(wert: string): string {
  // eslint-disable-next-line no-control-regex
  if (/^[\x00-\x7F]*$/.test(wert)) return wert
  return `=?UTF-8?B?${Buffer.from(wert, 'utf8').toString('base64')}?=`
}

function baueNachricht(absender: Absender, mail: Mail): string {
  const grenze = `preroll-${Math.random().toString(36).slice(2)}`
  const kopf = [
    `From: ${kodiereKopfzeile(absenderKopf(absender))}`,
    `To: ${mail.an}`,
    ...(mail.antwortAn ? [`Reply-To: ${mail.antwortAn}`] : []),
    `Subject: ${kodiereKopfzeile(mail.betreff)}`,
    'MIME-Version: 1.0',
  ]

  if (!mail.html) {
    return [
      ...kopf,
      'Content-Type: text/plain; charset="UTF-8"',
      '',
      mail.text,
    ].join('\r\n')
  }

  return [
    ...kopf,
    `Content-Type: multipart/alternative; boundary="${grenze}"`,
    '',
    `--${grenze}`,
    'Content-Type: text/plain; charset="UTF-8"',
    '',
    mail.text,
    '',
    `--${grenze}`,
    'Content-Type: text/html; charset="UTF-8"',
    '',
    mail.html,
    '',
    `--${grenze}--`,
  ].join('\r\n')
}

/**
 * Versand über die Gmail API. Voraussetzung: OAuth-Client in der Google Cloud
 * Console mit dem Bereich `https://www.googleapis.com/auth/gmail.send` und ein
 * einmalig erzeugtes Refresh-Token des sendenden Kontos.
 */
export async function sendeUeberGoogle(
  konfiguration: GoogleKonfiguration,
  mail: Mail,
): Promise<Versandergebnis> {
  try {
    const token = await holeToken(konfiguration)
    const roh = Buffer.from(
      baueNachricht({ adresse: konfiguration.absender }, mail),
      'utf8',
    ).toString('base64url')

    const antwort = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ raw: roh }),
      },
    )

    if (!antwort.ok) {
      if (antwort.status === 401) zwischengespeichert = null
      return {
        ok: false,
        transport: 'Google',
        fehler: `Gmail API antwortete ${antwort.status}: ${await antwort.text()}`,
      }
    }

    return { ok: true, transport: 'Google' }
  } catch (fehler) {
    return { ok: false, transport: 'Google', fehler: (fehler as Error).message }
  }
}

export const _intern = { baueNachricht, kodiereKopfzeile }
