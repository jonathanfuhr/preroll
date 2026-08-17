'use client'

import type { Plattform, Verhaeltnis } from '@prisma/client'
import { useState } from 'react'
import { PLATTFORM_TEXT } from '@/lib/plattformen'
import { ERLAUBT, VERHAELTNIS_MASSE, VERHAELTNIS_TEXT } from '@/lib/verhaeltnis'
import {
  VariantenMedien,
  type VariantenMedium,
  type VariantenVideo,
} from './varianten-medien'
import { Auswahl, Feld, Hinweis, Knopf, Textfeld } from '@/components/ui'

export type VariantenZeile = {
  id: string
  plattformen: Plattform[]
  caption: string | null
  verhaeltnis: Verhaeltnis | null
  /** Eigene Medien dieser Fassung — leer heißt geerbt. */
  medien: VariantenMedium[]
  /** Nur beim Reel: der Video-Platz dieser Fassung mit seinen drei Quellen. */
  video: VariantenVideo | null
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
 * **Eigene Medien je Fassung** hängen unter der Caption. Sie gehen über
 * dieselbe Route wie die des Beitrags (`/api/upload` mit `varianteId`) — dort
 * sitzen Blockupload, Formatprüfung, Transparenzwarnung und die
 * Karussell-Auftrennung, und ein zweiter Weg daneben wäre eine zweite Stelle,
 * an der das auseinanderläuft.
 */
export function VariantenFeld({
  postId,
  postTyp,
  postVerhaeltnis,
  kundeSlug,
  geerbteMedien,
  varianten,
  frei,
  ausserhalb,
  anlegen,
  speichern,
  loeschen,
  medienVerwerfen,
}: {
  postId: string
  postTyp: 'REEL' | 'KARUSSELL' | 'BEITRAG'
  /** Gilt, solange eine Fassung kein eigenes Format wählt. */
  postVerhaeltnis: Verhaeltnis
  kundeSlug: string
  /** Die Medien des Beitrags — was eine Fassung ohne eigene zeigt. */
  geerbteMedien: VariantenMedium[]
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
  medienVerwerfen: (varianteId: string) => Promise<void>
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
              v.medien.length > 0
                ? `${v.medien.length} eigene ${v.medien.length === 1 ? 'Datei hängt' : 'Dateien hängen'} an dieser Fassung.`
                : 'Wirkt erst mit eigenen Medien — sonst stünde das geerbte Bild in einer Fläche, für die es nicht gemacht ist.'
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

          <Feld
            beschriftung="Medien"
            hinweis="Leer lassen heißt: die Medien des Beitrags gelten. Ersetzt wird als Ganzes — ein Karussell aus zwei Quellen hätte niemand so gemeint."
          >
            <VariantenMedien
              postId={postId}
              varianteId={v.id}
              kundeSlug={kundeSlug}
              typ={postTyp}
              verhaeltnis={v.verhaeltnis ?? postVerhaeltnis}
              medien={v.medien}
              geerbt={geerbteMedien}
              video={v.video}
              entfernen={medienVerwerfen.bind(null, v.id)}
            />
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
