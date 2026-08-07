import { oeffentlicheKlappeUrl, oeffentlicheMedienUrl } from './medien-signatur'
import type { Medienstueck } from './meta'

/**
 * Was von einem Beitrag tatsächlich hochgeht — als Adressen, denn Meta lädt
 * die Dateien selbst.
 *
 * Steht bewusst neben `veroeffentlichung.ts` und nicht darin: Hier wird nur
 * gerechnet, keine Datenbank angefasst. So bleibt die Stelle prüfbar, an der
 * am ehesten etwas falsch zugeordnet wird.
 */
export type PostMaterial = {
  typ: 'REEL' | 'KARUSSELL' | 'BEITRAG'
  klappeVersionId: string | null
  medien: Array<{
    rolle: 'MEDIUM' | 'SLIDE' | 'THUMBNAIL'
    position: number
    mediumId: string
    medium: { mimeTyp: string }
  }>
}

export type Material =
  | { ok: true; medien: Medienstueck[] }
  | { ok: false; fehler: string }

/**
 * Bilder gehen als **JPEG** raus, auch wenn im Bestand ein PNG liegt:
 * Instagram nimmt für Bilder nichts anderes an. Gewandelt wird beim
 * Ausliefern, das Original bleibt unangetastet.
 *
 * Beim Reel gilt dieselbe Rangfolge wie in der Vorschau (`reelVideoQuelle`):
 * ein eigenes Video vor der Klappe-Fassung — so gewinnt die zuletzt getroffene
 * Wahl, ohne dass irgendwo Zeitstempel verglichen werden.
 *
 * Das Thumbnail bleibt außen vor. Instagram zieht sein Titelbild aus dem
 * Video; ein eigenes Cover mitzugeben verlangt einen zweiten Weg und stünde
 * hier nur halb.
 */
export function medienFuerPost(post: PostMaterial): Material {
  if (post.typ === 'REEL') {
    const eigenes = post.medien.find(
      (m) => m.rolle === 'MEDIUM' && m.medium.mimeTyp.startsWith('video/'),
    )
    if (eigenes) {
      return {
        ok: true,
        medien: [{ url: oeffentlicheMedienUrl(eigenes.mediumId), istVideo: true }],
      }
    }
    if (post.klappeVersionId) {
      return {
        ok: true,
        medien: [{ url: oeffentlicheKlappeUrl(post.klappeVersionId), istVideo: true }],
      }
    }
    return { ok: false, fehler: 'Der Beitrag hat kein Video.' }
  }

  if (post.typ === 'KARUSSELL') {
    const slides = post.medien
      .filter((m) => m.rolle === 'SLIDE')
      .sort((a, b) => a.position - b.position)
    if (slides.length === 0) return { ok: false, fehler: 'Das Karussell hat keine Slides.' }
    return {
      ok: true,
      medien: slides.map((s) => ({
        url: oeffentlicheMedienUrl(s.mediumId, 'jpeg'),
        istVideo: false,
      })),
    }
  }

  const bild = post.medien.find((m) => m.rolle === 'MEDIUM')
  if (!bild) return { ok: false, fehler: 'Der Beitrag hat kein Bild.' }
  return {
    ok: true,
    medien: [{ url: oeffentlicheMedienUrl(bild.mediumId, 'jpeg'), istVideo: false }],
  }
}
