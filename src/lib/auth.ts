import 'server-only'
import { createHash, randomBytes, randomInt, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import type { Gast, Nutzer } from '@prisma/client'
import { cookies } from 'next/headers'
import { prisma } from './db'
import { env } from './env'

const scryptAsync = promisify(scrypt)

export const TEAM_COOKIE = 'preroll_team'
export const GAST_COOKIE = 'preroll_gast'

const SESSION_TAGE = 30
const CODE_GUELTIG_MINUTEN = 15
const CODE_MAX_VERSUCHE = 5

// ------------------------------------------------------------------ Passwörter

export async function hashePasswort(passwort: string): Promise<string> {
  const salz = randomBytes(16)
  const abgeleitet = (await scryptAsync(passwort, salz, 64)) as Buffer
  return `scrypt:${salz.toString('hex')}:${abgeleitet.toString('hex')}`
}

export async function pruefePasswort(passwort: string, hash: string): Promise<boolean> {
  const [verfahren, salzHex, erwartetHex] = hash.split(':')
  if (verfahren !== 'scrypt' || !salzHex || !erwartetHex) return false

  const erwartet = Buffer.from(erwartetHex, 'hex')
  const abgeleitet = (await scryptAsync(passwort, Buffer.from(salzHex, 'hex'), erwartet.length)) as Buffer
  return timingSafeEqual(erwartet, abgeleitet)
}

// -------------------------------------------------------------------- Sessions

function tokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

function ablauf(): Date {
  return new Date(Date.now() + SESSION_TAGE * 86400_000)
}

async function setzeCookie(name: string, token: string, laeuftAbAm: Date) {
  const speicher = await cookies()
  speicher.set(name, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.appUrl.startsWith('https://'),
    path: '/',
    expires: laeuftAbAm,
  })
}

export async function starteTeamSession(nutzerId: string): Promise<void> {
  const token = randomBytes(32).toString('base64url')
  const laeuftAbAm = ablauf()
  await prisma.nutzerSession.create({
    data: { nutzerId, tokenHash: tokenHash(token), laeuftAbAm },
  })
  await setzeCookie(TEAM_COOKIE, token, laeuftAbAm)
}

export async function starteGastSession(gastId: string, exportId?: string): Promise<void> {
  const token = randomBytes(32).toString('base64url')
  const laeuftAbAm = ablauf()
  await prisma.gastSession.create({
    data: { gastId, exportId: exportId ?? null, tokenHash: tokenHash(token), laeuftAbAm },
  })
  await setzeCookie(GAST_COOKIE, token, laeuftAbAm)
}

export async function aktuellerNutzer(): Promise<Nutzer | null> {
  const token = (await cookies()).get(TEAM_COOKIE)?.value
  if (!token) return null

  const session = await prisma.nutzerSession.findUnique({
    where: { tokenHash: tokenHash(token) },
    include: { nutzer: true },
  })
  if (!session || session.laeuftAbAm < new Date() || !session.nutzer.aktiv) return null

  return session.nutzer
}

export async function aktuellerGast(): Promise<Gast | null> {
  const token = (await cookies()).get(GAST_COOKIE)?.value
  if (!token) return null

  const session = await prisma.gastSession.findUnique({
    where: { tokenHash: tokenHash(token) },
    include: { gast: true },
  })
  if (!session || session.laeuftAbAm < new Date()) return null

  return session.gast
}

export async function beendeTeamSession(): Promise<void> {
  const speicher = await cookies()
  const token = speicher.get(TEAM_COOKIE)?.value
  if (token) {
    await prisma.nutzerSession.deleteMany({ where: { tokenHash: tokenHash(token) } })
  }
  speicher.delete(TEAM_COOKIE)
}

export async function beendeGastSession(): Promise<void> {
  const speicher = await cookies()
  const token = speicher.get(GAST_COOKIE)?.value
  if (token) {
    await prisma.gastSession.deleteMany({ where: { tokenHash: tokenHash(token) } })
  }
  speicher.delete(GAST_COOKIE)
}

// ------------------------------------------------------------- Anmeldecodes

/**
 * Erzeugt einen sechsstelligen Code und legt ihn nur als Hash ab.
 * Rückgabe ist der Klartext — er geht ausschließlich per Mail raus.
 */
export async function erzeugeLoginCode(email: string, exportId?: string): Promise<string> {
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0')

  // Ältere offene Codes derselben Adresse verfallen sofort.
  await prisma.loginCode.deleteMany({ where: { email: email.toLowerCase(), eingelöstAm: null } })

  await prisma.loginCode.create({
    data: {
      email: email.toLowerCase(),
      codeHash: tokenHash(code),
      exportId: exportId ?? null,
      laeuftAbAm: new Date(Date.now() + CODE_GUELTIG_MINUTEN * 60_000),
    },
  })

  return code
}

export type CodePruefung =
  | { ok: true; exportId: string | null }
  | { ok: false; grund: 'unbekannt' | 'abgelaufen' | 'zu-viele-versuche' }

export async function loeseLoginCodeEin(email: string, code: string): Promise<CodePruefung> {
  const eintrag = await prisma.loginCode.findFirst({
    where: { email: email.toLowerCase(), eingelöstAm: null },
    orderBy: { erstelltAm: 'desc' },
  })

  if (!eintrag) return { ok: false, grund: 'unbekannt' }
  if (eintrag.versuche >= CODE_MAX_VERSUCHE) return { ok: false, grund: 'zu-viele-versuche' }
  if (eintrag.laeuftAbAm < new Date()) return { ok: false, grund: 'abgelaufen' }

  if (eintrag.codeHash !== tokenHash(code)) {
    await prisma.loginCode.update({
      where: { id: eintrag.id },
      data: { versuche: { increment: 1 } },
    })
    return { ok: false, grund: 'unbekannt' }
  }

  await prisma.loginCode.update({
    where: { id: eintrag.id },
    data: { eingelöstAm: new Date() },
  })

  return { ok: true, exportId: eintrag.exportId }
}

/** Token für einen öffentlichen Freigabe-Link. */
export function erzeugeExportToken(): string {
  return randomBytes(12).toString('base64url')
}
