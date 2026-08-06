import 'server-only'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const ausfuehren = promisify(execFile)

/**
 * Videos von einem Link werden lokal abgelegt statt per iframe eingebettet:
 * Instagram und YouTube sperren Einbettungen unvorhersehbar, und ein Video,
 * das in der Kundenvorschau nicht läuft, ist schlimmer als keines.
 *
 * Geladen wird mit `yt-dlp` — auch direkte Links. Ein zweiter Weg wäre nur
 * eine zweite Fehlerquelle. Der Download selbst läuft im Hintergrund, siehe
 * `video-download.ts`; hier steht nur, was beide Seiten wissen müssen.
 */

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
