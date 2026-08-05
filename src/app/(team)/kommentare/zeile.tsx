'use client'

import type { KommentarStatus } from '@prisma/client'
import { useState } from 'react'
import { Knopf, Textfeld } from '@/components/ui'
import {
  kommentarLoeschen,
  kommentarStatusSetzen,
  kommentarVomTeam,
} from '../kunden/[slug]/aktionen'

export function KommentarZeile({
  kommentarId,
  status,
  postId,
  exportId,
}: {
  kommentarId: string
  status: KommentarStatus
  postId: string | null
  exportId: string | null
}) {
  const [antworten, setAntworten] = useState(false)

  return (
    <div className="mt-3 border-t border-rahmen pt-2.5">
      <div className="flex items-center gap-4">
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

        {postId && (
          <button
            type="button"
            onClick={() => setAntworten((v) => !v)}
            className="text-[11.5px] text-leise hover:text-tinte"
          >
            {antworten ? 'abbrechen' : 'Antworten'}
          </button>
        )}

        <form action={kommentarLoeschen.bind(null, kommentarId)} className="ml-auto">
          <button type="submit" className="text-[11.5px] text-stiller hover:text-akzent">
            Löschen
          </button>
        </form>
      </div>

      {antworten && postId && (
        <form
          action={kommentarVomTeam.bind(null, postId, exportId)}
          className="mt-3 grid gap-2"
        >
          <input type="hidden" name="abschnitt" value="allgemein" />
          <Textfeld name="text" required rows={3} placeholder="Antwort an den Kunden …" />
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
