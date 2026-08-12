import 'server-only'
import type { Plattform, Prisma } from '@prisma/client'
import { prisma } from './db'

/**
 * Die Plattformwahl eines Kunden auf seine Beiträge nachziehen.
 *
 * Die Wahl am Beitrag ist eigenständig — sonst ließe sie sich am Beitrag gar
 * nicht ändern, weil der Kunde sie jedes Mal überschriebe. Damit driftet aber
 * der Bestand: Wer Facebook beim Kunden neu anhakt, hat 30 geplante Beiträge,
 * die weiterhin nur auf Instagram gehen, und merkt es erst hinterher.
 *
 * Deshalb dieser Weg — angestoßen von einem Haken in den Stammdaten, nie von
 * selbst. **Angefasst wird nur, was noch nicht draußen ist:** Ein Beitrag mit
 * vergangenem Termin trägt eine Aussage über die Vergangenheit, und die ändert
 * man nicht nachträglich.
 */
function nochNichtDraussen(kundeId: string): Prisma.PostWhereInput {
  return {
    kundeId,
    OR: [{ postenAm: null }, { postenAm: { gte: new Date() } }],
    veroeffentlichungen: { none: { stand: { in: ['LAEUFT', 'UEBERGEBEN', 'ERFOLGT'] } } },
  }
}

export async function zaehleOffeneBeitraege(kundeId: string): Promise<number> {
  return prisma.post.count({ where: nochNichtDraussen(kundeId) })
}

export async function uebernehmePlattformen(
  kundeId: string,
  plattformen: Plattform[],
): Promise<number> {
  const { count } = await prisma.post.updateMany({
    where: nochNichtDraussen(kundeId),
    data: { plattformen },
  })
  return count
}
