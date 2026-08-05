import { decodeJwt } from 'jose'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import type { NextRequest } from 'next/server'
import { starteTeamSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { ladeEinstellungen } from '@/lib/einstellungen'
import { env } from '@/lib/env'
import { initialen } from '@/lib/slug'
import { STATE_COOKIE } from '../start/route'

type TokenAntwort = { id_token?: string; error_description?: string }

/**
 * Rücklauf von Entra ID. Konten werden nur angelegt, wenn die Adresse bereits
 * als Nutzer hinterlegt ist — sonst könnte sich jeder im Tenant anmelden.
 */
export async function GET(anfrage: NextRequest) {
  const e = await ladeEinstellungen()
  if (!e.m365LoginErlaubt || !e.m365TenantId || !e.m365ClientId || !e.m365ClientSecret) {
    redirect('/anmelden?fehler=m365-aus')
  }

  const speicher = await cookies()
  const erwarteterState = speicher.get(STATE_COOKIE)?.value
  speicher.delete(STATE_COOKIE)

  const code = anfrage.nextUrl.searchParams.get('code')
  const state = anfrage.nextUrl.searchParams.get('state')

  if (!code || !state || state !== erwarteterState) {
    redirect('/anmelden?fehler=m365-state')
  }

  const antwort = await fetch(
    `https://login.microsoftonline.com/${e.m365TenantId}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: e.m365ClientId,
        client_secret: e.m365ClientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: `${env.appUrl}/api/auth/m365/callback`,
        scope: 'openid profile email',
      }),
    },
  )

  const daten = (await antwort.json()) as TokenAntwort
  if (!antwort.ok || !daten.id_token) {
    console.error('[m365]', daten.error_description ?? antwort.status)
    redirect('/anmelden?fehler=m365-token')
  }

  // Das Token kommt direkt von Microsoft über eine TLS-Verbindung; eine
  // zusätzliche Signaturprüfung brächte hier keinen Gewinn.
  const anspruch = decodeJwt(daten.id_token) as {
    sub?: string
    email?: string
    preferred_username?: string
    name?: string
  }

  const email = (anspruch.email ?? anspruch.preferred_username ?? '').toLowerCase()
  if (!email) redirect('/anmelden?fehler=m365-token')

  const nutzer = await prisma.nutzer.findUnique({ where: { email } })
  if (!nutzer || !nutzer.aktiv) {
    redirect('/anmelden?fehler=m365-unbekannt')
  }

  await prisma.nutzer.update({
    where: { id: nutzer.id },
    data: {
      oidcSubjekt: anspruch.sub ?? null,
      name: nutzer.name || anspruch.name || email,
      initialen: nutzer.initialen || initialen(anspruch.name ?? email),
      zuletztAktivAm: new Date(),
    },
  })

  await starteTeamSession(nutzer.id)
  redirect('/kunden')
}
