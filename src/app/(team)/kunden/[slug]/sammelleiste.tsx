'use client'

import type { PostStatus } from '@prisma/client'
import { useState, useTransition } from 'react'
import { PHASEN, PHASE_TEXT } from '@/lib/status'
import { hatWirkung, kundenwirkung, wirkungSaetze } from '@/lib/kundenwirkung'
import { Knopf } from '@/components/ui'
import { WirkungRueckfrage } from '@/components/wirkung-rueckfrage'
import { postsLoeschen, postsStatusSetzen } from './aktionen'

/** Was die Leiste über die ausgewählten Beiträge wissen muss. */
export type Auswahlposten = { id: string; status: PostStatus; postenAm: Date | null }

/**
 * Was mit der Auswahl geschehen soll — die Leiste über der Tabelle.
 *
 * Sie erscheint erst mit der ersten Auswahl und **klebt oben**: Wer unten in
 * einer langen Liste den letzten Beitrag anhakt, soll nicht erst
 * zurückrollen, um etwas damit zu tun.
 *
 * **Löschen fragt immer nach, ein Phasenwechsel nur, wenn er beim Kunden etwas
 * bewirkt.** Früher fragte er nie — eine Phase ließ sich ja zurückstellen. Mit
 * den Arbeitsphasen stimmt das nur noch halb: Ein Wechsel kann dreißig
 * Beiträge von der Kundenseite nehmen oder den Kunden auf einen früheren Stand
 * zurückwerfen, und der eingefrorene Stand, der dabei überschrieben wird,
 * kommt nicht zurück. Gefragt wird deshalb nach der **Wirkung**, nicht nach
 * der Zahl — und wo keine ist, geht der Wechsel weiter mit einem Klick durch.
 */
export function Sammelleiste({
  slug,
  posten,
  aufAufheben,
}: {
  slug: string
  posten: Auswahlposten[]
  aufAufheben: () => void
}) {
  const [laeuft, starte] = useTransition()
  const [fragt, setFragt] = useState(false)
  const [phasenfrage, setPhasenfrage] = useState<{
    phase: PostStatus
    saetze: string[]
    betroffen: number
  } | null>(null)

  if (posten.length === 0) return null

  const ids = posten.map((p) => p.id)
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
            onClick={() => {
              /*
                Gefragt wird einmal für den ganzen Stapel. Die Sätze werden
                über alle Beiträge gesammelt und entdoppelt: Bei zwanzig
                Beiträgen in derselben Phase steht sonst zwanzigmal dasselbe da.
              */
              const wirkungen = posten
                .map((p) => kundenwirkung(p.status, phase, p.postenAm))
                .filter(hatWirkung)
              if (wirkungen.length === 0) {
                starte(async () => {
                  await postsStatusSetzen(slug, ids, phase)
                  aufAufheben()
                })
                return
              }
              setPhasenfrage({
                phase,
                saetze: [...new Set(wirkungen.flatMap(wirkungSaetze))],
                betroffen: wirkungen.length,
              })
            }}
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

      {phasenfrage && (
        <WirkungRueckfrage
          titel={`${beitraege} auf „${PHASE_TEXT[phasenfrage.phase]}" setzen?`}
          saetze={phasenfrage.saetze}
          bestaetigung={`Auf ${PHASE_TEXT[phasenfrage.phase]} setzen`}
          laeuft={laeuft}
          fuss={
            phasenfrage.betroffen === anzahl
              ? 'Das gilt für alle ausgewählten Beiträge.'
              : `Bei ${phasenfrage.betroffen} von ${anzahl} ausgewählten Beiträgen ändert sich etwas; die übrigen stehen schon so oder bleiben für den Kunden gleich.`
          }
          aufAbbrechen={() => setPhasenfrage(null)}
          aufBestaetigen={() =>
            starte(async () => {
              await postsStatusSetzen(slug, ids, phasenfrage.phase)
              setPhasenfrage(null)
              aufAufheben()
            })
          }
        />
      )}

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
