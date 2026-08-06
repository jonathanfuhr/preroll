'use server'

import type { PostStatus, PostTyp } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { aktuellerNutzer, erzeugeExportToken } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { ladeGastEin, meldeFreigabe, meldeNeuenKommentar } from '@/lib/benachrichtigungen'
import { offeneStufe } from '@/lib/freigabe'
import { klappeVideoAnlegen, klappeVideoBeschreibung, klappeVideoName } from '@/lib/klappe'
import { slugify } from '@/lib/slug'
import { klappeVideoNachziehen } from './klappe-aktionen'

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

  // Der Anlegen-Dialog fragt bewusst keinen Termin ab. Bis einer gesetzt ist,
  // steht der Post im Kalender in der Spalte „Ungeplant" — ein erfundenes
  // Datum wäre schlechter als gar keines.
  const post = await prisma.post.create({
    data: {
      kundeId,
      typ,
      titel: text(formular, 'titel') ?? 'Ohne Titel',
      verantwortlichId: nutzer.id,
      // Beim Reel ist der Szenenplan der Normalfall, sonst nicht.
      szenenplanAktiv: typ === 'REEL',
    },
  })

  // Zweite Richtung der Klappe-Anbindung: Wird ein Reel konzipiert, entsteht
  // in Klappe gleich das Video dazu. Beim Upload aus dem Schnitt muss dann
  // kein Name mehr getippt werden — das Video wartet dort schon.
  if (typ === 'REEL' && kunde.klappeProjektId) {
    const ergebnis = await klappeVideoAnlegen(
      kunde.klappeProjektId,
      klappeVideoName(post.postenAm, post.titel),
      klappeVideoBeschreibung(post.postenAm, kunde.name),
    )
    if (ergebnis.ok) {
      await prisma.post.update({
        where: { id: post.id },
        data: {
          klappeVideoId: ergebnis.daten.id,
          klappeVideoName: ergebnis.daten.name,
          klappeVideoUrl: ergebnis.daten.webUrl ?? `/videos/${ergebnis.daten.id}`,
          klappeStandAm: new Date(),
        },
      })
    } else {
      // Kein Grund, das Anlegen des Posts scheitern zu lassen — im Editor
      // steht ein Knopf zum Nachholen.
      console.warn('[klappe] Video konnte nicht angelegt werden:', ergebnis.fehler)
    }
  }

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
      szenenplanAktiv: formular.get('szenenplanAktiv') === 'on',
      // Das Referenzvideo hängt am Medien-Dialog; steht sein Feld nicht im
      // Formular, darf das Speichern den Link nicht stillschweigend löschen.
      ...(formular.has('referenzVideoUrl')
        ? {
            referenzVideoUrl: text(formular, 'referenzVideoUrl'),
            referenzVideoTitel: text(formular, 'referenzVideoTitel'),
          }
        : {}),
      // Leeres Datumsfeld heißt: der Post wird wieder ungeplant.
      postenAm: datum ? new Date(`${datum}T${uhrzeit}`) : null,
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

  // Titel oder Termin geändert? Dann heißt das Video in Klappe nach.
  await klappeVideoNachziehen(postId)

  revalidatePath(`/kunden/${post.kunde.slug}`, 'layout')
}

/**
 * Termin per Drag & Drop im Kalender. Ein bereits terminierter Post behält
 * seine Uhrzeit — wer ihn nur um zwei Tage schiebt, will nicht auch die Zeit
 * neu setzen. Ein ungeplanter bekommt die Standard-Uhrzeit des Kunden.
 *
 * `tag` im Format JJJJ-MM-TT; `null` legt den Post zurück zu den ungeplanten.
 */
