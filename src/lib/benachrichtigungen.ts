import 'server-only'
import type { BenachrichtigungArt } from '@prisma/client'
import { formatiereTag } from './datum'
import { prisma } from './db'
import { env } from './env'
import { STUFE_TEXT } from './freigabe'
import { sendeMail, type Mail } from './mail'
import { vorlageEinladung, vorlageFreigabe, vorlageNeuerKommentar } from './mail/vorlagen'
import { sendePush } from './push'
import { empfaenger } from './rollen'

/**
 * Benachrichtigungen gehen drei Wege: als Meldung in der Glocke, als E-Mail
 * und als Push. Die Glocke bekommt immer alles — wer Mail und Push
 * abgeschaltet hat, soll trotzdem sehen, was passiert ist, sobald er die
 * Oberfläche öffnet. Mail und Push richten sich nach den Schaltern am Konto.
 *
 * Wer überhaupt in Frage kommt, entscheidet src/lib/rollen.ts.
 */

async function stilleZustellung(aufgabe: Promise<unknown>, was: string): Promise<void> {
  try {
    await aufgabe
  } catch (fehler) {
    console.error(`[benachrichtigung] ${was}:`, (fehler as Error).message)
  }
}

/** Wer über ein Ereignis dieses Kunden Bescheid bekommt. */
async function empfaengerFuerKunden(kundeId: string, exportId?: string | null) {
  const [kunde, exp, team] = await Promise.all([
    prisma.kunde.findUnique({
      where: { id: kundeId },
      include: { betreuer: { select: { nutzerId: true } } },
    }),
    exportId ? prisma.export.findUnique({ where: { id: exportId } }) : null,
    prisma.nutzer.findMany({ where: { aktiv: true } }),
  ])
  if (!kunde) return []

  const ids = empfaenger(team, {
    hauptAnsprechpartnerId: kunde.hauptAnsprechpartnerId,
    zusatzAnsprechpartnerId: exp?.zusatzAnsprechpartnerId ?? null,
    betreuerIds: kunde.betreuer.map((b) => b.nutzerId),
  })

  return team.filter((nutzer) => ids.includes(nutzer.id))
}

type Meldung = {
  art: BenachrichtigungArt
  titel: string
  text: string
  url: string
  kundeId: string
  postId?: string | null
}

async function verteile(
  ziele: Array<{
    id: string
    email: string
    mailBenachrichtigungen: boolean
    pushBenachrichtigungen: boolean
  }>,
  meldung: Meldung,
  mailBauen: (an: string) => Mail,
): Promise<void> {
  if (ziele.length === 0) return

  // Die Glocke bekommt immer alles.
  await stilleZustellung(
    prisma.benachrichtigung.createMany({
      data: ziele.map((nutzer) => ({
        nutzerId: nutzer.id,
        art: meldung.art,
        titel: meldung.titel,
        text: meldung.text,
        url: meldung.url,
        kundeId: meldung.kundeId,
        postId: meldung.postId ?? null,
      })),
    }),
    'Meldungen anlegen',
  )

  for (const nutzer of ziele) {
    if (nutzer.mailBenachrichtigungen) {
      await stilleZustellung(sendeMail(mailBauen(nutzer.email)), `Mail an ${nutzer.email}`)
    }
    if (nutzer.pushBenachrichtigungen) {
      await stilleZustellung(
        sendePush(
          { nutzerId: nutzer.id },
          { titel: meldung.titel, text: meldung.text, url: meldung.url },
        ),
        `Push an ${nutzer.email}`,
      )
    }
  }
}

// ------------------------------------------------------------- Kommentare

export async function meldeNeuenKommentar(kommentarId: string): Promise<void> {
  const kommentar = await prisma.kommentar.findUnique({
    where: { id: kommentarId },
    include: { post: { include: { kunde: true } }, export: true },
  })
  if (!kommentar?.post) return

  const post = kommentar.post
  const kunde = post.kunde
  const url = `${env.appUrl}/kunden/${kunde.slug}/posts/${kommentar.postId}`

  // Kommentare vom Team gehen an die Gäste des Links, nicht ins eigene Haus.
  if (kommentar.nutzerId) {
    if (!kommentar.exportId) return

    const beteiligungen = await prisma.exportGast.findMany({
      where: { exportId: kommentar.exportId },
      include: { gast: true, export: true },
    })

    for (const { gast, export: exp } of beteiligungen) {
      const gastUrl = `${env.appUrl}/f/${exp.token}`
      if (gast.mailBenachrichtigungen) {
        await stilleZustellung(
          sendeMail(
            vorlageNeuerKommentar(
              gast.email,
              kommentar.autorName,
              kunde.name,
              post.titel,
              kommentar.text,
              gastUrl,
            ),
          ),
          `Mail an ${gast.email}`,
        )
      }
      if (gast.pushBenachrichtigungen) {
        await stilleZustellung(
          sendePush(
            { gastId: gast.id },
            {
              titel: `Neuer Kommentar — ${post.titel}`,
              text: `${kommentar.autorName}: ${kommentar.text.slice(0, 120)}`,
              url: gastUrl,
            },
          ),
          `Push an ${gast.email}`,
        )
      }
    }
    return
  }

  const ziele = await empfaengerFuerKunden(kunde.id, kommentar.exportId)
  await verteile(
    ziele,
    {
      art: 'KOMMENTAR',
      titel: `Neuer Kommentar — ${post.titel}`,
      text: `${kommentar.autorName}: ${kommentar.text.slice(0, 160)}`,
      url,
      kundeId: kunde.id,
      postId: kommentar.postId,
    },
    (an) => vorlageNeuerKommentar(an, kommentar.autorName, kunde.name, post.titel, kommentar.text, url),
  )
}

