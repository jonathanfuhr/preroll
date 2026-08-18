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

/**
 * Eine abgewählte Plattform aus den Beiträgen nehmen.
 *
 * **Eine Abweichung von der sonstigen Linie, und zwar mit Absicht.** Sonst
 * gilt: Die Wahl am Beitrag ist die Absicht und bleibt stehen, angezeigt wird
 * nur der Schnitt mit dem, was der Kunde heute bespielt
 * (`angezeigtePlattformen`). Das ist bequem, solange eine Plattform nur
 * vorübergehend wegfällt — sie steht von selbst wieder da.
 *
 * Beim Abwählen in den Stammdaten ist die Absicht aber eine andere: „Wir
 * bespielen TikTok nicht mehr." Bliebe die Wahl an dreißig Beiträgen stehen,
 * käme sie beim nächsten Anhaken ungefragt zurück — und in der Zwischenzeit
 * stünde in der Datenbank etwas anderes als auf dem Bildschirm.
 *
 * **Angefasst wird nur, was noch nicht draußen ist** — dieselbe Grenze wie
 * beim Nachziehen: Ein veröffentlichter Beitrag trägt eine Aussage über die
 * Vergangenheit.
 *
 * **Fassungen bleiben unberührt.** Eine Fassung für eine abgeschaltete
 * Plattform wird ohnehin nicht angezeigt, und sie zu leeren hieße, die Arbeit
 * daran wegzuwerfen — sie ist wieder da, sobald die Plattform es ist.
 */
export async function entferneAbgewaehlte(
  kundeId: string,
  bleiben: Plattform[],
): Promise<number> {
  const betroffen = await prisma.post.findMany({
    where: nochNichtDraussen(kundeId),
    select: { id: true, plattformen: true },
  })

  const zuAendern = betroffen.filter((p) => p.plattformen.some((pl) => !bleiben.includes(pl)))
  if (zuAendern.length === 0) return 0

  // Einzeln statt `updateMany`: Jeder Beitrag behält seine eigene Wahl, nur
  // ohne die abgewählten. Ein gemeinsamer Wert würde sie gleichschalten.
  await prisma.$transaction(
    zuAendern.map((p) =>
      prisma.post.update({
        where: { id: p.id },
        data: { plattformen: { set: p.plattformen.filter((pl) => bleiben.includes(pl)) } },
      }),
    ),
  )

  return zuAendern.length
}
