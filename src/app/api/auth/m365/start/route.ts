import { randomBytes } from 'node:crypto'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { ladeEinstellungen } from '@/lib/einstellungen'
import { env } from '@/lib/env'

export const STATE_COOKIE = 'preroll_m365_state'

/**
 * `User.Read` kommt zu den OIDC-Ansprüchen dazu, damit der Rücklauf auch ein
 * Zugriffstoken für Graph enthält. Daraus holt Preroll Position, Telefon und
 * Profilbild — Angaben, die im Verzeichnis ohnehin gepflegt sind.
 *
 * Bewusst ohne `offline_access`: Gelesen wird einmal bei der Anmeldung, ein
 * Auffrischungstoken müsste danach nur verwahrt werden.
 */
export const M365_SCOPE = 'openid profile email User.Read'

/** Startet die Anmeldung über Microsoft Entra ID (OpenID Connect). */
export async function GET() {
  const e = await ladeEinstellungen()
  if (!e.m365LoginErlaubt || !e.m365TenantId || !e.m365ClientId) {
    redirect('/anmelden?fehler=m365-aus')
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

  const ziel = new URL(
    `https://login.microsoftonline.com/${e.m365TenantId}/oauth2/v2.0/authorize`,
  )
  ziel.searchParams.set('client_id', e.m365ClientId)
  ziel.searchParams.set('response_type', 'code')
  ziel.searchParams.set('redirect_uri', `${env.appUrl}/api/auth/m365/callback`)
  ziel.searchParams.set('response_mode', 'query')
  ziel.searchParams.set('scope', M365_SCOPE)
  ziel.searchParams.set('state', state)

  redirect(ziel.toString())
}
