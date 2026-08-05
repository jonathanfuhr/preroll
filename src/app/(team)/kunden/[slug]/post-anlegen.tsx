'use client'

import { useState } from 'react'
import { Auswahl, Eingabe, Feld, Knopf } from '@/components/ui'
import { postAnlegen } from './aktionen'

export function PostAnlegen({ kundeId }: { kundeId: string }) {
  const [offen, setOffen] = useState(false)
  const heute = new Date().toISOString().slice(0, 10)

  if (!offen) {
    return (
      <Knopf art="primaer" onClick={() => setOffen(true)}>
        Post anlegen
      </Knopf>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-tinte/25 px-6">
      <div className="w-full max-w-[420px] rounded-md border border-rahmen bg-flaeche p-6 shadow-xl">
        <h3 className="mb-5 text-[16px] font-semibold">Post anlegen</h3>

        <form action={postAnlegen.bind(null, kundeId)} className="grid gap-4">
          <Feld beschriftung="Typ">
            <Auswahl name="typ" defaultValue="BEITRAG">
              <option value="REEL">Reel · 9:16</option>
              <option value="KARUSSELL">Karussell · 4:5</option>
              <option value="BEITRAG">Beitrag · 4:5</option>
            </Auswahl>
          </Feld>

          <Feld beschriftung="Titel">
            <Eingabe name="titel" required placeholder="z. B. Recruiting-Reel" autoFocus />
          </Feld>

          <div className="grid grid-cols-[1fr_110px] gap-3">
            <Feld beschriftung="Posting-Datum">
              <Eingabe name="postenAm" type="date" defaultValue={heute} required />
            </Feld>
            <Feld beschriftung="Uhrzeit">
              <Eingabe name="uhrzeit" type="time" defaultValue="10:00" required />
            </Feld>
          </div>

          <div className="mt-1 flex justify-end gap-2">
            <Knopf type="button" art="leise" onClick={() => setOffen(false)}>
              Abbrechen
            </Knopf>
            <Knopf type="submit" art="primaer">
              Anlegen
            </Knopf>
          </div>
        </form>
      </div>
    </div>
  )
}
