import { createHmac, timingSafeEqual } from 'node:crypto'
import { env } from './env'

/**
 * Kurzlebige, öffentlich erreichbare Adressen für Dateien.
 *
 * Beim Posten übergibt man Meta **keine Datei**, sondern eine Adresse — die
 * Graph API holt sie sich selbst ab (`image_url`, `video_url`). Preroll
 * liefert Medien sonst über `/api/medien/<id>` aus, wo die nicht erratbare
 * cuid die einzige Hürde ist, und Klappe-Fassungen nur an Angemeldete. Für
 * den Moment des Postens genügt beides nicht: Die Adresse landet im Protokoll
 * eines fremden Dienstes und soll dort nicht dauerhaft gültig bleiben.
 *
 * Deshalb signiert und befristet. Zwei Stunden reichen für jeden Lauf — ein
 * Instagram-Video braucht ein paar Minuten Verarbeitung, nicht mehr —, und
 * jeder Versuch erzeugt eine frische Adresse.
 */
const GUELTIG = 2 * 3600_000

/** Woher die Datei kommt: aus dem eigenen Medienbestand oder aus Klappe. */
export type Quelle = 'medium' | 'klappe'

/** Instagram nimmt für Bilder nur JPEG an. PNG wird beim Ausliefern gewandelt. */
export type Ausgabeformat = 'original' | 'jpeg'

function unterschrift(quelle: Quelle, id: string, bis: number, format: Ausgabeformat): string {
  return createHmac('sha256', env.sessionGeheimnis)
    .update(`${quelle}.${id}.${bis}.${format}`)
    .digest('hex')
    .slice(0, 32)
}

function baue(quelle: Quelle, pfad: string, id: string, format: Ausgabeformat, jetzt: number) {
  const bis = jetzt + GUELTIG
  const sig = unterschrift(quelle, id, bis, format)
  return `${env.appUrl}${pfad}?bis=${bis}&f=${format}&sig=${sig}`
}

export function oeffentlicheMedienUrl(
  mediumId: string,
  format: Ausgabeformat = 'original',
  jetzt = Date.now(),
): string {
  return baue('medium', `/api/medien/oeffentlich/${mediumId}`, mediumId, format, jetzt)
}

export function oeffentlicheKlappeUrl(fassungId: string, jetzt = Date.now()): string {
  return baue('klappe', `/api/klappe/oeffentlich/${fassungId}`, fassungId, 'original', jetzt)
}

export function pruefeUnterschrift(
  quelle: Quelle,
  id: string,
  bis: string | null,
  format: string | null,
  sig: string | null,
  jetzt = Date.now(),
): { ok: true; format: Ausgabeformat } | { ok: false; grund: 'abgelaufen' | 'ungueltig' } {
  if (!bis || !sig) return { ok: false, grund: 'ungueltig' }
  if (format !== 'original' && format !== 'jpeg') return { ok: false, grund: 'ungueltig' }

  const ablauf = Number(bis)
  if (!Number.isFinite(ablauf)) return { ok: false, grund: 'ungueltig' }
  if (ablauf < jetzt) return { ok: false, grund: 'abgelaufen' }

  const erwartet = Buffer.from(unterschrift(quelle, id, ablauf, format))
  const gegeben = Buffer.from(sig)
  // Längenvergleich vorweg: `timingSafeEqual` wirft bei ungleicher Länge.
  if (erwartet.length !== gegeben.length) return { ok: false, grund: 'ungueltig' }
  if (!timingSafeEqual(erwartet, gegeben)) return { ok: false, grund: 'ungueltig' }

  return { ok: true, format }
}
