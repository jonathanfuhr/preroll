import { decodeJwt } from 'jose'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import type { NextRequest } from 'next/server'
import { starteTeamSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { ladeEinstellungen } from '@/lib/einstellungen'
import { env } from '@/lib/env'
import { speichereMedium } from '@/lib/medien'
import { initialen } from '@/lib/slug'
import { M365_SCOPE, STATE_COOKIE } from '../start/route'

type TokenAntwort = {
  id_token?: string
  access_token?: string
  error_description?: string
}

type GraphProfil = {
  displayName?: string
  jobTitle?: string | null
  mobilePhone?: string | null
  businessPhones?: string[]
}

const GRAPH_FELDER = 'displayName,jobTitle,mobilePhone,businessPhones'

/**
 * Position und Telefon stehen im Verzeichnis ohnehin gepflegt — sie hier
 * abzuholen erspart das Abtippen. Scheitert der Aufruf, ist das kein Grund,
 * die Anmeldung platzen zu lassen: Die Felder bleiben dann eben leer.
 */
async function ladeProfil(token: string): Promise<GraphProfil | null> {
  try {
    const antwort = await fetch(`https://graph.microsoft.com/v1.0/me?$select=${GRAPH_FELDER}`, {
      headers: { authorization: `Bearer ${token}` },
    })
    if (!antwort.ok) return null
    return (await antwort.json()) as GraphProfil
  } catch (fehler) {
    console.warn('[m365] Profil nicht abrufbar:', fehler)
    return null
  }
}

/** Wer kein Foto hinterlegt hat, bekommt von Graph eine 404 — kein Fehlerfall. */
async function ladeFoto(token: string): Promise<Buffer | null> {
  try {
    const antwort = await fetch('https://graph.microsoft.com/v1.0/me/photo/$value', {
      headers: { authorization: `Bearer ${token}` },
    })
    if (!antwort.ok) return null
    return Buffer.from(await antwort.arrayBuffer())
  } catch (fehler) {
    console.warn('[m365] Foto nicht abrufbar:', fehler)
    return null
  }
}

/** Erste gepflegte Nummer — mobil zuerst, weil sie eher erreichbar ist. */
function telefonnummer(profil: GraphProfil): string | null {
  return profil.mobilePhone?.trim() || profil.businessPhones?.[0]?.trim() || null
}

/**
 * Rücklauf von Entra ID.
 *
 * Wer hier ankommt, kommt aus dem konfigurierten Tenant — die Anmeldeadresse
 * nennt ihn ausdrücklich, fremde Konten kommen gar nicht bis hierher. Deshalb
 * entsteht beim ersten Anmelden ein Konto mit der Rolle `DESIGNER`: lesen und
 * bearbeiten dürfen ohnehin alle, Benachrichtigungen kommen nur für betreute
 * Kunden, und die Verwaltung bleibt der Administration vorbehalten.
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

  // Der Aufruf kann scheitern, bevor Microsoft überhaupt antwortet — ohne
  // diesen Fang bliebe die Rücksprungseite weiß, und niemand wüsste, woran es
  // lag.
  let antwort: Response
  try {
    antwort = await fetch(
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
          scope: M365_SCOPE,
        }),
      },
    )
  } catch (fehler) {
    console.error('[m365] Microsoft nicht erreichbar:', fehler)
    redirect('/anmelden?fehler=m365-netz')
  }

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

  const profil = daten.access_token ? await ladeProfil(daten.access_token) : null
  const name = profil?.displayName?.trim() || anspruch.name || email

  const vorhanden = await prisma.nutzer.findUnique({ where: { email } })
  if (vorhanden && !vorhanden.aktiv) {
    redirect('/anmelden?fehler=m365-gesperrt')
  }

  const nutzer =
    vorhanden ??
    (await prisma.nutzer.create({
      data: {
        email,
        name,
        initialen: initialen(name),
        rolle: 'DESIGNER',
        oidcSubjekt: anspruch.sub ?? null,
      },
    }))

  // Übernommen wird nur, was in Preroll noch leer ist. Wer seine Angaben hier
  // von Hand gesetzt oder ein anderes Bild hochgeladen hat, behält sie — auch
  // wenn im Verzeichnis etwas anderes steht.
  await prisma.nutzer.update({
    where: { id: nutzer.id },
    data: {
      oidcSubjekt: nutzer.oidcSubjekt ?? anspruch.sub ?? null,
      name: nutzer.name || name,
      initialen: nutzer.initialen || initialen(name),
      position: nutzer.position ?? profil?.jobTitle?.trim() ?? null,
      telefon: nutzer.telefon ?? (profil ? telefonnummer(profil) : null),
      zuletztAktivAm: new Date(),
    },
  })

  if (!nutzer.fotoId && daten.access_token) {
    const bild = await ladeFoto(daten.access_token)
    if (bild?.length) {
      try {
        const { medium } = await speichereMedium({
          inhalt: bild,
          dateiname: `${email}.jpg`,
          mimeTyp: 'image/jpeg',
          hochgeladenVonId: nutzer.id,
        })
        await prisma.nutzer.update({ where: { id: nutzer.id }, data: { fotoId: medium.id } })
      } catch (fehler) {
        console.warn('[m365] Foto nicht übernommen:', fehler)
      }
    }
  }

  await starteTeamSession(nutzer.id)
  redirect('/kunden')
}
