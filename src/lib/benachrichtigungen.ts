import 'server-only'
import type { BenachrichtigungArt } from '@prisma/client'
import { formatiereTag } from './datum'
import { prisma } from './db'
import { alsKlartext, erwaehnungenAus } from './kommentar-text'
import { env } from './env'
import { STUFE_TEXT } from './freigabe'
import { sendeMail, type Mail } from './mail'
import {
  vorlageEinladung,
  vorlageErwaehnung,
  vorlageFreigabe,
  vorlageNeuerKommentar,
  vorlageVeroeffentlichungFehlgeschlagen,
  vorlageZugangAbgelehnt,
} from './mail/vorlagen'
import { PLATTFORM_TEXT } from './plattformen'
import { sendePush } from './push'
import { empfaenger, hoertBeiAllenKundenMit } from './rollen'
import { antwortadresseFuerKunden } from './antwortadresse'
import { merkeVor } from './meldung-sammlung'

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
  /**
   * Statt sofort zu senden nur vormerken — die Sammlung schickt später eine
   * Mail für alles, was in derselben Zeit für denselben Kunden zusammenkam.
   * Nur für Kommentare: Eine Freigabe oder ein Fehlschlag beim Posten ist ein
   * Einzelereignis, das niemand mit anderen gebündelt sehen will.
   */
  sammeln?: { art: 'KOMMENTAR'; kommentarId: string } | { art: 'FREIGABE'; freigabeId: string },
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

  /*
    Antworten gehen an die Projektverantwortliche, nicht ans Ausgangspostfach.
    Einmal je Verteilung nachgeschlagen statt je Empfänger — es ist dieselbe
    Adresse für alle.
  */
  const antwortAn = await antwortadresseFuerKunden(meldung.kundeId)

  for (const nutzer of ziele) {
    if (nutzer.mailBenachrichtigungen) {
      if (sammeln) {
        await merkeVor({ ...sammeln, kundeId: meldung.kundeId, email: nutzer.email, url: meldung.url })
      } else {
        await stilleZustellung(
          sendeMail({ ...mailBauen(nutzer.email), antwortAn }),
          `Mail an ${nutzer.email}`,
        )
      }
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

  // Mail, Push und Glocke zeigen keine Chips — dort stehen die Erwähnungen
  // als schlichtes „@Name".
  const lesbar = alsKlartext(kommentar.text)

  // Erwähnte zuerst: Sie bekommen eine eigene, an sie gerichtete Meldung und
  // sind danach vom allgemeinen Verteiler ausgenommen — zwei Mails zum
  // selben Kommentar liest niemand gern.
  const erwaehnt = await meldeErwaehnungen(kommentar, post.titel, kunde, url, lesbar)

  // Kommentare vom Team gehen an die Gäste des Links, nicht ins eigene Haus
  // — es sei denn, sie sind mit `#intern` markiert. Dann ist das Haus genau
  // der richtige Empfänger und der Kunde erfährt nichts davon.
  if (kommentar.nutzerId && !kommentar.intern) {
    if (!kommentar.exportId) return

    const beteiligungen = await prisma.exportGast.findMany({
      where: { exportId: kommentar.exportId, gastId: { notIn: erwaehnt.gastIds } },
      include: { gast: true, export: true },
    })

    for (const { gast, export: exp } of beteiligungen) {
      const gastUrl = `${env.appUrl}/f/${exp.token}`
      if (gast.mailBenachrichtigungen) {
        /*
          Auch beim Kunden gesammelt — dort fällt es sogar mehr ins Gewicht:
          Wer als Agentur einen Plan durchkommentiert, schickt ihm sonst
          binnen Minuten fünf Mails. Die Antwortadresse setzt der Versand.
        */
        await merkeVor({
          art: 'KOMMENTAR',
          kundeId: kunde.id,
          email: gast.email,
          kommentarId: kommentar.id,
          url: `${gastUrl}#post-${post.id}`,
        })
      }
      if (gast.pushBenachrichtigungen) {
        await stilleZustellung(
          sendePush(
            { gastId: gast.id },
            {
              titel: `Neuer Kommentar — ${post.titel}`,
              text: `${kommentar.autorName}: ${lesbar.slice(0, 120)}`,
              url: gastUrl,
            },
          ),
          `Push an ${gast.email}`,
        )
      }
    }
    return
  }

  const ziele = (await empfaengerFuerKunden(kunde.id, kommentar.exportId)).filter(
    (n) => !erwaehnt.nutzerIds.includes(n.id),
  )
  await verteile(
    ziele,
    {
      art: 'KOMMENTAR',
      // Beim internen Wort steht das auch in der Meldung — sonst antwortet
      // jemand darauf im Glauben, der Kunde lese mit.
      titel: `${kommentar.intern ? 'Interne Anmerkung' : 'Neuer Kommentar'} — ${post.titel}`,
      text: `${kommentar.autorName}: ${lesbar.slice(0, 160)}`,
      url,
      kundeId: kunde.id,
      postId: kommentar.postId,
    },
    (an) => vorlageNeuerKommentar(an, kommentar.autorName, kunde.name, post.titel, lesbar, url),
    // Kommentare werden gesammelt: fünf Anmerkungen in einer Durchsicht sind
    // eine Mail, nicht fünf.
    { art: 'KOMMENTAR', kommentarId: kommentar.id },
  )
}

/**
 * Erwähnte benachrichtigen — und zwar nur die, die ohnehin Zutritt haben:
 * aktive Teamkonten und Gäste **dieses** Freigabe-Links. Der Text ist die
 * einzige Quelle dafür, wer erwähnt wurde, und er kommt aus einem Formular;
 * ohne diesen Abgleich ließe sich mit einer untergeschobenen Kennung jemand
 * anschreiben, der mit dem Kunden nichts zu tun hat.
 */
async function meldeErwaehnungen(
  kommentar: {
    autorName: string
    exportId: string | null
    postId: string | null
    text: string
    intern: boolean
  },
  postTitel: string,
  kunde: { id: string; name: string },
  teamUrl: string,
  lesbar: string,
): Promise<{ nutzerIds: string[]; gastIds: string[] }> {
  const erwaehnungen = erwaehnungenAus(kommentar.text)
  if (erwaehnungen.length === 0) return { nutzerIds: [], gastIds: [] }

  const nutzerIds = erwaehnungen.filter((e) => e.art === 'nutzer').map((e) => e.id)
  const gastIds = erwaehnungen.filter((e) => e.art === 'gast').map((e) => e.id)

  const [nutzer, beteiligungen] = await Promise.all([
    nutzerIds.length > 0
      ? prisma.nutzer.findMany({ where: { id: { in: nutzerIds }, aktiv: true } })
      : [],
    // Ein interner Kommentar erwähnt niemanden nach außen: Eine Mail „Sie
    // wurden erwähnt" zu einem Text, den der Gast nirgends findet, wäre die
    // unangenehmste Art, ihn doch mitzuteilen.
    gastIds.length > 0 && kommentar.exportId && !kommentar.intern
      ? prisma.exportGast.findMany({
          where: { exportId: kommentar.exportId, gastId: { in: gastIds } },
          include: { gast: true, export: true },
        })
      : [],
  ])

  await verteile(
    nutzer,
    {
      art: 'KOMMENTAR',
      titel: `${kommentar.autorName} hat Sie erwähnt`,
      text: `${postTitel}: ${lesbar.slice(0, 140)}`,
      url: teamUrl,
      kundeId: kunde.id,
      postId: kommentar.postId,
    },
    (an) => vorlageErwaehnung(an, kommentar.autorName, kunde.name, postTitel, lesbar, teamUrl),
  )

  for (const { gast, export: exp } of beteiligungen) {
    const gastUrl = `${env.appUrl}/f/${exp.token}`
    if (gast.mailBenachrichtigungen) {
      await stilleZustellung(
        sendeMail({
          ...vorlageErwaehnung(
            gast.email,
            kommentar.autorName,
            kunde.name,
            postTitel,
            lesbar,
            gastUrl,
          ),
          antwortAn: await antwortadresseFuerKunden(kunde.id),
        }),
        `Erwähnung an ${gast.email}`,
      )
    }
    if (gast.pushBenachrichtigungen) {
      await stilleZustellung(
        sendePush(
          { gastId: gast.id },
          {
            titel: `${kommentar.autorName} hat Sie erwähnt`,
            text: `${postTitel}: ${lesbar.slice(0, 120)}`,
            url: gastUrl,
          },
        ),
        `Push an ${gast.email}`,
      )
    }
  }

  return {
    nutzerIds: nutzer.map((n) => n.id),
    gastIds: beteiligungen.map((b) => b.gastId),
  }
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
    /*
      Freigaben werden gesammelt wie Kommentare — und dort fällt es sogar mehr
      ins Gewicht: Wer einen Monatsplan durchgeht, gibt acht Beiträge
      nacheinander frei. Acht Mails darüber sagen nichts, was eine nicht auch
      sagt. Push und Glocke kommen weiterhin sofort.
    */
    { art: 'FREIGABE', freigabeId: freigabe.id },
  )
}

