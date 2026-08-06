'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { aktuellerNutzer } from '@/lib/auth'
import { prisma } from '@/lib/db'

/**
 * Kunden anheften — je Nutzer, nicht je Team. Wer drei Kunden betreut, will
 * genau die in der Seitenleiste, nicht alle zwanzig.
 */
export async function favoritUmschalten(kundeId: string) {
  const nutzer = await aktuellerNutzer()
  if (!nutzer) redirect('/anmelden')

  const vorhanden = await prisma.kundeFavorit.findUnique({
    where: { nutzerId_kundeId: { nutzerId: nutzer.id, kundeId } },
  })

  if (vorhanden) {
    await prisma.kundeFavorit.delete({ where: { id: vorhanden.id } })
  } else {
    await prisma.kundeFavorit.create({ data: { nutzerId: nutzer.id, kundeId } })
  }

  // Die Seitenleiste hängt im Layout — ohne dies bliebe sie stehen.
  revalidatePath('/', 'layout')
}
