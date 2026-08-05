'use server'

import type { PostStatus, PostTyp } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { aktuellerNutzer, erzeugeExportToken } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { ladeGastEin, meldeNeuenKommentar } from '@/lib/benachrichtigungen'
import { slugify } from '@/lib/slug'

async function nutzerOderRaus() {
  const nutzer = await aktuellerNutzer()
  if (!nutzer) redirect('/anmelden')
  return nutzer
}

function text(formular: FormData, feld: string): string | null {
  const wert = String(formular.get(feld) ?? '').trim()
  return wert === '' ? null : wert
}

// ------------------------------------------------------------------- Kunden

export async function kundeAnlegen(formular: FormData) {
  await nutzerOderRaus()

  const name = text(formular, 'name')
  if (!name) redirect('/kunden/neu?fehler=name')

  let slug = slugify(name)
  // Bei Namensgleichheit hinten durchnummerieren.
  for (let n = 2; await prisma.kunde.findUnique({ where: { slug } }); n++) {
    slug = `${slugify(name)}-${n}`
  }

  const kunde = await prisma.kunde.create({
    data: {
      name,
      slug,
      handle: text(formular, 'handle')?.replace(/^@/, '') ?? null,
      bio: text(formular, 'bio'),
      website: text(formular, 'website'),
    },
  })

  revalidatePath('/kunden')
  redirect(`/kunden/${kunde.slug}`)
}

export async function kundeSpeichern(kundeId: string, formular: FormData) {
  await nutzerOderRaus()

  const zahl = (feld: string) => {
    const wert = text(formular, feld)
    if (wert === null) return null
    const n = Number(wert.replace(/[^\d]/g, ''))
    return Number.isFinite(n) ? n : null
  }

  const kunde = await prisma.kunde.update({
    where: { id: kundeId },
    data: {
      name: text(formular, 'name') ?? undefined,
      handle: text(formular, 'handle')?.replace(/^@/, '') ?? null,
      bio: text(formular, 'bio'),
      website: text(formular, 'website'),
      notiz: text(formular, 'notiz'),
      follower: zahl('follower'),
      gefolgt: zahl('gefolgt'),
      beitraege: zahl('beitraege'),
      kennzahlenAm: new Date(),
      kennzahlenTyp: 'MANUELL',
    },
  })

  revalidatePath(`/kunden/${kunde.slug}`, 'layout')
}

// -------------------------------------------------------------------- Posts

export async function postAnlegen(kundeId: string, formular: FormData) {
  const nutzer = await nutzerOderRaus()

  const kunde = await prisma.kunde.findUniqueOrThrow({ where: { id: kundeId } })
  const typ = (text(formular, 'typ') ?? 'BEITRAG') as PostTyp
  const datum = text(formular, 'postenAm') ?? new Date().toISOString().slice(0, 10)
  const uhrzeit = text(formular, 'uhrzeit') ?? '10:00'

  const post = await prisma.post.create({
    data: {
      kundeId,
      typ,
      postenAm: new Date(`${datum}T${uhrzeit}`),
      titel: text(formular, 'titel') ?? 'Ohne Titel',
      verantwortlichId: nutzer.id,
      // Beim Reel ist der Szenenplan der Normalfall, sonst nicht.
      szenenplanAktiv: typ === 'REEL',
    },
  })

  revalidatePath(`/kunden/${kunde.slug}`, 'layout')
  redirect(`/kunden/${kunde.slug}/posts/${post.id}`)
}

export async function postSpeichern(postId: string, formular: FormData) {
  await nutzerOderRaus()

  const datum = text(formular, 'postenAm')
  const uhrzeit = text(formular, 'uhrzeit') ?? '10:00'

  const post = await prisma.post.update({
    where: { id: postId },
    data: {
      titel: text(formular, 'titel') ?? 'Ohne Titel',
      kurzbeschreibung: text(formular, 'kurzbeschreibung'),
      caption: String(formular.get('caption') ?? ''),
      laenge: text(formular, 'laenge'),
      ziel: text(formular, 'ziel'),
      stil: text(formular, 'stil'),
      inhalte: text(formular, 'inhalte'),
      referenzVideoUrl: text(formular, 'referenzVideoUrl'),
      referenzVideoTitel: text(formular, 'referenzVideoTitel'),
      szenenplanAktiv: formular.get('szenenplanAktiv') === 'on',
      ...(datum ? { postenAm: new Date(`${datum}T${uhrzeit}`) } : {}),
    },
    include: { kunde: true },
  })

  // Eigene Felder mitschreiben.
  const definitionen = await prisma.customFeldDefinition.findMany({
    where: { kundeId: post.kundeId },
  })
  for (const definition of definitionen) {
    const wert = formular.get(`custom_${definition.id}`)
    const inhalt =
      definition.typ === 'JANEIN' ? (wert === 'on' ? 'ja' : null) : (String(wert ?? '').trim() || null)

    await prisma.customFeldWert.upsert({
      where: { postId_definitionId: { postId, definitionId: definition.id } },
      update: { wert: inhalt },
      create: { postId, definitionId: definition.id, wert: inhalt },
    })
  }

  revalidatePath(`/kunden/${post.kunde.slug}`, 'layout')
}

