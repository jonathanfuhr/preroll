'use client'

import type { KommentarStatus } from '@prisma/client'
import { useState } from 'react'
import { KommentarFeld, type Erwaehnbar } from '@/components/kommentar-feld'
import { Knopf } from '@/components/ui'
import {
  kommentarBearbeiten,
  kommentarLoeschen,
  kommentarStatusSetzen,
  kommentarVomTeam,
} from '../kunden/[slug]/aktionen'

/**
 * Die Handgriffe unter einer Rückmeldung. Bearbeiten und Löschen erscheinen
 * nur, wo sie erlaubt sind — die Entscheidung fällt am Server
 * (`kommentar-rechte.ts`), hier steht nur ihr Ergebnis.
 */
export function KommentarZeile({
  kommentarId,
  status,
  postId,
  exportId,
  text,
  erwaehnbar,
  darfAendern,
  istAntwort,
}: {
  kommentarId: string
  status: KommentarStatus
  postId: string | null
  exportId: string | null
  text: string
  erwaehnbar: Erwaehnbar[]
  darfAendern: boolean
  /** Auf eine Antwort wird nicht noch einmal geantwortet — ein Strang genügt. */
  istAntwort?: boolean
}) {
  const [antworten, setAntworten] = useState(false)
  const [bearbeiten, setBearbeiten] = useState(false)

  if (bearbeiten) {
    return (
      <form
        action={kommentarBearbeiten.bind(null, kommentarId)}
        onSubmit={() => setBearbeiten(false)}
        className="mt-3 grid gap-2 border-t border-rahmen pt-3"
      >
        <KommentarFeld erwaehnbar={erwaehnbar} standardwert={text} autoFokus intern />
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => setBearbeiten(false)}
            className="text-[11.5px] text-stiller hover:text-tinte"
          >
            abbrechen
          </button>
          <Knopf art="primaer" klein type="submit">
            Speichern
          </Knopf>
        </div>
      </form>
    )
  }

  return (
    <div className="mt-3 border-t border-rahmen pt-2.5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        {!istAntwort && (
          <form
            action={kommentarStatusSetzen.bind(
              null,
              kommentarId,
              status === 'OFFEN' ? 'ERLEDIGT' : 'OFFEN',
            )}
          >
            <button
              type="submit"
              className={`text-[11.5px] ${
                status === 'OFFEN' ? 'text-akzent hover:text-akzent-dunkel' : 'text-final'
              }`}
            >
              {status === 'OFFEN' ? 'Als erledigt markieren' : '✓ erledigt — wieder öffnen'}
            </button>
          </form>
        )}

        {postId && !istAntwort && (
          <button
            type="button"
            onClick={() => setAntworten((v) => !v)}
            className="text-[11.5px] text-leise hover:text-tinte"
          >
            {antworten ? 'abbrechen' : 'Antworten'}
          </button>
        )}

        {darfAendern && (
          <>
            <button
              type="button"
              onClick={() => setBearbeiten(true)}
              className="text-[11.5px] text-leise hover:text-tinte"
            >
              Bearbeiten
            </button>
            <form action={kommentarLoeschen.bind(null, kommentarId)} className="ml-auto">
              <button type="submit" className="text-[11.5px] text-stiller hover:text-akzent">
                Löschen
              </button>
            </form>
          </>
        )}
      </div>

      {antworten && postId && (
        <form
          action={kommentarVomTeam.bind(null, postId, exportId)}
          onSubmit={() => setAntworten(false)}
          className="mt-3 grid gap-2"
        >
          <input type="hidden" name="abschnitt" value="allgemein" />
          <input type="hidden" name="antwortAufId" value={kommentarId} />
          <KommentarFeld
            erwaehnbar={erwaehnbar}
            platzhalter="Antwort … @ erwähnt jemanden"
            autoFokus
            intern
          />
          <div className="flex justify-end">
            <Knopf art="primaer" klein type="submit">
              Antwort senden
            </Knopf>
          </div>
        </form>
      )}
    </div>
  )
}
