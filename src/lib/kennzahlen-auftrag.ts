import 'server-only'
import type { KennzahlenQuelle, Plattform } from '@prisma/client'
import { prisma } from './db'
import { ladeEinstellungen, speichereEinstellungen } from './einstellungen'
import { holeProfilwerte as holeInstagram } from './instagram-kennzahlen'
import { holeProfilwerte as holeTikTok } from './tiktok-kennzahlen'
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
 * **Geholt wird von Instagram und TikTok**, beide ohne Anmeldung von der
 * öffentlichen Profilseite. Facebook und LinkedIn bleiben von Hand gepflegt:
 * Für sie gibt es keinen Weg ohne genehmigte App. Welche Plattform an der
 * Reihe ist, entscheidet allein das Alter — die Warteschlange ist eine, nicht
 * eine je Anbieter.
 */

const LAUFABSTAND = 20 * 60_000
const HALTBARKEIT = 20 * 3600_000

/**
 * Die Plattformen, deren Zahlen Preroll selbst holt — samt Abruf und Quelle
 * fürs Protokoll. An einer Stelle, damit „welche gehen automatisch" nicht an
 * drei Stellen leicht verschieden beantwortet wird.
 */
const ABRUFBAR = {
  INSTAGRAM: { hole: holeInstagram, quelle: 'INSTAGRAM_WEB' as KennzahlenQuelle },
  TIKTOK: { hole: holeTikTok, quelle: 'TIKTOK_WEB' as KennzahlenQuelle },
} satisfies Partial<Record<Plattform, unknown>>

export type AbrufbarePlattform = keyof typeof ABRUFBAR

export function istAbrufbar(plattform: Plattform): plattform is AbrufbarePlattform {
  return plattform in ABRUFBAR
}

export const ABRUFBARE_PLATTFORMEN = Object.keys(ABRUFBAR) as AbrufbarePlattform[]

export type Aktualisierung =
  | { ok: true; follower: number | null }
  | { ok: false; fehler: string }

/** Holt ein Profil und schreibt Stammdaten wie Tageswert fort. */
export async function aktualisiereKennzahlen(
  kundeId: string,
  plattform: AbrufbarePlattform = 'INSTAGRAM',
): Promise<Aktualisierung> {
  const { hole, quelle } = ABRUFBAR[plattform]

  const kunde = await prisma.kunde.findUnique({
    where: { id: kundeId },
    select: {
      id: true,
      logoId: true,
      profile: { where: { plattform }, select: { handle: true } },
    },
  })
  if (!kunde) return { ok: false, fehler: 'Kunde nicht gefunden.' }

  const handle = kunde.profile[0]?.handle?.trim()
  if (!handle) {
    return { ok: false, fehler: `Für diesen Kunden ist kein ${plattform === 'TIKTOK' ? 'TikTok' : 'Instagram'}-Handle hinterlegt.` }
  }

  const ergebnis = await hole(handle)
  // Bewusst ohne `merkeAbgelaufen`: Gefragt wird ohne Sitzung, ein
  // Fehlschlag sagt also nichts über sie aus. Die erste Fassung meldete hier
  // eine abgelaufene Sitzung — und das rote Band im Backend behauptete, die
  // Referenzvideos gingen nicht, obwohl sie gingen.
  if (!ergebnis.ok) return { ok: false, fehler: ergebnis.fehler }

  const { werte } = ergebnis
  const jetzt = new Date()
  // Nur TikTok führt diese Zahl; bei Instagram gibt es sie nicht.
  const likes = 'likes' in werte ? werte.likes : null

  await prisma.plattformProfil.update({
    where: { kundeId_plattform: { kundeId, plattform } },
    data: {
      follower: werte.follower,
      gefolgt: werte.gefolgt,
      beitraege: werte.beitraege,
      ...(likes === null ? {} : { likes }),
      // Bio und Website nur übernehmen, wenn die Quelle etwas liefert — ein
      // leeres Feld dort soll eine gepflegte Angabe hier nicht löschen.
      ...(werte.bio ? { bio: werte.bio } : {}),
      ...('website' in werte && werte.website ? { website: werte.website } : {}),
      standAm: jetzt,
      quelle,
    },
  })

  // Ein Tageswert je Kunde und Plattform — mehrere Läufe am selben Tag
  // überschreiben ihn.
  const tag = new Date(Date.UTC(jetzt.getFullYear(), jetzt.getMonth(), jetzt.getDate()))
  const zahlen = {
    follower: werte.follower,
    gefolgt: werte.gefolgt,
    beitraege: werte.beitraege,
    likes,
    quelle,
  }
  await prisma.kennzahlVerlauf.upsert({
    where: { kundeId_plattform_datum: { kundeId, plattform, datum: tag } },
    create: { kundeId, plattform, datum: tag, ...zahlen },
    update: zahlen,
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
      Eine Warteschlange über beide Plattformen, nicht eine je Anbieter: Sonst
      käme TikTok bei vielen Kunden nie an die Reihe, weil Instagram den Takt
      belegt. Das am längsten Ungeprüfte zuerst; `null` sortiert Prisma nach
      vorn, und ein frisch eingetragenes Profil ist damit sofort dran.
    */
    const faellig = await prisma.plattformProfil.findFirst({
      where: {
        plattform: { in: ABRUFBARE_PLATTFORMEN },
        handle: { not: null },
        kunde: { archiviert: false },
        OR: [{ standAm: null }, { standAm: { lt: new Date(Date.now() - HALTBARKEIT) } }],
      },
      orderBy: { standAm: 'asc' },
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