export async function postStatusSetzen(postId: string, status: PostStatus) {
  await nutzerOderRaus()
  const post = await prisma.post.update({
    where: { id: postId },
    data: { status },
    include: { kunde: true },
  })
  revalidatePath(`/kunden/${post.kunde.slug}`, 'layout')
}

export async function postLoeschen(postId: string) {
  await nutzerOderRaus()
  const post = await prisma.post.delete({ where: { id: postId }, include: { kunde: true } })
  revalidatePath(`/kunden/${post.kunde.slug}`, 'layout')
  redirect(`/kunden/${post.kunde.slug}`)
}

// ------------------------------------------------------------------- Szenen

export async function szeneAnlegen(postId: string) {
  await nutzerOderRaus()
  const letzte = await prisma.szene.findFirst({
    where: { postId },
    orderBy: { position: 'desc' },
  })
  await prisma.szene.create({
    data: { postId, position: (letzte?.position ?? -1) + 1, abschnitt: 'Szene' },
  })
  revalidatePath('/kunden', 'layout')
}

export async function szeneSpeichern(szeneId: string, formular: FormData) {
  await nutzerOderRaus()
  await prisma.szene.update({
    where: { id: szeneId },
    data: {
      abschnitt: text(formular, 'abschnitt') ?? 'Szene',
      bildSzene: text(formular, 'bildSzene'),
      sprechertext: text(formular, 'sprechertext'),
      texteinblendung: text(formular, 'texteinblendung'),
    },
  })
  revalidatePath('/kunden', 'layout')
}

export async function szeneLoeschen(szeneId: string) {
  await nutzerOderRaus()
  await prisma.szene.delete({ where: { id: szeneId } })
  revalidatePath('/kunden', 'layout')
}

// ---------------------------------------------------------- Eigene Felder

export async function customFeldAnlegen(kundeId: string, formular: FormData) {
  await nutzerOderRaus()
  const name = text(formular, 'name')
  if (!name) return

  const letztes = await prisma.customFeldDefinition.findFirst({
    where: { kundeId },
    orderBy: { position: 'desc' },
  })

  await prisma.customFeldDefinition.create({
    data: {
      kundeId,
      name,
      typ: (text(formular, 'typ') ?? 'TEXT') as 'TEXT' | 'DATUM' | 'JANEIN',
      position: (letztes?.position ?? -1) + 1,
    },
  })
  revalidatePath('/kunden', 'layout')
}

export async function customFeldLoeschen(definitionId: string) {
  await nutzerOderRaus()
  await prisma.customFeldDefinition.delete({ where: { id: definitionId } })
  revalidatePath('/kunden', 'layout')
}

// --------------------------------------------------------- Ansprechpartner

export async function ansprechpartnerSpeichern(kundeId: string, formular: FormData) {
  await nutzerOderRaus()

  const id = text(formular, 'id')
  const daten = {
    name: text(formular, 'name') ?? 'Ohne Namen',
    rolle: text(formular, 'rolle'),
    telefon: text(formular, 'telefon'),
    email: text(formular, 'email'),
    adresse: text(formular, 'adresse'),
    website: text(formular, 'website'),
    standard: formular.get('standard') === 'on',
  }

  // Es gibt genau einen Standard-Ansprechpartner je Kunde.
  if (daten.standard) {
    await prisma.ansprechpartner.updateMany({ where: { kundeId }, data: { standard: false } })
  }

  if (id) {
    await prisma.ansprechpartner.update({ where: { id }, data: daten })
  } else {
    await prisma.ansprechpartner.create({ data: { kundeId, ...daten } })
  }

  revalidatePath('/kunden', 'layout')
}

export async function ansprechpartnerLoeschen(id: string) {
  await nutzerOderRaus()
  await prisma.ansprechpartner.delete({ where: { id } })
  revalidatePath('/kunden', 'layout')
}

// ------------------------------------------------------------------ Export

