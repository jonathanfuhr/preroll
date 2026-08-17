'use client'

import type { Plattform, Verhaeltnis } from '@prisma/client'
import { useState } from 'react'
import { PLATTFORM_TEXT } from '@/lib/plattformen'
import { ERLAUBT, VERHAELTNIS_MASSE, VERHAELTNIS_TEXT } from '@/lib/verhaeltnis'
import { Auswahl, Feld, Hinweis, Knopf, Textfeld } from '@/components/ui'

export type VariantenZeile = {
  id: string
  plattformen: Plattform[]
  caption: string | null
  verhaeltnis: Verhaeltnis | null
  /** Wie viele eigene Medien hängen — entscheidet über „geerbt" oder nicht. */
  medienAnzahl: number
}

/**
 * Abweichende Fassungen unter der Caption.
 *
 * Der Ablauf folgt der Absicht: Der Beitrag wird normal eingetragen, und *dann*
 * kommt eine Abweichung dazu. Deshalb steht hier ein Knopf und kein zweiter
 * Satz Felder, der immer mitliefe — die meisten Beiträge haben keine Variante,
 * und leere Felder für den Regelfall sind Lärm.
 *
 * **Leer heißt geerbt**, und das steht auch so an den Feldern. Ohne den Hinweis
 * würde jemand die Caption abtippen, damit „etwas drinsteht" — und hätte damit
 * eine Kopie, die beim nächsten Umbau des Beitrags stillschweigend veraltet.
 *
 * **Eigene Medien je Fassung sind noch nicht wählbar.** Das Datenmodell trägt
 * sie (`PostVarianteMedium`), die Erbregel rechnet damit, ZIP und Kundenansicht
 * zeigen sie — es fehlt allein der Upload-Weg. Ihn hier zweitgebaut daneben zu
 * stellen wäre die schlechtere Hälfte: `/api/upload` trägt Formatprüfung,
 * Transparenzwarnung, Karussell-Auftrennung und das Aufräumen der drei
 * Video-Quellen. Ein zweiter Weg daneben wäre eine zweite Stelle, an der das
 * alles auseinanderläuft. Der Weg führt über `varianteId` **in** dieser Route,
 * und das ist ein eigener Schritt.
 */
