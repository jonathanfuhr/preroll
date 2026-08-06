import 'server-only'
import { Readable } from 'node:stream'
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

type Zugang = { basisUrl: string; token: string }

async function zugang(): Promise<Zugang | null> {
  const e = await ladeEinstellungen()
  if (!e.klappeBasisUrl || !e.klappeApiKey) return null
  return { basisUrl: e.klappeBasisUrl.replace(/\/$/, ''), token: e.klappeApiKey }
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
 * Die Fassung eines Reels für den ZIP-Export. Liegt das Video nur als
 * Klappe-Stream vor, wird es im Moment des Exports von dort durchgereicht —
 * ein ZIP mit fehlendem Reel wäre für den Scheduler wertlos.
 */
export async function klappeVideoFuersZip(
  fassungId: string,
  art: 'original' | 'proxy',
): Promise<{ strom: Readable; endung: string } | null> {
  const antwort = await klappeMedium(fassungId, art)
  if (!antwort?.ok || !antwort.body) return null

  const typ = antwort.headers.get('content-type') ?? ''
  const endung = typ.includes('quicktime') ? 'mov' : typ.includes('webm') ? 'webm' : 'mp4'
  return {
    strom: Readable.fromWeb(antwort.body as Parameters<typeof Readable.fromWeb>[0]),
    endung,
  }
}

/** Abspielfassung, Original oder Posterframe einer Fassung durchreichen. */
export async function klappeMedium(
  fassungId: string,
  art: 'proxy' | 'original' | 'poster',
  bereich?: string | null,
): Promise<Response | null> {
  const z = await zugang()
  if (!z) return null

  const kopfzeilen: Record<string, string> = { authorization: `Bearer ${z.token}` }
  if (bereich) kopfzeilen.range = bereich

  const pfad = art === 'poster' ? 'poster' : art
  try {
    return await fetch(
      `${z.basisUrl}/v1/versions/${encodeURIComponent(fassungId)}/${pfad}${
        art === 'original' ? '?inline=1' : ''
      }`,
      { headers: kopfzeilen, cache: 'no-store' },
    )
  } catch {
    return null
  }
}