export async function exportAnlegen(kundeId: string, formular: FormData) {
  await nutzerOderRaus()

  const kunde = await prisma.kunde.findUniqueOrThrow({ where: { id: kundeId } })
  const von = text(formular, 'zeitraumVon')
  const bis = text(formular, 'zeitraumBis')
  if (!von || !bis) return

  await prisma.export.create({
    data: {
      kundeId,
      token: erzeugeExportToken(),
      titel: text(formular, 'titel'),
      zeitraumVon: new Date(von),
      zeitraumBis: new Date(bis),
      gueltigBis: text(formular, 'gueltigBis') ? new Date(text(formular, 'gueltigBis')!) : null,
      ansprechpartnerId: text(formular, 'ansprechpartnerId'),
      kommentareErlaubt: formular.get('kommentareErlaubt') === 'on',
      freigabeButtonZeigen: formular.get('freigabeButtonZeigen') === 'on',
      konzepteMitzeigen: formular.get('konzepteMitzeigen') === 'on',
      loginPflicht: formular.get('loginPflicht') === 'on',
    },
  })

  revalidatePath(`/kunden/${kunde.slug}/export`)
}

export async function exportSpeichern(exportId: string, formular: FormData) {
  await nutzerOderRaus()

  const von = text(formular, 'zeitraumVon')
  const bis = text(formular, 'zeitraumBis')

  const exp = await prisma.export.update({
    where: { id: exportId },
    data: {
      titel: text(formular, 'titel'),
      ...(von ? { zeitraumVon: new Date(von) } : {}),
      ...(bis ? { zeitraumBis: new Date(bis) } : {}),
      gueltigBis: text(formular, 'gueltigBis') ? new Date(text(formular, 'gueltigBis')!) : null,
      ansprechpartnerId: text(formular, 'ansprechpartnerId'),
      kommentareErlaubt: formular.get('kommentareErlaubt') === 'on',
      freigabeButtonZeigen: formular.get('freigabeButtonZeigen') === 'on',
      konzepteMitzeigen: formular.get('konzepteMitzeigen') === 'on',
      loginPflicht: formular.get('loginPflicht') === 'on',
    },
    include: { kunde: true },
  })

  revalidatePath(`/kunden/${exp.kunde.slug}/export`)
}

export async function exportLoeschen(exportId: string) {
  await nutzerOderRaus()
  const exp = await prisma.export.delete({ where: { id: exportId }, include: { kunde: true } })
  revalidatePath(`/kunden/${exp.kunde.slug}/export`)
}

/** Lädt einen Kunden-Kontakt zu einem Freigabe-Link ein und schickt die Mail. */
export async function gastEinladen(exportId: string, formular: FormData) {
  await nutzerOderRaus()

  const email = text(formular, 'email')?.toLowerCase()
  const name = text(formular, 'name')
  if (!email) return

  const gast = await prisma.gast.upsert({
    where: { email },
    update: name ? { name } : {},
    create: { email, name: name ?? email },
  })

  const nutzer = await aktuellerNutzer()
  await prisma.exportGast.upsert({
    where: { exportId_gastId: { exportId, gastId: gast.id } },
    update: {},
    create: { exportId, gastId: gast.id, eingeladenVonId: nutzer?.id ?? null },
  })

  await ladeGastEin(exportId, gast.id)

  const exp = await prisma.export.findUniqueOrThrow({
    where: { id: exportId },
    include: { kunde: true },
  })
  revalidatePath(`/kunden/${exp.kunde.slug}/export`)
}

export async function einladungZuruecknehmen(exportId: string, gastId: string) {
  await nutzerOderRaus()
  await prisma.exportGast.deleteMany({ where: { exportId, gastId } })
  revalidatePath('/kunden', 'layout')
}

// -------------------------------------------------------------- Kommentare

export async function kommentarVomTeam(postId: string, exportId: string | null, formular: FormData) {
  const nutzer = await nutzerOderRaus()

  const inhalt = String(formular.get('text') ?? '').trim()
  if (!inhalt) return

  const kommentar = await prisma.kommentar.create({
    data: {
      postId,
      exportId,
      abschnitt: text(formular, 'abschnitt') ?? 'allgemein',
      autorName: nutzer.name,
      autorEmail: nutzer.email,
      nutzerId: nutzer.id,
      text: inhalt,
    },
  })

  await meldeNeuenKommentar(kommentar.id)
  revalidatePath('/kunden', 'layout')
}

export async function kommentarStatusSetzen(kommentarId: string, status: 'OFFEN' | 'ERLEDIGT') {
  await nutzerOderRaus()
  await prisma.kommentar.update({ where: { id: kommentarId }, data: { status } })
  revalidatePath('/kunden', 'layout')
  revalidatePath('/kommentare')
}

export async function kommentarLoeschen(kommentarId: string) {
  await nutzerOderRaus()
  await prisma.kommentar.delete({ where: { id: kommentarId } })
  revalidatePath('/kunden', 'layout')
  revalidatePath('/kommentare')
}
