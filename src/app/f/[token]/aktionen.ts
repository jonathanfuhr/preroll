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
import { env } from '@/lib/env'
import { sendeMail } from '@/lib/mail'
import { vorlageAnmeldecode } from '@/lib/mail/vorlagen'

/**
 * Anmeldung von Kunden — dreistufig wie in Klappe:
 * E-Mail → Code aus der Mail → Name → Inhalt.
 *
 * Ein Freigabe-Link öffnet sich nie ohne diese Hürde. Wer eine gültige
 * Sitzung hat (40 Tage), kommt direkt durch.
 */

function anmeldePfad(token: string | null): string {
  return token ? `/f/${token}/anmelden` : '/portal/anmelden'
}

function zielPfad(token: string | null): string {
  return token ? `/f/${token}` : '/portal'
}

// ------------------------------------------------------- Schritt 1: E-Mail

export async function codeAnfordern(token: string | null, formular: FormData) {
  const email = String(formular.get('email') ?? '').trim().toLowerCase()
  if (!email) redirect(`${anmeldePfad(token)}?fehler=email`)

  const exp = token ? await prisma.export.findUnique({ where: { token } }) : null

  // Der Gast entsteht hier ohne Namen — der kommt erst nach dem Code.
  await prisma.gast.upsert({
    where: { email },
    update: {},
    create: { email, name: '' },
  })

  const code = await erzeugeLoginCode(email, exp?.id)
  const einstellungen = await ladeEinstellungen()

  const ergebnis = await sendeMail(vorlageAnmeldecode(email, code, einstellungen.workspaceName))

  if (!ergebnis.ok) {
    // In der Entwicklung ist meist kein Mailversand eingerichtet. Statt die
    // Anmeldung dort unbenutzbar zu machen, steht der Code im Serverprotokoll.
    if (!env.istProduktion) {
      console.warn(`[gast-login] Kein Mailversand — Code für ${email}: ${code}`)
    } else {
      console.error('[gast-login] Code konnte nicht versandt werden:', ergebnis.fehler)
      redirect(`${anmeldePfad(token)}?fehler=versand`)
    }
  }

  redirect(`${anmeldePfad(token)}?schritt=code&email=${encodeURIComponent(email)}`)
}

// ---------------------------------------------------------- Schritt 2: Code

export async function codeEinloesen(token: string | null, formular: FormData) {
  const email = String(formular.get('email') ?? '').trim().toLowerCase()
  const code = String(formular.get('code') ?? '').replace(/\D/g, '')

  const pruefung = await loeseLoginCodeEin(email, code)
  if (!pruefung.ok) {
    redirect(
      `${anmeldePfad(token)}?schritt=code&email=${encodeURIComponent(email)}&fehler=${pruefung.grund}`,
    )
  }

  const gast = await prisma.gast.findUnique({ where: { email } })
  if (!gast) redirect(`${anmeldePfad(token)}?fehler=unbekannt`)

  await prisma.gast.update({ where: { id: gast.id }, data: { zuletztAktivAm: new Date() } })
  await starteGastSession(gast.id, pruefung.exportId ?? undefined)

  // Wer über einen Link kommt, wird dem Export zugeordnet — so taucht er
  // später in der eigenen Übersicht auf.
  if (pruefung.exportId) {
    await prisma.exportGast.upsert({
      where: { exportId_gastId: { exportId: pruefung.exportId, gastId: gast.id } },
      update: { zuletztGeoeffnetAm: new Date() },
      create: { exportId: pruefung.exportId, gastId: gast.id, zuletztGeoeffnetAm: new Date() },
    })
  }

  redirect(`${anmeldePfad(token)}?schritt=name`)
}

// ---------------------------------------------------------- Schritt 3: Name

export async function namenSpeichern(token: string | null, formular: FormData) {
  const gast = await aktuellerGast()
  if (!gast) redirect(anmeldePfad(token))

  const name = String(formular.get('name') ?? '').trim()
  if (!name) redirect(`${anmeldePfad(token)}?schritt=name&fehler=name`)

  await prisma.gast.update({ where: { id: gast.id }, data: { name } })
  redirect(zielPfad(token))
}

export async function gastAbmelden(ziel = '/portal/anmelden') {
  await beendeGastSession()
  redirect(ziel)
}

// -------------------------------------------------------------- Kommentare

export async function kommentarVomKunden(token: string, formular: FormData) {
  const exp = await prisma.export.findUnique({ where: { token } })
  if (!exp || !exp.kommentareErlaubt) return

  const text = String(formular.get('text') ?? '').trim()
  if (!text) return

  // Ohne Anmeldung kommt niemand bis hierher — der Name steht am Gast.
  const gast = await aktuellerGast()
  if (!gast) redirect(`/f/${token}/anmelden`)

  const postId = String(formular.get('postId') ?? '') || null

  const kommentar = await prisma.kommentar.create({
    data: {
      postId,
      exportId: exp.id,
      abschnitt: String(formular.get('abschnitt') ?? 'allgemein'),
      autorName: gast.name,
      autorEmail: gast.email,
      gastId: gast.id,
      text,
    },
  })

  await meldeNeuenKommentar(kommentar.id)
  revalidatePath(`/f/${token}`)
}

export async function freigabeErteilen(token: string, formular: FormData) {
  const exp = await prisma.export.findUnique({ where: { token } })
  if (!exp || !exp.freigabeButtonZeigen) return

  const gast = await aktuellerGast()
  if (!gast) redirect(`/f/${token}/anmelden`)

  const freigabe = await prisma.freigabe.create({
    data: {
      exportId: exp.id,
      gastId: gast.id,
      autorName: gast.name,
      notiz: String(formular.get('notiz') ?? '').trim() || null,
    },
  })

  // Die erste Freigabe schaltet den Link von „im Review" auf „freigegeben".
  if (!exp.freigegebenAm) {
    await prisma.export.update({ where: { id: exp.id }, data: { freigegebenAm: new Date() } })
  }

  await meldeFreigabe(freigabe.id)
  revalidatePath(`/f/${token}`)
  revalidatePath('/portal')
}
