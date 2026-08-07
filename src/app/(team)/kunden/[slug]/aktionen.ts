'use server'

import type { PostStatus, PostTyp } from '@prisma/client'
import type { Verhaeltnis } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { aktuellerNutzer, erzeugeExportToken } from '@/lib/auth'
import { monatsgrenzen } from '@/lib/datum'
import { prisma } from '@/lib/db'
import { ladeGastEin, meldeFreigabe, meldeNeuenKommentar } from '@/lib/benachrichtigungen'
import { aktualisiereKennzahlen } from '@/lib/kennzahlen-auftrag'
import { istErlaubt, standardVerhaeltnis } from '@/lib/verhaeltnis'
import { darfBearbeiten, darfLoeschen } from '@/lib/kommentar-rechte'
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
      freigabenNoetig: formular.get('freigabenNoetig') === 'on',
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
      // Das Format kommt aus dem Dialog; ohne Angabe der Standard des Typs.
      verhaeltnis: istErlaubt(typ, formular.get('verhaeltnis') as Verhaeltnis)
        ? (formular.get('verhaeltnis') as Verhaeltnis)
        : standardVerhaeltnis(typ),
      // Neu Angelegtes ist ein Entwurf: in Arbeit, nur intern. Erst wer ihn
      // aufs Konzept setzt, zeigt ihn dem Kunden. Vorher gab es dafür einen
      // Schalter am Freigabe-Link — der saß an der falschen Stelle, denn ob
      // ein Beitrag vorzeigbar ist, hängt am Beitrag, nicht am Monat.
      status: 'ENTWURF',
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

  // Der Typ entscheidet, welche Formate erlaubt sind — er steht nicht im
  // Formular und lässt sich von dort auch nicht ändern.
  const { typ } = await prisma.post.findUniqueOrThrow({
    where: { id: postId },
    select: { typ: true },
  })
  const gewaehlt = formular.get('verhaeltnis') as Verhaeltnis | null

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
      // Nur ein für diesen Typ vorgesehenes Format — ein veralteter Tab oder
      // ein von Hand gebogenes Formular soll kein 16:9-Karussell anlegen.
      ...(gewaehlt && istErlaubt(typ, gewaehlt) ? { verhaeltnis: gewaehlt } : {}),
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

/**
 * Reihenfolge nach dem Ziehen — die Positionen ergeben sich aus der Liste.
 *
 * In zwei Durchgängen: `position` ist je Post eindeutig, und beim direkten
 * Umnummerieren kollidiert unterwegs fast immer eine Zeile mit einer anderen.
 * Der Umweg über negative Werte hält alle Zwischenstände frei.
 */
