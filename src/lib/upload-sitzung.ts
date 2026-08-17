import 'server-only'
import { randomBytes } from 'node:crypto'
import { appendFile, mkdir, readFile, rm, stat } from 'node:fs/promises'
import path from 'node:path'
import { env } from './env'

/**
 * Dateien kommen in Blöcken herein, nicht am Stück.
 *
 * Der Anlass stand im Betrieb: Vor Preroll hing ein Cloudflare-Tunnel, und
 * der nahm keine Anfrage über 100 MB an — ein Reel darüber lief in einen
 * Abbruch, der sich wie ein Hänger anfühlte. Seit dem 17.08.2026 läuft
 * Preroll direkt über Klappes Reverse Proxy mit 256 MB, der Anlass ist also
 * weg. Geblieben sind die zwei Gründe, die nie am Tunnel hingen: Es gibt
 * einen echten Fortschritt zu zeigen, und ein abgebrochener Block kostet
 * vier Megabyte statt der ganzen Datei.
 *
 * Bewusst ohne Wiederaufnahme nach einem Verbindungsabriss (wie in Klappe):
 * Preroll lädt Reels von ein paar Dutzend Megabyte, keine 40-GB-Rushes.
 */

/** Muss zur Blockgröße im Browser passen. */
export const BLOCKGROESSE = 4 * 1024 * 1024

/** Nach so langer Untätigkeit gilt eine angefangene Sitzung als verwaist. */
const VERFALL_MS = 6 * 3600 * 1000

function sitzungsordner(): string {
  return path.join(path.resolve(env.uploadVerzeichnis), '.teile')
}

function sitzungspfad(sitzung: string): string {
  // Kennungen kommen von uns und sind hexadezimal — trotzdem prüfen, denn
  // hier landet ein Pfad aus einer Anfrage.
  if (!/^[0-9a-f]{32}$/.test(sitzung)) throw new Error('Ungültige Upload-Kennung.')
  return path.join(sitzungsordner(), sitzung)
}

export async function neueSitzung(): Promise<string> {
  const sitzung = randomBytes(16).toString('hex')
  await mkdir(sitzungsordner(), { recursive: true })
  await appendFile(sitzungspfad(sitzung), Buffer.alloc(0))
  return sitzung
}

/**
 * Hängt einen Block an. `versatz` ist die Zahl der Bytes, die davor schon da
 * sein müssen — so fällt ein doppelt oder in falscher Reihenfolge gesendeter
 * Block auf, statt die Datei still zu verderben.
 */
export async function haengeAn(
  sitzung: string,
  versatz: number,
  block: Buffer,
): Promise<number> {
  const pfad = sitzungspfad(sitzung)
  const { size } = await stat(pfad)

  if (size !== versatz) {
    throw new Error(`Block passt nicht: erwartet ab Byte ${size}, bekommen ab ${versatz}.`)
  }

  await appendFile(pfad, block)
  return size + block.byteLength
}

export async function ladeSitzung(sitzung: string): Promise<Buffer> {
  return readFile(sitzungspfad(sitzung))
}

export async function loescheSitzung(sitzung: string): Promise<void> {
  await rm(sitzungspfad(sitzung), { force: true }).catch(() => {})
}

/**
 * Räumt liegengebliebene Sitzungen weg — etwa wenn jemand den Tab schließt.
 * Läuft beiläufig beim nächsten Upload; ein eigener Zeitplaner wäre für ein
 * paar Dateien am Tag zu viel.
 */
export async function raeumeAuf(): Promise<void> {
  try {
    const ordner = sitzungsordner()
    const { readdir } = await import('node:fs/promises')
    const dateien = await readdir(ordner)
    const grenze = Date.now() - VERFALL_MS

    for (const name of dateien) {
      const pfad = path.join(ordner, name)
      const { mtimeMs } = await stat(pfad)
      if (mtimeMs < grenze) await rm(pfad, { force: true }).catch(() => {})
    }
  } catch {
    // Kein Ordner, keine Reste — nichts zu tun.
  }
}
