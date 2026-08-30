import 'server-only'
import type { KennzahlenQuelle } from '@prisma/client'
import { prisma } from './db'
import {
  ABRUFBARE_PLATTFORMEN,
  ABRUF_BEDINGUNG,
  istAbrufbar,
  UEBER_HANDLE,
  type AbrufbarePlattform,
  type Abrufkontext,
} from './kennzahlen-bereit'
import { ladeEinstellungen, speichereEinstellungen } from './einstellungen'
import { holeProfilwerte as holeInstagram } from './instagram-kennzahlen'
import { holeProfilwerte as holeTikTok } from './tiktok-kennzahlen'
import { holeInstagramKennzahlen as holeInstagramGraph, holeSeitenKennzahlen } from './meta'
import { speichereMedium } from './medien'

/**
 * Die Kennzahlen aktuell halten.
 *
 * Preroll hat keinen Zeitplaner — angestoßen wird beim Aufruf des Backends,
 * genau wie die Wache über die Instagram-Sitzung. Damit das die Quellen nicht
 * strapaziert, gilt doppelt gebremst: **ein Profil je Lauf**, und Läufe
 * höchstens alle 20 Minuten. Bei einer Handvoll Kunden ist damit jedes Profil
 * längst vor dem Tagesende einmal dran; bei siebzig immer noch.
 *
 * Ein Profil wird geholt, wenn seine Zahlen älter als 20 Stunden sind — nicht
 * „älter als 24", sonst rutscht der Termin mit jedem Tag später und trifft
 * irgendwann die Nacht.
 *
 * **Drei Plattformen, zwei Wege.** Instagram und TikTok werden aus ihrer
 * öffentlichen Profilseite gelesen — dort beobachtet Preroll *fremde* Profile,
 * und einen Weg über die offizielle Schnittstelle gibt es dafür nicht.
 * Facebook geht über die **Graph API**: Die Seite ist dem Systemnutzer der
 * Agentur zugewiesen, das Token liegt am Kunden, der dokumentierte Weg ist
 * offen. LinkedIn bleibt von Hand gepflegt.
 *
 * Was eine Plattform zum Abruf braucht, sagt sie selbst (`bereit`) — bei
 * Instagram und TikTok ein Handle, bei Facebook Seite und Token. Ohne das
 * stünde die Bedingung in der Warteschlange, im Abruf und in der Meldung je
 * einmal leicht verschieden da.
 */

const LAUFABSTAND = 20 * 60_000
const HALTBARKEIT = 20 * 3600_000

/**
 * Wie lange ein **gescheitertes** Profil in Ruhe gelassen wird.
 *
 * Vorher gar nicht: Ein Fehlschlag ließ `standAm` leer, das Profil war damit
 * sofort wieder das älteste, und der Lauf holte es alle zwanzig Minuten aufs
 * Neue — rund siebzig aussichtslose Anfragen am Tag gegen dieselbe Adresse.
 * Instagram drosselt daraufhin **alles**, und dann fallen auch die Profile
 * aus, die vorher gingen. Genau so sah es aus, als sei „die
 * Instagram-Verbindung kaputt".
 *
 * Zwei Stunden sind der Ausgleich: oft genug, dass eine vorübergehende
 * Störung binnen eines halben Tages von selbst durchläuft, selten genug, dass
 * ein dauerhaft kaputtes Profil nicht den Takt frisst.
 */
const FEHLERPAUSE = 2 * 3600_000

/** Was ein Abruf zurückgibt — dieselbe Form für alle Plattformen. */
type Abrufwerte = {
  follower: number | null
  gefolgt: number | null
  beitraege: number | null
  likes: number | null
  bio: string | null
  website: string | null
  profilbildUrl: string | null
}

/**
 * `quelle` überschreibt die der Bedingung: Instagram kann über Graph **oder**
 * über die Profilseite kommen, und in den Stammdaten soll stehen, welcher Weg
 * es war — „automatisch geholt" ohne Angabe wäre bei zwei Wegen zu wenig.
 */
type Abrufergebnis =
  | { ok: true; werte: Abrufwerte; quelle?: KennzahlenQuelle }
  | { ok: false; fehler: string }