export async function szenenSortieren(postId: string, ids: string[]) {
  await nutzerOderRaus()
  await prisma.$transaction([
    ...ids.map((id, i) =>
      prisma.szene.update({ where: { id, postId }, data: { position: -(i + 1) } }),
    ),
    ...ids.map((id, i) => prisma.szene.update({ where: { id, postId }, data: { position: i } })),
  ])
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

// ---------------------------------------------------------------- Freigaben

/**
 * Eine Freigabe umfasst immer einen ganzen Monat — gewählt wird deshalb nur
 * der Monat, nicht Von und Bis. Je Kunde und Monat gibt es genau eine; ein
 * zweiter Anlauf aktualisiert die vorhandene, statt einen zweiten Link
 * anzulegen, von dem der Kunde nie erfahren würde.
 */
export async function exportAnlegen(kundeId: string, formular: FormData) {
  await nutzerOderRaus()

  const kunde = await prisma.kunde.findUniqueOrThrow({ where: { id: kundeId } })
  const grenzen = monatsgrenzen(String(formular.get('monat') ?? ''))
  if (!grenzen) return

  await prisma.export.upsert({
    where: { kundeId_zeitraumVon: { kundeId, zeitraumVon: grenzen.von } },
    create: {
      kundeId,
      token: erzeugeExportToken(),
      titel: text(formular, 'titel'),
      zeitraumVon: grenzen.von,
      zeitraumBis: grenzen.bis,
      zusatzAnsprechpartnerId: text(formular, 'zusatzAnsprechpartnerId'),
    },
    update: {
      titel: text(formular, 'titel'),
      zusatzAnsprechpartnerId: text(formular, 'zusatzAnsprechpartnerId'),
    },
  })

  revalidatePath(`/kunden/${kunde.slug}/freigaben`)
}

export async function exportSpeichern(exportId: string, formular: FormData) {
  await nutzerOderRaus()

  const grenzen = monatsgrenzen(String(formular.get('monat') ?? ''))

  const exp = await prisma.export.update({
    where: { id: exportId },
    data: {
      titel: text(formular, 'titel'),
      ...(grenzen ? { zeitraumVon: grenzen.von, zeitraumBis: grenzen.bis } : {}),
      zusatzAnsprechpartnerId: text(formular, 'zusatzAnsprechpartnerId'),
    },
    include: { kunde: true },
  })

  revalidatePath(`/kunden/${exp.kunde.slug}/freigaben`)
}

export async function exportLoeschen(exportId: string) {
  await nutzerOderRaus()
  const exp = await prisma.export.delete({ where: { id: exportId }, include: { kunde: true } })
  revalidatePath(`/kunden/${exp.kunde.slug}/freigaben`)
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
  revalidatePath(`/kunden/${exp.kunde.slug}/freigaben`)
}

export async function einladungZuruecknehmen(exportId: string, gastId: string) {
  await nutzerOderRaus()
  await prisma.exportGast.deleteMany({ where: { exportId, gastId } })
  revalidatePath('/kunden', 'layout')
}

// -------------------------------------------------------------- Kennzahlen

/**
 * Kennzahlen dieses Kunden sofort holen, ohne auf den nächsten Lauf zu
 * warten. Das Ergebnis steht danach über der Adresse — ein Knopf, der
 * kommentarlos nichts tut, wäre schlimmer als keiner.
 */
export async function kennzahlenHolen(kundeId: string, slug: string) {
  await nutzerOderRaus()

  const ergebnis = await aktualisiereKennzahlen(kundeId)
  revalidatePath(`/kunden/${slug}`, 'layout')

  redirect(
    ergebnis.ok
      ? `/kunden/${slug}/stammdaten?kennzahlen=ok`
      : `/kunden/${slug}/stammdaten?kennzahlen=fehler&meldung=${encodeURIComponent(ergebnis.fehler)}`,
  )
}

// -------------------------------------------------------------- Kommentare

export async function kommentarVomTeam(postId: string, exportId: string | null, formular: FormData) {
  const nutzer = await nutzerOderRaus()

  const inhalt = String(formular.get('text') ?? '').trim()
  if (!inhalt) return

  // Eine Antwort hängt am Kommentar, auf den sie sich bezieht — sonst steht
  // sie als eigenständige Rückmeldung daneben und niemand sieht den Bezug.
  const antwortAufId = text(formular, 'antwortAufId')

  const kommentar = await prisma.kommentar.create({
    data: {
      postId,
      exportId,
      abschnitt: text(formular, 'abschnitt') ?? 'allgemein',
      autorName: nutzer.name,
      autorEmail: nutzer.email,
      nutzerId: nutzer.id,
      text: inhalt,
      antwortAufId,
    },
  })

  await meldeNeuenKommentar(kommentar.id)
  revalidatePath('/kunden', 'layout')
  revalidatePath('/kommentare')
}

export async function kommentarStatusSetzen(kommentarId: string, status: 'OFFEN' | 'ERLEDIGT') {
  await nutzerOderRaus()

  // Der Stand gilt für den ganzen Strang: Eine erledigte Rückmeldung, deren
  // Antworten weiter als offen gezählt werden, bliebe ewig in der Liste.
  await prisma.kommentar.updateMany({
    where: { OR: [{ id: kommentarId }, { antwortAufId: kommentarId }] },
    data: { status },
  })

  revalidatePath('/kunden', 'layout')
  revalidatePath('/kommentare')
}

/**
 * Ändern und Löschen kann jede Person nur bei sich selbst — und die
 * Administration überall. Geprüft wird hier am Server: Die Knöpfe in der
 * Oberfläche sind eine Bequemlichkeit, keine Sperre.
 */
export async function kommentarBearbeiten(kommentarId: string, formular: FormData) {
  const nutzer = await nutzerOderRaus()

  const inhalt = String(formular.get('text') ?? '').trim()
  if (!inhalt) return

  const kommentar = await prisma.kommentar.findUniqueOrThrow({
    where: { id: kommentarId },
    select: { nutzerId: true, gastId: true },
  })
  if (!darfBearbeiten(kommentar, { art: 'nutzer', id: nutzer.id, rolle: nutzer.rolle })) return

  await prisma.kommentar.update({
    where: { id: kommentarId },
    data: { text: inhalt, bearbeitetAm: new Date() },
  })

  revalidatePath('/kunden', 'layout')
  revalidatePath('/kommentare')
}

export async function kommentarLoeschen(kommentarId: string) {
  const nutzer = await nutzerOderRaus()

  const kommentar = await prisma.kommentar.findUniqueOrThrow({
    where: { id: kommentarId },
    select: { nutzerId: true, gastId: true },
  })
  if (!darfLoeschen(kommentar, { art: 'nutzer', id: nutzer.id, rolle: nutzer.rolle })) return

  // Antworten hängen per `onDelete: Cascade` am Kommentar und gehen mit.
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

/**
 * Überträgt den Ablauf eines Reels auf ein anderes. Wer ihn übernimmt,
 * verliert seinen eigenen — deshalb fragt die Oberfläche vorher, wenn dort
 * schon etwas steht, und stellt beide nebeneinander. Hier wird nur noch
 * ausgeführt, was dort entschieden wurde.
 */
export async function szenenplanUebertragen(vonPostId: string, nachPostId: string) {
  await nutzerOderRaus()

  const [quelle, ziel] = await Promise.all([
    prisma.post.findUniqueOrThrow({
      where: { id: vonPostId },
      include: { szenen: { orderBy: { position: 'asc' } } },
    }),
    prisma.post.findUniqueOrThrow({
      where: { id: nachPostId },
      include: { kunde: { select: { slug: true } } },
    }),
  ])

  // Nur innerhalb desselben Kunden — ein Ablauf gehört zu seinem Kontext.
  if (quelle.kundeId !== ziel.kundeId) return

  await prisma.$transaction([
    prisma.szene.deleteMany({ where: { postId: nachPostId } }),
    ...quelle.szenen.map((szene, position) =>
      prisma.szene.create({
        data: {
          postId: nachPostId,
          position,
          abschnitt: szene.abschnitt,
          bildSzene: szene.bildSzene,
          sprechertext: szene.sprechertext,
          texteinblendung: szene.texteinblendung,
        },
      }),
    ),
    prisma.post.update({ where: { id: nachPostId }, data: { szenenplanAktiv: true } }),
  ])

  revalidatePath(`/kunden/${ziel.kunde.slug}`, 'layout')
}

/**
 * Entfernt einen Slide aus dem Karussell. Das Medium selbst bleibt in der
 * Bibliothek — nur die Zuordnung fällt weg. Deshalb lässt sich das
 * rückgängig machen, ohne die Datei erneut hochzuladen.
 */
export async function slideEntfernen(postId: string, mediumId: string) {
  await nutzerOderRaus()

  const post = await prisma.post.findUniqueOrThrow({
    where: { id: postId },
    include: { kunde: { select: { slug: true } } },
  })

  await prisma.postMedium.deleteMany({ where: { postId, mediumId, rolle: 'SLIDE' } })

  // Lücken schließen, damit die Positionen lückenlos bleiben.
  const rest = await prisma.postMedium.findMany({
    where: { postId, rolle: 'SLIDE' },
    orderBy: { position: 'asc' },
  })
  await prisma.$transaction(
    rest.map((eintrag, position) =>
      prisma.postMedium.update({ where: { id: eintrag.id }, data: { position } }),
    ),
  )

  revalidatePath(`/kunden/${post.kunde.slug}`, 'layout')
}

/** Zurücknehmen des Entfernens — der Slide kommt an seine alte Stelle. */
export async function slideWiederherstellen(
  postId: string,
  mediumId: string,
  position: number,
) {
  await nutzerOderRaus()

  const post = await prisma.post.findUniqueOrThrow({
    where: { id: postId },
    include: { kunde: { select: { slug: true } } },
  })

  const rest = await prisma.postMedium.findMany({
    where: { postId, rolle: 'SLIDE' },
    orderBy: { position: 'asc' },
  })

  // Platz schaffen: alles ab der Zielstelle rückt eins weiter. Über negative
  // Zwischenwerte, weil (postId, rolle, position) eindeutig ist.
  const nachher = rest.slice(position)
  await prisma.$transaction([
    ...nachher.map((e, i) =>
      prisma.postMedium.update({ where: { id: e.id }, data: { position: -(i + 1) } }),
    ),
    ...nachher.map((e, i) =>
      prisma.postMedium.update({ where: { id: e.id }, data: { position: position + i + 1 } }),
    ),
    prisma.postMedium.create({
      data: { postId, mediumId, rolle: 'SLIDE', position },
    }),
  ])

  revalidatePath(`/kunden/${post.kunde.slug}`, 'layout')
}
