import 'server-only'
import { normalisiereHandle, statusAus, werteAusSeite, type TikTokWerte } from './tiktok-profil'

export { normalisiereHandle, statusAus, werteAusSeite, type TikTokWerte } from './tiktok-profil'

/**
 * Profil-Kennzahlen von TikTok holen — Follower, Folge ich, Videos, Likes,
 * Bio und Profilbild.
 *
 * **Woher.** Aus der öffentlichen Profilseite `tiktok.com/@handle`. TikTok
 * legt den Zustand der Seite als JSON hinein; gelesen wird er in
 * `tiktok-profil.ts`.
 *
 * **Warum nicht die offizielle Schnittstelle.** Die Display API setzt eine
 * genehmigte App und eine OAuth-Anmeldung des Kontoinhabers voraus, die
 * Research API einen Forschungsantrag. Beides ist für ein Agentur-Werkzeug,
 * das fremde Kundenprofile beobachtet, kein gangbarer Weg — dieselbe Lage wie
 * bei Meta vor dem App Review.
 *
 * **Ohne Anmeldung, und das bleibt so.** Gefragt wird ohne Cookie; nachgemessen
 * antwortet die Seite so mit 200 und allen Zahlen. Anders als bei Instagram
 * gibt es hier gar keine hinterlegte Sitzung, die als zweiter Versuch
 * einspringen könnte — TikTok braucht Preroll nur zum Lesen.
 *
 * **TikTok wehrt sich häufiger als Instagram.** Statt der Profilseite kommt
 * mitunter eine Sperrseite ohne Datenblock. Das ist kein Fehler im Code und
 * kein Grund für ein Warnband: Der Lauf meldet es, der nächste versucht es
 * wieder. Weil der Rhythmus ohnehin sparsam ist (ein Profil je Lauf, höchstens
 * einmal am Tag), fällt das nicht ins Gewicht.
 */

/** Ein gewöhnlicher Browser-Kopf. Ohne ihn liefert TikTok schneller eine Sperrseite. */
const KOPFZEILEN = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8',
}

export type Abrufergebnis = { ok: true; werte: TikTokWerte } | { ok: false; fehler: string }

export async function holeProfilwerte(handle: string): Promise<Abrufergebnis> {
  const name = normalisiereHandle(handle)
  if (!name) return { ok: false, fehler: 'Kein TikTok-Handle hinterlegt.' }

  let antwort: Response
  try {
    antwort = await fetch(`https://www.tiktok.com/@${encodeURIComponent(name)}`, {
      headers: KOPFZEILEN,
      cache: 'no-store',
      signal: AbortSignal.timeout(25_000),
    })
  } catch {
    return { ok: false, fehler: 'TikTok war nicht erreichbar.' }
  }

  if (antwort.status === 404) {
    return { ok: false, fehler: `Das Konto @${name} gibt es bei TikTok nicht.` }
  }
  if (!antwort.ok) {
    return { ok: false, fehler: `TikTok hat mit ${antwort.status} geantwortet.` }
  }

  const seite = await antwort.text()
  const werte = werteAusSeite(seite)
  if (!werte) {
    /*
      Zwei Fälle, die sich am Ergebnis gleichen und in der Ursache nicht:
      TikTok sagt selbst, dass es das Konto nicht gibt (dann steht ein
      `statusCode` im Block) — oder es liefert überhaupt keine Auskunft, dann
      ist es eine Sperrseite. Das eine ist ein Tippfehler im Handle, das andere
      geht von allein vorbei.
    */
    const status = statusAus(seite)
    if (status) {
      return {
        ok: false,
        fehler: `TikTok kennt @${name} nicht oder das Konto ist gesperrt (${status.text ?? status.code}).`,
      }
    }
    return {
      ok: false,
      fehler:
        'TikTok hat statt des Profils eine Sperrseite geliefert. Das passiert zeitweise; ' +
        'der nächste Lauf versucht es erneut.',
    }
  }

  // Die Seite antwortet auch für Konten, die es nicht gibt, mit einem
  // Datenblock ohne Zahlen. Ohne Followerzahl gibt es nichts fortzuschreiben.
  if (werte.follower === null) {
    return { ok: false, fehler: `Für @${name} liefert TikTok keine Zahlen.` }
  }

  return { ok: true, werte }
}
