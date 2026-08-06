'use client'

import { Auswahl, Eingabe, Knopf } from '@/components/ui'

export function CustomFeldFormular({ anlegen }: { anlegen: (formular: FormData) => Promise<void> }) {
  return (
    <form action={anlegen} className="flex flex-wrap items-end gap-2">
      <div className="w-[220px]">
        <Eingabe name="name" required placeholder="Feldname, z. B. Drehort" />
      </div>
      <div className="w-[140px]">
        <Auswahl name="typ" defaultValue="TEXT">
          <option value="TEXT">Text</option>
          <option value="DATUM">Datum</option>
          <option value="JANEIN">Ja / Nein</option>
        </Auswahl>
      </div>
      <Knopf klein type="submit">
        Feld hinzufügen
      </Knopf>
    </form>
  )
}
