import 'server-only'
import type { Plattform } from '@prisma/client'
import { prisma } from './db'
import { zielPlattformen } from './plattformen'
import { posteAufLinkedIn } from './linkedin'
import { gueltigesToken } from './linkedin-zugang'
import {
  posteAufFacebook,
  posteAufInstagram,
  type Medienstueck,
  type MetaAntwort,
  type MetaFehler,
} from './meta'
import {
  meldeVeroeffentlichungFehlgeschlagen,
  meldeZugangAbgelehnt,
} from './benachrichtigungen'
import { medienFuerPost } from './veroeffentlichung-medien'

export { medienFuerPost } from './veroeffentlichung-medien'

/**
 * Veröffentlichen: was fällig ist, und was daraus wird.
 *
 * ## Warum der Termin nicht an Facebook übergeben wird
 *
 * Facebook kann `scheduled_publish_time` — man reicht den Beitrag Tage vorher
 * ein und ist fertig. Genutzt wird das trotzdem nicht, und zwar aus einem
 * Grund, der erst beim Kreuzposten sichtbar wird: Instagram kann es **nicht**,
 * dort muss Preroll zur Minute selbst posten. Wären beide Wege verschieden,
 * stünde der Facebook-Beitrag schon fest, während der Instagram-Beitrag noch
 * änderbar ist — wer zwischendurch die Caption anfasst, hätte zwei
 * verschiedene Fassungen desselben Beitrags draußen. Genau das soll das
 * Kreuzposten verhindern.
 *
 * Der Preis ist Erreichbarkeit: Läuft der Container zur Postzeit nicht, geht
 * **keiner** der beiden raus statt nur einer. Beide zusammen zu spät ist
 * besser als einer pünktlich und einer gar nicht.
 *
 * `UEBERGEBEN` bleibt trotzdem im Modell — YouTube wird es brauchen, wo das
 * Video lange vor dem Termin hochgeladen und mit `publishAt` scharfgestellt
 * wird. Dort gibt es kein Gegenstück, das mitwandern müsste.
 *
 * ## Wie lange nachgeholt wird
 *
 * Ein verschlafener Termin wird nachgeholt, aber nicht endlos: Sechs Stunden
 * decken einen Neustart und eine durchschlafene Nacht ab und landen noch im
 * selben Arbeitstag. Was älter ist, geht nicht mehr raus — ein Beitrag, der um
 * 10:00 Uhr geplant war und um 23:00 Uhr erscheint, ist schlimmer als keiner.
 */
export const VERFALL = 6 * 3600_000

/** Nach einem Fehlschlag frühestens so viel später wieder. */
export const WIEDERHOLABSTAND = 5 * 60_000

/** Danach gilt ein Versuch als endgültig gescheitert. */
export const MAX_VERSUCHE = 3

/**
 * Ab wann ein hängengebliebener Lauf als abgebrochen gilt. Bewusst großzügig:
 * Ein Instagram-Video darf fünf Minuten in der Verarbeitung stehen.
 */
const LAUF_ZEITLIMIT = 15 * 60_000

// ------------------------------------------------------------------ Abgleich

/**
 * Die geplanten Veröffentlichungen mit dem tatsächlichen Stand der Posts
 * abgleichen.
 *
 * Bewusst **ableitend statt eintragend**: Es gibt keine Aktion „einplanen", die
 * jemand vergessen könnte. Wer einen Beitrag auf Final zieht oder im Kalender
 * verschiebt, hat damit alles getan — der nächste Takt zieht nach. Umgekehrt
 * verschwindet eine geplante Veröffentlichung wieder, wenn der Beitrag
 * zurückgestuft wird.
 *
 * Angefasst wird dabei nur, was noch `GEPLANT` ist. Was einmal draußen ist,
 * bleibt als Beleg stehen, auch wenn der Post danach umgeplant wird.
 */
