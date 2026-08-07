'use client'

import type { PostStatus } from '@prisma/client'
import { useEffect, useRef, useState } from 'react'
import { naechstePhase, PHASEN, PHASE_TEXT } from '@/lib/status'
import { Knopf } from '@/components/ui'
import { postLoeschen, postStatusSetzen } from './aktionen'

/**
 * Die zwei Handgriffe, die man in einer Liste am häufigsten braucht: einen
 * Beitrag eine Phase weiterschieben und ihn wegräumen.
 *
 * Der Phasenknopf steht offen, weil er der Normalfall ist — Entwurf wird
 * Konzept, Konzept wird Vorschau, Vorschau wird Final. Alles andere liegt
 * hinter dem Menü: eine Phase zurück ist selten und Löschen soll man nicht
 * aus Versehen treffen.
 */
export function ZeilenMenue({ postId, status }: { postId: string; status: PostStatus }) {
  const [offen, setOffen] = useState(false)
  const [statusDialog, setStatusDialog] = useState(false)
  const menue = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!offen) return
    const zu = (e: PointerEvent) => {
      if (!menue.current?.contains(e.target as Node)) setOffen(false)
    }
    document.addEventListener('pointerdown', zu)
    return () => document.removeEventListener('pointerdown', zu)
  }, [offen])

  const naechste = naechstePhase(status)

  return (
    <div className="flex items-center justify-end gap-1">
      {naechste ? (
        <form action={postStatusSetzen.bind(null, postId, naechste)}>
          <button
            type="submit"
            className="whitespace-nowrap rounded-[5px] border border-rahmen-3 px-2.5 py-1 text-[11.5px] font-medium text-tinte-3 transition-colors hover:border-rahmen-4 hover:text-tinte"
          >
            Status wechseln: {PHASE_TEXT[naechste]}
          </button>
        </form>
      ) : (
        // Final ist das Ende der Kette — „Gepostet" wird berechnet, nicht gesetzt.
        <span className="px-2.5 text-[11.5px] text-stiller">—</span>
      )}

      <div className="relative" ref={menue}>
        <button
          type="button"
          aria-label="Weitere Aktionen"
          aria-expanded={offen}
          onClick={() => setOffen((v) => !v)}
          className="rounded-[5px] px-2 py-1 text-[14px] leading-none text-stiller transition-colors hover:bg-flaeche-tief hover:text-tinte"
        >
          …
        </button>

        {offen && (
          <div className="absolute right-0 top-full z-30 mt-1 w-[190px] overflow-hidden rounded-md border border-rahmen bg-flaeche py-1 shadow-lg">
            <button
              type="button"
              onClick={() => {
                setOffen(false)
                setStatusDialog(true)
              }}
              className="block w-full px-3 py-2 text-left text-[12.5px] text-tinte-3 hover:bg-flaeche-tief hover:text-tinte"
            >
              Status wechseln
            </button>

            <form action={postLoeschen.bind(null, postId)}>
              <button
                type="submit"
                className="block w-full px-3 py-2 text-left text-[12.5px] text-stiller hover:bg-flaeche-tief hover:text-akzent"
              >
                Löschen
              </button>
            </form>
          </div>
        )}
      </div>

      {statusDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-tinte/25 px-6"
          onClick={() => setStatusDialog(false)}
        >
          <div
            className="w-full max-w-[380px] rounded-md border border-rahmen bg-flaeche p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-1 text-[15px] font-semibold">Status wechseln</h3>
            <p className="mb-4 text-[12px] leading-relaxed text-leise">
              Ein Entwurf bleibt intern. Ab dem Konzept sieht der Kunde den Beitrag in seiner
              Freigabe.
            </p>

            <div className="grid gap-2">
              {PHASEN.map((phase) => (
                /*
                  Geschlossen wird über `onSubmit`, nicht über `onClick` am
                  Knopf: Ein Klick-Handler läuft **vor** dem Absenden, das
                  Schließen hängt den Dialog samt Formular aus — und die
                  Server-Aktion kam nie los. Genau daran ist die erste
                  Fassung gescheitert.
                */
                <form
                  key={phase}
                  action={postStatusSetzen.bind(null, postId, phase)}
                  onSubmit={() => setStatusDialog(false)}
                >
                  <button
                    type="submit"
                    disabled={phase === status}
                    className={`flex w-full items-center gap-2.5 rounded-[5px] border px-3.5 py-2.5 text-left text-[13px] transition-colors ${
                      phase === status
                        ? 'border-akzent bg-akzent-zart font-medium text-tinte'
                        : 'border-rahmen text-tinte-3 hover:border-rahmen-4'
                    }`}
                  >
                    {phase === status && (
                      <span aria-hidden className="block size-[6px] rounded-full bg-akzent" />
                    )}
                    {PHASE_TEXT[phase]}
                    {phase === status && (
                      <span className="ml-auto text-[11px] text-leiser">aktuell</span>
                    )}
                  </button>
                </form>
              ))}
            </div>

            <div className="mt-5 flex justify-end">
              <Knopf klein art="leise" onClick={() => setStatusDialog(false)}>
                Schließen
              </Knopf>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