const LEER: Abrufwerte = {
  follower: null,
  gefolgt: null,
  beitraege: null,
  likes: null,
  bio: null,
  website: null,
  profilbildUrl: null,
}

/**
 * Der Abruf je Plattform. Die **Bedingung** dazu steht in
 * `kennzahlen-bereit.ts` — sie ist eine Festlegung und gehört geprüft, der
 * Abruf ist Netzwerkarbeit und lässt sich nicht sinnvoll testen.
 */
const HOLEN: Record<AbrufbarePlattform, (k: Abrufkontext) => Promise<Abrufergebnis>> = {
  INSTAGRAM: async (k) => {
    /*
      Der offizielle Weg zuerst, wo er offensteht: Ist dem Kunden eine
      Facebook-Seite mit verknüpftem Instagram-Konto zugeordnet, liefert die
      Graph API dieselben Zahlen — ohne Drosselung, ohne Bruch beim nächsten
      Umbau der Profilseite und ohne den 400er, an dem der öffentliche Weg
      für einen Teil der Business-Konten scheitert.

      Ohne Zuordnung bleibt es beim Auslesen. Das ist kein Notbehelf, sondern
      der einzige Weg für Profile, die der Agentur nicht zugewiesen sind.
    */
    if (k.igKontoId && k.fbSeitenToken) {
      const g = await holeInstagramGraph(k.igKontoId, k.fbSeitenToken)
      if (g.ok) {
        const { handle: _handle, ...werte } = g.daten
        return { ok: true, werte: { ...LEER, ...werte }, quelle: 'GRAPH_API' }
      }
      /*
        Scheitert Graph, wird **nicht** still auf das Auslesen zurückgefallen:
        Eine zugeordnete Seite, die keine Zahlen liefert, ist ein Zustand, den
        jemand ansehen muss — ein abgelaufenes Token, ein entzogenes Recht.
        Ein stiller Rückfall verstecktes das, bis irgendwann beides kaputt ist.
      */
      if (!k.handle?.trim()) return { ok: false, fehler: g.fehler.text }
    }

    const e = await holeInstagram(k.handle!)
    return e.ok ? { ok: true, werte: { ...LEER, ...e.werte } } : e
  },
  TIKTOK: async (k) => {
    const e = await holeTikTok(k.handle!)
    // TikTok führt keine Website im Profil — das Feld bleibt, wie es ist.
    return e.ok ? { ok: true, werte: { ...LEER, ...e.werte, website: null } } : e
  },
  FACEBOOK: async (k) => {
    const e = await holeSeitenKennzahlen(k.fbSeitenId!, k.fbSeitenToken!)
    return e.ok
      ? { ok: true, werte: { ...LEER, ...e.daten } }
      : { ok: false, fehler: e.fehler.text }
  },
}

// Durchgereicht, damit Aufrufer nicht zwei Module kennen müssen.
export {
  ABRUFBARE_PLATTFORMEN,
  istAbrufbar,
  type AbrufbarePlattform,
} from './kennzahlen-bereit'

export type Aktualisierung =
  | { ok: true; follower: number | null }
  | { ok: false; fehler: string }