export async function postTerminieren(postId: string, tag: string | null) {
  await nutzerOderRaus()

  const post = await prisma.post.findUniqueOrThrow({
    where: { id: postId },
    include: { kunde: { select: { slug: true, standardUhrzeit: true } } },
  })

  if (tag === null) {
    await prisma.post.update({ where: { id: postId }, data: { postenAm: null } })
    revalidatePath(`/kunden/${post.kunde.slug}`, 'layout')
    return
  }

  const uhrzeit = post.postenAm
    ? `${String(post.postenAm.getHours()).padStart(2, '0')}:${String(post.postenAm.getMinutes()).padStart(2, '0')}`
    : post.kunde.standardUhrzeit

  await prisma.post.update({
    where: { id: postId },
    data: { postenAm: new Date(`${tag}T${uhrzeit}`) },
  })

  // In Klappe trägt das Video das Datum im Namen — der zieht mit.
  await klappeVideoNachziehen(postId).catch(() => {})

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

// -------------------------------------------------- Betreuung des Kunden

/**
 * Hauptansprechpartner und betreuende Konten. Ansprechpartner sind seit dem
 * Rollenumbau Nutzerkonten — eine eigene Kontaktliste gibt es nicht mehr.
 */
export async function betreuungSpeichern(kundeId: string, formular: FormData) {
  await nutzerOderRaus()

  const haupt = text(formular, 'hauptAnsprechpartnerId')
  const betreuerIds = formular.getAll('betreuer').map(String).filter(Boolean)

  const kunde = await prisma.kunde.update({
    where: { id: kundeId },
    data: { hauptAnsprechpartnerId: haupt },
  })

  // Zuweisungen komplett neu setzen — die Auswahl ist die Wahrheit.
  await prisma.kundeBetreuer.deleteMany({ where: { kundeId } })
  if (betreuerIds.length > 0) {
    await prisma.kundeBetreuer.createMany({
      data: betreuerIds.map((nutzerId) => ({ kundeId, nutzerId })),
    })
  }

  revalidatePath(`/kunden/${kunde.slug}`, 'layout')
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
      zusatzAnsprechpartnerId: text(formular, 'zusatzAnsprechpartnerId'),
      kommentareErlaubt: formular.get('kommentareErlaubt') === 'on',
      freigabenErlaubt: formular.get('freigabenErlaubt') === 'on',
      konzepteMitzeigen: formular.get('konzepteMitzeigen') === 'on',
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
      zusatzAnsprechpartnerId: text(formular, 'zusatzAnsprechpartnerId'),
      kommentareErlaubt: formular.get('kommentareErlaubt') === 'on',
      freigabenErlaubt: formular.get('freigabenErlaubt') === 'on',
      konzepteMitzeigen: formular.get('konzepteMitzeigen') === 'on',
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

// -------------------------------------------------------- Karussell-Slides

/**
 * Neue Reihenfolge der Karussell-Slides. Kommt vom Ziehen im Editor und wird
 * sofort gespeichert.
 *
 * Die Positionen laufen in zwei Schritten: erst weit weg, dann an ihren Platz.
 * Sonst kollidiert eine Zwischenstellung mit dem eindeutigen Index über
 * (postId, rolle, position).
 */
export async function slidesSortieren(postId: string, mediumIds: string[]) {
  await nutzerOderRaus()

  const post = await prisma.post.findUniqueOrThrow({
    where: { id: postId },
    include: { kunde: true },
  })

  const vorhandene = await prisma.postMedium.findMany({
    where: { postId, rolle: 'SLIDE' },
  })
  const bekannt = new Map(vorhandene.map((m) => [m.mediumId, m.id]))

  // Nur Slides berücksichtigen, die es auch wirklich gibt.
  const reihenfolge = mediumIds.filter((id) => bekannt.has(id))
  if (reihenfolge.length !== vorhandene.length) return

  await prisma.$transaction([
    ...vorhandene.map((eintrag, index) =>
      prisma.postMedium.update({
        where: { id: eintrag.id },
        data: { position: -1000 - index },
      }),
    ),
    ...reihenfolge.map((mediumId, index) =>
      prisma.postMedium.update({
        where: { id: bekannt.get(mediumId)! },
        data: { position: index },
      }),
    ),
  ])

  revalidatePath(`/kunden/${post.kunde.slug}`, 'layout')
}

// ---------------------------------------------------------------- Freigaben

/**
 * Trägt eine Freigabe stellvertretend ein — für den Fall, dass der Kunde auf
 * anderem Weg zugestimmt hat, am Telefon oder per Mail. Der Name des Kunden
 * steht als Autor, wer es eingetragen hat, hängt als Nutzer daran.
 */
export async function freigabeEintragen(postId: string, formular: FormData) {
  const nutzer = await nutzerOderRaus()

  const post = await prisma.post.findUniqueOrThrow({
    where: { id: postId },
    include: { kunde: true },
  })

  const stufe = offeneStufe(post.status)
  if (!stufe) return

  const autorName = text(formular, 'autorName')
  if (!autorName) {
    redirect(`/kunden/${post.kunde.slug}/posts/${postId}?freigabe=name`)
  }

  const freigabe = await prisma.freigabe.upsert({
    where: { postId_stufe: { postId, stufe } },
    update: {},
    create: {
      postId,
      stufe,
      nutzerId: nutzer.id,
      autorName,
      notiz: text(formular, 'notiz'),
    },
  })

  await meldeFreigabe(freigabe.id)
  revalidatePath(`/kunden/${post.kunde.slug}`, 'layout')
}

export async function freigabeZuruecknehmen(freigabeId: string) {
  await nutzerOderRaus()
  const freigabe = await prisma.freigabe.delete({
    where: { id: freigabeId },
    include: { post: { include: { kunde: true } } },
  })
  revalidatePath(`/kunden/${freigabe.post.kunde.slug}`, 'layout')
}
