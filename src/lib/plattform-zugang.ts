import 'server-only'
import type { PlattformZugang } from '@prisma/client'
import { prisma } from './db'
import { holeSeiten, type MetaSeite } from './meta'

/**
 * Die Zugänge, über die Preroll veröffentlicht.
 *
 * Für Meta gibt es genau **einen** — ein Systemnutzer im eigenen Portfolio,
 * dem nach und nach die Assets aller Kunden zugewiesen werden. Das Modell
 * erlaubt mehrere (`PlattformZugang` ist eine Tabelle, kein Feld), weil
 * LinkedIn und YouTube andere Zuschnitte haben: LinkedIn wieder einen für
 * alle, YouTube einen je Kanal. Bis dahin bleibt es hier bei der Einzahl.
 */

export async function ladeMetaZugang(): Promise<PlattformZugang | null> {
  return prisma.plattformZugang.findFirst({
    where: { plattform: 'FACEBOOK' },
    orderBy: { erstelltAm: 'asc' },
  })
}

/**
 * Token hinterlegen und in einem Zug prüfen.
 *
 * Geprüft wird mit `me/accounts` — dem Aufruf, der beim Posten ohnehin die
 * Grundlage bildet. Damit sagt der Test nicht bloß „ein Endpunkt antwortet",
 * sondern zeigt genau die Seiten, die Preroll später bespielen kann.
 */
export async function speichereMetaToken(
  token: string,
  bezeichnung: string,
): Promise<{ ok: true; seiten: MetaSeite[] } | { ok: false; fehler: string }> {
  const geprueft = await holeSeiten(token)
  const jetzt = new Date()

  const vorhanden = await ladeMetaZugang()
  const daten = {
    plattform: 'FACEBOOK' as const,
    art: 'SYSTEMNUTZER' as const,
    bezeichnung,
    token,
    geprueftAm: jetzt,
    fehler: geprueft.ok ? null : geprueft.fehler.text,
    // Ein geheilter Zugang darf beim nächsten Ausfall wieder melden.
    gemeldetAm: geprueft.ok ? null : undefined,
  }

  if (vorhanden) {
    await prisma.plattformZugang.update({ where: { id: vorhanden.id }, data: daten })
  } else {
    await prisma.plattformZugang.create({ data: daten })
  }

  // Ein Token, das nicht angenommen wird, bleibt trotzdem gespeichert: Sonst
  // tippt man es beim nächsten Versuch noch einmal ab, obwohl vielleicht nur
  // eine Berechtigung fehlt.
  return geprueft.ok ? { ok: true, seiten: geprueft.daten } : { ok: false, fehler: geprueft.fehler.text }
}

/** Erneut nachfragen, ohne das Token anzufassen. */
export async function pruefeMetaZugang(): Promise<
  { ok: true; seiten: MetaSeite[] } | { ok: false; fehler: string }
> {
  const zugang = await ladeMetaZugang()
  if (!zugang) return { ok: false, fehler: 'Es ist kein Meta-Zugang hinterlegt.' }

  const geprueft = await holeSeiten(zugang.token)
  await prisma.plattformZugang.update({
    where: { id: zugang.id },
    data: {
      geprueftAm: new Date(),
      fehler: geprueft.ok ? null : geprueft.fehler.text,
      gemeldetAm: geprueft.ok ? null : undefined,
    },
  })

  return geprueft.ok ? { ok: true, seiten: geprueft.daten } : { ok: false, fehler: geprueft.fehler.text }
}

export async function loeseMetaZugang(): Promise<void> {
  const zugang = await ladeMetaZugang()
  if (!zugang) return

  // Die Kunden zeigen über `onDelete: SetNull` ins Leere; ihre Seiten-Kennungen
  // bleiben stehen. Das ist Absicht — wer den Zugang neu einrichtet, findet die
  // Zuordnung wieder vor, statt sie bei zwanzig Kunden neu zu klicken.
  await prisma.plattformZugang.delete({ where: { id: zugang.id } })
}

/**
 * Die Seiten des hinterlegten Zugangs — für die Auswahl in den Stammdaten.
 *
 * Fehlt der Zugang oder klemmt er, kommt eine leere Liste statt eines Fehlers:
 * Die Stammdaten sollen sich auch dann öffnen lassen, wenn Meta gerade zickt.
 */
export async function metaSeiten(): Promise<MetaSeite[]> {
  const zugang = await ladeMetaZugang()
  if (!zugang) return []

  const geprueft = await holeSeiten(zugang.token)
  return geprueft.ok ? geprueft.daten : []
}

/**
 * Welche Kunden an einem kaputten Zugang hängen — für die Meldung im Backend.
 * „Meta geht nicht" wäre nutzlos; „betrifft diese vier Kunden" ist eine
 * Auskunft, mit der jemand etwas anfangen kann.
 */
export async function kundenAmZugang(zugangId: string): Promise<Array<{ slug: string; name: string }>> {
  return prisma.kunde.findMany({
    where: { metaZugangId: zugangId, archiviert: false, postenAktiv: true },
    orderBy: { name: 'asc' },
    select: { slug: true, name: true },
  })
}
