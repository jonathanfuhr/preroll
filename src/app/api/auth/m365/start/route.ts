import { randomBytes } from 'node:crypto'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { ladeEinstellungen } from '@/lib/einstellungen'
import { env } from '@/lib/env'

export const STATE_COOKIE = 'preroll_m365_state'

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
  ziel.searchParams.set('scope', 'openid profile email')
  ziel.searchParams.set('state', state)

  redirect(ziel.toString())
}