export async function gleicheVeroeffentlichungenAb(jetzt = new Date()): Promise<void> {
  const fruehestens = new Date(jetzt.getTime() - VERFALL)

  const posts = await prisma.post.findMany({
    where: {
      status: 'FINAL',
      postenAm: { gte: fruehestens },
      kunde: {
        postenAktiv: true,
        archiviert: false,
        fbSeitenToken: { not: null },
      },
    },
    select: {
      id: true,
      postenAm: true,
      plattformen: true,
      kunde: { select: { fbSeitenId: true, igKontoId: true, liOrganisationId: true } },
      veroeffentlichungen: { select: { id: true, plattform: true, stand: true, geplantFuer: true } },
    },
  })

  for (const post of posts) {
    if (!post.postenAm) continue

    const ziele = zielPlattformen(post.plattformen, post.kunde)

    /*
      Eine abgewählte Plattform nimmt ihre geplante Zeile wieder mit. Nur die
      geplante: Was einmal draußen ist, lässt sich nicht abwählen, und der
      Beleg bleibt stehen. Das ist dieselbe Regel wie beim Zurückstufen eines
      Beitrags, nur eine Ebene feiner.
    */
    const ueberzaehlig = post.veroeffentlichungen.filter(
      (v) => v.stand === 'GEPLANT' && !ziele.includes(v.plattform),
    )
    if (ueberzaehlig.length > 0) {
      await prisma.veroeffentlichung.deleteMany({
        where: { id: { in: ueberzaehlig.map((v) => v.id) } },
      })
    }

    for (const plattform of ziele) {
      const vorhanden = post.veroeffentlichungen.find((v) => v.plattform === plattform)

      if (!vorhanden) {
        // `create` statt `upsert`: Ein Wettlauf zweier Läufe endet am
        // eindeutigen Schlüssel, und genau das ist die gewünschte Antwort.
        await prisma.veroeffentlichung
          .create({ data: { postId: post.id, plattform, geplantFuer: post.postenAm } })
          .catch(() => {})
        continue
      }

      const verschoben = vorhanden.geplantFuer.getTime() !== post.postenAm.getTime()

      if (vorhanden.stand === 'GEPLANT' && verschoben) {
        await prisma.veroeffentlichung.update({
          where: { id: vorhanden.id },
          data: { geplantFuer: post.postenAm },
        })
      }

      /*
        Ein neuer Termin auf einem gescheiterten Beitrag heißt: Jemand hat den
        Fehlschlag gesehen und etwas dagegen getan. Das ist die natürlichste
        Wiederholung, die es gibt — Problem beheben, Beitrag auf einen neuen
        Termin ziehen, fertig. Der Versuchszähler beginnt von vorn, und der
        Meldungs-Merker fällt weg, damit ein erneuter Fehlschlag wieder meldet.

        Nur bei **verschobenem** Termin: Sonst bliebe eine gescheiterte Zeile
        in einer Endlosschleife aus Wiederbeleben und Scheitern hängen.
      */
      if (vorhanden.stand === 'FEHLGESCHLAGEN' && verschoben) {
        await prisma.veroeffentlichung.update({
          where: { id: vorhanden.id },
          data: {
            stand: 'GEPLANT',
            geplantFuer: post.postenAm,
            versuche: 0,
            meldung: null,
            erledigtAm: null,
            gemeldetAm: null,
          },
        })
      }
    }
  }

  // Was nicht mehr hingehört: zurückgestufte Beiträge, entzogene Termine,
  // abgeschaltete Kunden, entfernte Kanäle. Nur Geplantes — Erledigtes bleibt.
  await prisma.veroeffentlichung.deleteMany({
    where: {
      stand: 'GEPLANT',
      OR: [
        { post: { status: { not: 'FINAL' } } },
        { post: { postenAm: null } },
        { post: { kunde: { postenAktiv: false } } },
        { post: { kunde: { archiviert: true } } },
        { post: { kunde: { fbSeitenToken: null } } },
        { plattform: 'FACEBOOK', post: { kunde: { fbSeitenId: null } } },
        { plattform: 'INSTAGRAM', post: { kunde: { igKontoId: null } } },
      ],
    },
  })

  await raeumeHaengendeAuf(jetzt)
}

/**
 * Ein Lauf, der mitten im Posten abgebrochen ist — Containerneustart, Absturz.
 *
 * Er wird **nicht** wieder auf `GEPLANT` gesetzt. Ob der Beitrag draußen ist
 * oder nicht, weiß hier niemand; ein zweiter Versuch könnte ihn doppelt
 * veröffentlichen, und das ist der teuerste aller Fehler. Also stehenlassen,
 * kennzeichnen und einen Menschen nachsehen lassen.
 */
async function raeumeHaengendeAuf(jetzt: Date): Promise<void> {
  await prisma.veroeffentlichung.updateMany({
    where: {
      stand: 'LAEUFT',
      aktualisiertAm: { lt: new Date(jetzt.getTime() - LAUF_ZEITLIMIT) },
    },
    data: {
      stand: 'FEHLGESCHLAGEN',
      meldung:
        'Der Lauf wurde unterbrochen. Bitte auf der Plattform nachsehen, ob der Beitrag draußen ist — Preroll versucht es von sich aus nicht noch einmal.',
      erledigtAm: jetzt,
    },
  })
}

