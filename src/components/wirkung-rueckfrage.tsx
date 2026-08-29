'use client'

import type { ReactNode } from 'react'
import { Knopf } from './ui'

/**
 * Die Rückfrage vor einem Phasenwechsel, der beim Kunden etwas bewirkt.
 *
 * Sie erscheint **nur dann** — ein Fenster, das bei jedem Klick aufgeht, wird
 * weggeklickt, ohne gelesen zu werden, und schützt dann vor gar nichts. Wo der
 * Wechsel eine reine Hausangelegenheit ist, geht er weiterhin mit einem Klick
 * durch.
 *
 * Der Knopf bestätigt und heißt nach der Sache („Auf Produktion setzen"), nicht
 * „OK": Was man bestätigt, soll auch auf dem Knopf stehen.
 */
export function WirkungRueckfrage({
  titel,
  saetze,
  bestaetigung,
  laeuft,
  aufAbbrechen,
  aufBestaetigen,
  fuss,
}: {
  titel: string
  saetze: string[]
  /** Beschriftung des bestätigenden Knopfs. */
  bestaetigung: string
  laeuft?: boolean
  aufAbbrechen: () => void
  aufBestaetigen: () => void
  /** Zusatz unter den Sätzen, etwa die Zahl der betroffenen Beiträge. */
  fuss?: ReactNode
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-tinte/25 px-3 sm:px-6"
      onClick={aufAbbrechen}
    >
      <div
        className="w-full max-w-[440px] rounded-md border border-rahmen bg-flaeche p-5 shadow-xl sm:p-6"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <h3 className="mb-2 text-[15px] font-semibold">{titel}</h3>

        <ul className="mb-4 grid gap-2">
          {saetze.map((satz) => (
            <li
              key={satz}
              className="rounded-[5px] bg-arbeit-flaeche px-3 py-2 text-[12.5px] leading-relaxed text-tinte-3"
            >
              {satz}
            </li>
          ))}
        </ul>

        {fuss && <p className="mb-4 text-[11.5px] leading-relaxed text-leiser">{fuss}</p>}

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={aufAbbrechen}
            className="text-[12px] text-stiller hover:text-tinte"
          >
            Abbrechen
          </button>
          <Knopf klein art="primaer" type="button" disabled={laeuft} onClick={aufBestaetigen}>
            {laeuft ? 'Wird gesetzt …' : bestaetigung}
          </Knopf>
        </div>
      </div>
    </div>
  )
}
