/**
 * Was Instagrams `web_profile_info` liefert — und wie man es liest.
 *
 * Bewusst ohne `server-only`: reine Textarbeit, und genau hier bricht es
 * zuerst, wenn Instagram die Antwort umbaut. Also testbar halten.
 */

export type Profilwerte = {
  follower: number | null
  gefolgt: number | null
  beitraege: number | null
  bio: string | null
  website: string | null
  profilbildUrl: string | null
  privat: boolean
}

/**
 * `@name`, ganze Profil-Adressen und Anhängsel fallen weg. Das Protokoll ist
 * dabei freiwillig — kopiert wird oft nur `instagram.com/name`.
 */
export function normalisiereHandle(eingabe: string): string {
  return eingabe
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/^(www\.)?instagram\.com\//i, '')
    .replace(/^@/, '')
    .replace(/[/?#].*$/, '')
    .trim()
}

function zahl(wert: unknown): number | null {
  return typeof wert === 'number' && Number.isFinite(wert) ? wert : null
}

function text(wert: unknown): string | null {
  return typeof wert === 'string' && wert.trim() ? wert.trim() : null
}

export function werteAusAntwort(rohdaten: unknown): Profilwerte | null {
  const nutzer = (rohdaten as { data?: { user?: Record<string, unknown> } })?.data?.user
  if (!nutzer) return null

  const zaehler = (feld: string) =>
    zahl((nutzer[feld] as { count?: unknown } | undefined)?.count)

  return {
    follower: zaehler('edge_followed_by'),
    gefolgt: zaehler('edge_follow'),
    beitraege: zaehler('edge_owner_to_timeline_media'),
    bio: text(nutzer.biography),
    website: text(nutzer.external_url),
    profilbildUrl: text(nutzer.profile_pic_url_hd) ?? text(nutzer.profile_pic_url),
    privat: nutzer.is_private === true,
  }
}

/**
 * Was ein Fehlschlag bedeutet — im Klartext.
 *
 * Steht hier und nicht beim Abruf, weil es **Textarbeit** ist und genau hier
 * zuerst bricht, wenn Instagram die Antworten umbaut. Der Abruf selbst ist
 * Netzwerkarbeit und lässt sich nicht sinnvoll prüfen; die Zuordnung
 * „Antwort → Satz" schon.
 */
export function deuteFehler(
  status: number,
  meldung: string | undefined,
  name: string,
  mitSitzung: boolean,
): string {
  if (status === 404) return `Das Profil @${name} gibt es nicht (mehr).`

  if (status === 429 || /wait a few minutes/i.test(meldung ?? '')) {
    return (
      'Instagram bremst diese Adresse gerade ab („zu viele Anfragen"). Das gibt sich von ' +
      'selbst — der nächste Lauf versucht es später wieder.'
    )
  }

  /*
    Der Fall, der wie ein Fehler bei uns aussieht und keiner ist: Instagram hat
    ein Schema gelöscht, das an einer Business-Kategorie hängt, und liefert für
    die betroffenen Profile 400 — nachgemessen an mehreren großen Konten
    gleichzeitig, während andere im selben Moment einwandfrei antworten. Weder
    ein anderer Endpunkt noch eine Anmeldung kommen daran vorbei.

    Ohne diesen Satz stand dort „abgewiesen (400)", und man suchte den Fehler
    beim Handle oder bei der hinterlegten Sitzung.
  */
  if (/Asset asset:\/\/.*has been deleted/i.test(meldung ?? '')) {
    return (
      `Instagram liefert für @${name} gerade einen Fehler aus dem eigenen Haus ` +
      '(gelöschtes Schema zur Business-Kategorie). Das Profil ist in Ordnung und der Handle ' +
      'stimmt — der Abruf geht erst wieder, wenn Meta das behoben hat. Andere Profile sind ' +
      'davon nicht betroffen.'
    )
  }

  const zusatz = meldung ? `: ${meldung}` : ''
  return mitSitzung
    ? `Instagram hat die Anfrage abgewiesen (${status}${zusatz}) — auch mit der hinterlegten Sitzung.`
    : `Instagram hat die Anfrage abgewiesen (${status}${zusatz}).`
}
