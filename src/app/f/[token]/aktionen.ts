'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import {
  aktuellerGast,
  beendeGastSession,
  erzeugeLoginCode,
  loeseLoginCodeEin,
  starteGastSession,
} from '@/lib/auth'
import { meldeFreigabe, meldeNeuenKommentar } from '@/lib/benachrichtigungen'
import { prisma } from '@/lib/db'
import { ladeEinstellungen } from '@/lib/einstellungen'
import { sendeMail } from '@/lib/mail'
import { vorlageAnmeldecode } from '@/lib/mail/vorlagen'

/** Schickt einen sechsstelligen Anmeldecode an die angegebene Adresse. */
export async function codeAnfordern(token: string | null, formular: FormData) {
  const email = String(formular.get('email') ?? '').trim().toLowerCase()
  const name = String(formular.get('name') ?? '').trim()

  if (!email) redirect(zielMitFehler(token, 'email'))

  const exp = token ? await prisma.export.findUnique({ where: { token } }) : null

  // Name und E-Mail sind vor dem Ansehen Pflicht — der Gast entsteht hier.
  await prisma.gast.upsert({
    where: { email },
    update: name ? { name } : {},
    create: { email, name: name || email },
  })

  const code = await erzeugeLoginCode(email, exp?.id)
  const einstellungen = await ladeEinstellungen()

  const ergebnis = await sendeMail(vorlageAnmeldecode(email, code, einstellungen.workspaceName))
  if (!ergebnis.ok) {
    console.error('[gast-login] Code konnte nicht versandt werden:', ergebnis.fehler)
    redirect(zielMitFehler(token, 'versand'))
  }

  redirect(
    token
      ? `/f/${token}/anmelden?schritt=code&email=${encodeURIComponent(email)}`
      : `/portal/anmelden?schritt=code&email=${encodeURIComponent(email)}`,
  )
}

function zielMitFehler(token: string | null, fehler: string): string {
  return token ? `/f/${token}/anmelden?fehler=${fehler}` : `/portal/anmelden?fehler=${fehler}`
}

export async function codeEinloesen(token: string | null, formular: FormData) {
  const email = String(formular.get('email') ?? '').trim().toLowerCase()
  const code = String(formular.get('code') ?? '').replace(/\D/g, '')

  const pruefung = await loeseLoginCodeEin(email, code)
  if (!pruefung.ok) {
    const ziel = token
      ? `/f/${token}/anmelden?schritt=code&email=${encodeURIComponent(email)}`
      : `/portal/anmelden?schritt=code&email=${encodeURIComponent(email)}`
    redirect(`${ziel}&fehler=${pruefung.grund}`)
  }

  const gast = await prisma.gast.findUnique({ where: { email } })
  if (!gast) redirect(zielMitFehler(token, 'unbekannt'))

  await prisma.gast.update({ where: { id: gast.id }, data: { zuletztAktivAm: new Date() } })
  await starteGastSession(gast.id, pruefung.exportId ?? undefined)

  // Wer über einen Link kommt, wird diesem Export zugeordnet — so taucht er
  // später in der eigenen Übersicht auf.
  if (pruefung.exportId) {
    await prisma.exportGast.upsert({
      where: { exportId_gastId: { exportId: pruefung.exportId, gastId: gast.id } },
      update: { zuletztGeoeffnetAm: new Date() },
      create: { exportId: pruefung.exportId, gastId: gast.id, zuletztGeoeffnetAm: new Date() },
    })
  }

  redirect(token ? `/f/${token}` : '/portal')
}

export async function gastAbmelden(ziel = '/portal/anmelden') {
  await beendeGastSession()
  redirect(ziel)
}

/** Kommentar eines Kunden — ohne Anmeldung nur mit Namensangabe. */
export async function kommentarVomKunden(token: string, formular: FormData) {
  const exp = await prisma.export.findUnique({ where: { token } })
  if (!exp || !exp.kommentareErlaubt) return

  const text = String(formular.get('text') ?? '').trim()
  if (!text) return

  const gast = await aktuellerGast()
  const name = gast?.name ?? String(formular.get('autorName') ?? '').trim()
  if (!name) return

  const postId = String(formular.get('postId') ?? '') || null

  const kommentar = await prisma.kommentar.create({
    data: {
      postId,
      exportId: exp.id,
      abschnitt: String(formular.get('abschnitt') ?? 'allgemein'),
      autorName: name,
      autorEmail: gast?.email ?? null,
      gastId: gast?.id ?? null,
      text,
    },
  })

  await meldeNeuenKommentar(kommentar.id)
  revalidatePath(`/f/${token}`)
}

/** Der Kunde erteilt die Freigabe für den gesamten Plan. */
export async function freigabeErteilen(token: string, formular: FormData) {
  const exp = await prisma.export.findUnique({ where: { token } })
  if (!exp || !exp.freigabeButtonZeigen) return

  const gast = await aktuellerGast()
  const name = gast?.name ?? String(formular.get('autorName') ?? '').trim()
  if (!name) return

  const freigabe = await prisma.freigabe.create({
    data: {
      exportId: exp.id,
      gastId: gast?.id ?? null,
      autorName: name,
      notiz: String(formular.get('notiz') ?? '').trim() || null,
    },
  })

  // Die erste Freigabe schaltet den Link von „im Review" auf „freigegeben".
  if (!exp.freigegebenAm) {
    await prisma.export.update({
      where: { id: exp.id },
      data: { freigegebenAm: new Date() },
    })
  }

  await meldeFreigabe(freigabe.id)
  revalidatePath(`/f/${token}`)
  revalidatePath('/portal')
}
