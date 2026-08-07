import 'server-only'
import { ladeEinstellungen, speichereEinstellungen } from './einstellungen'
import { fuehreFaelligeAus, gleicheVeroeffentlichungenAb } from './veroeffentlichung'

/**
 * Der Zeitplaner.
 *
 * Preroll hatte bisher keinen — Prüfläufe für Instagram-Sitzung und Kennzahlen
 * stößt das Team-Layout an, wenn jemand arbeitet. Für Postings wäre das
 * falsch: Arbeitet um 11:00 Uhr niemand im Backend, ginge der Beitrag nicht
 * raus, und dieser Fehler ist nach außen sichtbar.
 *
 * Das heißt aber nicht, dass es dafür einen Worker braucht. Der Container läuft
 * ohnehin durch (`restart: unless-stopped`); ein Intervall im Serverprozess ist
 * kein zweiter Dienst, keine Warteschlange und kein Redis. Die Entscheidung
 * gegen Infrastruktur bleibt damit stehen — sie war nie eine gegen einen Takt.
 *
 * Was der Takt **nicht** leistet: Läuft der Container nicht, läuft er auch
 * nicht. Deshalb wird nicht auf einen Zeitpunkt geprüft, sondern auf ein
 * Fenster — geholt wird, was fällig und noch nicht erledigt ist. Ein
 * verschlafener Termin ist damit ein verspäteter, kein ausgefallener
 * (`VERFALL` in `veroeffentlichung.ts`).
 */
const TAKT = 60_000

/** Verhindert, dass HMR im Entwicklungsbetrieb mehrere Takte nebeneinander legt. */
let gestartet = false

/** Ein Lauf zur Zeit. Der eigentliche Schutz sitzt in der Datenbank. */
let laeuft = false

export function starteZeitplaner(): void {
  if (gestartet) return
  gestartet = true

  const uhr = setInterval(() => void takt(), TAKT)
  // Der Takt soll den Prozess nicht am Leben halten — er hängt an ihm, nicht
  // umgekehrt.
  uhr.unref?.()

  console.info('[veroeffentlichung] Zeitplaner läuft, Takt 60 s.')
}

/**
 * Ein Durchgang. Wirft nie: Ein Fehler hier darf den Serverprozess nicht
 * mitnehmen, und der nächste Takt kommt in einer Minute.
 */
export async function takt(jetzt = new Date()): Promise<void> {
  if (laeuft) return
  laeuft = true

  try {
    const e = await ladeEinstellungen()
    if (!e.veroeffentlichenAktiv) return

    await gleicheVeroeffentlichungenAb(jetzt)
    await fuehreFaelligeAus(jetzt)

    await speichereEinstellungen({ veroeffentlichenLaufAm: new Date() })
  } catch (fehler) {
    console.warn('[veroeffentlichung] Lauf fehlgeschlagen:', fehler)
  } finally {
    laeuft = false
  }
}