// ------------------------------------------------------------------ Ausführen

/**
 * Alles veröffentlichen, was fällig ist. Gibt zurück, wie viele Versuche
 * unternommen wurden — null heißt: nichts zu tun.
 */
export async function fuehreFaelligeAus(jetzt = new Date()): Promise<number> {
  const verfallen = new Date(jetzt.getTime() - VERFALL)

  // Zu spät zum Nachholen: einmal kennzeichnen, dann nie wieder anfassen.
  await prisma.veroeffentlichung.updateMany({
    where: { stand: 'GEPLANT', geplantFuer: { lt: verfallen } },
    data: {
      stand: 'FEHLGESCHLAGEN',
      meldung: `Der Termin liegt mehr als ${VERFALL / 3600_000} Stunden zurück — nicht mehr veröffentlicht.`,
      erledigtAm: jetzt,
    },
  })

  const faellig = await prisma.veroeffentlichung.findMany({
    where: {
      stand: 'GEPLANT',
      geplantFuer: { lte: jetzt, gte: verfallen },
      OR: [
        { versuche: 0 },
        { aktualisiertAm: { lt: new Date(jetzt.getTime() - WIEDERHOLABSTAND) } },
      ],
    },
    orderBy: { geplantFuer: 'asc' },
    select: { id: true },
    take: 20,
  })

  let versuche = 0
  for (const { id } of faellig) {
    // Sperre gegen Doppelposts: Nur wer die Zeile von GEPLANT auf LAEUFT
    // dreht, darf sie posten. Zwei gleichzeitige Läufe — oder zwei Container
    // — treffen sich hier, und einer von beiden geht leer aus.
    const geclaimt = await prisma.veroeffentlichung.updateMany({
      where: { id, stand: 'GEPLANT' },
      data: { stand: 'LAEUFT', versuche: { increment: 1 } },
    })
    if (geclaimt.count === 0) continue

    versuche++
    await veroeffentlicheEine(id, jetzt).catch(async (fehler) => {
      // Hier zu landen heißt: ein Fehler außerhalb der Meta-Anbindung. Die
      // Zeile darf nicht auf LAEUFT stehenbleiben, sonst räumt sie erst das
      // Zeitlimit ab.
      await notiereFehlschlag(id, {
        text: `Unerwarteter Fehler: ${fehler instanceof Error ? fehler.message : String(fehler)}`,
        zugangHin: false,
      }).catch(() => {})
    })
  }

  return versuche
}

async function notiereFehlschlag(id: string, fehler: MetaFehler): Promise<void> {
  const zeile = await prisma.veroeffentlichung.findUnique({
    where: { id },
    select: { versuche: true, post: { select: { kunde: { select: { metaZugangId: true } } } } },
  })
  if (!zeile) return

  // Ein toter Zugang wird nicht wiederholt — das wird nicht besser, bevor
  // jemand ihn erneuert. Und er gehört an den Zugang notiert, nicht an den
  // Beitrag: Betroffen sind alle Kunden, die daran hängen.
  const endgueltig = fehler.zugangHin || zeile.versuche >= MAX_VERSUCHE

  await prisma.veroeffentlichung.update({
    where: { id },
    data: {
      stand: endgueltig ? 'FEHLGESCHLAGEN' : 'GEPLANT',
      meldung: fehler.text,
      erledigtAm: endgueltig ? new Date() : null,
    },
  })

  if (!endgueltig) return

  if (fehler.zugangHin && zeile.post.kunde.metaZugangId) {
    // Am Zugang notiert, nicht am Beitrag: Betroffen sind alle Kunden, die
    // daran hängen — und gemeldet wird deshalb der Zugang, einmal, statt
    // jeder liegengebliebene Beitrag einzeln.
    await prisma.plattformZugang.update({
      where: { id: zeile.post.kunde.metaZugangId },
      data: { fehler: fehler.text, geprueftAm: new Date() },
    })
    await meldeZugangAbgelehnt(zeile.post.kunde.metaZugangId).catch(() => {})
    return
  }

  await meldeVeroeffentlichungFehlgeschlagen(id).catch(() => {})
}

