'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { aktuellerNutzer } from '@/lib/auth'
import { speichereEinstellungen } from '@/lib/einstellungen'
import {
  aktualisiereMetaZugang,
  legeMetaZugangAn,
  loeseMetaZugang,
  pruefeMetaZugang,
} from '@/lib/plattform-zugang'
import { linkedInOrganisationen, loeseLinkedInZugang } from '@/lib/linkedin-zugang'
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
 * Einen Zugang anlegen oder einen bestehenden ändern — dasselbe Formular,
 * unterschieden an der mitgeschickten Kennung.
 *
 * Gespeichert wird auch dann, wenn Meta das Token ablehnt: Sonst tippt man
 * es beim nächsten Versuch noch einmal ab, obwohl vielleicht nur eine
 * Berechtigung fehlt. Was Meta gesagt hat, steht danach am Zugang.
 */
export async function metaZugangSpeichern(formular: FormData) {
  await adminOderRaus()

  const id = String(formular.get('zugangId') ?? '').trim()
  const token = String(formular.get('token') ?? '').trim()
  const bezeichnung = String(formular.get('bezeichnung') ?? '').trim() || 'Systemnutzer'

  // Neu ohne Token wäre ein Zugang, der nichts kann.
  if (!id && !token) {
    redirect(`${SEITE}?stand=fehler&meldung=${encodeURIComponent('Kein Token eingegeben.')}`)
  }

  const ergebnis = id
    ? await aktualisiereMetaZugang(id, bezeichnung, token || null)
    : await legeMetaZugangAn(token, bezeichnung)

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

export async function metaZugangPruefen(formular: FormData) {
  await adminOderRaus()

  const ergebnis = await pruefeMetaZugang(String(formular.get('zugangId') ?? ''))
  revalidatePath(SEITE)

  if (!ergebnis.ok) {
    redirect(`${SEITE}?stand=fehler&meldung=${encodeURIComponent(ergebnis.fehler)}`)
  }
  redirect(
    `${SEITE}?stand=ok&meldung=${encodeURIComponent(`${ergebnis.seiten.length} Seite(n) erreichbar.`)}`,
  )
}

export async function metaZugangLoesen(formular: FormData) {
  await adminOderRaus()
  await loeseMetaZugang(String(formular.get('zugangId') ?? ''))
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

// ------------------------------------------------------------------ LinkedIn

/**
 * Die App-Daten. Ohne sie gibt es keinen Autorisierungsablauf — ein Token von
 * Hand einzutragen wie bei Meta geht bei LinkedIn nicht, denn ein Token für
 * eine Firmenseite entsteht nur über den Ablauf.
 *
 * Das Secret bleibt stehen, wenn das Feld leer abgeschickt wird: Es wird nie
 * zurück in die Maske geschrieben, und ein leeres Feld heißt „unverändert",
 * nicht „lösche es".
 */
export async function linkedInAppSpeichern(formular: FormData) {
  await adminOderRaus()

  const clientId = String(formular.get('linkedinClientId') ?? '').trim()
  const secret = String(formular.get('linkedinClientSecret') ?? '').trim()

  await speichereEinstellungen({
    linkedinClientId: clientId || null,
    ...(secret ? { linkedinClientSecret: secret } : {}),
  })

  revalidatePath('/einstellungen/veroeffentlichen')
}

export async function linkedInZugangLoesen() {
  await adminOderRaus()
  await loeseLinkedInZugang()
  revalidatePath('/einstellungen/veroeffentlichen')
}

/** Prüft den Zugang mit dem Aufruf, den das Posten ohnehin braucht. */
export async function linkedInZugangPruefen() {
  await adminOderRaus()
  await linkedInOrganisationen()
  revalidatePath('/einstellungen/veroeffentlichen')
}
