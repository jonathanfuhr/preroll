import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import type { NextRequest } from 'next/server'
import { aktuellerNutzer } from '@/lib/auth'
import { ladeEinstellungen } from '@/lib/einstellungen'
import { holeToken } from '@/lib/linkedin'
import { speichereLinkedInZugang } from '@/lib/linkedin-zugang'
import { rueckAdresse, STATE_COOKIE } from '../start/route'

const ZIEL = '/einstellungen/veroeffentlichen'

function mitFehler(text: string): never {
  redirect(`${ZIEL}?linkedin=fehler&meldung=${encodeURIComponent(text)}`)
}

/**
 * Der Rücklauf von LinkedIn: Code gegen Token tauschen und den Zugang ablegen.
 *
 * Das `state`-Kästchen wird **verglichen und danach gelöscht**. Ohne den
 * Vergleich könnte jemand einen fremden Code unterschieben und damit ein
 * fremdes Konto als Zugang der Agentur hinterlegen.
 */
export async function GET(anfrage: NextRequest) {
  const nutzer = await aktuellerNutzer()
  if (!nutzer || nutzer.rolle !== 'ADMIN') redirect('/anmelden')

  const speicher = await cookies()
  const erwartet = speicher.get(STATE_COOKIE)?.value
  speicher.delete(STATE_COOKIE)

  const suche = anfrage.nextUrl.searchParams
  const fehler = suche.get('error_description') ?? suche.get('error')
  if (fehler) mitFehler(fehler)

  const code = suche.get('code')
  const state = suche.get('state')
  if (!code || !state || !erwartet || state !== erwartet) {
    mitFehler('Der Rücklauf von LinkedIn passte nicht zum gestarteten Vorgang.')
  }

  const e = await ladeEinstellungen()
  if (!e.linkedinClientId || !e.linkedinClientSecret) redirect(`${ZIEL}?linkedin=app-fehlt`)

  const satz = await holeToken({
    code,
    clientId: e.linkedinClientId,
    clientSecret: e.linkedinClientSecret,
    redirectUri: rueckAdresse(),
  })
  if (!satz.ok) mitFehler(satz.fehler.text)

  // Die Bezeichnung nennt, wer verbunden hat — sie steht später in
  // Fehlermeldungen, und dann ist „von wem" die erste Frage.
  await speichereLinkedInZugang({
    ...satz.daten,
    bezeichnung: `LinkedIn · verbunden von ${nutzer.name}`,
  })

  redirect(`${ZIEL}?linkedin=verbunden`)
}
