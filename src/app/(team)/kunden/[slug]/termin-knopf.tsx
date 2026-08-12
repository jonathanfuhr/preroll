'use client'

import { useState } from 'react'
import { Knopf } from '@/components/ui'
import { postTerminSetzen } from './aktionen'

const DATUM = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
const UHRZEIT = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' })

/** `2026-08-11` und `10:00` — die Werte, die `<input type="date|time">` erwartet. */
function felder(termin: Date | null): { datum: string; uhrzeit: string } {
  if (!termin) return { datum: '', uhrzeit: '' }
  const zwei = (n: number) => String(n).padStart(2, '0')
  return {
    datum: `${termin.getFullYear()}-${zwei(termin.getMonth() + 1)}-${zwei(termin.getDate())}`,
    uhrzeit: `${zwei(termin.getHours())}:${zwei(termin.getMinutes())}`,
  }
}

/**
 * Der Termin in der Post-Liste — anzusehen und mit einem Klick zu ändern.
 *
 * Umplanen war bisher zweierlei: im Kalender ziehen oder den Post öffnen und
 * das Formular speichern. Für „der geht doch erst Donnerstag raus" ist beides
 * zu weit; die Zeile, in der das Datum steht, ist der nächstliegende Ort.
 *
 * Bewusst kein Speichern beim Tippen: Datum und Uhrzeit gehören zusammen, und
 * ein Zwischenstand — neuer Tag, alte Uhrzeit — wäre ein Termin, den niemand
 * gewollt hat. Deshalb OK und Abbrechen.
 */
export function TerminKnopf({
  postId,
  postenAm,
  standardUhrzeit,
}: {
  postId: string
  postenAm: Date | null
  /** Vorbelegung für einen noch ungeplanten Beitrag — die Hausregel des Kunden. */
  standardUhrzeit: string
}) {
  const [offen, setOffen] = useState(false)
  const start = felder(postenAm)

  return (
    <>
      <button
        type="button"
        onClick={() => setOffen(true)}
        title="Termin ändern"
        className="-mx-1 rounded-[4px] px-1 py-0.5 text-left transition-colors hover:bg-flaeche-tief"
      >
        {postenAm ? (
          <>
            {DATUM.format(postenAm)}
            {/* Am Telefon zweizeilig — nebeneinander kosten sie 55 px, die dem Titel fehlen. */}
            <span className="block text-still md:ml-1.5 md:inline">{UHRZEIT.format(postenAm)}</span>
          </>
        ) : (
          <span className="text-stiller">ungeplant</span>
        )}
      </button>

      {offen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-tinte/25 px-3 sm:px-6"
          onClick={() => setOffen(false)}
        >
          <div
            className="w-full max-w-[360px] rounded-md border border-rahmen bg-flaeche p-5 shadow-xl sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-1 text-[15px] font-semibold">Termin</h3>
            <p className="mb-4 text-[12px] leading-relaxed text-leise">
              Ohne Datum steht der Beitrag wieder unter „Ungeplant" und erscheint in keiner
              Freigabe.
            </p>

            {/*
              Geschlossen wird über `onSubmit` am Formular, nicht über `onClick`
              am Knopf: Ein Klick-Handler läuft **vor** dem Absenden und hängt
              das Formular aus, bevor die Server-Aktion loskommt.
            */}
            <form
              action={postTerminSetzen.bind(null, postId)}
              onSubmit={() => setOffen(false)}
              className="grid gap-4"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-1.5">
                  <span className="text-[11px] uppercase tracking-[0.1em] text-still">Datum</span>
                  <input
                    type="date"
                    name="datum"
                    defaultValue={start.datum}
                    autoFocus
                    className="w-full rounded-[5px] border border-rahmen-3 bg-flaeche px-3 py-2 text-[13px] text-tinte focus:border-rahmen-4 focus:outline-none"
                  />
                </label>

                <label className="grid gap-1.5">
                  <span className="text-[11px] uppercase tracking-[0.1em] text-still">Uhrzeit</span>
                  <input
                    type="time"
                    name="uhrzeit"
                    defaultValue={start.uhrzeit || standardUhrzeit}
                    className="w-full rounded-[5px] border border-rahmen-3 bg-flaeche px-3 py-2 text-[13px] text-tinte focus:border-rahmen-4 focus:outline-none"
                  />
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-rahmen pt-4">
                <button
                  type="button"
                  onClick={() => setOffen(false)}
                  className="text-[12px] text-stiller hover:text-tinte"
                >
                  Abbrechen
                </button>
                <Knopf klein art="primaer" type="submit">
                  OK
                </Knopf>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