/**
 * Der Zweig je Plattform — an einer Stelle, damit `veroeffentlicheEine` beim
 * nächsten Anbieter nicht weiter wächst.
 *
 * `null` heißt: Für diese Plattform fehlt beim Kunden die Zuordnung. Das ist
 * etwas anderes als ein Fehlschlag beim Anbieter und wird oben auch anders
 * gemeldet.
 *
 * Der LinkedIn-Token kommt **hier** und nicht vom Kunden: Er hängt am einen
 * Zugang der Agentur, wird vor dem Gebrauch erneuert, und ein abgelaufener
 * mitten im Upload hinterließe halb angelegte Bilder.
 */
async function posteJePlattform(opts: {
  plattform: Plattform
  text: string
  medien: Medienstueck[]
  fbSeitenId: string | null
  fbSeitenToken: string | null
  igKontoId: string | null
  liOrganisationId: string | null
}): Promise<MetaAntwort<{ externeId: string }> | null> {
  if (opts.plattform === 'FACEBOOK') {
    if (!opts.fbSeitenId || !opts.fbSeitenToken) return null
    return posteAufFacebook({
      seitenId: opts.fbSeitenId,
      seitenToken: opts.fbSeitenToken,
      text: opts.text,
      medien: opts.medien,
    })
  }

  if (opts.plattform === 'INSTAGRAM') {
    if (!opts.igKontoId || !opts.fbSeitenToken) return null
    return posteAufInstagram({
      igKontoId: opts.igKontoId,
      seitenToken: opts.fbSeitenToken,
      text: opts.text,
      medien: opts.medien,
    })
  }

  if (opts.plattform === 'LINKEDIN') {
    if (!opts.liOrganisationId) return null
    const token = await gueltigesToken()
    if (!token) {
      return {
        ok: false,
        fehler: { text: 'Es ist kein LinkedIn-Zugang verbunden.', zugangHin: true },
      }
    }
    return posteAufLinkedIn({
      token,
      organisationId: opts.liOrganisationId,
      text: opts.text,
      medien: opts.medien,
    })
  }

  // YouTube steht im Enum, ist aber nicht gebaut — und bekommt deshalb auch
  // keine Zeile. Landet hier trotzdem eine, ist das kein Fehlschlag des
  // Anbieters, sondern eine fehlende Zuordnung.
  return null
}

/** Eine bereits auf `LAEUFT` gesetzte Zeile tatsächlich veröffentlichen. */
async function veroeffentlicheEine(id: string, jetzt: Date): Promise<void> {
  const zeile = await prisma.veroeffentlichung.findUnique({
    where: { id },
    include: {
      post: {
        select: {
          id: true,
          typ: true,
          caption: true,
          klappeVersionId: true,
          medien: {
            orderBy: [{ rolle: 'asc' }, { position: 'asc' }],
            select: {
              rolle: true,
              position: true,
              mediumId: true,
              medium: { select: { mimeTyp: true } },
            },
          },
          kunde: {
            select: {
              fbSeitenId: true,
              fbSeitenToken: true,
              igKontoId: true,
              liOrganisationId: true,
            },
          },
        },
      },
    },
  })
  if (!zeile) return

  const { post } = zeile
  const { fbSeitenId, fbSeitenToken, igKontoId, liOrganisationId } = post.kunde

  // Meta braucht den Seiten-Token, LinkedIn nicht — die Prüfung gehört deshalb
  // in den Meta-Zweig und nicht davor. Vorher stand sie oben und hätte einen
  // LinkedIn-Beitrag mit der Meldung „keine Facebook-Seite verbunden"
  // abgewiesen.
  if (zeile.plattform !== 'LINKEDIN' && !fbSeitenToken) {
    await notiereFehlschlag(id, {
      text: 'Für diesen Kunden ist keine Facebook-Seite verbunden.',
      zugangHin: false,
    })
    return
  }

  const material = medienFuerPost(post)
  if (!material.ok) {
    await notiereFehlschlag(id, { text: material.fehler, zugangHin: false })
    return
  }

  const ergebnis = await posteJePlattform({
    plattform: zeile.plattform,
    text: post.caption,
    medien: material.medien,
    fbSeitenId,
    fbSeitenToken,
    igKontoId,
    liOrganisationId,
  })

  if (!ergebnis) {
    await notiereFehlschlag(id, {
      text: 'Für diese Plattform ist beim Kunden kein Konto hinterlegt.',
      zugangHin: false,
    })
    return
  }

  if (!ergebnis.ok) {
    await notiereFehlschlag(id, ergebnis.fehler)
    return
  }

  await prisma.veroeffentlichung.update({
    where: { id },
    data: {
      stand: 'ERFOLGT',
      externeId: ergebnis.daten.externeId,
      meldung: null,
      erledigtAm: jetzt,
    },
  })
}
