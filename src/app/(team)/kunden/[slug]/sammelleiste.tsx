'use client'

import type { PostStatus } from '@prisma/client'
import { useState, useTransition } from 'react'
import { PHASEN, PHASE_TEXT } from '@/lib/status'
import { Knopf } from '@/components/ui'
import { postsLoeschen, postsStatusSetzen } from './aktionen'

/**
 * Was mit der Auswahl geschehen soll — die Leiste über der Tabelle.
 *
 * Sie erscheint erst mit der ersten Auswahl und **klebt oben**: Wer unten in
 * einer langen Liste den letzten Beitrag anhakt, soll nicht erst
 * zurückrollen, um etwas damit zu tun.
 *
 * **Löschen fragt nach, Phasenwechsel nicht.** Eine Phase lässt sich
 * zurückstellen; dreißig gelöschte Beiträge sind weg — samt Kommentaren und
 * Freigaben, die daran hängen. Der Rückfragetext nennt deshalb die Zahl, nicht
 * bloß „wirklich?".
 */
export function Sammelleiste({
  slug,
  ids,
  aufAufheben,
}: {
  slug: string
  ids: string[]
  aufAufheben: () => void
}) {
  const [laeuft, starte] = useTransition()
  const [fragt, setFragt] = useState(false)

  if (ids.length === 0) return null

  const anzahl = ids.length
  const beitraege = `${anzahl} ${anzahl === 1 ? 'Beitrag' : 'Beiträge'}`

  return (
    <div className="sticky top-2 z-20 mb-4 flex flex-wrap items-center gap-x-4 gap-y-3 rounded-md border border-rahmen-4 bg-flaeche px-4 py-3 shadow-md">
      <span className="text-[12.5px] font-medium text-tinte">{beitraege} ausgewählt</span>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11.5px] text-still">Phase setzen:</span>
        {PHASEN.map((phase: PostStatus) => (
          <button
            key={phase}
            type="button"
            disabled={laeuft}
            onClick={() =>
              starte(async () => {
                await postsStatusSetzen(slug, ids, phase)
                aufAufheben()
              })
            }
            className="rounded-[5px] border border-rahmen-3 px-2.5 py-1 text-[11.5px] font-medium text-tinte-3 transition-colors hover:border-rahmen-4 hover:text-tinte disabled:opacity-50"
          >
            {PHASE_TEXT[phase]}
          </button>
        ))}
      </div>

      <div className="ml-auto flex items-center gap-3">
        <button
          type="button"
          onClick={aufAufheben}
          className="text-[11.5px] text-stiller hover:text-tinte"
        >
          Auswahl aufheben
        </button>
        <button
          type="button"
          disabled={laeuft}
          onClick={() => setFragt(true)}
          className="rounded-[5px] border border-rahmen-3 px-2.5 py-1 text-[11.5px] font-medium text-akzent transition-colors hover:border-akzent disabled:opacity-50"
        >
          Löschen
        </button>
      </div>

      {fragt && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-tinte/25 px-3 sm:px-6"
          onClick={() => setFragt(false)}
        >
          <div
            className="w-full max-w-[400px] rounded-md border border-rahmen bg-flaeche p-5 shadow-xl sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-1 text-[15px] font-semibold">{beitraege} löschen?</h3>
            <p className="mb-5 text-[12px] leading-relaxed text-leise">
              Mit den Beiträgen verschwinden ihre Kommentare, Freigaben und Fassungen. Die
              hochgeladenen Dateien bleiben in der Bibliothek. Rückgängig geht das nicht.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setFragt(false)}
                className="text-[12px] text-stiller hover:text-tinte"
              >
                Abbrechen
              </button>
              <Knopf
                klein
                art="primaer"
                type="button"
                onClick={() =>
                  starte(async () => {
                    await postsLoeschen(slug, ids)
                    setFragt(false)
                    aufAufheben()
                  })
                }
              >
                {laeuft ? 'Wird gelöscht …' : 'Löschen'}
              </Knopf>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
