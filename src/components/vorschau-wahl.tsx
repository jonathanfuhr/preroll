'use client'

import type { Plattform } from '@prisma/client'
import { useState, type ReactNode } from 'react'
import { PLATTFORM_TEXT } from '@/lib/plattformen'
import { PlattformMarke } from './plattform-marken'

export type Vorschauart = {
  /** Wofür diese Ansicht steht — trägt Beschriftung und Marke. */
  plattform: Plattform
  inhalt: ReactNode
}

/**
 * Die Vorschau eines Beitrags, und darüber die Wahl, auf welcher Plattform.
 *
 * **Nur wo derselbe Inhalt an mehrere Plattformen geht.** Instagram im
 * Geräterahmen und LinkedIn im Fenster untereinander zu stellen hieße,
 * denselben Text zweimal zu zeigen und den Kunden zweimal dasselbe lesen zu
 * lassen. Wo die Inhalte sich unterscheiden, steht jede Fassung ohnehin in
 * einer eigenen Zeile — dann gibt es hier nichts zu wählen und der Umschalter
 * fällt weg.
 *
 * Facebook bekommt vorerst den Instagram-Rahmen: Ein eigenes Fenster dafür ist
 * nicht gezeichnet, und ein Umschalter mit zwei gleich aussehenden Ansichten
 * wäre eine Wahl ohne Unterschied.
 */
export function VorschauWahl({ arten }: { arten: Vorschauart[] }) {
  const [aktiv, setAktiv] = useState(0)
  const gewaehlt = arten[Math.min(aktiv, arten.length - 1)]

  return (
    /*
      Feste Handybreite statt „so breit wie der Inhalt": Sonst wäre die Spalte
      beim Geräterahmen 344 px und beim LinkedIn-Fenster nur so breit wie sein
      Bild — bei jedem Umschalten spränge das Layout.
    */
    <div className="grid w-[344px] max-w-full gap-3 justify-self-center lg:justify-self-start">
      {arten.length > 1 && (
        <div className="flex flex-wrap gap-1 rounded-[6px] border border-rahmen bg-flaeche-leise p-1">
          {arten.map((art, i) => (
            <button
              key={art.plattform}
              type="button"
              onClick={() => setAktiv(i)}
              aria-current={i === aktiv}
              className={`flex items-center gap-1.5 rounded-[4px] px-2.5 py-1.5 text-[12px] font-medium transition-colors ${
                i === aktiv
                  ? 'bg-flaeche text-tinte shadow-[0_1px_2px_rgba(28,22,16,.08)]'
                  : 'text-stiller hover:text-tinte'
              }`}
            >
              <PlattformMarke plattform={art.plattform} groesse={13} />
              {PLATTFORM_TEXT[art.plattform]}
            </button>
          ))}
        </div>
      )}

      {gewaehlt.inhalt}
    </div>
  )
}