export function VariantenFeld({
  postTyp,
  varianten,
  frei,
  ausserhalb,
  anlegen,
  speichern,
  loeschen,
}: {
  postTyp: 'REEL' | 'KARUSSELL' | 'BEITRAG'
  varianten: VariantenZeile[]
  /** Plattformen, die in keiner anderen Variante stehen. */
  frei: Plattform[]
  /**
   * Plattformen, die der Kunde bespielt, dieser Beitrag aber nicht. Sie
   * stehen gesperrt da statt zu fehlen: Wer LinkedIn sucht und nicht findet,
   * sucht an der falschen Stelle weiter — eine Fassung für eine Plattform,
   * auf der der Beitrag gar nicht erscheint, wäre sinnlos, und das steht
   * dann auch dabei.
   */
  ausserhalb: Plattform[]
  anlegen: (formular: FormData) => Promise<void>
  speichern: (varianteId: string, formular: FormData) => Promise<void>
  loeschen: (varianteId: string) => Promise<void>
}) {
  const [offen, setOffen] = useState(false)
  const erlaubteFormate = ERLAUBT[postTyp]

  return (
    <div className="grid gap-4">
      {varianten.map((v) => (
        <form
          key={v.id}
          action={speichern.bind(null, v.id)}
          className="grid gap-3.5 rounded-md border border-rahmen bg-flaeche-leise p-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-[12px] font-medium text-tinte">
              Für {v.plattformen.map((p) => PLATTFORM_TEXT[p]).join(', ') || '— niemanden'}
            </span>
            <button
              type="submit"
              formAction={loeschen.bind(null, v.id)}
              className="text-[11.5px] text-stiller hover:text-akzent"
            >
              entfernen
            </button>
          </div>

          <Feld
            beschriftung="Plattformen"
            hinweis="Eine Plattform kann nur in einer Fassung stehen — welche sonst gälte, wäre nicht entscheidbar."
          >
            <div className="flex flex-wrap gap-3">
              {[...new Set([...v.plattformen, ...frei])].map((p) => (
                <label key={p} className="flex items-center gap-1.5 text-[12.5px] text-tinte-3">
                  <input
                    type="checkbox"
                    name="plattformen"
                    value={p}
                    defaultChecked={v.plattformen.includes(p)}
                  />
                  {PLATTFORM_TEXT[p]}
                </label>
              ))}
              {ausserhalb.map((p) => (
                <span
                  key={p}
                  title={`Dieser Beitrag geht nicht auf ${PLATTFORM_TEXT[p]} — oben in den Eckdaten anhaken.`}
                  className="flex items-center gap-1.5 text-[12.5px] text-stiller"
                >
                  <input type="checkbox" disabled />
                  {PLATTFORM_TEXT[p]}
                </span>
              ))}
            </div>
          </Feld>

          <Feld
            beschriftung="Caption"
            hinweis="Leer lassen heißt: die Caption des Beitrags gilt. Sie abzutippen wäre eine Kopie, die beim nächsten Umbau veraltet."
          >
            <Textfeld name="caption" defaultValue={v.caption ?? ''} rows={5} />
          </Feld>

          <Feld
            beschriftung="Format"
            hinweis={
              v.medienAnzahl > 0
                ? `${v.medienAnzahl} eigene Medien hängen an dieser Fassung.`
                : 'Wirkt erst mit eigenen Medien — sonst stünde das geerbte Bild in einer Fläche, für die es nicht gemacht ist. Eigene Medien je Fassung kommen im nächsten Schritt.'
            }
          >
            <Auswahl name="verhaeltnis" defaultValue={v.verhaeltnis ?? ''}>
              <option value="">— wie der Beitrag —</option>
              {erlaubteFormate.map((f) => (
                <option key={f} value={f}>
                  {VERHAELTNIS_TEXT[f]} · {VERHAELTNIS_MASSE[f]}
                </option>
              ))}
            </Auswahl>
          </Feld>

          <div className="flex justify-end">
            <Knopf klein type="submit">
              Fassung speichern
            </Knopf>
          </div>
        </form>
      ))}

      {frei.length === 0 && varianten.length > 0 ? (
        <Hinweis>
          Jede Plattform dieses Beitrags hat eine Fassung. Mehr geht nicht — eine zweite für
          dieselbe Plattform wäre nicht entscheidbar.
        </Hinweis>
      ) : offen ? (
        <form
          action={anlegen}
          className="grid gap-3.5 rounded-md border border-dashed border-rahmen-3 p-4"
        >
          <Feld
            beschriftung="Für welche Plattformen"
            hinweis="Alles, was hier nicht angehakt ist, bekommt weiterhin das Hauptformat."
          >
            <div className="flex flex-wrap gap-3">
              {frei.map((p) => (
                <label key={p} className="flex items-center gap-1.5 text-[12.5px] text-tinte-3">
                  <input type="checkbox" name="plattformen" value={p} />
                  {PLATTFORM_TEXT[p]}
                </label>
              ))}
            </div>
          </Feld>

          <Feld
            beschriftung="Caption"
            hinweis="Leer lassen heißt: die Caption des Beitrags gilt."
          >
            <Textfeld name="caption" rows={4} />
          </Feld>

          <div className="flex justify-between gap-2">
            <Knopf klein art="leise" type="button" onClick={() => setOffen(false)}>
              Abbrechen
            </Knopf>
            <Knopf klein art="primaer" type="submit">
              Fassung anlegen
            </Knopf>
          </div>
        </form>
      ) : (
        <div>
          <Knopf klein art="leise" type="button" onClick={() => setOffen(true)}>
            Anderes Caption/Format hinzufügen
          </Knopf>
          {frei.length === 0 && (
            <p className="mt-2 text-[11.5px] text-stiller">
              Dafür braucht der Beitrag mindestens zwei Plattformen.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
