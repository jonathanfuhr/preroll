import 'server-only'
import { prisma } from './db'
import type { Erwaehnbar } from '@/components/kommentar-feld'

/**
 * Wer in einem Kommentar erwähnt werden kann: das aktive Team und die Gäste
 * dieses Kunden. Beide Seiten sehen dieselbe Liste — der Kunde soll die
 * Person ansprechen können, die seinen Beitrag betreut, und das Team den
 * Kontakt, der geantwortet hat.
 *
 * Gefragt wird nach dem **Kunden**, nicht nach einem einzelnen Link: Wer zu
 * einem Monat eingeladen war, ist im nächsten dieselbe Ansprechperson, und
 * an einem Beitrag ohne Rückmeldung gibt es noch gar keinen Link, an dem
 * sich eine Gästeliste festmachen ließe.
 *
 * Gäste ohne Namen bleiben draußen: Das sind angefangene Anmeldungen, hinter
 * denen noch niemand steht.
 */
export async function erwaehnbarePersonen(kundeId: string): Promise<Erwaehnbar[]> {
  const [team, beteiligungen] = await Promise.all([
    prisma.nutzer.findMany({
      where: { aktiv: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
    prisma.exportGast.findMany({
      where: { export: { kundeId } },
      include: { gast: { select: { id: true, name: true } } },
    }),
  ])

  const gaeste = new Map(
    beteiligungen.filter((b) => b.gast.name.trim()).map((b) => [b.gast.id, b.gast]),
  )

  return [
    ...team.map((n) => ({ art: 'nutzer' as const, id: n.id, name: n.name, zusatz: 'Agentur' })),
    ...[...gaeste.values()].map((g) => ({
      art: 'gast' as const,
      id: g.id,
      name: g.name,
      zusatz: 'Kunde',
    })),
  ]
}