// ------------------------------------------------------------ Einladungen

export async function ladeGastEin(exportId: string, gastId: string): Promise<void> {
  const [gast, exp] = await Promise.all([
    prisma.gast.findUnique({ where: { id: gastId } }),
    prisma.export.findUnique({ where: { id: exportId }, include: { kunde: true } }),
  ])
  if (!gast || !exp) return

  await stilleZustellung(
    sendeMail({
      ...vorlageEinladung(gast.email, exp.kunde.name, `${env.appUrl}/f/${exp.token}`),
      // Auf eine Einladung wird geantwortet („wer sind Sie?", „geht der Link
      // nicht auf?") — und zwar bei der Ansprechperson, nicht im Ausgangsfach.
      antwortAn: await antwortadresseFuerKunden(exp.kundeId),
    }),
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

// -------------------------------------------------------- Veröffentlichungen

/**
 * Ein Beitrag ist nicht rausgegangen.
 *
 * Geht an denselben Kreis wie jede andere Meldung dieses Kunden
 * (`empfaenger` in `rollen.ts`: Administration und Projektmanagement hören
 * überall mit, dazu der Hauptansprechpartner und betreuende Designer) — und
 * zusätzlich an die Person, die für **diesen Beitrag** eingetragen ist. Sie
 * steht sonst in keiner dieser Gruppen, ist aber die, die es angeht.
 *
 * Gemeldet wird **je Fehlschlag einmal**. Der Merker wird beim Wiederbeleben
 * zurückgesetzt, damit ein erneuter Fehlschlag wieder meldet.
 */
export async function meldeVeroeffentlichungFehlgeschlagen(id: string): Promise<void> {
  const zeile = await prisma.veroeffentlichung.findUnique({
    where: { id },
    include: {
      post: {
        select: {
          id: true,
          titel: true,
          verantwortlichId: true,
          kunde: { select: { id: true, name: true, slug: true } },
        },
      },
    },
  })
  if (!zeile || zeile.gemeldetAm) return

  // Erst den Merker setzen: Zwei gleichzeitige Läufe sollen nicht zweimal
  // schreiben, und eine verpasste Mail ist besser als eine doppelte.
  await prisma.veroeffentlichung.update({ where: { id }, data: { gemeldetAm: new Date() } })

  const { post } = zeile
  const kunde = post.kunde
  const url = `${env.appUrl}/kunden/${kunde.slug}/posts/${post.id}`
  const plattform = PLATTFORM_TEXT[zeile.plattform]
  const termin = formatiereTag(zeile.geplantFuer, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
  const grund = zeile.meldung ?? 'Ohne nähere Angabe.'

  const ziele = await empfaengerFuerKunden(kunde.id)

  // Die verantwortliche Person des Beitrags kommt dazu, falls sie nicht
  // ohnehin schon dabei ist.
  if (post.verantwortlichId && !ziele.some((z) => z.id === post.verantwortlichId)) {
    const verantwortlich = await prisma.nutzer.findFirst({
      where: { id: post.verantwortlichId, aktiv: true },
    })
    if (verantwortlich) ziele.push(verantwortlich)
  }

  await verteile(
    ziele,
    {
      art: 'VEROEFFENTLICHUNG',
      titel: `Nicht veröffentlicht — ${kunde.name}`,
      text: `${plattform} · ${post.titel}: ${grund}`,
      url,
      kundeId: kunde.id,
      postId: post.id,
    },
    (an) =>
      vorlageVeroeffentlichungFehlgeschlagen(an, kunde.name, post.titel, plattform, termin, grund, url),
  )
}

/**
 * Der Meta-Zugang wird abgelehnt.
 *
 * Eine Meldung statt einer je Beitrag: Ein totes Token lässt jeden fälligen
 * Beitrag scheitern, und zwanzig Mails über dieselbe Ursache liest niemand.
 * Empfänger sind die Rollen, die bei allen Kunden mithören — Administration
 * (sie erneuert) und Projektmanagement (es weiß, was liegenbleibt).
 */
export async function meldeZugangAbgelehnt(zugangId: string): Promise<void> {
  const zugang = await prisma.plattformZugang.findUnique({
    where: { id: zugangId },
    include: {
      kunden: {
        where: { archiviert: false, postenAktiv: true },
        orderBy: { name: 'asc' },
        select: { name: true },
      },
    },
  })
  if (!zugang || !zugang.fehler || zugang.gemeldetAm) return

  await prisma.plattformZugang.update({
    where: { id: zugangId },
    data: { gemeldetAm: new Date() },
  })

  const ziele = (await prisma.nutzer.findMany({ where: { aktiv: true } })).filter((n) =>
    hoertBeiAllenKundenMit(n.rolle),
  )
  if (ziele.length === 0) return

  const namen = zugang.kunden.map((k) => k.name)
  const url = `${env.appUrl}/einstellungen/veroeffentlichen`
  const titel = 'Meta-Zugang erneuern'
  const text =
    namen.length === 0
      ? zugang.fehler
      : `${zugang.fehler} Betrifft ${namen.join(', ')}.`

  await stilleZustellung(
    prisma.benachrichtigung.createMany({
      data: ziele.map((nutzer) => ({ nutzerId: nutzer.id, art: 'WARTUNG' as const, titel, text, url })),
    }),
    'Zugangsmeldung anlegen',
  )

  for (const nutzer of ziele) {
    if (nutzer.mailBenachrichtigungen) {
      await stilleZustellung(
        sendeMail(vorlageZugangAbgelehnt(nutzer.email, zugang.fehler, namen, url)),
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
