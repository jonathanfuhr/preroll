import { redirect } from 'next/navigation'
import { aktuellerNutzer } from '@/lib/auth'
import { darfVerwalten } from '@/lib/rollen'
import { EinstellungenReiter } from './reiter'

/** Einstellungen sind Administrationssache — und in Bereiche aufgeteilt. */
export default async function EinstellungenLayout({ children }: { children: React.ReactNode }) {
  const nutzer = await aktuellerNutzer()
  if (!nutzer) redirect('/anmelden')
  if (!darfVerwalten(nutzer.rolle)) redirect('/kunden')

  return (
    <div className="max-w-[820px]">
      <h1 className="mb-5 text-[24px] font-semibold tracking-[-0.02em]">Einstellungen</h1>
      <EinstellungenReiter />
      <div className="pt-7">{children}</div>
    </div>
  )
}
