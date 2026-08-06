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
