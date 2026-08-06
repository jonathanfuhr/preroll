/**
 * Aus dem, was jemand einfügt, eine Datei im Netscape-Format machen.
 *
 * Bewusst ohne `server-only`: reine Textarbeit, und genau hier ginge ein
 * Tippfehler still daneben — also testbar halten.
 */

/** Zeile im Netscape-Format, wie yt-dlp sie erwartet. */
function zeile(name: string, wert: string, ablauf: number): string {
  return `.instagram.com\tTRUE\t/\tTRUE\t${ablauf}\t${name}\t${wert}`
}

/**
 * Nimmt entgegen, was jemand einfügt: eine ganze `cookies.txt` oder nur den
 * Wert von `sessionid`. Das Zweite ist der übliche Fall — eine Zeile aus den
 * Entwicklerwerkzeugen ist schneller besorgt als eine Browser-Erweiterung.
 *
 * Leere Eingabe ergibt `null` und heißt „unverändert" — nicht „löschen".
 */
export function alsCookiedatei(eingabe: string, jetzt = Date.now()): string | null {
  const text = eingabe.trim()
  if (!text) return null

  // Sieht aus wie eine echte cookies.txt? Dann unverändert übernehmen.
  if (text.includes('\t') || text.startsWith('# Netscape')) return text

  // Ablauf ein Jahr voraus; wann wirklich Schluss ist, entscheidet Instagram.
  const ablauf = Math.floor(jetzt / 1000) + 365 * 24 * 3600

  const paare = text
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const i = s.indexOf('=')
      return i < 0 ? ['sessionid', s.trim()] : [s.slice(0, i).trim(), s.slice(i + 1).trim()]
    })
    .filter(([name, wert]) => name && wert)

  if (paare.length === 0) return null

  return (
    ['# Netscape HTTP Cookie File', ...paare.map(([n, w]) => zeile(n, w, ablauf))].join('\n') + '\n'
  )
}

/**
 * Aus der hinterlegten Datei die Zeile für einen `Cookie:`-Kopf machen.
 *
 * yt-dlp bekommt eine Datei, ein HTTP-Aufruf braucht die Kurzform. Beide
 * lesen dieselbe Hinterlegung — wer die Sitzung einmal einträgt, hat sie für
 * Downloads **und** Kennzahlen.
 *
 * `sessionid` allein genügt Instagram; `ds_user_id` und `csrftoken` kommen
 * mit, wenn sie dabei sind, weil manche Antworten sonst knapper ausfallen.
 */
const GEBRAUCHT = ['sessionid', 'ds_user_id', 'csrftoken', 'mid', 'ig_did']

export function cookieKopfzeile(inhalt: string | null | undefined): string | null {
  if (!inhalt?.trim()) return null

  const werte = new Map<string, string>()

  for (const roh of inhalt.split('\n')) {
    // Browser-Erweiterungen schreiben HttpOnly-Cookies mit dem Präfix
    // `#HttpOnly_` — und ausgerechnet `sessionid` ist HttpOnly. Wer die
    // Zeile für einen Kommentar hält, wirft genau das weg, worauf es
    // ankommt. yt-dlp kennt die Marke; hier fehlte sie.
    const zeile = roh.replace(/^#HttpOnly_/, '')
    if (!zeile.trim() || zeile.startsWith('#')) continue

    // Netscape-Format: Domäne, Flag, Pfad, Sicher, Ablauf, Name, Wert
    const felder = zeile.split('\t')
    if (felder.length >= 7) {
      const [name, wert] = [felder[5].trim(), felder[6].trim()]
      if (GEBRAUCHT.includes(name) && wert) werte.set(name, wert)
    }
  }

  if (!werte.has('sessionid')) return null
  return [...werte].map(([n, w]) => `${n}=${w}`).join('; ')
}

/** Der Wert eines einzelnen Cookies aus der Kopfzeile — für `x-csrftoken`. */
export function cookieWert(kopfzeile: string | null, name: string): string | null {
  if (!kopfzeile) return null
  for (const teil of kopfzeile.split(';')) {
    const [n, ...rest] = teil.trim().split('=')
    if (n === name && rest.length) return rest.join('=')
  }
  return null
}
