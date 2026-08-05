import 'server-only'
import { formatiereTag } from './datum'
import { prisma } from './db'
import { ladeEinstellungen } from './einstellungen'
import { env } from './env'
import { sendeMail } from './mail'
import {
  vorlageEinladung,
  vorlageFreigabe,
  vorlageNeuerKommentar,
} from './mail/vorlagen'
import { sendePush } from './push'

/**
 * Benachrichtigungen gehen als E-Mail und als Push raus — je nachdem, was
 * die Empfängerin oder der Empfänger eingeschaltet hat. Fehler werden
 * protokolliert, aber nie weitergereicht: Eine misslungene Zustellung darf
 * das Speichern eines Kommentars nicht scheitern lassen.
 */

async function stilleZustellung(aufgabe: Promise<unknown>, was: string): Promise<void> {
  try {
    await aufgabe
  } catch (fehler) {
    console.error(`[benachrichtigung] ${was}:`, (fehler as Error).message)
  }
}

/** Alle aktiven Team-Mitglieder — sie betreuen gemeinsam die Kunden. */
async function teamEmpfaenger() {
  return prisma.nutzer.findMany({ where: { aktiv: true } })
}

export async function meldeNeuenKommentar(kommentarId: string): Promise<void> {
  const kommentar = await prisma.kommentar.findUnique({
    where: { id: kommentarId },
    include: { post: { include: { kunde: true } }, export: true },
  })
  if (!kommentar) return

  const kunde = kommentar.post?.kunde
  const titel = kommentar.post?.titel ?? 'Allgemeine Anmerkung'
  const url = kommentar.post
    ? `${env.appUrl}/kunden/${kunde?.slug}/posts/${kommentar.postId}`
    : `${env.appUrl}/kunden/${kunde?.slug ?? ''}`

  // Kommentare von Gästen gehen ans Team, Kommentare vom Team an die Gäste
  // des zugehörigen Export-Links.
  if (kommentar.gastId) {
    for (const nutzer of await teamEmpfaenger()) {
      if (nutzer.mailBenachrichtigungen) {
        await stilleZustellung(
          sendeMail(
            vorlageNeuerKommentar(
              nutzer.email,
              kommentar.autorName,
              kunde?.name ?? '',
              titel,
              kommentar.text,
              url,
            ),
          ),
          `Mail an ${nutzer.email}`,
        )
      }
      if (nutzer.pushBenachrichtigungen) {
        await stilleZustellung(
          sendePush(
            { nutzerId: nutzer.id },
            {
              titel: `Neuer Kommentar — ${titel}`,
              text: `${kommentar.autorName}: ${kommentar.text.slice(0, 120)}`,
              url,
            },
          ),
          `Push an ${nutzer.email}`,
        )
      }
    }
    return
  }

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
            kunde?.name ?? '',
            titel,
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
            titel: `Neuer Kommentar — ${titel}`,
            text: `${kommentar.autorName}: ${kommentar.text.slice(0, 120)}`,
            url: gastUrl,
          },
        ),
        `Push an ${gast.email}`,
      )
    }
  }
}

export async function meldeFreigabe(freigabeId: string): Promise<void> {
  const freigabe = await prisma.freigabe.findUnique({
    where: { id: freigabeId },
    include: { export: { include: { kunde: true } } },
  })
  if (!freigabe) return

  const zeitraum = zeitraumText(freigabe.export.zeitraumVon, freigabe.export.zeitraumBis)
  const url = `${env.appUrl}/kunden/${freigabe.export.kunde.slug}/export`

  for (const nutzer of await teamEmpfaenger()) {
    if (nutzer.mailBenachrichtigungen) {
      await stilleZustellung(
        sendeMail(
          vorlageFreigabe(
            nutzer.email,
            freigabe.autorName,
            freigabe.export.kunde.name,
            zeitraum,
            url,
          ),
        ),
        `Mail an ${nutzer.email}`,
      )
    }
    if (nutzer.pushBenachrichtigungen) {
      await stilleZustellung(
        sendePush(
          { nutzerId: nutzer.id },
          {
            titel: `Freigabe: ${freigabe.export.kunde.name}`,
            text: `${freigabe.autorName} hat ${zeitraum} freigegeben.`,
            url,
          },
        ),
        `Push an ${nutzer.email}`,
      )
    }
  }
}

export async function ladeGastEin(exportId: string, gastId: string): Promise<void> {
  const [gast, exp, einstellungen] = await Promise.all([
    prisma.gast.findUnique({ where: { id: gastId } }),
    prisma.export.findUnique({ where: { id: exportId }, include: { kunde: true } }),
    ladeEinstellungen(),
  ])
  if (!gast || !exp) return

  void einstellungen
  const zeitraum = zeitraumText(exp.zeitraumVon, exp.zeitraumBis)
  await stilleZustellung(
    sendeMail(
      vorlageEinladung(gast.email, exp.kunde.name, zeitraum, `${env.appUrl}/f/${exp.token}`),
    ),
    `Einladung an ${gast.email}`,
  )
}

export function zeitraumText(von: Date, bis: Date): string {
  // Reine Datumswerte in UTC formatieren, sonst rutscht der Monat.
  const vonText = formatiereTag(von, { month: 'long', year: 'numeric' })
  const bisText = formatiereTag(bis, { month: 'long', year: 'numeric' })
  return vonText === bisText ? vonText : `${vonText} – ${bisText}`
}
