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
