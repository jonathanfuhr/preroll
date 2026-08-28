'use client'

import { useState } from 'react'
import { KommentarFeld, type Erwaehnbar } from './kommentar-feld'
import { Karte, Knopf } from './ui'
import { kommentarVomTeam } from '@/app/(team)/kunden/[slug]/aktionen'

/**
 * Das Eingabefeld für eine neue Anmerkung im Post-Editor.
 *
 * Eigenes Bauteil, weil es **zurückgesetzt** werden muss: `KommentarFeld`
 * hält seinen Text in eigenem Zustand — es braucht ihn für die
 * @-Erwähnungen —, und React setzt nach einer Server-Aktion nur
 * unkontrollierte Felder zurück. Ohne das Zurücksetzen stünde der eben
 * gesendete Text noch da, und der zweite Klick schriebe ihn ein zweites Mal.
 *
 * Zurückgesetzt wird über einen Schlüssel: Er zählt hoch, das Feld wird neu
 * eingehängt und startet leer. Dasselbe tut das Antwortformular, nur
 * unauffälliger — es schließt sich nach dem Senden.
 */
export function KommentarSchreiben({
  postId,
  erwaehnbar,
}: {
  postId: string
  erwaehnbar: Erwaehnbar[]
}) {
  const [runde, setRunde] = useState(0)

  return (
    <Karte className="p-4">
      <form
        action={kommentarVomTeam.bind(null, postId, null)}
        onSubmit={() => setRunde((n) => n + 1)}
        className="grid gap-2"
      >
        <input type="hidden" name="abschnitt" value="allgemein" />
        <KommentarFeld
          key={runde}
          erwaehnbar={erwaehnbar}
          platzhalter="Anmerkung … @ erwähnt jemanden, #intern bleibt im Haus"
          intern
        />
        <div className="flex justify-end">
          <Knopf art="primaer" klein type="submit">
            Kommentar senden
          </Knopf>
        </div>
      </form>
    </Karte>
  )
}
