import { randomBytes } from 'node:crypto'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { aktuellerNutzer } from '@/lib/auth'
import { ladeEinstellungen } from '@/lib/einstellungen'
import { env } from '@/lib/env'
import { autorisierungsUrl } from '@/lib/linkedin-token'

export const STATE_COOKIE = 'preroll_linkedin_state'

/** Die Rücksprungadresse muss in der LinkedIn-App genauso eingetragen sein. */
export function rueckAdresse(): string {
  return `${env.appUrl}/api/auth/linkedin/callback`
}

/**
 * Startet die Verbindung zu LinkedIn.
 *
 * Anders als bei der Anmeldung über Microsoft geht es hier nicht um einen
 * Menschen, der sich anmeldet, sondern um einen Zugang, mit dem Preroll später
 * postet. Deshalb darf **nur die Administration** hier hindurch — wer den
 * Ablauf startet, verbindet ein Konto für alle Kunden.
 */
export async function GET() {
  const nutzer = await aktuellerNutzer()
  if (!nutzer) redirect('/anmelden')
  if (nutzer.rolle !== 'ADMIN') redirect('/kunden')

  const e = await ladeEinstellungen()
  if (!e.linkedinClientId || !e.linkedinClientSecret) {
    redirect('/einstellungen/veroeffentlichen?linkedin=app-fehlt')
  }

  // Schützt vor untergeschobenen Rückläufern.
  const state = randomBytes(16).toString('base64url')
  const speicher = await cookies()
  speicher.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.appUrl.startsWith('https://'),
    path: '/',
    maxAge: 600,
  })

  redirect(autorisierungsUrl(e.linkedinClientId, rueckAdresse(), state))
}
