import 'server-only'
import type { PlattformZugang } from '@prisma/client'
import { prisma } from './db'
import { holeSeiten, type MetaSeite } from './meta'
import { fasseSeitenZusammen, type SeiteMitZugang } from './meta-seiten'

/**
 * Die Zugänge, über die Preroll veröffentlicht.
 *
 * Für Meta sind es **mehrere**: Nicht jeder Kunde liegt im selben Portfolio.
 * Wer Seiten von zwei Business Managern bespielt, braucht aus jedem einen
 * eigenen Systemnutzer — ein Token, das alles kann, gibt es dann nicht.
 * `PlattformZugang` war von Anfang an eine Tabelle; hier stand nur die
 * Einzahl davor.
 *
 * Nach außen sieht man davon so wenig wie möglich: Die Seitenauswahl in den
 * Stammdaten zeigt **alle** Seiten aus **allen** Zugängen in einer Liste.
 * Aus welchem Zugang eine Seite stammt, ist eine Frage der Verwaltung, nicht
 * der Zuordnung — wer einen Kunden einrichtet, sucht seine Seite, nicht
 * seinen Business Manager.
 */

/** Alle Meta-Zugänge, älteste zuerst — die Reihenfolge bleibt damit stabil. */
export async function ladeMetaZugaenge(): Promise<PlattformZugang[]> {
  return prisma.plattformZugang.findMany({
    where: { plattform: 'FACEBOOK' },
    orderBy: { erstelltAm: 'asc' },
  })
}

export async function ladeMetaZugang(id: string): Promise<PlattformZugang | null> {
  return prisma.plattformZugang.findUnique({ where: { id } })
}

type Pruefung = { ok: true; seiten: MetaSeite[] } | { ok: false; fehler: string }

/** Das Ergebnis einer Prüfung an den Zugang schreiben — an einer Stelle. */
async function schreibeStand(id: string, geprueft: Pruefung): Promise<void> {
  await prisma.plattformZugang.update({
    where: { id },
    data: {
      geprueftAm: new Date(),
      fehler: geprueft.ok ? null : geprueft.fehler,
      // Ein geheilter Zugang darf beim nächsten Ausfall wieder melden.
      gemeldetAm: geprueft.ok ? null : undefined,
    },
  })
}

async function pruefeToken(token: string): Promise<Pruefung> {
  const geprueft = await holeSeiten(token)
  return geprueft.ok ? { ok: true, seiten: geprueft.daten } : { ok: false, fehler: geprueft.fehler.text }
}

/**
 * Einen weiteren Zugang anlegen und in einem Zug prüfen.
 *
 * Geprüft wird mit `me/accounts` — dem Aufruf, der beim Posten ohnehin die
 * Grundlage bildet. Damit sagt der Test nicht bloß „ein Endpunkt antwortet",
 * sondern zeigt genau die Seiten, die Preroll später bespielen kann.
 *
 * Ein Token, das nicht angenommen wird, bleibt trotzdem gespeichert: Sonst
 * tippt man es beim nächsten Versuch noch einmal ab, obwohl vielleicht nur
 * eine Berechtigung fehlt.
 */
export async function legeMetaZugangAn(token: string, bezeichnung: string): Promise<Pruefung> {
  const geprueft = await pruefeToken(token)

  await prisma.plattformZugang.create({
    data: {
      plattform: 'FACEBOOK',
      art: 'SYSTEMNUTZER',
      bezeichnung,
      token,
      geprueftAm: new Date(),
      fehler: geprueft.ok ? null : geprueft.fehler,
    },
  })

  return geprueft
}

/**
 * Bezeichnung ändern und wahlweise das Token ersetzen.
 *
 * Ein leeres Tokenfeld heißt „unverändert" — das Feld steht in der
 * Oberfläche leer da, weil ein hinterlegtes Token nie zurück in den Browser
 * geht. Wer nur den Namen richtigstellt, soll es nicht neu abtippen müssen.
 */
export async function aktualisiereMetaZugang(
  id: string,
  bezeichnung: string,
  token: string | null,
): Promise<Pruefung> {
  const vorhanden = await ladeMetaZugang(id)
  if (!vorhanden) return { ok: false, fehler: 'Diesen Zugang gibt es nicht mehr.' }

  const geprueft = await pruefeToken(token ?? vorhanden.token)

  await prisma.plattformZugang.update({
    where: { id },
    data: {
      bezeichnung,
      ...(token ? { token } : {}),
      geprueftAm: new Date(),
      fehler: geprueft.ok ? null : geprueft.fehler,
      gemeldetAm: geprueft.ok ? null : undefined,
    },
  })

  return geprueft
}

/** Erneut nachfragen, ohne das Token anzufassen. */
export async function pruefeMetaZugang(id: string): Promise<Pruefung> {
  const zugang = await ladeMetaZugang(id)
  if (!zugang) return { ok: false, fehler: 'Diesen Zugang gibt es nicht mehr.' }

  const geprueft = await pruefeToken(zugang.token)
  await schreibeStand(id, geprueft)
  return geprueft
}

export async function loeseMetaZugang(id: string): Promise<void> {
  // Die Kunden zeigen über `onDelete: SetNull` ins Leere; ihre Seiten-Kennungen
  // bleiben stehen. Das ist Absicht — wer den Zugang neu einrichtet, findet die
  // Zuordnung wieder vor, statt sie bei zwanzig Kunden neu zu klicken.
  await prisma.plattformZugang.deleteMany({ where: { id } })
}

/** Eine Seite, und woher sie kommt. */
export type MetaSeiteMitZugang = SeiteMitZugang

export type ZugangMitSeiten = {
  zugang: PlattformZugang
  seiten: MetaSeite[]
  /** Was Meta beim Abholen gesagt hat — leer heißt: alles in Ordnung. */
  fehler: string | null
}

/**
 * Jeder Zugang mit seinen Seiten — für die Verwaltung in den Einstellungen.
 *
 * Die Zugänge werden **nebeneinander** gefragt: Bei drei Portfolios wartet
 * man sonst dreimal hintereinander auf Meta. Ein hängender Zugang bremst so
 * nur sich selbst.
 */
export async function metaZugaengeMitSeiten(): Promise<ZugangMitSeiten[]> {
  const zugaenge = await ladeMetaZugaenge()

  return Promise.all(
    zugaenge.map(async (zugang) => {
      const geprueft = await pruefeToken(zugang.token)
      return geprueft.ok
        ? { zugang, seiten: geprueft.seiten, fehler: null }
        : { zugang, seiten: [], fehler: geprueft.fehler }
    }),
  )
}

/**
 * Alle erreichbaren Seiten über alle Zugänge — für die Auswahl in den
 * Stammdaten.
 *
 * Fehlt ein Zugang oder klemmt er, fällt nur er aus, nicht die Liste: Die
 * Stammdaten sollen sich auch dann öffnen lassen, wenn ein Business Manager
 * gerade zickt.
 *
 * Zusammengelegt und entdoppelt wird in `fasseSeitenZusammen` — dort steht
 * auch, warum.
 */
export async function metaSeiten(): Promise<MetaSeiteMitZugang[]> {
  const mitSeiten = await metaZugaengeMitSeiten()

  return fasseSeitenZusammen(
    mitSeiten.map(({ zugang, seiten }) => ({
      zugangId: zugang.id,
      zugangName: zugang.bezeichnung,
      seiten,
    })),
  )
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
