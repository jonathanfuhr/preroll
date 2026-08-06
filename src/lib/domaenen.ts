/**
 * Welche Mail-Domänen als „eigene" gelten.
 *
 * Sie entscheiden zweierlei: Adressen daraus werden beim Anmelden direkt zu
 * Microsoft geschickt, und wer von dort zum ersten Mal zurückkommt, bekommt
 * automatisch ein Konto. Eine leere Liste heißt deshalb ausdrücklich: keine
 * Selbstregistrierung — Konten legt jemand von Hand an.
 *
 * Ohne `server-only`, damit die Regel testbar bleibt.
 */

/** Aus dem Eingabefeld: durch Komma, Semikolon, Leerzeichen oder Zeile getrennt. */
export function leseDomaenen(wert: string | null | undefined): string[] {
  if (!wert) return []
  return [
    ...new Set(
      wert
        .split(/[,;\s]+/)
        .map((d) => d.trim().toLowerCase().replace(/^@+/, ''))
        .filter((d) => d.includes('.')),
    ),
  ]
}

/** Für die Anzeige im Formular. */
export function schreibeDomaenen(domaenen: string[]): string {
  return domaenen.join(', ')
}

export function domaeneVon(email: string): string {
  return email.trim().toLowerCase().split('@').at(-1) ?? ''
}

/**
 * Subdomänen zählen mit: Wer `thdvideo.de` einträgt, meint auch
 * `mail.thdvideo.de` — aber ausdrücklich nicht `nicht-thdvideo.de`.
 */
export function istEigeneDomaene(email: string, erlaubt: string[]): boolean {
  const domaene = domaeneVon(email)
  if (!domaene) return false
  return erlaubt.some((d) => domaene === d || domaene.endsWith(`.${d}`))
}
