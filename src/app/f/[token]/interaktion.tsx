'use client'

import { useState } from 'react'
import { Knopf, Textfeld } from '@/components/ui'
import { freigabeErteilen, kommentarVomKunden } from './aktionen'

const ZEIT = new Intl.DateTimeFormat('de-DE', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

type Kommentar = {
  id: string
  autorName: string
  text: string
  am: string
  vomTeam: boolean
}

/**
 * Kommentare zu einem Beitrag. Wer hier schreibt, ist angemeldet — der Name
 * steht am Gast und muss nicht noch einmal erfragt werden.
 */
export function KommentarBereich({
  token,
  postId,
  erlaubt,
  gastName,
  kommentare,
}: {
  token: string
  postId: string
  erlaubt: boolean
  gastName: string
  kommentare: Kommentar[]
}) {
  const [offen, setOffen] = useState(false)

  if (!erlaubt && kommentare.length === 0) return null

  return (
    <div className="border-l-2 border-rahmen pl-4">
      <div className="mb-2 flex items-center gap-3">
        <h4 className="text-[10.5px] uppercase tracking-[0.1em] text-still">
          Kommentare{kommentare.length > 0 && ` · ${kommentare.length}`}
        </h4>
        {erlaubt && (
          <button
            type="button"
            onClick={() => setOffen((v) => !v)}
            className="text-[11.5px] text-akzent hover:text-akzent-dunkel"
          >
            {offen ? 'abbrechen' : 'Kommentar hinzufügen'}
          </button>
        )}
      </div>

      {kommentare.length > 0 && (
        <ul className="mb-3 grid gap-3">
          {kommentare.map((kommentar) => (
            <li
              key={kommentar.id}
              className={`rounded-[5px] border px-3.5 py-2.5 ${
                kommentar.vomTeam
                  ? 'border-rahmen bg-flaeche-leise'
                  : 'border-[#eee0dd] bg-akzent-zart'
              }`}
            >
              <div className="mb-1 flex items-baseline gap-2">
                <span className="text-[12px] font-semibold text-tinte">{kommentar.autorName}</span>
                {kommentar.vomTeam && (
                  <span className="text-[10px] uppercase tracking-[0.08em] text-still">Agentur</span>
                )}
                <span className="text-[10.5px] text-stiller">
                  {ZEIT.format(new Date(kommentar.am))}
                </span>
              </div>
              <p className="whitespace-pre-wrap text-[12.5px] leading-relaxed text-tinte-3">
                {kommentar.text}
              </p>
            </li>
          ))}
        </ul>
      )}

      {offen && erlaubt && (
        <form action={kommentarVomKunden.bind(null, token)} className="grid gap-2.5">
          <input type="hidden" name="postId" value={postId} />
          <input type="hidden" name="abschnitt" value="allgemein" />

          <Textfeld name="text" required rows={3} placeholder="Was soll geändert werden?" />
          <div className="flex justify-end">
            <Knopf art="primaer" klein type="submit">
              Kommentar senden
            </Knopf>
          </div>
        </form>
      )}
    </div>
  )
}

/** Freigabe-Knopf im Kopf der Seite. */
export function Freigabeleiste({
  token,
  zeigen,
  freigegeben,
  gastName,
}: {
  token: string
  zeigen: boolean
  freigegeben: { autorName: string; am: string } | null
  gastName: string
}) {
  const [offen, setOffen] = useState(false)

  if (freigegeben) {
    return (
      <div className="rounded-[5px] bg-final-flaeche px-3.5 py-2 text-right">
        <div className="text-[12.5px] font-medium text-final">Freigabe erteilt</div>
        <div className="text-[11px] text-leiser">
          von {freigegeben.autorName} · {ZEIT.format(new Date(freigegeben.am))}
        </div>
      </div>
    )
  }

  if (!zeigen) return null

  return (
    <>
      <div className="flex items-center gap-3">
        <span className="text-[11.5px] text-leiser">Freigabe-Link · nur für Sie sichtbar</span>
        <Knopf art="primaer" onClick={() => setOffen(true)}>
          Freigabe erteilen
        </Knopf>
      </div>

      {offen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-tinte/25 px-6">
          <div className="w-full max-w-[420px] rounded-md border border-rahmen bg-flaeche p-6 shadow-xl">
            <h3 className="text-[16px] font-semibold">Content-Plan freigeben</h3>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-leise">
              Damit bestätigen Sie als <strong>{gastName}</strong>, dass die geplanten Beiträge so
              veröffentlicht werden können. Offene Kommentare bleiben davon unberührt.
            </p>

            <form action={freigabeErteilen.bind(null, token)} className="mt-5 grid gap-3">
              <Textfeld name="notiz" rows={3} placeholder="Kommentar zur Freigabe (optional)" />
              <div className="flex justify-end gap-2">
                <Knopf type="button" art="leise" onClick={() => setOffen(false)}>
                  Abbrechen
                </Knopf>
                <Knopf art="primaer" type="submit">
                  Freigabe erteilen
                </Knopf>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
