import 'server-only'
import { cookieKopfzeile, cookieWert } from './instagram-cookies'
import { ladeEinstellungen } from './einstellungen'
import { deuteFehler, normalisiereHandle, werteAusAntwort, type Profilwerte } from './instagram-profil'

export { normalisiereHandle, werteAusAntwort, type Profilwerte } from './instagram-profil'

/**
 * Profil-Kennzahlen von Instagram holen — Follower, Gefolgt, Beiträge, Bio,
 * Website und Profilbild.
 *
 * **Warum nicht die Graph API.** Der dokumentierte Weg (Business Discovery)
 * setzt eine Meta-App mit bestandenem App Review voraus. Der Antrag läuft;
 * bis er durch ist, gäbe es gar keine Zahlen.
 *
 * **Ohne Anmeldung zuerst.** Nachgemessen: `web_profile_info` antwortet auf
 * eine Anfrage **ganz ohne Cookie** mit 200 und allen Zahlen. Genau so wird
 * gefragt. Das ist nicht nur einfacher, es hält die hinterlegte Sitzung aus
 * dem Spiel — sie wird für die Referenzvideos gebraucht, und was sie nicht
 * anfasst, kann sie auch nicht auffällig machen.
 *
 * Die Sitzung kommt nur als **zweiter Versuch** dazu, falls Instagram die
 * anonyme Anfrage abweist (etwa bei Drosselung). Das war ursprünglich
 * umgekehrt gebaut und ging schief: Eine Sitzung, die aus nur `sessionid`
 * besteht — ohne `csrftoken` —, quittiert dieser Endpunkt mit **400**. Der
 * Reel-Download über yt-dlp kam mit derselben Sitzung klaglos durch, was wie
 * ein Widerspruch aussah. Er war keiner: Die Sitzung war in Ordnung, die
 * Anfrage nicht.
 */

/** Die öffentliche Web-Anwendung schickt diese Kennung mit; ohne sie kommt 401. */
const APP_ID = '936619743392459'

const BROWSER =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

export type Abrufergebnis = { ok: true; werte: Profilwerte } | { ok: false; fehler: string }

type Versuch = { status: number; rohdaten?: unknown; meldung?: string }

async function frage(name: string, kekse: string | null): Promise<Versuch> {
  const antwort = await fetch(
    `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(name)}`,
    {
      headers: {
        'x-ig-app-id': APP_ID,
        'user-agent': BROWSER,
        accept: 'application/json',
        // Ohne Referer sieht die Anfrage aus wie von nirgendwo.
        referer: `https://www.instagram.com/${name}/`,
        'x-requested-with': 'XMLHttpRequest',
        ...(kekse ? { cookie: kekse } : {}),
        // Wer angemeldet fragt, muss den CSRF-Wert doppelt mitschicken —
        // im Cookie und im Kopf. Fehlt er, antwortet Instagram mit 400.
        ...(kekse && cookieWert(kekse, 'csrftoken')
          ? { 'x-csrftoken': cookieWert(kekse, 'csrftoken')! }
          : {}),
      },
      /*
        Umleitungen **nicht** verfolgen. Dieser Endpunkt gibt JSON zurück oder
        gar nichts; ein 302 ist keine Weiterleitung zu einer Antwort, sondern
        eine Absage — nachgemessen zeigt er dabei auf **dieselbe** Adresse,
        `fetch` läuft also im Kreis, bis die Grenze greift, und wirft. Daraus
        wurde die Meldung „Instagram war nicht erreichbar", während der
        anonyme Versuch Sekunden vorher sauber geantwortet hatte.
      */
      redirect: 'manual',
      cache: 'no-store',
      signal: AbortSignal.timeout(20_000),
    },
  )

  if (!antwort.ok) {
    /*
      Instagram legt den Grund in den Rumpf, auch bei 4xx — und der ist hier
      Gold wert: Er unterscheidet „Handle gibt es nicht" von „bei uns ist
      gerade etwas kaputt". Ohne ihn steht in den Stammdaten nur eine Zahl,
      und man sucht den Fehler bei sich.
    */
    let meldung: string | undefined
    try {
      const rumpf = (await antwort.json()) as { message?: unknown }
      if (typeof rumpf?.message === 'string') meldung = rumpf.message
    } catch {
      // Kein JSON — dann eben nur der Status.
    }
    return { status: antwort.status, meldung }
  }

  try {
    return { status: antwort.status, rohdaten: await antwort.json() }
  } catch {
    // Statt JSON kam die Anmelde- oder Sperrseite.
    return { status: 499 }
  }
}

export async function holeProfilwerte(handle: string): Promise<Abrufergebnis> {
  const name = normalisiereHandle(handle)
  if (!name) return { ok: false, fehler: 'Für diesen Kunden ist kein Instagram-Handle hinterlegt.' }

  const e = await ladeEinstellungen()
  const kekse = cookieKopfzeile(e.instagramCookies)

  let versuch: Versuch
  try {
    versuch = await frage(name, null)
  } catch (fehler) {
    const grund = fehler instanceof Error ? fehler.message : String(fehler)
    return { ok: false, fehler: `Instagram war nicht erreichbar: ${grund}` }
  }

  /*
    Erst wenn es anonym nicht geht, die Sitzung bemühen — und nur, wenn sie
    vollständig ist. Eine Sitzung aus bloßem `sessionid` ohne `csrftoken`
    quittiert dieser Endpunkt zuverlässig mit 400.

    **Übernommen wird sie nur, wenn sie wirklich weiterhilft.** Scheitert auch
    sie, bleibt die Meldung des anonymen Versuchs stehen: Der ist der
    Hauptweg, und seine Antwort ist die aussagekräftige — „Instagram hat ein
    Schema gelöscht" hilft weiter, „mit Sitzung ging es auch nicht" nicht.
    Vorher überschrieb der zweite Versuch den ersten und machte aus einer
    brauchbaren Diagnose eine unbrauchbare.
  */
  let sitzungVersucht = false
  if (!versuch.rohdaten && kekse && cookieWert(kekse, 'csrftoken')) {
    sitzungVersucht = true
    try {
      const mitSitzung = await frage(name, kekse)
      if (mitSitzung.rohdaten) versuch = mitSitzung
    } catch {
      // Auch ein Netzwerkfehler hier darf die Diagnose oben nicht wegwischen.
    }
  }

  if (!versuch.rohdaten) {
    /*
      Bewusst **nicht** als abgelaufene Sitzung gemeldet: Der erste Versuch
      läuft ohne Sitzung, ein Fehlschlag sagt also nichts über sie aus. Das
      rote Warnband gehört dem Video-Download, nicht hier.
    */
    return {
      ok: false,
      fehler: deuteFehler(versuch.status, versuch.meldung, name, sitzungVersucht),
    }
  }

  const werte = werteAusAntwort(versuch.rohdaten)
  if (!werte) {
    return { ok: false, fehler: 'Die Antwort von Instagram hatte eine unerwartete Form.' }
  }

  return { ok: true, werte }
}
