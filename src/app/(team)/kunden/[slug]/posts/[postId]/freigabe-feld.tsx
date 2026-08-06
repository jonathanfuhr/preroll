'use client'

import type { Freigabestufe } from '@prisma/client'
import { useState } from 'react'
import { freigabeBeschriftung, STUFE_TEXT } from '@/lib/freigabe'
import { Eingabe, Feld, Hinweis, Karte, Knopf, Textfeld } from '@/components/ui'
import { freigabeEintragen, freigabeZuruecknehmen } from '../../aktionen'

const ZEIT = new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' })

export type FreigabeZeile = {
  id: string
  stufe: Freigabestufe
  autorName: string
  notiz: string | null
  am: string
  vomTeam: boolean
}

/**
 * Freigaben eines Posts im Backend. Der Kunde gibt normalerweise auf der
 * Export-Seite frei — sagt er stattdessen am Telefon oder per Mail zu, trägt
 * das Team die Freigabe hier ein.
 */
export function FreigabeFeld({
  postId,
  offen,
  erledigt,
  freigaben,
  vorschlagName,
}: {
  postId: string
  offen: Freigabestufe | null
  erledigt: boolean
  freigaben: FreigabeZeile[]
  vorschlagName: string | null
}) {
  const [dialog, setDialog] = useState(false)

  return (
    <div className="grid gap-3">
      {freigaben.length > 0 && (
        <div className="grid gap-2">
          {freigaben.map((f) => (
            <Karte key={f.id} className="flex flex-wrap items-start justify-between gap-3 p-4">
              <div>
                <div className="text-[13px] font-medium text-final">
                  {STUFE_TEXT[f.stufe]} freigegeben
                </div>
                <p className="mt-1 text-[11.5px] text-leiser">
                  von {f.autorName} · {ZEIT.format(new Date(f.am))}
                  {f.vomTeam && ' · von der Agentur eingetragen'}
                </p>
                {f.notiz && (
                  <p className="mt-2 whitespace-pre-wrap text-[12.5px] leading-relaxed text-tinte-3">
                    {f.notiz}
                  </p>
                )}
              </div>
              <form action={freigabeZuruecknehmen.bind(null, f.id)}>
                <button type="submit" className="text-[11.5px] text-stiller hover:text-akzent">
                  zurücknehmen
                </button>
              </form>
            </Karte>
          ))}
        </div>
      )}

      {!offen ? (
        <Hinweis>
          Dieser Beitrag steht auf Final — Konzept und Vorschau sind durch, es steht keine Freigabe
          mehr aus.
        </Hinweis>
      ) : erledigt ? (
        <Hinweis>
          Die {STUFE_TEXT[offen]}-Freigabe liegt vor. Wechselt der Status weiter, wird die nächste
          Stufe fällig.
        </Hinweis>
      ) : (
        <Karte className="flex flex-wrap items-center justify-between gap-3 p-4">
          <p className="max-w-[420px] text-[12.5px] leading-relaxed text-leise">
            Offen: <strong>{STUFE_TEXT[offen]}</strong>. Normalerweise gibt der Kunde auf der
            Export-Seite frei. Hat er auf anderem Weg zugestimmt, hier eintragen.
          </p>
          <Knopf klein onClick={() => setDialog(true)}>
            {freigabeBeschriftung(offen)}
          </Knopf>
        </Karte>
      )}

      {dialog && offen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-tinte/25 px-6">
          <div className="w-full max-w-[440px] rounded-md border border-rahmen bg-flaeche p-6 shadow-xl">
            <h3 className="text-[16px] font-semibold">{STUFE_TEXT[offen]}-Freigabe eintragen</h3>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-leise">
              Für den Fall, dass der Kunde außerhalb der Export-Seite zugestimmt hat. Der Eintrag
              ist als „von der Agentur eingetragen" gekennzeichnet.
            </p>

            <form action={freigabeEintragen.bind(null, postId)} className="mt-5 grid gap-4">
              <Feld
                beschriftung="Wer hat freigegeben?"
                hinweis="Name der Person beim Kunden — sie steht später an der Freigabe."
              >
                <Eingabe
                  name="autorName"
                  required
                  autoFocus
                  defaultValue={vorschlagName ?? ''}
                  placeholder="Vor- und Nachname"
                />
              </Feld>
              <Feld beschriftung="Notiz" hinweis="Etwa: telefonisch am 06.08. bestätigt.">
                <Textfeld name="notiz" rows={3} />
              </Feld>
              <div className="flex justify-end gap-2">
                <Knopf type="button" art="leise" onClick={() => setDialog(false)}>
                  Abbrechen
                </Knopf>
                <Knopf art="primaer" type="submit">
                  Eintragen
                </Knopf>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
