'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { aktuellerNutzer } from '@/lib/auth'
import { speichereEinstellungen } from '@/lib/einstellungen'
import { loeseMetaZugang, pruefeMetaZugang, speichereMetaToken } from '@/lib/plattform-zugang'
import { takt } from '@/lib/veroeffentlichung-lauf'

const SEITE = '/einstellungen/veroeffentlichen'

async function adminOderRaus() {
  const nutzer = await aktuellerNutzer()
  if (!nutzer) redirect('/anmelden')
  if (nutzer.rolle !== 'ADMIN') redirect('/kunden')
}

export async function hauptschalterSpeichern(formular: FormData) {
  await adminOderRaus()
  await speichereEinstellungen({
    veroeffentlichenAktiv: formular.get('veroeffentlichenAktiv') === 'on',
  })
  revalidatePath(SEITE)
}

/**
 * Token hinterlegen. Gespeichert wird auch dann, wenn Meta es ablehnt — sonst
 * tippt man es beim nächsten Versuch noch einmal ab, obwohl vielleicht nur
 * eine Berechtigung fehlt. Was Meta gesagt hat, steht danach an der
 * Verbindung.
 */
export async function metaTokenSpeichern(formular: FormData) {
  await adminOderRaus()

  const token = String(formular.get('token') ?? '').trim()
  const bezeichnung = String(formular.get('bezeichnung') ?? '').trim() || 'Systemnutzer'

  if (!token) {
    redirect(`${SEITE}?stand=fehler&meldung=${encodeURIComponent('Kein Token eingegeben.')}`)
  }

  const ergebnis = await speichereMetaToken(token, bezeichnung)
  revalidatePath(SEITE)

  if (!ergebnis.ok) {
    redirect(`${SEITE}?stand=fehler&meldung=${encodeURIComponent(ergebnis.fehler)}`)
  }
  redirect(
    `${SEITE}?stand=ok&meldung=${encodeURIComponent(
      ergebnis.seiten.length === 0
        ? 'Der Zugang lebt, aber es ist ihm noch keine Seite zugewiesen.'
        : `${ergebnis.seiten.length} Seite(n) erreichbar.`,
    )}`,
  )
}

export async function metaZugangPruefen() {
  await adminOderRaus()

  const ergebnis = await pruefeMetaZugang()
  revalidatePath(SEITE)

  if (!ergebnis.ok) {
    redirect(`${SEITE}?stand=fehler&meldung=${encodeURIComponent(ergebnis.fehler)}`)
  }
  redirect(
    `${SEITE}?stand=ok&meldung=${encodeURIComponent(`${ergebnis.seiten.length} Seite(n) erreichbar.`)}`,
  )
}

export async function metaZugangLoesen() {
  await adminOderRaus()
  await loeseMetaZugang()
  revalidatePath(SEITE)
}

/**
 * Den Zeitplaner von Hand anstoßen. Er läuft ohnehin jede Minute — der Knopf
 * ist dafür da, beim Einrichten nicht warten zu müssen, und um zu sehen, dass
 * er überhaupt etwas tut.
 */
export async function laufAnstossen() {
  await adminOderRaus()
  await takt()
  revalidatePath(SEITE)
}
