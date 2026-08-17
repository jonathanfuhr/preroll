import 'server-only'
import { createWriteStream } from 'node:fs'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { ladeEinstellungen } from './einstellungen'

export { klappeVideoBeschreibung, klappeVideoName } from './klappe-namen'

/**
 * Anbindung an Klappe (`jonathanfuhr/klappe`, API-Fassung 1.3).
 *
 * Angemeldet wird über die Gerätekopplung: Preroll meldet ein „Gerät" an, ein
 * Mensch bestätigt es im Browser, danach gilt ein Bearer-Token. Genau der Weg,
 * den auch die Schnittprogramm-Plugins gehen.
 */

// -------------------------------------------------------------------- Typen

export type KlappeProjekt = {
  id: string
  name: string
  customer: string | null
  description: string | null
  videoCount: number
  archivedAt: string | null
}

export type KlappeFassung = {
  id: string
  videoId: string
  versionNumber: number
  label: string | null
  status: string
  isFinal: boolean
  internal: boolean
  createdAt: string
  hasPoster: boolean
  originalFilename: string
  webUrl?: string
  media: {
    durationSeconds: number | null
    width: number | null
    height: number | null
    frameRate: unknown
  }
}

export type KlappeVideo = {
  id: string
  projectId: string
  projectName: string | null
  name: string
  description: string | null
  versionCount: number
  latestVersion: KlappeFassung | null
  webUrl?: string
  updatedAt: string
}

export type KlappeAntwort<T> = { ok: true; daten: T } | { ok: false; fehler: string }

// ------------------------------------------------------------- Grundgerüst

type Zugang = { basisUrl: string; medienUrl: string; token: string }

async function zugang(): Promise<Zugang | null> {
  const e = await ladeEinstellungen()
  if (!e.klappeBasisUrl || !e.klappeApiKey) return null
  const basisUrl = e.klappeBasisUrl.replace(/\/$/, '')
  return {
    basisUrl,
    // Videodaten nehmen den kurzen Weg, wenn einer eingetragen ist. Warum das
    // nicht bloß Feinschliff ist, steht am Feld `klappeMedienUrl` im Schema.
    medienUrl: e.klappeMedienUrl?.trim().replace(/\/$/, '') || basisUrl,
    token: e.klappeApiKey,
  }
}

export async function klappeEingerichtet(): Promise<boolean> {
  return (await zugang()) !== null
}

async function anfrage<T>(
  pfad: string,
  optionen: { methode?: string; koerper?: unknown } = {},
): Promise<KlappeAntwort<T>> {
  const z = await zugang()
  if (!z) return { ok: false, fehler: 'Klappe ist nicht eingerichtet (Einstellungen → Klappe).' }

  return roheAnfrage<T>(z.basisUrl, z.token, pfad, optionen)
}

async function roheAnfrage<T>(
  basisUrl: string,
  token: string,
  pfad: string,
  optionen: { methode?: string; koerper?: unknown } = {},
): Promise<KlappeAntwort<T>> {
  try {
    const antwort = await fetch(`${basisUrl}/v1${pfad}`, {
      method: optionen.methode ?? 'GET',
      headers: {
        authorization: `Bearer ${token}`,
        ...(optionen.koerper ? { 'content-type': 'application/json' } : {}),
      },
      body: optionen.koerper ? JSON.stringify(optionen.koerper) : undefined,
      cache: 'no-store',
    })

    if (antwort.status === 401) {
      return { ok: false, fehler: 'Klappe hat die Anmeldung abgelehnt — bitte neu koppeln.' }
    }
    if (!antwort.ok) {
      const text = await antwort.text()
      return { ok: false, fehler: `Klappe antwortete ${antwort.status}: ${text.slice(0, 300)}` }
    }
    if (antwort.status === 204) return { ok: true, daten: undefined as T }

    return { ok: true, daten: (await antwort.json()) as T }
  } catch (fehler) {
    return { ok: false, fehler: `Klappe ist nicht erreichbar: ${(fehler as Error).message}` }
  }
}

// -------------------------------------------------------------- Kopplung

type KopplungStart = {
  deviceCode: string
  userCode: string
  verificationUrl: string
  verificationUrlComplete: string
  expiresInSeconds: number
  intervalSeconds: number
}

/** Schritt 1 der Gerätekopplung — liefert den Code, den ein Mensch bestätigt. */
export async function kopplungStarten(
  basisUrl: string,
  clientName = 'Preroll',
): Promise<KlappeAntwort<KopplungStart>> {
  try {
    const antwort = await fetch(`${basisUrl.replace(/\/$/, '')}/v1/auth/geraet/start`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ clientName }),
    })
    if (!antwort.ok) {
      return {
        ok: false,
        fehler: `Klappe antwortete ${antwort.status}. Ist die externe Anbindung freigeschaltet?`,
      }
    }
    return { ok: true, daten: (await antwort.json()) as KopplungStart }
  } catch (fehler) {
    return { ok: false, fehler: `Klappe ist nicht erreichbar: ${(fehler as Error).message}` }
  }
}

