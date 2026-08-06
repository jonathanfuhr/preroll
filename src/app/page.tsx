import { redirect } from 'next/navigation'
import { aktuellerGast, aktuellerNutzer } from '@/lib/auth'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

/**
 * Die Wurzel hat keinen eigenen Inhalt — sie schickt jeden dorthin, wo er
 * hingehört: in die leere Installation zur Einrichtung, angemeldete
 * Team-Mitglieder zu den Kunden, angemeldete Kunden in ihre Übersicht.
 */
export default async function Startseite() {
  if ((await prisma.nutzer.count()) === 0) redirect('/einrichten')

  if (await aktuellerNutzer()) redirect('/kunden')
  if (await aktuellerGast()) redirect('/portal')

  redirect('/anmelden')
}