/** Holt ein Profil und schreibt Stammdaten wie Tageswert fort. */
export async function aktualisiereKennzahlen(
  kundeId: string,
  plattform: AbrufbarePlattform = 'INSTAGRAM',
): Promise<Aktualisierung> {
  const bedingung = ABRUF_BEDINGUNG[plattform]

  const kunde = await prisma.kunde.findUnique({
    where: { id: kundeId },
    select: {
      id: true,
      logoId: true,
      fbSeitenId: true,
      fbSeitenToken: true,
      igKontoId: true,
      profile: { where: { plattform }, select: { handle: true } },
    },
  })
  if (!kunde) return { ok: false, fehler: 'Kunde nicht gefunden.' }

  const kontext: Abrufkontext = {
    handle: kunde.profile[0]?.handle ?? null,
    fbSeitenId: kunde.fbSeitenId,
    fbSeitenToken: kunde.fbSeitenToken,
    igKontoId: kunde.igKontoId,
  }
  if (!bedingung.bereit(kontext)) return { ok: false, fehler: bedingung.fehlt }

  const ergebnis = await HOLEN[plattform](kontext)
  // Bewusst ohne `merkeAbgelaufen`: Gefragt wird ohne Sitzung, ein
  // Fehlschlag sagt also nichts über sie aus. Die erste Fassung meldete hier
  // eine abgelaufene Sitzung — und das rote Band im Backend behauptete, die
  // Referenzvideos gingen nicht, obwohl sie gingen.
  if (!ergebnis.ok) {
    /*
      Der Fehlschlag wird **festgehalten**, nicht verschwiegen. Zwei Dinge
      hingen daran: In den Stammdaten stand nur „Noch nichts eingetragen",
      egal ob niemand gepflegt hat oder der Abruf seit Tagen scheitert — und
      der Lauf zog dasselbe aussichtslose Profil alle zwanzig Minuten wieder
      heran, weil `standAm` leer blieb. Instagram drosselt daraufhin die ganze
      Adresse, und dann fallen auch die Profile aus, die vorher gingen.
    */
    await prisma.plattformProfil
      .updateMany({
        where: { kundeId, plattform },
        data: { letzterVersuchAm: new Date(), letzterFehler: ergebnis.fehler },
      })
      .catch(() => {})
    return { ok: false, fehler: ergebnis.fehler }
  }

  const { werte } = ergebnis
  const jetzt = new Date()

  const zahlen = {
    follower: werte.follower,
    gefolgt: werte.gefolgt,
    beitraege: werte.beitraege,
    likes: werte.likes,
  }

  /*
    `upsert`, nicht `update`: Bei Facebook entsteht die Profilzeile mit der
    Kanalzuordnung, bei den anderen mit dem Handle — aber ein Abruf soll auch
    dann durchgehen, wenn sie aus irgendeinem Grund fehlt. Ein Knopf, der mit
    „Zeile nicht gefunden" scheitert, ist keine Auskunft.
  */
  const gepflegt = {
    ...zahlen,
    // Bio und Website nur übernehmen, wenn die Quelle etwas liefert — ein
    // leeres Feld dort soll eine gepflegte Angabe hier nicht löschen.
    ...(werte.bio ? { bio: werte.bio } : {}),
    ...(werte.website ? { website: werte.website } : {}),
    standAm: jetzt,
    letzterVersuchAm: jetzt,
    // Geht es wieder, verschwindet der alte Grund — ein Fehler, der stehen
    // bleibt, obwohl es längst läuft, ist schlimmer als keiner.
    letzterFehler: null,
    // Welcher Weg es wirklich war — bei Instagram entscheidet sich das im Abruf.
    quelle: ergebnis.quelle ?? bedingung.quelle,
  }
  await prisma.plattformProfil.upsert({
    where: { kundeId_plattform: { kundeId, plattform } },
    create: { kundeId, plattform, handle: kontext.handle, ...gepflegt },
    update: gepflegt,
  })

  // Ein Tageswert je Kunde und Plattform — mehrere Läufe am selben Tag
  // überschreiben ihn.
  const tag = new Date(Date.UTC(jetzt.getFullYear(), jetzt.getMonth(), jetzt.getDate()))
  await prisma.kennzahlVerlauf.upsert({
    where: { kundeId_plattform_datum: { kundeId, plattform, datum: tag } },
    create: { kundeId, plattform, datum: tag, ...zahlen, quelle: bedingung.quelle },
    update: { ...zahlen, quelle: bedingung.quelle },
  })

  // Das Profilbild nur, wenn noch keines hinterlegt ist — wer eines
  // ausgetauscht hat, will es behalten. Dieselbe Regel wie bei M365.
  if (!kunde.logoId && werte.profilbildUrl) {
    await uebernimmProfilbild(kundeId, werte.profilbildUrl, plattform).catch(() => {})
  }

  return { ok: true, follower: werte.follower }
}

