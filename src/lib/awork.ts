import 'server-only'
import { ladeEinstellungen } from './einstellungen'

/**
 * Anbindung an awork — das Projektmanagement, in dem die Aufträge ohnehin
 * liegen. Gebaut ist bislang nur die Verbindung: Schlüssel hinterlegen,
 * Verbindung prüfen, Projekte lesen. Was Preroll dorthin schreibt — Aufgaben
 * zu Kundenkommentaren, Meldungen als Projektkommentar — ist noch nicht
 * entschieden und deshalb bewusst nicht vorweggenommen.
 *
 * Der Zuschnitt folgt Klappe, ist aber schlanker: Preroll hat keinen Worker,
 * und ohne festgelegte Ereignisse braucht es keinen Ereignis-Katalog.
 */

export const AWORK_BASIS = 'https://api.awork.com/api/v1'

const ZEITLIMIT_MS = 20_000
const VERSUCHE = 3
const WARTE_MS = 1_000

export class AworkFehler extends Error {
  constructor(
    nachricht: string,
    readonly status: number | null,
    /** Lohnt ein weiterer Versuch? Netz, 429 und 5xx: ja. */
    readonly nochmal: boolean,
  ) {
    super(nachricht)
    this.name = 'AworkFehler'
  }
}

function warte(ms: number): Promise<void> {
  return new Promise((fertig) => setTimeout(fertig, ms))
}

/** awork nennt bei 429 selbst die Wartezeit — die zu nehmen ist nicht nur höflich. */
function wartezeitAus(antwort: Response): number | null {
  const kopf = antwort.headers.get('retry-after') ?? antwort.headers.get('x-ratelimit-reset')
  if (!kopf) return null
  const sekunden = Number(kopf)
  return Number.isFinite(sekunden) ? sekunden * 1000 : null
}

async function fehlerAus(antwort: Response): Promise<AworkFehler> {
  let text = ''
  try {
    text = await antwort.text()
  } catch {
    // Antwort ohne lesbaren Rumpf — der Statuscode allein muss reichen.
  }

  const nachricht =
    antwort.status === 401 || antwort.status === 403
      ? 'awork hat den Schlüssel abgelehnt. Bitte prüfen, ob er noch gültig ist.'
      : `awork antwortet mit ${antwort.status}${text ? `: ${text.slice(0, 200)}` : ''}`

  return new AworkFehler(nachricht, antwort.status, antwort.status === 429 || antwort.status >= 500)
}

async function anfrage<T>(
  pfad: string,
  schluessel: string,
  optionen: { methode?: 'GET' | 'POST'; rumpf?: unknown; abfrage?: Record<string, string | number> } = {},
): Promise<T> {
  const url = new URL(`${AWORK_BASIS}${pfad}`)
  for (const [name, wert] of Object.entries(optionen.abfrage ?? {})) {
    url.searchParams.set(name, String(wert))
  }

  let letzterFehler: AworkFehler | null = null

  for (let versuch = 1; versuch <= VERSUCHE; versuch++) {
    try {
      const antwort = await fetch(url, {
        method: optionen.methode ?? 'GET',
        headers: {
          authorization: `Bearer ${schluessel}`,
          accept: 'application/json',
          ...(optionen.rumpf === undefined ? {} : { 'content-type': 'application/json' }),
        },
        ...(optionen.rumpf === undefined ? {} : { body: JSON.stringify(optionen.rumpf) }),
        signal: AbortSignal.timeout(ZEITLIMIT_MS),
      })

      if (antwort.ok) {
        if (antwort.status === 204) return undefined as T
        const text = await antwort.text()
        return (text ? JSON.parse(text) : undefined) as T
      }

      const fehler = await fehlerAus(antwort)
      if (!fehler.nochmal) throw fehler
      letzterFehler = fehler

      if (versuch < VERSUCHE) {
        await warte(wartezeitAus(antwort) ?? WARTE_MS * 2 ** (versuch - 1))
      }
    } catch (fehler) {
      if (fehler instanceof AworkFehler) {
        if (!fehler.nochmal) throw fehler
        letzterFehler = fehler
      } else {
        // Netz, DNS, Zeitablauf — alles Gründe, es gleich noch einmal zu versuchen.
        const text = fehler instanceof Error ? fehler.message : String(fehler)
        letzterFehler = new AworkFehler(`awork ist nicht erreichbar: ${text}`, null, true)
      }
      if (versuch < VERSUCHE) await warte(WARTE_MS * 2 ** (versuch - 1))
    }
  }

  throw letzterFehler ?? new AworkFehler('awork antwortet nicht.', null, true)
}

export type AworkProjekt = {
  id: string
  name: string
  projectTypeName?: string | null
  isArchived?: boolean
}

/**
 * Verbindungstest. Nimmt den Schlüssel ausdrücklich entgegen, damit er sich
 * prüfen lässt, bevor er gespeichert ist — und fragt zwei Endpunkte ab, damit
 * nicht bloß einer „OK" sagt.
 */
export async function aworkPruefen(schluessel: string): Promise<{
  nutzer: number
  projekte: number
}> {
  const nutzer = await anfrage<unknown[]>('/users', schluessel, {
    abfrage: { page: 1, pageSize: 200 },
  })
  const projekte = await anfrage<unknown[]>('/projects', schluessel, {
    abfrage: { page: 1, pageSize: 200 },
  })

  return {
    nutzer: Array.isArray(nutzer) ? nutzer.length : 0,
    projekte: Array.isArray(projekte) ? projekte.length : 0,
  }
}

/** Ist die Anbindung eingeschaltet und ein Schlüssel hinterlegt? */
export async function aworkEingerichtet(): Promise<boolean> {
  const e = await ladeEinstellungen()
  return e.aworkAktiv && Boolean(e.aworkApiKey)
}

/**
 * Projekte aus awork — die Grundlage für alles, was später dazukommt. Gibt bei
 * abgeschalteter Anbindung eine leere Liste zurück statt zu werfen: Aufrufer
 * sollen den Normalfall „noch nicht eingerichtet" nicht als Fehler behandeln
 * müssen.
 */
export async function aworkProjekte(): Promise<AworkProjekt[]> {
  const e = await ladeEinstellungen()
  if (!e.aworkAktiv || !e.aworkApiKey) return []

  const rohdaten = await anfrage<AworkProjekt[]>('/projects', e.aworkApiKey, {
    abfrage: { page: 1, pageSize: 200 },
  })
  return Array.isArray(rohdaten) ? rohdaten : []
}
