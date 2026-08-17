import 'server-only'
import type { PlattformZugang } from '@prisma/client'
import { prisma } from './db'
import { ladeEinstellungen } from './einstellungen'
import {
  brauchtErneuerung,
  frischeToken,
  holeOrganisationen,
  type LinkedInOrganisation,
} from './linkedin'

/**
 * Der LinkedIn-Zugang — genau **einer**, anders als bei Meta.
 *
 * Bei Meta braucht es je Business-Portfolio einen Systemnutzer, deshalb steht
 * dort eine Liste. Bei LinkedIn hängt alles an einem Mitgliedskonto, das an
 * den Firmenseiten der Kunden als Administrator eingetragen ist — genau das
 * Konto, das die Agentur ohnehin führt. Ein zweites wäre kein anderer Zugang,
 * sondern ein anderer Mensch.
 *
 * Erneuert wird **vor** dem Gebrauch, nicht nach einem 401: Ein Token, der
 * mitten in einem Upload abläuft, hinterlässt ein halb angelegtes Bild bei
 * LinkedIn und einen Fehlschlag, dessen Ursache niemand am Text erkennt.
 */

export async function ladeLinkedInZugang(): Promise<PlattformZugang | null> {
  return prisma.plattformZugang.findFirst({ where: { plattform: 'LINKEDIN' } })
}

/** Sind die App-Daten hinterlegt? Ohne sie gibt es keinen Autorisierungsablauf. */
export async function linkedInAppSteht(): Promise<boolean> {
  const e = await ladeEinstellungen()
  return Boolean(e.linkedinClientId && e.linkedinClientSecret)
}

/** Steht ein verbundener Zugang bereit? Danach richtet sich die Plattformwahl. */
export async function linkedInEingerichtet(): Promise<boolean> {
  return (await ladeLinkedInZugang()) !== null
}

/**
 * Den Zugang nach dem Autorisierungsablauf ablegen. Es gibt nur einen — ein
 * zweiter Durchlauf ersetzt ihn, statt einen zweiten anzulegen, von dem
 * niemand wüsste, welcher gilt.
 */
export async function speichereLinkedInZugang(satz: {
  token: string
  auffrischToken: string | null
  gueltigBis: Date
  bezeichnung: string
}): Promise<PlattformZugang> {
  const vorhanden = await ladeLinkedInZugang()

  const daten = {
    plattform: 'LINKEDIN' as const,
    art: 'PERSON' as const,
    bezeichnung: satz.bezeichnung,
    token: satz.token,
    auffrischToken: satz.auffrischToken,
    gueltigBis: satz.gueltigBis,
    geprueftAm: new Date(),
    fehler: null,
    gemeldetAm: null,
  }

  return vorhanden
    ? prisma.plattformZugang.update({ where: { id: vorhanden.id }, data: daten })
    : prisma.plattformZugang.create({ data: daten })
}

export async function loeseLinkedInZugang(): Promise<void> {
  const vorhanden = await ladeLinkedInZugang()
  if (vorhanden) await prisma.plattformZugang.delete({ where: { id: vorhanden.id } })
}

/**
 * Ein brauchbares Token — erneuert, falls es bald abläuft.
 *
 * Gibt `null` zurück, wenn gar kein Zugang steht. Scheitert die Erneuerung,
 * kommt das **alte** Token zurück: Es gilt möglicherweise noch, und ein
 * Fehlschlag beim Auffrischen ist kein Grund, einen Beitrag gar nicht erst zu
 * versuchen. Der Grund landet am Zugang, damit die Administration ihn sieht.
 */
export async function gueltigesToken(): Promise<string | null> {
  const zugang = await ladeLinkedInZugang()
  if (!zugang) return null
  if (!brauchtErneuerung(zugang.gueltigBis) || !zugang.auffrischToken) return zugang.token

  const e = await ladeEinstellungen()
  if (!e.linkedinClientId || !e.linkedinClientSecret) return zugang.token

  const frisch = await frischeToken({
    auffrischToken: zugang.auffrischToken,
    clientId: e.linkedinClientId,
    clientSecret: e.linkedinClientSecret,
  })

  if (!frisch.ok) {
    await prisma.plattformZugang.update({
      where: { id: zugang.id },
      data: { fehler: `Erneuerung fehlgeschlagen: ${frisch.fehler.text}`, geprueftAm: new Date() },
    })
    return zugang.token
  }

  await prisma.plattformZugang.update({
    where: { id: zugang.id },
    data: {
      token: frisch.daten.token,
      // LinkedIn schickt beim Auffrischen nicht immer ein neues — dann gilt
      // das alte weiter. Es mit `null` zu überschreiben hieße, den Zugang beim
      // nächsten Mal nicht mehr erneuern zu können.
      auffrischToken: frisch.daten.auffrischToken ?? zugang.auffrischToken,
      gueltigBis: frisch.daten.gueltigBis,
      geprueftAm: new Date(),
      fehler: null,
      gemeldetAm: null,
    },
  })

  return frisch.daten.token
}

export type OrgPruefung =
  | { ok: true; organisationen: LinkedInOrganisation[] }
  | { ok: false; fehler: string }

/**
 * Die Firmenseiten am Zugang — und dabei gleich der Prüfstand.
 *
 * Wie bei Meta prüft der Test mit dem Aufruf, den das Posten ohnehin braucht:
 * Er sagt nicht bloß „ein Endpunkt antwortet", sondern zeigt genau die Seiten,
 * die Preroll bespielen kann.
 */
export async function linkedInOrganisationen(): Promise<OrgPruefung> {
  const zugang = await ladeLinkedInZugang()
  if (!zugang) return { ok: false, fehler: 'Es ist kein LinkedIn-Zugang verbunden.' }

  const token = await gueltigesToken()
  if (!token) return { ok: false, fehler: 'Es ist kein LinkedIn-Zugang verbunden.' }

  const geholt = await holeOrganisationen(token)

  await prisma.plattformZugang.update({
    where: { id: zugang.id },
    data: {
      geprueftAm: new Date(),
      fehler: geholt.ok ? null : geholt.fehler.text,
      gemeldetAm: geholt.ok ? null : undefined,
    },
  })

  return geholt.ok
    ? { ok: true, organisationen: geholt.daten }
    : { ok: false, fehler: geholt.fehler.text }
}

/** Kunden, die an diesem Zugang hängen — für die Warnung vor dem Lösen. */
export async function kundenAmLinkedInZugang(): Promise<Array<{ slug: string; name: string }>> {
  const zugang = await ladeLinkedInZugang()
  if (!zugang) return []
  return prisma.kunde.findMany({
    where: { liZugangId: zugang.id },
    orderBy: { name: 'asc' },
    select: { slug: true, name: true },
  })
}
