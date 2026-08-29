'use client'

import type { Freigabestufe } from '@prisma/client'
import { useState } from 'react'
import { freigabeBeschriftung, istInterneStufe, STUFE_TEXT } from '@/lib/freigabe'
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
  gepostet,
  freigaben,
  vorschlagName,
  darfIntern,
}: {
  postId: string
  offen: Freigabestufe | null
  erledigt: boolean
  /** Ändert nur die Wortwahl: „steht auf Final" gegen „ist gepostet". */
  gepostet: boolean
  freigaben: FreigabeZeile[]
  vorschlagName: string | null
  /** Darf die angemeldete Person interne Freigaben erteilen? */
  darfIntern: boolean
}) {
  const [dialog, setDialog] = useState(false)
  // Eine interne Freigabe kommt aus dem Haus und wird hier direkt erteilt —
  // eine externe trägt das Team nur stellvertretend ein.
  const intern = offen !== null && istInterneStufe(offen)

  return (
    <div className="grid gap-3">
      {freigaben.length > 0 && (
        <div className="grid gap-2">
          {freigaben.map((f) => (
            <Karte key={f.id} className="flex flex-wrap items-start justify-between gap-3 p-4">
              <div>
                <div className="text-[13px] font-medium text-final">
                  {STUFE_TEXT[f.stufe]} freigegeben
                  {istInterneStufe(f.stufe) && (
                    <span className="ml-2 rounded-[3px] bg-arbeit-flaeche px-1.5 py-0.5 text-[10.5px] font-normal text-arbeit">
                      intern
                    </span>
                  )}
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
          {gepostet
            ? 'Dieser Beitrag ist gepostet — alle Freigaben sind durch, es steht keine mehr aus.'
            : 'Dieser Beitrag steht auf Final — alle Freigaben sind durch, es steht keine mehr aus.'}
        </Hinweis>
      ) : erledigt ? (
        <Hinweis>
          Die {STUFE_TEXT[offen]}-Freigabe liegt vor. Wechselt der Status weiter, wird die nächste
          Stufe fällig.
        </Hinweis>
      ) : (
        <Karte className="flex flex-wrap items-center justify-between gap-3 p-4">
          <p className="max-w-[420px] text-[12.5px] leading-relaxed text-leise">
            Offen: <strong>{STUFE_TEXT[offen]}</strong>.{' '}
            {intern
              ? 'Eine interne Freigabe: Sie sagt, dass der Beitrag so zum Kunden kann.'
              : 'Normalerweise gibt der Kunde auf der Export-Seite frei. Hat er auf anderem Weg zugestimmt, hier eintragen.'}
            {intern && !darfIntern && (
              <> Erteilen dürfen sie Administration und Projektmanagement.</>
            )}
          </p>
          {(!intern || darfIntern) && (
            <Knopf klein onClick={() => setDialog(true)}>
              {freigabeBeschriftung(offen)}
            </Knopf>
          )}
        </Karte>
      )}

      {dialog && offen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-tinte/25 px-3 sm:px-6">
          <div className="w-full max-w-[440px] rounded-md border border-rahmen bg-flaeche p-5 shadow-xl sm:p-6">
            <h3 className="text-[16px] font-semibold">
              {STUFE_TEXT[offen]}-Freigabe {intern ? 'erteilen' : 'eintragen'}
            </h3>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-leise">
              {intern
                ? 'Eine interne Freigabe — sie bleibt im Haus und taucht beim Kunden nicht auf.'
                : 'Für den Fall, dass der Kunde außerhalb der Export-Seite zugestimmt hat. Der Eintrag ist als „von der Agentur eingetragen" gekennzeichnet.'}
            </p>

            {/*
              Nach dem Eintragen schließt der Dialog von selbst. Ein Fenster,
              das offen bleibt, obwohl die Arbeit getan ist, sieht aus, als
              wäre nichts passiert.
            */}
            <form
              action={async (formular: FormData) => {
                await freigabeEintragen(postId, formular)
                setDialog(false)
              }}
              className="mt-5 grid gap-4"
            >
              <Feld
                beschriftung="Wer hat freigegeben?"
                hinweis={
                  intern
                    ? 'Der eigene Name — er steht später an der Freigabe.'
                    : 'Name der Person beim Kunden — sie steht später an der Freigabe.'
                }
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
