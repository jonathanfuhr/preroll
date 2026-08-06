'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import { Fehler, Hinweis, Knopf } from '@/components/ui'
import { szenenplanUebertragen } from '../../aktionen'
import type { Szene } from './szenenplan'

export type Zielreel = {
  id: string
  titel: string
  postenAm: string | null
  szenen: Szene[]
}

const TERMIN = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })

/**
 * Einen Ablauf auf ein anderes Reel übertragen.
 *
 * Der heikle Fall ist das Ziel, in dem schon etwas steht: Ein stilles
 * Überschreiben wäre nicht rückgängig zu machen. Deshalb stehen beide Pläne
 * nebeneinander, bevor irgendetwas passiert.
 */
export function SzenenplanUebertragen({
  postId,
  szenen,
  ziele,
}: {
  postId: string
  szenen: Szene[]
  ziele: Zielreel[]
}) {
  const router = useRouter()
  const [offen, setOffen] = useState(false)
  const [gewaehlt, setGewaehlt] = useState<Zielreel | null>(null)
  const [laeuft, starteUebergang] = useTransition()

  useEffect(() => {
    if (!offen) return
    const vorher = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const beiTaste = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOffen(false)
    }
    window.addEventListener('keydown', beiTaste)
    return () => {
      document.body.style.overflow = vorher
      window.removeEventListener('keydown', beiTaste)
    }
  }, [offen])

  function schliessen() {
    setOffen(false)
    setGewaehlt(null)
  }

  function uebertrage(ziel: Zielreel) {
    starteUebergang(async () => {
      await szenenplanUebertragen(postId, ziel.id)
      router.refresh()
      schliessen()
    })
  }

  if (szenen.length === 0) return null

  if (!offen) {
    return (
      <button
        type="button"
        onClick={() => setOffen(true)}
        className="rounded-[4px] border border-rahmen-3 bg-flaeche px-3.5 py-2 text-[12.5px] text-tinte transition-colors hover:border-akzent hover:text-akzent"
      >
        Auf anderes Reel übertragen
      </button>
    )
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-tinte/25 px-6 py-10"
      onClick={schliessen}
    >
      <div
        className="w-full max-w-[760px] rounded-md border border-rahmen bg-flaeche p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-[16px] font-semibold">Ablauf übertragen</h3>
            <p className="mt-1 text-[12.5px] text-leise">
              {gewaehlt
                ? 'Der Ablauf des Ziels wird ersetzt.'
                : `${szenen.length} Szenen auf ein anderes Reel dieses Kunden kopieren.`}
            </p>
          </div>
          <button
            type="button"
            onClick={schliessen}
            className="text-[18px] leading-none text-still hover:text-tinte"
            aria-label="Schließen"
          >
            ×
          </button>
        </div>

        {!gewaehlt ? (
          ziele.length === 0 ? (
            <Hinweis>Dieser Kunde hat kein weiteres Reel.</Hinweis>
          ) : (
            <div className="grid gap-2">
              {ziele.map((ziel) => (
                <button
                  key={ziel.id}
                  type="button"
                  onClick={() => (ziel.szenen.length > 0 ? setGewaehlt(ziel) : uebertrage(ziel))}
                  disabled={laeuft}
                  className="flex items-center justify-between gap-4 rounded-md border border-rahmen px-4 py-3 text-left transition-colors hover:border-rahmen-4 disabled:opacity-50"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-medium text-tinte">
                      {ziel.titel}
                    </span>
                    <span className="mt-0.5 block text-[11.5px] text-leiser">
                      {ziel.postenAm ? TERMIN.format(new Date(ziel.postenAm)) : 'ungeplant'}
                      {ziel.szenen.length > 0
                        ? ` · hat bereits ${ziel.szenen.length} Szenen`
                        : ' · noch kein Ablauf'}
                    </span>
                  </span>
                  <span className="shrink-0 text-[11.5px] text-still">
                    {ziel.szenen.length > 0 ? 'Vergleichen' : 'Übertragen'}
                  </span>
                </button>
              ))}
            </div>
          )
        ) : (
          <>
            <div className="mb-4">
              <Fehler>
                <strong className="font-semibold">{gewaehlt.titel}</strong> hat bereits einen
                Ablauf mit {gewaehlt.szenen.length} Szenen. Beim Übertragen geht er verloren — das
                lässt sich nicht rückgängig machen.
              </Fehler>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Spalte titel="Wird übertragen" szenen={szenen} betont />
              <Spalte titel={`Wird ersetzt: ${gewaehlt.titel}`} szenen={gewaehlt.szenen} />
            </div>

            <div className="mt-5 flex justify-end gap-2 border-t border-rahmen pt-4">
              <Knopf klein art="leise" onClick={() => setGewaehlt(null)} disabled={laeuft}>
                Zurück
              </Knopf>
              <Knopf klein art="primaer" onClick={() => uebertrage(gewaehlt)} disabled={laeuft}>
                {laeuft ? 'Wird übertragen …' : 'Ja, überschreiben'}
              </Knopf>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function Spalte({
  titel,
  szenen,
  betont,
}: {
  titel: string
  szenen: Szene[]
  betont?: boolean
}) {
  return (
    <div
      className={`overflow-hidden rounded-md border ${betont ? 'border-akzent' : 'border-rahmen'}`}
    >
      <div
        className={`border-b px-3.5 py-2 text-[11px] uppercase tracking-[0.1em] ${
          betont ? 'border-akzent/30 bg-akzent-zart text-akzent' : 'border-rahmen bg-flaeche-leise text-still'
        }`}
      >
        {titel}
      </div>

      <ol className="max-h-[300px] overflow-y-auto">
        {szenen.map((szene, i) => (
          <li key={szene.id} className="border-b border-rahmen px-3.5 py-2.5 last:border-b-0">
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-[10px] text-still">{i + 1}</span>
              <span className="text-[12px] font-medium text-tinte">{szene.abschnitt}</span>
            </div>
            {szene.bildSzene && (
              <p className="mt-1 line-clamp-2 text-[11.5px] leading-relaxed text-leise">
                {szene.bildSzene}
              </p>
            )}
            {szene.sprechertext && (
              <p className="mt-1 line-clamp-2 text-[11.5px] italic leading-relaxed text-leiser">
                „{szene.sprechertext}"
              </p>
            )}
          </li>
        ))}
      </ol>
    </div>
  )
}