/** Schritt 3 — das Token gibt es genau einmal, sobald bestätigt wurde. */
export async function kopplungAbholen(
  basisUrl: string,
  deviceCode: string,
): Promise<KlappeAntwort<{ token: string }>> {
  try {
    const antwort = await fetch(`${basisUrl.replace(/\/$/, '')}/v1/auth/geraet/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ deviceCode }),
    })
    const daten = (await antwort.json().catch(() => ({}))) as {
      token?: string
      error?: string
      message?: string
    }

    if (!antwort.ok || !daten.token) {
      // Solange niemand bestätigt hat, antwortet Klappe mit einer Wartemeldung.
      return { ok: false, fehler: daten.message ?? daten.error ?? 'Noch nicht bestätigt.' }
    }
    return { ok: true, daten: { token: daten.token } }
  } catch (fehler) {
    return { ok: false, fehler: `Klappe ist nicht erreichbar: ${(fehler as Error).message}` }
  }
}

export async function klappeKonto(
  basisUrl?: string,
  token?: string,
): Promise<KlappeAntwort<{ name: string; email: string }>> {
  if (basisUrl && token) return roheAnfrage(basisUrl, token, '/auth/me')
  return anfrage('/auth/me')
}

// ------------------------------------------------------------ Lesen

export async function klappeProjekte(): Promise<KlappeAntwort<KlappeProjekt[]>> {
  return anfrage<KlappeProjekt[]>('/projects?sort=name')
}

/**
 * Videos eines Projekts. Bewusst immer projektbezogen — würde Preroll alle
 * Videos aller Kunden zeigen, wäre die Auswahl nach kurzer Zeit unbrauchbar.
 */
export async function klappeVideos(projektId: string): Promise<KlappeAntwort<KlappeVideo[]>> {
  return anfrage<KlappeVideo[]>(`/projects/${encodeURIComponent(projektId)}/videos`)
}

export async function klappeVideo(videoId: string): Promise<KlappeAntwort<KlappeVideo>> {
  return anfrage<KlappeVideo>(`/videos/${encodeURIComponent(videoId)}`)
}

export async function klappeFassungen(videoId: string): Promise<KlappeAntwort<KlappeFassung[]>> {
  return anfrage<KlappeFassung[]>(`/videos/${encodeURIComponent(videoId)}/versions`)
}

// ------------------------------------------------------------ Schreiben

/**
 * Legt in Klappe ein Video an. Wird beim Konzipieren eines Reels aufgerufen,
 * damit beim späteren Upload aus dem Schnitt kein Name mehr getippt werden
 * muss — das Video wartet dort schon unter dem richtigen Namen.
 */
export async function klappeVideoAnlegen(
  projektId: string,
  name: string,
  beschreibung?: string,
): Promise<KlappeAntwort<KlappeVideo>> {
  return anfrage<KlappeVideo>(`/projects/${encodeURIComponent(projektId)}/videos`, {
    methode: 'POST',
    koerper: { name, description: beschreibung ?? null },
  })
}

export async function klappeVideoUmbenennen(
  videoId: string,
  name: string,
  beschreibung?: string,
): Promise<KlappeAntwort<KlappeVideo>> {
  return anfrage<KlappeVideo>(`/videos/${encodeURIComponent(videoId)}`, {
    methode: 'PATCH',
    koerper: { name, ...(beschreibung === undefined ? {} : { description: beschreibung }) },
  })
}

// ------------------------------------------------------------ Medien

/**
 * Die Fassung eines Reels fürs ZIP — erst vollständig auf die Platte, dann ins
 * Archiv. Ein ZIP mit fehlendem Reel wäre für den Zeitplaner wertlos.
 *
 * Bewusst **nicht** direkt in das Archiv gestreamt, wie es hier einmal stand:
 * Bricht der Strom auf halbem Weg ab — bei uns als `TypeError: terminated` mit
 * `NGHTTP2_PROTOCOL_ERROR` —, reißt er das ganze Archiv mit, denn der Eintrag
 * ist dann halb geschrieben und lässt sich nicht mehr überspringen. Über eine
 * Zwischendatei ist der Fehlschlag ein fehlendes Video statt eines kaputten
 * Downloads, und der Rest des Archivs bleibt brauchbar.
 *
 * Die Zeitgrenze gilt für den ganzen Abruf. Über den kurzen Weg
 * (`klappeMedienUrl`) braucht eine 115-MB-Fassung gut eine Sekunde; wer hier
 * in die Grenze läuft, hat ein anderes Problem als eine langsame Leitung.
 */
export async function klappeVideoFuersZip(
  fassungId: string,
  art: 'original' | 'proxy',
  zeitgrenzeMs = 120_000,
): Promise<{ pfad: string; endung: string } | null> {
  const antwort = await klappeMedium(fassungId, art, null, AbortSignal.timeout(zeitgrenzeMs))
  if (!antwort?.ok || !antwort.body) return null

  const typ = antwort.headers.get('content-type') ?? ''
  const endung = typ.includes('quicktime') ? 'mov' : typ.includes('webm') ? 'webm' : 'mp4'
  const pfad = path.join(os.tmpdir(), `klappe-${fassungId}-${Date.now()}.${endung}`)

  try {
    await pipeline(
      Readable.fromWeb(antwort.body as Parameters<typeof Readable.fromWeb>[0]),
      createWriteStream(pfad),
    )
    return { pfad, endung }
  } catch (fehler) {
    console.warn('[klappe] Fassung nicht vollständig geladen:', fassungId, fehler)
    await fs.rm(pfad, { force: true }).catch(() => undefined)
    return null
  }
}

/** Abspielfassung, Original oder Posterframe einer Fassung durchreichen. */
export async function klappeMedium(
  fassungId: string,
  art: 'proxy' | 'original' | 'poster',
  bereich?: string | null,
  abbruch?: AbortSignal,
): Promise<Response | null> {
  const z = await zugang()
  if (!z) return null

  const kopfzeilen: Record<string, string> = { authorization: `Bearer ${z.token}` }
  if (bereich) kopfzeilen.range = bereich

  const pfad = art === 'poster' ? 'poster' : art
  try {
    return await fetch(
      `${z.medienUrl}/v1/versions/${encodeURIComponent(fassungId)}/${pfad}${
        art === 'original' ? '?inline=1' : ''
      }`,
      { headers: kopfzeilen, cache: 'no-store', signal: abbruch },
    )
  } catch {
    return null
  }
}
