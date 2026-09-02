'use client'

import { useState } from 'react'
import type { Plattform } from '@prisma/client'
import { PLATTFORM_TEXT } from '@/lib/plattformen'
import { Knopf } from './ui'

/**
 * Der Download-Knopf auf der Kundenseite — für den ganzen Monat oben rechts,
 * für einen einzelnen Beitrag in dessen Kopfzeile.
 *
 * **Gefragt wird nur, wenn es etwas zu entscheiden gibt.** Sind die Beiträge
 * auf allen Plattformen gleich, führt der Knopf ohne Umweg zum Archiv: Ein
 * Fenster mit Kästchen, die alle dasselbe liefern, wäre ein Klick ohne
 * Entscheidung. Weicht dagegen eine Fassung ab, hängt es von der Plattform ab,
 * welche Datei die richtige ist — dann steht die Wahl an. Was daraus folgt,
 * rechnet `zipPlattformwahl`.
 *
 * Die beiden Haken des Teams (Captions, Kommentarverlauf) gibt es hier nicht:
 * Die Captions gehören zum Beitrag und kommen immer mit, der Kommentarverlauf
 * ist eine Hausangelegenheit.
 */
export function ZipKnopf({
  url,
  wahl,
  plattformen,
  text,
  art = 'kopf',
}: {
  /** Adresse des Archivs — darf bereits Parameter tragen (`?monat=…`). */
  url: string
  /** Steht eine Wahl an? Sonst führt der Knopf direkt zum Archiv. */
  wahl: boolean
  /**
   * Ohne Wahl: die Plattformen, deren Fassungen gelten (leer = Hauptformat).
   * Mit Wahl: die Plattformen, die zur Auswahl stehen.
   */
  plattformen: Plattform[]
  text: string
  art?: 'kopf' | 'zeile'
}) {
  const [offen, setOffen] = useState(false)
  const [gewaehlt, setGewaehlt] = useState<Plattform[]>(plattformen)

  const stil =
    art === 'kopf'
      ? 'rounded-[5px] border border-rahmen-3 px-3 py-1.5 text-[12px] font-medium text-tinte hover:border-rahmen-4'
      : 'inline-flex items-center gap-1.5 rounded-[4px] border border-rahmen-3 px-2 py-1 text-[11px] text-leiser hover:border-rahmen-4 hover:text-tinte'

  if (!wahl) {
    return (
      <a href={mitPlattformen(url, plattformen)} className={stil}>
        {art === 'zeile' && <Pfeil />}
        {text}
      </a>
    )
  }

  return (
    <>
      <button type="button" onClick={() => setOffen(true)} className={stil}>
        {art === 'zeile' && <Pfeil />}
        {text}
      </button>

      {offen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-tinte/25 px-3 sm:px-6"
          onClick={() => setOffen(false)}
        >
          <div
            className="w-full max-w-[420px] rounded-md border border-rahmen bg-flaeche p-5 shadow-xl sm:p-6"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <h3 className="mb-1.5 text-[15px] font-semibold">Welche Plattformen?</h3>
            <p className="mb-4 text-[12.5px] leading-relaxed text-leiser">
              Die Beiträge sehen nicht überall gleich aus — Text oder Bild weichen je Plattform ab.
              Wählen Sie, welche Fassungen ins Archiv sollen.
            </p>

            <div className="mb-4 grid gap-2">
              {plattformen.map((p) => (
                <label key={p} className="flex items-center gap-2.5 text-[13px] text-tinte-2">
                  <input
                    type="checkbox"
                    checked={gewaehlt.includes(p)}
                    onChange={(e) => {
                      // Erst lesen, dann setzen: Die Updater-Funktion läuft
                      // beim Rendern, und bis dahin hat React das Ereignis
                      // geleert — `e.currentTarget` wäre dort `null`.
                      const an = e.currentTarget.checked
                      setGewaehlt((vorher) =>
                        an ? [...vorher, p] : vorher.filter((x) => x !== p),
                      )
                    }}
                  />
                  {PLATTFORM_TEXT[p]}
                </label>
              ))}
            </div>

            <p className="mb-4 text-[11.5px] leading-relaxed text-stiller">
              {gewaehlt.length > 1
                ? 'Im Archiv liegt ein Ordner je Plattform, darin einer je Beitrag.'
                : 'Im Archiv liegt ein Ordner je Beitrag.'}
            </p>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setOffen(false)}
                className="text-[12px] text-stiller hover:text-tinte"
              >
                Abbrechen
              </button>
              {gewaehlt.length > 0 ? (
                <a
                  href={mitPlattformen(url, gewaehlt)}
                  onClick={() => setOffen(false)}
                  className="rounded-[5px] bg-akzent px-3.5 py-2 text-[12px] font-medium text-white hover:opacity-90"
                >
                  Herunterladen
                </a>
              ) : (
                <Knopf klein art="primaer" type="button" disabled>
                  Herunterladen
                </Knopf>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

/** Hängt die Plattformen an — die Adresse trägt oft schon den Monat. */
function mitPlattformen(url: string, plattformen: Plattform[]): string {
  if (plattformen.length === 0) return url
  const anhang = plattformen.map((p) => `plattform=${p}`).join('&')
  return `${url}${url.includes('?') ? '&' : '?'}${anhang}`
}

function Pfeil() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M8 2v8m0 0 3-3m-3 3L5 7M2.5 12.5h11"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
