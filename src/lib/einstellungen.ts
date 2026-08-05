import 'server-only'
import type { Einstellungen } from '@prisma/client'
import { prisma } from './db'

/** Es gibt genau eine Einstellungszeile pro Container. */
export async function ladeEinstellungen(): Promise<Einstellungen> {
  const vorhanden = await prisma.einstellungen.findUnique({ where: { id: 'singleton' } })
  if (vorhanden) return vorhanden
  return prisma.einstellungen.create({ data: { id: 'singleton' } })
}

export async function speichereEinstellungen(
  daten: Partial<Omit<Einstellungen, 'id' | 'aktualisiertAm'>>,
): Promise<Einstellungen> {
  return prisma.einstellungen.upsert({
    where: { id: 'singleton' },
    update: daten,
    create: { id: 'singleton', ...daten },
  })
}
