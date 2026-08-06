import 'server-only'
import { cookieKopfzeile } from './instagram-cookies'
import { ladeEinstellungen } from './einstellungen'
import { normalisiereHandle, werteAusAntwort, type Profilwerte } from './instagram-profil'

export { normalisiereHandle, werteAusAntwort, type Profilwerte } from './instagram-profil'

/**
 * Profil-Kennzahlen von Instagram holen — Follower, Gefolgt, Beiträge, Bio,
 * Website und Profilbild.
 *
 * **Warum nicht die Graph API.** Der dokumentierte Weg (Business Discovery)
 * setzt eine Meta-App mit bestandenem App Review voraus. Der Antrag läuft;
 * bis er durch ist, gäbe es gar keine Zahlen. Preroll hat für die
 * Referenzvideos ohnehin eine angemeldete Instagram-Sitzung hinterlegt, und
 * dieselbe Sitzung beantwortet auch `web_profile_info`.
 *
 * **Was das kostet.** Der Endpunkt ist nicht dokumentiert und die Nutzung
 * widerspricht Instagrams Bedingungen. Er kann sich jederzeit ändern, und zu
 * häufige Abfragen können die Sitzung auffällig machen — dann stehen auch
 * die Referenzvideos still, es ist dieselbe. Deshalb: eigener Schalter in
 * den Einstellungen, **höchstens ein Profil je Lauf**, und Läufe im
 * Mindestabstand (`kennzahlen-auftrag.ts`). Wer das nicht will, lässt den
 * Schalter aus und pflegt die Zahlen wie bisher von Hand.
 */

/** Die öffentliche Web-Anwendung schickt diese Kennung mit; ohne sie kommt 401. */
const APP_ID = '936619743392459'

const BROWSER =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

export type Abrufergebnis =
  | { ok: true; werte: Profilwerte }
  | { ok: false; fehler: string; abgelaufen?: boolean }

export async function holeProfilwerte(handle: string): Promise<Abrufergebnis> {
  const name = normalisiereHandle(handle)
  if (!name) return { ok: false, fehler: 'Für diesen Kunden ist kein Instagram-Handle hinterlegt.' }

  const e = await ladeEinstellungen()
  const kekse = cookieKopfzeile(e.instagramCookies)
  if (!kekse) {
    return {
      ok: false,
      fehler:
        'Es ist keine Instagram-Sitzung hinterlegt. Unter Einstellungen → Videos von Instagram eintragen.',
      abgelaufen: true,
    }
  }

  let antwort: Response
  try {
    antwort = await fetch(
      `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(name)}`,
      {
        headers: {
          'x-ig-app-id': APP_ID,
          'user-agent': BROWSER,
          accept: 'application/json',
          cookie: kekse,
        },
        cache: 'no-store',
        signal: AbortSignal.timeout(20_000),
      },
    )
  } catch (fehler) {
    const grund = fehler instanceof Error ? fehler.message : String(fehler)
    return { ok: false, fehler: `Instagram war nicht erreichbar: ${grund}` }
  }

  // Nachgemessen: Auf eine ungültige Sitzung antwortet dieser Endpunkt mit
  // **400**, nicht mit 401 — wer nur auf 401 prüft, hält eine tote Sitzung
  // für einen Serverfehler. 401 und 403 kommen ebenfalls vor.
  if ([400, 401, 403].includes(antwort.status)) {
    return {
      ok: false,
      fehler:
        'Instagram hat die Anfrage abgewiesen. Meist ist die hinterlegte Sitzung abgelaufen — ' +
        'seltener stimmt der Handle nicht.',
      abgelaufen: true,
    }
  }
  if (antwort.status === 404) {
    return { ok: false, fehler: `Das Profil @${name} gibt es nicht (mehr).` }
  }
  if (antwort.status === 429) {
    return { ok: false, fehler: 'Instagram bremst gerade ab. Später noch einmal versuchen.' }
  }
  if (!antwort.ok) {
    return { ok: false, fehler: `Instagram antwortete mit ${antwort.status}.` }
  }

  let rohdaten: unknown
  try {
    rohdaten = await antwort.json()
  } catch {
    // Statt JSON kam die Anmeldeseite — auch das ist eine tote Sitzung.
    return {
      ok: false,
      fehler: 'Instagram hat keine Daten geliefert — vermutlich ist die Sitzung abgelaufen.',
      abgelaufen: true,
    }
  }

  const werte = werteAusAntwort(rohdaten)
  if (!werte) {
    return {
      ok: false,
      fehler: 'Die Antwort von Instagram hatte eine unerwartete Form.',
    }
  }

  return { ok: true, werte }
}
