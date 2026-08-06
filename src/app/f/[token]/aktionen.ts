'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import {
  aktuellerGast,
  aktuellerNutzer,
  beendeGastSession,
  erzeugeLoginCode,
  loeseLoginCodeEin,
  starteGastSession,
} from '@/lib/auth'
import { meldeFreigabe, meldeNeuenKommentar } from '@/lib/benachrichtigungen'
import { darfBearbeiten, darfLoeschen, type Betrachter } from '@/lib/kommentar-rechte'
import { prisma } from '@/lib/db'
import { ladeEinstellungen } from '@/lib/einstellungen'
import { offeneStufe } from '@/lib/freigabe'
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

  // Ohne Anmeldung kommt niemand bis hierher. Das Team sieht dieselbe Seite
  // in der Vorschau und schreibt dort unter seinem eigenen Namen — solche
  // Kommentare gehen an die Gäste des Links, nicht ins eigene Haus
  // (`meldeNeuenKommentar` entscheidet das am `nutzerId`).
  const gast = await aktuellerGast()
  const nutzer = gast?.name.trim() ? null : await aktuellerNutzer()
  if (!gast?.name.trim() && !nutzer) redirect(`/f/${token}/anmelden`)

  const postId = String(formular.get('postId') ?? '') || null
  const antwortAufId = String(formular.get('antwortAufId') ?? '') || null

  const kommentar = await prisma.kommentar.create({
    data: {
      postId,
      exportId: exp.id,
      abschnitt: String(formular.get('abschnitt') ?? 'allgemein'),
      autorName: nutzer ? nutzer.name : gast!.name,
      autorEmail: nutzer ? nutzer.email : gast!.email,
      gastId: nutzer ? null : gast!.id,
      nutzerId: nutzer?.id ?? null,
      text,
      antwortAufId,
    },
  })

  await meldeNeuenKommentar(kommentar.id)
  revalidatePath(`/f/${token}`)
}

/**
 * Wer auf der Freigabe-Seite sitzt, darf **die eigenen** Kommentare ändern
 * und löschen — ein Tippfehler soll nicht bis zum Anruf bei der Agentur
 * stehen bleiben. „Erledigt" bleibt dem Team vorbehalten: Es entscheidet,
 * wann eine Anmerkung umgesetzt ist.
 *
 * Sieht das Team die Seite in der Vorschau, gelten dort seine eigenen
 * Rechte — inklusive der Ausnahme für die Administration.
 */
async function werDaSchreibt(): Promise<Betrachter | null> {
  const gast = await aktuellerGast()
  if (gast?.name.trim()) return { art: 'gast', id: gast.id }

  const nutzer = await aktuellerNutzer()
  return nutzer ? { art: 'nutzer', id: nutzer.id, rolle: nutzer.rolle } : null
}

export async function gastKommentarBearbeiten(token: string, kommentarId: string, formular: FormData) {
  const wer = await werDaSchreibt()
  if (!wer) return

  const inhalt = String(formular.get('text') ?? '').trim()
  if (!inhalt) return

  const kommentar = await prisma.kommentar.findUniqueOrThrow({
    where: { id: kommentarId },
    select: { nutzerId: true, gastId: true, export: { select: { token: true } } },
  })
  // Der Kommentar muss zu diesem Link gehören — sonst ließe sich mit einer
  // fremden Kennung an einem anderen Export herumschreiben.
  if (kommentar.export?.token !== token) return
  if (!darfBearbeiten(kommentar, wer)) return

  await prisma.kommentar.update({
    where: { id: kommentarId },
    data: { text: inhalt, bearbeitetAm: new Date() },
  })
  revalidatePath(`/f/${token}`)
}

export async function gastKommentarLoeschen(token: string, kommentarId: string) {
  const wer = await werDaSchreibt()
  if (!wer) return

  const kommentar = await prisma.kommentar.findUniqueOrThrow({
    where: { id: kommentarId },
    select: { nutzerId: true, gastId: true, export: { select: { token: true } } },
  })
  if (kommentar.export?.token !== token) return
  if (!darfLoeschen(kommentar, wer)) return

  await prisma.kommentar.delete({ where: { id: kommentarId } })
  revalidatePath(`/f/${token}`)
}

/**
 * Der Kunde gibt einen einzelnen Post frei — je nach Status das Konzept oder
 * die Vorschau. Die anstehende Stufe kommt aus dem Status, nicht aus dem
 * Formular: sonst könnte ein veralteter Tab die falsche Stufe setzen.
 */
export async function freigabeErteilen(token: string, postId: string, formular: FormData) {
  const exp = await prisma.export.findUnique({ where: { token } })
  if (!exp || !exp.freigabenErlaubt) return

  const gast = await aktuellerGast()
  const nutzer = gast?.name.trim() ? null : await aktuellerNutzer()
  if (!gast?.name.trim() && !nutzer) redirect(`/f/${token}/anmelden`)

  const post = await prisma.post.findUnique({ where: { id: postId } })
  if (!post || post.kundeId !== exp.kundeId) return

  const stufe = offeneStufe(post.status)
  if (!stufe) return

  const freigabe = await prisma.freigabe.upsert({
    where: { postId_stufe: { postId, stufe } },
    update: {},
    create: {
      postId,
      stufe,
      exportId: exp.id,
      gastId: nutzer ? null : gast!.id,
      nutzerId: nutzer?.id ?? null,
      autorName: nutzer ? nutzer.name : gast!.name,
      notiz: String(formular.get('notiz') ?? '').trim() || null,
    },
  })

  // Trägt das Team die Freigabe ein, weiß es bereits Bescheid — dieselbe Regel
  // wie im Post-Editor.
  if (!nutzer) await meldeFreigabe(freigabe.id)
  revalidatePath(`/f/${token}`)
  revalidatePath('/portal')
}
