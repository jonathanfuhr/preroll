import 'server-only'
import { prisma } from './db'
import { ladeEinstellungen, speichereEinstellungen } from './einstellungen'
import { holeProfilwerte } from './instagram-kennzahlen'
import { merkeAbgelaufen } from './instagram'
import { speichereMedium } from './medien'

/**
 * Die Kennzahlen aktuell halten.
 *
 * Preroll hat keinen Zeitplaner — angestoßen wird beim Aufruf des Backends,
 * genau wie die Wache über die Instagram-Sitzung. Damit das die Sitzung nicht
 * strapaziert, gilt doppelt gebremst: **ein Profil je Lauf**, und Läufe
 * höchstens alle 20 Minuten. Bei einer Handvoll Kunden ist damit jedes Profil
 * längst vor dem Tagesende einmal dran; bei siebzig immer noch.
 *
 * Ein Profil wird geholt, wenn seine Zahlen älter als 20 Stunden sind — nicht
 * „älter als 24", sonst rutscht der Termin mit jedem Tag später und trifft
 * irgendwann die Nacht.
 */

const LAUFABSTAND = 20 * 60_000
const HALTBARKEIT = 20 * 3600_000

export type Aktualisierung =
  | { ok: true; follower: number | null }
  | { ok: false; fehler: string }

/** Holt ein Profil und schreibt Stammdaten wie Tageswert fort. */
export async function aktualisiereKennzahlen(kundeId: string): Promise<Aktualisierung> {
  const kunde = await prisma.kunde.findUnique({
    where: { id: kundeId },
    select: { id: true, handle: true, logoId: true },
  })
  if (!kunde) return { ok: false, fehler: 'Kunde nicht gefunden.' }
  if (!kunde.handle?.trim()) {
    return { ok: false, fehler: 'Für diesen Kunden ist kein Instagram-Handle hinterlegt.' }
  }

  const ergebnis = await holeProfilwerte(kunde.handle)
  if (!ergebnis.ok) {
    // Eine tote Sitzung gehört in die Einstellungen und ins Warnband, nicht
    // nur an diesen einen Kunden — genau wie beim Referenzvideo.
    if (ergebnis.abgelaufen) await merkeAbgelaufen()
    return { ok: false, fehler: ergebnis.fehler }
  }

  const { werte } = ergebnis
  const jetzt = new Date()

  await prisma.kunde.update({
    where: { id: kundeId },
    data: {
      follower: werte.follower,
      gefolgt: werte.gefolgt,
      beitraege: werte.beitraege,
      // Bio und Website nur übernehmen, wenn Instagram etwas liefert —
      // ein leeres Feld dort soll eine gepflegte Angabe hier nicht löschen.
      ...(werte.bio ? { bio: werte.bio } : {}),
      ...(werte.website ? { website: werte.website } : {}),
      kennzahlenAm: jetzt,
      kennzahlenTyp: 'INSTAGRAM_WEB',
    },
  })

  // Ein Tageswert je Kunde — mehrere Läufe am selben Tag überschreiben ihn.
  const tag = new Date(Date.UTC(jetzt.getFullYear(), jetzt.getMonth(), jetzt.getDate()))
  await prisma.kennzahlVerlauf.upsert({
    where: { kundeId_datum: { kundeId, datum: tag } },
    create: {
      kundeId,
      datum: tag,
      follower: werte.follower,
      gefolgt: werte.gefolgt,
      beitraege: werte.beitraege,
      quelle: 'INSTAGRAM_WEB',
    },
    update: {
      follower: werte.follower,
      gefolgt: werte.gefolgt,
      beitraege: werte.beitraege,
      quelle: 'INSTAGRAM_WEB',
    },
  })

  // Das Profilbild nur, wenn noch keines hinterlegt ist — wer eines
  // ausgetauscht hat, will es behalten. Dieselbe Regel wie bei M365.
  if (!kunde.logoId && werte.profilbildUrl) {
    await uebernimmProfilbild(kundeId, werte.profilbildUrl).catch(() => {})
  }

  return { ok: true, follower: werte.follower }
}

async function uebernimmProfilbild(kundeId: string, url: string): Promise<void> {
  const antwort = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(20_000) })
  if (!antwort.ok) return

  const inhalt = Buffer.from(await antwort.arrayBuffer())
  if (inhalt.byteLength === 0) return

  const { medium } = await speichereMedium({
    inhalt,
    dateiname: 'instagram-profilbild.jpg',
    mimeTyp: antwort.headers.get('content-type')?.split(';')[0] ?? 'image/jpeg',
    kundeId,
  })
  await prisma.kunde.update({ where: { id: kundeId }, data: { logoId: medium.id } })
}

/**
 * Angestoßen vom Team-Layout: Ist ein Lauf fällig, wird **ein** Profil
 * nachgezogen. Wirft nie — eine Seite darf nicht daran scheitern, dass
 * Instagram gerade zickt.
 */
export async function wacheUeberKennzahlen(): Promise<void> {
  try {
    const e = await ladeEinstellungen()
    if (!e.kennzahlenAktiv || !e.instagramCookies?.trim()) return

    if (e.kennzahlenLaufAm && Date.now() - e.kennzahlenLaufAm.getTime() < LAUFABSTAND) return

    const faellig = await prisma.kunde.findFirst({
      where: {
        archiviert: false,
        handle: { not: null },
        OR: [
          { kennzahlenAm: null },
          { kennzahlenAm: { lt: new Date(Date.now() - HALTBARKEIT) } },
        ],
      },
      // Das am längsten Ungeprüfte zuerst; `null` sortiert Prisma nach vorn.
      orderBy: { kennzahlenAm: 'asc' },
      select: { id: true },
    })
    if (!faellig) return

    // Sofort vormerken, damit nicht mehrere Seitenaufrufe gleichzeitig losziehen.
    await speichereEinstellungen({ kennzahlenLaufAm: new Date() })
    await aktualisiereKennzahlen(faellig.id)
  } catch (fehler) {
    console.warn('[kennzahlen] Lauf fehlgeschlagen:', fehler)
  }
}
