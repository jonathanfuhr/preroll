import 'server-only'
import { execFile } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { ladeEinstellungen, speichereEinstellungen } from './einstellungen'

export { alsCookiedatei } from './instagram-cookies'

const ausfuehren = promisify(execFile)

/**
 * Instagram gibt Reels nur an eine angemeldete Sitzung heraus — auch die, die
 * im privaten Browserfenster laufen. Nachgemessen: weder eine neuere
 * yt-dlp-Fassung noch ein Browser-User-Agent noch die Einbett-Adresse ändern
 * daran etwas.
 *
 * Eine Anmeldung *in* Preroll ist nicht möglich: Ein Fenster auf
 * `instagram.com` gehört einer fremden Herkunft, deren Cookies Preroll nicht
 * lesen darf, und `sessionid` ist zusätzlich `HttpOnly`. Bleibt der von
 * yt-dlp dokumentierte Weg — eine mitgebrachte Sitzung.
 */

/** Schreibt die hinterlegte Sitzung in einen Ordner — oder nichts, wenn keine da ist. */
export async function schreibeCookiedatei(ordner: string): Promise<string | null> {
  const e = await ladeEinstellungen()
  if (!e.instagramCookies?.trim()) return null

  const datei = path.join(ordner, 'cookies.txt')
  await writeFile(datei, e.instagramCookies, { mode: 0o600 })
  return datei
}

export type Pruefergebnis = { ok: true; titel: string } | { ok: false; fehler: string }

/**
 * Prüft die Sitzung an einem echten Reel — ohne es zu laden. Ein künstlicher
 * Endpunkt würde nur sagen, ob Instagram antwortet, nicht ob es *dieses*
 * Video herausgibt.
 */
export async function pruefeInstagram(url: string): Promise<Pruefergebnis> {
  const ordner = await mkdtemp(path.join(tmpdir(), 'preroll-igtest-'))
  try {
    const datei = await schreibeCookiedatei(ordner)
    const { stdout } = await ausfuehren(
      'yt-dlp',
      [
        ...(datei ? ['--cookies', datei] : []),
        '--simulate',
        '--no-warnings',
        '--no-playlist',
        '-O',
        '%(title).60s',
        url,
      ],
      { timeout: 60_000 },
    )

    const titel = stdout.trim().split('\n')[0] || 'Video gefunden'
    await speichereEinstellungen({ instagramGeprueftAm: new Date(), instagramFehler: null })
    return { ok: true, titel }
  } catch (fehler) {
    const rohtext = fehler instanceof Error ? fehler.message : String(fehler)
    const fehlertext = rohtext.toLowerCase().includes('empty media response')
      ? 'Instagram gibt das Video nicht heraus — die hinterlegte Sitzung fehlt oder ist abgelaufen.'
      : rohtext.split('\n').filter(Boolean).at(-1)?.slice(0, 240) ?? 'Unbekannter Fehler.'

    await speichereEinstellungen({
      instagramGeprueftAm: new Date(),
      instagramFehler: fehlertext,
    })
    return { ok: false, fehler: fehlertext }
  } finally {
    await rm(ordner, { recursive: true, force: true }).catch(() => {})
  }
}

/**
 * Merkt sich, dass ein Download an der Anmeldung gescheitert ist. So steht in
 * den Einstellungen „abgelaufen", bevor jemand das nächste Mal danach sucht.
 */
export async function merkeAbgelaufen(): Promise<void> {
  await speichereEinstellungen({
    instagramFehler: 'Ein Download scheiterte zuletzt an der Anmeldung — Sitzung vermutlich abgelaufen.',
    instagramGeprueftAm: new Date(),
  }).catch(() => {})
}
