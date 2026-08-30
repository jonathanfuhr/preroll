import type { PostStatus } from '@prisma/client'

/**
 * Die Länge eines Reels — gemessen aus der Datei, geschrieben ins Freifeld.
 *
 * Bisher tippte man sie von Hand, und sie stimmte selten: Im Konzept ist sie
 * eine Schätzung, nach dem Schnitt ein anderer Wert, und niemand denkt beim
 * Austauschen des Videos daran, die Zahl nachzuziehen.
 *
 * Das Feld bleibt trotzdem ein **Freifeld**. Im Konzept steht dort oft „30–45
 * Sek" oder „so lang wie der O-Ton" — eine Absicht, keine Messung. Deshalb
 * wird nur überschrieben, wenn wirklich ein Video ankommt.
 */

/** „31 Sek" oder „1:45 Min" — kurz genug für die Eckdatenzeile. */
export function formatiereDauer(sekunden: number): string {
  const ganz = Math.max(1, Math.round(sekunden))
  if (ganz < 60) return `${ganz} Sek`
  const min = Math.floor(ganz / 60)
  const rest = ganz % 60
  return `${min}:${String(rest).padStart(2, '0')} Min`
}

/**
 * In den frühen Phasen ist die Länge ein Vorhaben, später eine Tatsache.
 *
 * Entwurf und Konzept zeigen deshalb „ca. 31 Sek": Dort steht das Video noch
 * nicht fest — was gemessen wurde, ist bestenfalls ein Vorschnitt, und eine
 * Sekundenangabe ohne Einschränkung verspricht dem Kunden eine Genauigkeit,
 * die es nicht gibt. Ab der Produktion fällt das „ca." weg.
 *
 * Ein bereits eingeschränkter Wert bleibt, wie er ist — „ca. ca. 30 Sek" wäre
 * albern, und „etwa 30 Sek" ist schon eindeutig genug.
 */
export function laengeAnzeige(laenge: string | null, status: PostStatus): string | null {
  if (!laenge) return null
  const wert = laenge.trim()
  if (!wert) return null

  const frueh = status === 'ENTWURF' || status === 'KONZEPT'
  if (!frueh) return wert
  if (/^(ca\.?|etwa|rund|circa|~)/i.test(wert)) return wert
  return `ca. ${wert}`
}
