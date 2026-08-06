import 'server-only'
import { execFile } from 'node:child_process'
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import type { Medium } from '@prisma/client'
import { speichereMedium } from './medien'

const ausfuehren = promisify(execFile)

const MAX_GROESSE = 200 * 1024 * 1024
const ZEITLIMIT = 120_000

/**
 * Referenzvideos werden lokal abgelegt statt per iframe eingebettet:
 * Instagram und YouTube sperren Einbettungen unvorhersehbar, und ein Video,
 * das in der Kundenvorschau nicht läuft, ist schlimmer als keines.
 *
 * Zwei Wege:
 *  - Direkte Videolinks (`…/reel.mp4`) werden geladen, wie sie sind.
 *  - Plattform-Links brauchen `yt-dlp`. Fehlt es, sagt die Meldung das klar,
 *    statt still zu scheitern.
 */

export type DownloadErgebnis =
  | { ok: true; medium: Medium; titel: string | null }
  | { ok: false; fehler: string }

const VIDEO_TYPEN = ['video/mp4', 'video/quicktime', 'video/webm']

function istDirekterVideolink(url: string): boolean {
  return /\.(mp4|mov|m4v|webm)(\?|$)/i.test(url)
}

export function istPlattformLink(url: string): boolean {
  return /(?:instagram\.com|youtube\.com|youtu\.be|tiktok\.com|vimeo\.com|facebook\.com)/i.test(url)
}

/** Ist yt-dlp auf diesem System verfügbar? */
export async function ytDlpVerfuegbar(): Promise<boolean> {
  try {
    await ausfuehren('yt-dlp', ['--version'], { timeout: 10_000 })
    return true
  } catch {
    return false
  }
}

async function ladeDirekt(url: string): Promise<{ inhalt: Buffer; typ: string; name: string }> {
  const antwort = await fetch(url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(ZEITLIMIT),
  })
  if (!antwort.ok) throw new Error(`Der Server antwortete mit ${antwort.status}.`)

  const laenge = Number(antwort.headers.get('content-length') ?? 0)
  if (laenge > MAX_GROESSE) {
    throw new Error(`Das Video ist größer als ${Math.round(MAX_GROESSE / 1024 / 1024)} MB.`)
  }

  const inhalt = Buffer.from(await antwort.arrayBuffer())
  if (inhalt.byteLength > MAX_GROESSE) {
    throw new Error(`Das Video ist größer als ${Math.round(MAX_GROESSE / 1024 / 1024)} MB.`)
  }

  const typ = (antwort.headers.get('content-type') ?? '').split(';')[0].trim()
  if (typ && !VIDEO_TYPEN.includes(typ)) {
    throw new Error(`Der Link liefert ${typ}, kein Video.`)
  }

  const name = decodeURIComponent(new URL(url).pathname.split('/').pop() || 'referenz.mp4')
  return { inhalt, typ: typ || 'video/mp4', name }
}

async function ladeMitYtDlp(
  url: string,
): Promise<{ inhalt: Buffer; typ: string; name: string; titel: string | null }> {
  const ordner = await mkdtemp(path.join(tmpdir(), 'preroll-referenz-'))
  try {
    // Auf MP4 festlegen — das spielt in jedem Browser, ohne Nachbearbeitung.
    await ausfuehren(
      'yt-dlp',
      [
        '--no-playlist',
        '--max-filesize',
        String(MAX_GROESSE),
        '-f',
        'mp4/bestvideo[ext=mp4]+bestaudio[ext=m4a]/best',
        '--merge-output-format',
        'mp4',
        '-o',
        path.join(ordner, '%(title).80s.%(ext)s'),
        url,
      ],
      { timeout: ZEITLIMIT, maxBuffer: 8 * 1024 * 1024 },
    )

    const dateien = await readdir(ordner)
    const datei = dateien.find((d) => /\.(mp4|mkv|webm|mov)$/i.test(d))
    if (!datei) throw new Error('yt-dlp hat keine Videodatei erzeugt.')

    const inhalt = await readFile(path.join(ordner, datei))
    return {
      inhalt,
      typ: 'video/mp4',
      name: datei,
      titel: datei.replace(/\.[^.]+$/, ''),
    }
  } finally {
    await rm(ordner, { recursive: true, force: true }).catch(() => {})
  }
}

/**
 * Lädt ein Referenzvideo herunter und legt es als Medium ab.
 * Wirft nie — der Editor zeigt die Meldung an und der Link bleibt gespeichert.
 */
export async function ladeReferenzvideo(opts: {
  url: string
  kundeId: string
  hochgeladenVonId?: string | null
}): Promise<DownloadErgebnis> {
  let url: URL
  try {
    url = new URL(opts.url)
  } catch {
    return { ok: false, fehler: 'Das ist keine gültige Adresse.' }
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return { ok: false, fehler: 'Nur http- und https-Adressen werden geladen.' }
  }

  try {
    let geladen: { inhalt: Buffer; typ: string; name: string; titel?: string | null }

    if (istDirekterVideolink(opts.url)) {
      geladen = await ladeDirekt(opts.url)
    } else if (istPlattformLink(opts.url)) {
      if (!(await ytDlpVerfuegbar())) {
        return {
          ok: false,
          fehler:
            'Für Instagram-, YouTube- und TikTok-Links wird yt-dlp benötigt, das auf diesem ' +
            'Server nicht installiert ist. Der Link bleibt gespeichert und wird in der ' +
            'Kundenvorschau verlinkt. Alternativ ein direktes Video (.mp4) hinterlegen.',
        }
      }
      geladen = await ladeMitYtDlp(opts.url)
    } else {
      // Unbekannte Adresse: erst direkt versuchen, dann yt-dlp.
      try {
        geladen = await ladeDirekt(opts.url)
      } catch (fehler) {
        if (!(await ytDlpVerfuegbar())) throw fehler
        geladen = await ladeMitYtDlp(opts.url)
      }
    }

    const { medium } = await speichereMedium({
      inhalt: geladen.inhalt,
      dateiname: geladen.name,
      mimeTyp: geladen.typ,
      kundeId: opts.kundeId,
      hochgeladenVonId: opts.hochgeladenVonId,
    })

    return { ok: true, medium, titel: geladen.titel ?? null }
  } catch (fehler) {
    const meldung = (fehler as Error).message
    return {
      ok: false,
      fehler: meldung.includes('ETIMEDOUT') || meldung.includes('timeout')
        ? 'Das Laden hat zu lange gedauert und wurde abgebrochen.'
        : `Das Video konnte nicht geladen werden: ${meldung.slice(0, 200)}`,
    }
  }
}