// -------------------------------------------------------------- Freigaben

export async function meldeFreigabe(freigabeId: string): Promise<void> {
  const freigabe = await prisma.freigabe.findUnique({
    where: { id: freigabeId },
    include: { post: { include: { kunde: true } } },
  })
  if (!freigabe) return

  // Trägt das Team die Freigabe selbst ein, weiß es ohnehin Bescheid.
  if (freigabe.nutzerId) return

  const stufe = STUFE_TEXT[freigabe.stufe]
  const kunde = freigabe.post.kunde
  const url = `${env.appUrl}/kunden/${kunde.slug}/posts/${freigabe.postId}`

  const ziele = await empfaengerFuerKunden(kunde.id, freigabe.exportId)
  await verteile(
    ziele,
    {
      art: 'FREIGABE',
      titel: `${stufe} freigegeben — ${kunde.name}`,
      text: `${freigabe.autorName}: ${freigabe.post.titel}`,
      url,
      kundeId: kunde.id,
      postId: freigabe.postId,
    },
    (an) => vorlageFreigabe(an, freigabe.autorName, kunde.name, `${stufe} · ${freigabe.post.titel}`, url),
  )
}

// ------------------------------------------------------------ Einladungen

export async function ladeGastEin(exportId: string, gastId: string): Promise<void> {
  const [gast, exp] = await Promise.all([
    prisma.gast.findUnique({ where: { id: gastId } }),
    prisma.export.findUnique({ where: { id: exportId }, include: { kunde: true } }),
  ])
  if (!gast || !exp) return

  const zeitraum = zeitraumText(exp.zeitraumVon, exp.zeitraumBis)
  await stilleZustellung(
    sendeMail(vorlageEinladung(gast.email, exp.kunde.name, zeitraum, `${env.appUrl}/f/${exp.token}`)),
    `Einladung an ${gast.email}`,
  )
}

export function zeitraumText(von: Date, bis: Date): string {
  // Reine Datumswerte in UTC formatieren, sonst rutscht der Monat.
  const vonText = formatiereTag(von, { month: 'long', year: 'numeric' })
  const bisText = formatiereTag(bis, { month: 'long', year: 'numeric' })
  return vonText === bisText ? vonText : `${vonText} – ${bisText}`
}

/**
 * Die Instagram-Sitzung ist abgelaufen. Geht an die Administration — sie ist
 * die einzige Rolle, die sie erneuern kann.
 */
export async function meldeInstagramAbgelaufen(grund: string): Promise<void> {
  const admins = await prisma.nutzer.findMany({
    where: { rolle: 'ADMIN', aktiv: true },
    select: { id: true, email: true, mailBenachrichtigungen: true, pushBenachrichtigungen: true },
  })

  const titel = 'Instagram-Sitzung erneuern'
  const text = `${grund} Bis dahin lassen sich keine Videos von Instagram laden.`
  const url = `${env.appUrl}/einstellungen`

  if (admins.length === 0) return

  await stilleZustellung(
    prisma.benachrichtigung.createMany({
      data: admins.map((nutzer) => ({ nutzerId: nutzer.id, art: 'WARTUNG' as const, titel, text, url })),
    }),
    'Wartungsmeldung anlegen',
  )

  for (const nutzer of admins) {
    if (nutzer.mailBenachrichtigungen) {
      await stilleZustellung(
        sendeMail({
          an: nutzer.email,
          betreff: `Preroll: ${titel}`,
          text: `${text}\n\n${url}`,
        }),
        `Mail an ${nutzer.email}`,
      )
    }
    if (nutzer.pushBenachrichtigungen) {
      await stilleZustellung(
        sendePush({ nutzerId: nutzer.id }, { titel, text, url }),
        `Push an ${nutzer.email}`,
      )
    }
  }
}
