'use client'

import type { PostTyp } from '@prisma/client'
import { useState } from 'react'
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
  { wert: 'BEITRAG', titel: 'Beitrag', text: 'Ein Bild · 4:5', Icon: IconBeitrag },
  { wert: 'KARUSSELL', titel: 'Karussell', text: 'Mehrere Slides · 4:5', Icon: IconKarussell },
  { wert: 'REEL', titel: 'Reel', text: 'Video · 9:16', Icon: IconReel },
]

export function PostAnlegen({ kundeId }: { kundeId: string }) {
  const [offen, setOffen] = useState(false)
  const [typ, setTyp] = useState<PostTyp>('BEITRAG')

  if (!offen) {
    return (
      <Knopf art="primaer" onClick={() => setOffen(true)}>
        Neuer Post
      </Knopf>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-tinte/25 px-6">
      <div className="w-full max-w-[520px] rounded-md border border-rahmen bg-flaeche p-6 shadow-xl">
        <h3 className="mb-1 text-[16px] font-semibold">Neuer Post</h3>
        <p className="mb-5 text-[12.5px] leading-relaxed text-leise">
          Termin, Caption und Medien kommen im nächsten Schritt.
        </p>

        <form action={postAnlegen.bind(null, kundeId)} className="grid gap-5">
          <input type="hidden" name="typ" value={typ} />

          <div className="grid grid-cols-3 gap-3">
            {TYPEN.map((eintrag) => {
              const aktiv = typ === eintrag.wert
              return (
                <button
                  key={eintrag.wert}
                  type="button"
                  onClick={() => setTyp(eintrag.wert)}
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
