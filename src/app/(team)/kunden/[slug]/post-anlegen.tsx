'use client'

import type { Plattform, PostTyp, Verhaeltnis } from '@prisma/client'
import { useState } from 'react'
import { ERLAUBT, standardVerhaeltnis, VERHAELTNIS_TEXT } from '@/lib/verhaeltnis'
import { PlattformWahl } from '@/components/plattform-wahl'
import { Eingabe, Feld, Knopf, TYP_FARBE } from '@/components/ui'
import { postAnlegen } from './aktionen'

/**
 * Typwahl als Kacheln statt Dropdown: Es sind genau drei, sie unterscheiden
 * sich in der Form, und die Form ist das Wesentliche an der Entscheidung.
 * Termin und Uhrzeit bleiben hier außen vor — die stehen im Editor.
 */

function IconBeitrag() {
  return (
    <svg width="30" height="30" viewBox="0 0 30 30" fill="none" aria-hidden>
      <rect x="7" y="4" width="16" height="20" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  )
}

function IconKarussell() {
  return (
    <svg width="30" height="30" viewBox="0 0 30 30" fill="none" aria-hidden>
      <rect x="3.5" y="7" width="4" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.4" opacity=".45" />
      <rect x="9.5" y="4" width="16" height="20" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  )
}

function IconReel() {
  return (
    <svg width="30" height="30" viewBox="0 0 30 30" fill="none" aria-hidden>
      <rect x="8" y="3" width="14" height="24" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M13 11.5v7l6-3.5-6-3.5Z" fill="currentColor" />
    </svg>
  )
}

const TYPEN: Array<{ wert: PostTyp; titel: string; text: string; Icon: () => React.ReactElement }> = [
  { wert: 'BEITRAG', titel: 'Beitrag', text: 'Ein Bild', Icon: IconBeitrag },
  { wert: 'KARUSSELL', titel: 'Karussell', text: 'Mehrere Slides', Icon: IconKarussell },
  { wert: 'REEL', titel: 'Reel', text: 'Ein Video', Icon: IconReel },
]

export function PostAnlegen({
  kundeId,
  plattformen,
}: {
  kundeId: string
  /** Die Plattformen des Kunden — vorbelegt, aber hier schon abwählbar. */
  plattformen: Plattform[]
}) {
  const [offen, setOffen] = useState(false)
  const [typ, setTyp] = useState<PostTyp>('BEITRAG')
  const [verhaeltnis, setVerhaeltnis] = useState<Verhaeltnis>(standardVerhaeltnis('BEITRAG'))

  // Der Typ entscheidet, was zur Wahl steht — beim Wechsel auf dessen
  // Standard zurück, sonst bliebe ein Format stehen, das es dort nicht gibt.
  function waehleTyp(neu: PostTyp) {
    setTyp(neu)
    setVerhaeltnis(standardVerhaeltnis(neu))
  }

  if (!offen) {
    return (
      <Knopf art="primaer" onClick={() => setOffen(true)}>
        Neuer Post
      </Knopf>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-tinte/25 px-3 sm:px-6">
      <div className="w-full max-w-[520px] rounded-md border border-rahmen bg-flaeche p-5 shadow-xl sm:p-6">
        <h3 className="mb-1 text-[16px] font-semibold">Neuer Post</h3>
        <p className="mb-5 text-[12.5px] leading-relaxed text-leise">
          Termin, Caption und Medien kommen im nächsten Schritt.
        </p>

        <form action={postAnlegen.bind(null, kundeId)} className="grid gap-5">
          <input type="hidden" name="typ" value={typ} />
          <input type="hidden" name="verhaeltnis" value={verhaeltnis} />

          <div className="grid grid-cols-3 gap-3">
            {TYPEN.map((eintrag) => {
              const aktiv = typ === eintrag.wert
              return (
                <button
                  key={eintrag.wert}
                  type="button"
                  onClick={() => waehleTyp(eintrag.wert)}
                  aria-pressed={aktiv}
                  className={`grid justify-items-center gap-2 rounded-md border px-3 py-4 transition-colors ${
                    aktiv
                      ? 'border-akzent bg-akzent-zart'
                      : 'border-rahmen bg-flaeche hover:border-rahmen-4'
                  }`}
                >
                  <span style={{ color: aktiv ? TYP_FARBE[eintrag.wert] : 'var(--color-stiller)' }}>
                    <eintrag.Icon />
                  </span>
                  <span
                    className={`text-[13px] font-medium ${aktiv ? 'text-tinte' : 'text-tinte-3'}`}
                  >
                    {eintrag.titel}
                  </span>
                  <span className="text-center text-[10.5px] leading-tight text-leiser">
                    {eintrag.text}
                  </span>
                </button>
              )
            })}
          </div>

          <Feld
            beschriftung="Format"
            hinweis={
              typ === 'REEL' && verhaeltnis !== 'VERTIKAL_9_16'
                ? 'Quer oder quadratisch heißt es Video, nicht Reel. Lässt sich später ändern.'
                : 'Lässt sich später ändern.'
            }
          >
            <div className="flex flex-wrap gap-2">
              {ERLAUBT[typ].map((wert, i) => (
                <button
                  key={wert}
                  type="button"
                  onClick={() => setVerhaeltnis(wert)}
                  aria-pressed={verhaeltnis === wert}
                  className={`rounded-[5px] border px-3 py-1.5 text-[12.5px] transition-colors ${
                    verhaeltnis === wert
                      ? 'border-akzent bg-akzent-zart text-tinte'
                      : 'border-rahmen-3 text-leise hover:border-rahmen-4'
                  }`}
                >
                  {VERHAELTNIS_TEXT[wert]}
                  {i === 0 && <span className="ml-1.5 text-[10.5px] text-stiller">Standard</span>}
                </button>
              ))}
            </div>
          </Feld>

          {/*
            Nur bei Kunden, die überhaupt eine Plattform führen. Wo nichts zur
            Wahl steht, ist ein leeres Feld schlechter als gar keines.
          */}
          {plattformen.length > 0 && (
            <Feld beschriftung="Plattformen" hinweis="Aus den Stammdaten vorbelegt.">
              <PlattformWahl auswahl={plattformen} moeglich={plattformen} />
            </Feld>
          )}

          <Feld beschriftung="Titel" hinweis="Nur intern — steht in Listen, Kalender und Klappe.">
            <Eingabe name="titel" required autoFocus placeholder="z. B. Recruiting-Reel" />
          </Feld>

          <div className="flex justify-end gap-2">
            <Knopf type="button" art="leise" onClick={() => setOffen(false)}>
              Abbrechen
            </Knopf>
            <Knopf type="submit" art="primaer">
              Anlegen und bearbeiten
            </Knopf>
          </div>
        </form>
      </div>
    </div>
  )
}