async function uebernimmProfilbild(
  kundeId: string,
  url: string,
  plattform: AbrufbarePlattform,
): Promise<void> {
  const antwort = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(20_000) })
  if (!antwort.ok) return

  const inhalt = Buffer.from(await antwort.arrayBuffer())
  if (inhalt.byteLength === 0) return

  const { medium } = await speichereMedium({
    inhalt,
    dateiname: `${plattform.toLowerCase()}-profilbild.jpg`,
    mimeTyp: antwort.headers.get('content-type')?.split(';')[0] ?? 'image/jpeg',
    kundeId,
  })
  await prisma.kunde.update({ where: { id: kundeId }, data: { logoId: medium.id } })
}

/**
 * Angestoßen vom Team-Layout: Ist ein Lauf fällig, wird **ein** Profil
 * nachgezogen. Wirft nie — eine Seite darf nicht daran scheitern, dass eine
 * Plattform gerade zickt.
 */
export async function wacheUeberKennzahlen(): Promise<void> {
  try {
    const e = await ladeEinstellungen()
    if (!e.kennzahlenAktiv) return

    if (e.kennzahlenLaufAm && Date.now() - e.kennzahlenLaufAm.getTime() < LAUFABSTAND) return

    /*
      Eine Warteschlange über alle abrufbaren Plattformen, nicht eine je
      Anbieter: Sonst käme TikTok bei vielen Kunden nie an die Reihe, weil
      Instagram den Takt belegt. Das am längsten Ungeprüfte zuerst; `null`
      sortiert Prisma nach vorn, und ein frisch eingetragenes Profil ist damit
      sofort dran.

      Die Bedingung je Plattform steht hier ein zweites Mal — als Abfrage,
      die `bereit` in SQL nachbildet. Ohne sie zöge der Lauf reihum Profile,
      die er gar nicht holen kann, und käme nie bei denen an, die es könnten.
    */
    const faellig = await prisma.plattformProfil.findFirst({
      where: {
        kunde: { archiviert: false },
        OR: [
          { plattform: { in: UEBER_HANDLE }, handle: { not: null } },
          {
            plattform: 'FACEBOOK',
            kunde: { fbSeitenId: { not: null }, fbSeitenToken: { not: null } },
          },
          /*
            Instagram kommt auch ohne Handle in Frage, wenn das Konto über die
            Facebook-Seite zugeordnet ist — dann geht es über die Graph API.
            Ohne diesen Zweig bliebe ein Kunde außen vor, dessen Konto
            zugeordnet ist, aber dessen Handle niemand eingetippt hat: also
            ausgerechnet der mit dem besseren Weg.
          */
          {
            plattform: 'INSTAGRAM',
            kunde: { igKontoId: { not: null }, fbSeitenToken: { not: null } },
          },
        ],
        AND: [
          { OR: [{ standAm: null }, { standAm: { lt: new Date(Date.now() - HALTBARKEIT) } }] },
          // Nach einem Fehlschlag erst einmal Ruhe — sonst frisst ein
          // aussichtsloses Profil jeden Lauf und drosselt nebenbei die Quelle.
          {
            OR: [
              { letzterVersuchAm: null },
              { letzterVersuchAm: { lt: new Date(Date.now() - FEHLERPAUSE) } },
            ],
          },
        ],
      },
      /*
        Erst die, die noch nie liefen oder deren Zahlen alt sind — und
        innerhalb dessen die, bei denen es zuletzt am längsten her ist.
        `letzterVersuchAm` als zweites Kriterium stellt sicher, dass ein
        Profil mit frischem Fehlschlag hinter eines rutscht, das noch gar
        nicht dran war.
      */
      orderBy: [{ letzterVersuchAm: { sort: 'asc', nulls: 'first' } }, { standAm: 'asc' }],
      select: { kundeId: true, plattform: true },
    })
    if (!faellig || !istAbrufbar(faellig.plattform)) return

    // Sofort vormerken, damit nicht mehrere Seitenaufrufe gleichzeitig losziehen.
    await speichereEinstellungen({ kennzahlenLaufAm: new Date() })
    await aktualisiereKennzahlen(faellig.kundeId, faellig.plattform)
  } catch (fehler) {
    console.warn('[kennzahlen] Lauf fehlgeschlagen:', fehler)
  }
}
