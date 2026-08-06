'use server'

import type { Rolle } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { aktuellerNutzer, hashePasswort, pruefePasswort } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { pruefePasswortRegeln } from '@/lib/passwort'
import { darfVerwalten } from '@/lib/rollen'
import { initialen } from '@/lib/slug'

async function adminOderRaus() {
  const nutzer = await aktuellerNutzer()
  if (!nutzer) redirect('/anmelden')
  if (!darfVerwalten(nutzer.rolle)) redirect('/kunden')
  return nutzer
}

function text(formular: FormData, feld: string): string | null {
  const wert = String(formular.get(feld) ?? '').trim()
  return wert === '' ? null : wert
}

// ------------------------------------------------------- Benutzerverwaltung

export async function nutzerAnlegen(formular: FormData) {
  await adminOderRaus()

  const name = text(formular, 'name')
  const email = text(formular, 'email')?.toLowerCase()
  const passwort = String(formular.get('passwort') ?? '')

  if (!name || !email) redirect('/einstellungen/benutzer?fehler=pflicht')

  const regelbruch = pruefePasswortRegeln(passwort)
  if (regelbruch) {
    redirect(`/einstellungen/benutzer?fehler=passwort&meldung=${encodeURIComponent(regelbruch)}`)
  }

  if (await prisma.nutzer.findUnique({ where: { email } })) {
    redirect('/einstellungen/benutzer?fehler=vorhanden')
  }

  await prisma.nutzer.create({
    data: {
      email,
      name,
      initialen: initialen(name),
      rolle: (text(formular, 'rolle') ?? 'EDITOR') as Rolle,
      position: text(formular, 'position'),
      telefon: text(formular, 'telefon'),
      passwortHash: await hashePasswort(passwort),
    },
  })

  revalidatePath('/einstellungen/benutzer')
}

export async function nutzerSpeichern(nutzerId: string, formular: FormData) {
  const ich = await adminOderRaus()

  const rolle = (text(formular, 'rolle') ?? 'EDITOR') as Rolle
  const aktiv = formular.get('aktiv') === 'on'

  // Sich selbst die Rechte oder den Zugang zu nehmen, sperrt das System aus.
  if (nutzerId === ich.id && (rolle !== 'ADMIN' || !aktiv)) {
    redirect('/einstellungen/benutzer?fehler=selbst')
  }

  // Es muss immer jemand die Verwaltung öffnen können.
  if (rolle !== 'ADMIN' || !aktiv) {
    const andereAdmins = await prisma.nutzer.count({
      where: { rolle: 'ADMIN', aktiv: true, id: { not: nutzerId } },
    })
    if (andereAdmins === 0) redirect('/einstellungen/benutzer?fehler=letzter-admin')
  }

  const name = text(formular, 'name')
  await prisma.nutzer.update({
    where: { id: nutzerId },
    data: {
      name: name ?? undefined,
      initialen: name ? initialen(name) : undefined,
      email: text(formular, 'email')?.toLowerCase() ?? undefined,
      rolle,
      aktiv,
      position: text(formular, 'position'),
      telefon: text(formular, 'telefon'),
    },
  })

  revalidatePath('/einstellungen/benutzer')
}

export async function passwortZuruecksetzen(nutzerId: string, formular: FormData) {
  await adminOderRaus()

  const passwort = String(formular.get('passwort') ?? '')
  const regelbruch = pruefePasswortRegeln(passwort)
  if (regelbruch) {
    redirect(`/einstellungen/benutzer?fehler=passwort&meldung=${encodeURIComponent(regelbruch)}`)
  }

  await prisma.nutzer.update({
    where: { id: nutzerId },
    data: { passwortHash: await hashePasswort(passwort) },
  })

  // Bestehende Sitzungen beenden — ein zurückgesetztes Passwort soll wirken.
  await prisma.nutzerSession.deleteMany({ where: { nutzerId } })
  revalidatePath('/einstellungen/benutzer')
}

// -------------------------------------------------------- Eigenes Konto

export async function profilSpeichern(formular: FormData) {
  const nutzer = await aktuellerNutzer()
  if (!nutzer) redirect('/anmelden')

  const name = text(formular, 'name')
  await prisma.nutzer.update({
    where: { id: nutzer.id },
    data: {
      name: name ?? undefined,
      initialen: name ? initialen(name) : undefined,
      email: text(formular, 'email')?.toLowerCase() ?? undefined,
      position: text(formular, 'position'),
      telefon: text(formular, 'telefon'),
    },
  })

  revalidatePath('/profil')
}

export async function passwortAendern(formular: FormData) {
  const nutzer = await aktuellerNutzer()
  if (!nutzer) redirect('/anmelden')

  const alt = String(formular.get('alt') ?? '')
  const neu = String(formular.get('neu') ?? '')
  const wiederholung = String(formular.get('wiederholung') ?? '')

  if (!nutzer.passwortHash || !(await pruefePasswort(alt, nutzer.passwortHash))) {
    redirect('/profil?fehler=alt')
  }
  if (neu !== wiederholung) redirect('/profil?fehler=ungleich')

  const regelbruch = pruefePasswortRegeln(neu)
  if (regelbruch) redirect(`/profil?fehler=regeln&meldung=${encodeURIComponent(regelbruch)}`)

  await prisma.nutzer.update({
    where: { id: nutzer.id },
    data: { passwortHash: await hashePasswort(neu) },
  })

  redirect('/profil?geaendert=1')
}

export async function meineBenachrichtigungen(formular: FormData) {
  const nutzer = await aktuellerNutzer()
  if (!nutzer) redirect('/anmelden')

  await prisma.nutzer.update({
    where: { id: nutzer.id },
    data: {
      mailBenachrichtigungen: formular.get('mailBenachrichtigungen') === 'on',
      pushBenachrichtigungen: formular.get('pushBenachrichtigungen') === 'on',
    },
  })

  revalidatePath('/profil')
}
