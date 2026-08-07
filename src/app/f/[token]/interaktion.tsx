'use client'

import type { Freigabestufe } from '@prisma/client'
import { useState } from 'react'
import { freigabeBeschriftung, STUFE_TEXT } from '@/lib/freigabe'
import { KommentarFeld, type Erwaehnbar } from '@/components/kommentar-feld'
import { KommentarInhalt } from '@/components/kommentar-inhalt'
import { InternBadge, Knopf, Textfeld } from '@/components/ui'
import {
  freigabeErteilen,
  gastKommentarBearbeiten,
  gastKommentarLoeschen,
  kommentarVomKunden,
} from './aktionen'

const ZEIT = new Intl.DateTimeFormat('de-DE', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

export type ErteilteFreigabe = {
  stufe: Freigabestufe
  autorName: string
  am: string
  vomTeam: boolean
}

type Kommentar = {
  id: string
  autorName: string
  text: string
  am: string
  bearbeitet: boolean
  vomTeam: boolean
  /** Nur fürs Haus — steht beim Gast gar nicht erst in der Liste. */
  intern: boolean
  antwortAufId: string | null
  /** Ergebnis der Rechteprüfung am Server — hier wird nur angezeigt. */
  darfAendern: boolean
}

/**
 * Kommentare zu einem Beitrag. Wer hier schreibt, ist angemeldet — der Name
 * steht am Gast und muss nicht noch einmal erfragt werden.
 */
export function KommentarBereich({
  token,
  postId,
  erlaubt,
  kommentare,
  erwaehnbar,
  alsTeam,
}: {
  token: string
  postId: string
  erlaubt: boolean
  kommentare: Kommentar[]
  erwaehnbar: Erwaehnbar[]
  /** Das Team in der Vorschau — nur dort wirkt `#intern`. */
  alsTeam?: boolean
}) {
  const [offen, setOffen] = useState(false)

  if (!erlaubt && kommentare.length === 0) return null

  const straenge = kommentare.filter((k) => !k.antwortAufId)

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

      {straenge.length > 0 && (
        <ul className="mb-3 grid gap-3">
          {straenge.map((kommentar) => (
            <li key={kommentar.id}>
              <Eintrag
                token={token}
                postId={postId}
                kommentar={kommentar}
                erwaehnbar={erwaehnbar}
                antwortenErlaubt={erlaubt}
                alsTeam={alsTeam}
              />

              {kommentare
                .filter((k) => k.antwortAufId === kommentar.id)
                .map((antwort) => (
                  <div key={antwort.id} className="mt-2 pl-5">
                    <Eintrag
                      token={token}
                      postId={postId}
                      kommentar={antwort}
                      erwaehnbar={erwaehnbar}
                      antwortenErlaubt={erlaubt}
                      alsTeam={alsTeam}
                      strangId={kommentar.id}
                    />
                  </div>
                ))}
            </li>
          ))}
        </ul>
      )}

      {offen && erlaubt && (
        <form
          action={kommentarVomKunden.bind(null, token)}
          onSubmit={() => setOffen(false)}
          className="grid gap-2.5"
        >
          <input type="hidden" name="postId" value={postId} />
          <input type="hidden" name="abschnitt" value="allgemein" />

          <KommentarFeld
            erwaehnbar={erwaehnbar}
            platzhalter="Was soll geändert werden? Mit @ jemanden ansprechen"
            intern={alsTeam}
          />
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

/**
 * Ein Kommentar auf der Freigabe-Seite. Antworten darf jede angemeldete
 * Person; ändern und löschen nur die eigenen — „erledigt" bleibt dem Team
 * vorbehalten, denn es entscheidet, wann eine Anmerkung umgesetzt ist.
 */
function Eintrag({
  token,
  postId,
  kommentar,
  erwaehnbar,
  antwortenErlaubt,
  alsTeam,
  strangId,
}: {
  token: string
  postId: string
  kommentar: Kommentar
  erwaehnbar: Erwaehnbar[]
  antwortenErlaubt: boolean
  alsTeam?: boolean
  /**
   * Bei einer Antwort die Kennung der Rückmeldung, an der sie hängt. Eine
   * Antwort auf eine Antwort bleibt im selben Strang — eine dritte Ebene
   * würde die Unterhaltung nur ausfransen. Wem sie gilt, steht als
   * Erwähnung im Text.
   */
  strangId?: string
}) {
  const [antworten, setAntworten] = useState(false)
  const [bearbeiten, setBearbeiten] = useState(false)

  return (
    <div
      className={`rounded-[5px] border px-3.5 py-2.5 ${
        kommentar.vomTeam ? 'border-rahmen bg-flaeche-leise' : 'border-[#eee0dd] bg-akzent-zart'
      }`}
    >
      <div className="mb-1 flex flex-wrap items-baseline gap-2">
        <span className="text-[12px] font-semibold text-tinte">{kommentar.autorName}</span>
        {kommentar.intern && <InternBadge />}
        {kommentar.vomTeam && (
          <span className="text-[10px] uppercase tracking-[0.08em] text-still">Agentur</span>
        )}
        <span className="text-[10.5px] text-stiller">
          {ZEIT.format(new Date(kommentar.am))}
          {kommentar.bearbeitet && ' · bearbeitet'}
        </span>
      </div>

      {bearbeiten ? (
        <form
          action={gastKommentarBearbeiten.bind(null, token, kommentar.id)}
          onSubmit={() => setBearbeiten(false)}
          className="grid gap-2"
        >
          <KommentarFeld erwaehnbar={erwaehnbar} standardwert={kommentar.text} autoFokus intern={alsTeam} />
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setBearbeiten(false)}
              className="text-[11px] text-stiller hover:text-tinte"
            >
              abbrechen
            </button>
            <Knopf art="primaer" klein type="submit">
              Speichern
            </Knopf>
          </div>
        </form>
      ) : (
        <KommentarInhalt text={kommentar.text} klein />
      )}

      {!bearbeiten && (antwortenErlaubt || kommentar.darfAendern) && (
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
          {antwortenErlaubt && (
            <button
              type="button"
              onClick={() => setAntworten((v) => !v)}
              className="text-[11px] text-leise hover:text-tinte"
            >
              {antworten ? 'abbrechen' : 'Antworten'}
            </button>
          )}

          {kommentar.darfAendern && (
            <>
              <button
                type="button"
                onClick={() => setBearbeiten(true)}
                className="text-[11px] text-leise hover:text-tinte"
              >
                Bearbeiten
              </button>
              <form
                action={gastKommentarLoeschen.bind(null, token, kommentar.id)}
                className="ml-auto"
              >
                <button type="submit" className="text-[11px] text-stiller hover:text-akzent">
                  Löschen
                </button>
              </form>
            </>
          )}
        </div>
      )}

      {antworten && (
        <form
          action={kommentarVomKunden.bind(null, token)}
          onSubmit={() => setAntworten(false)}
          className="mt-2.5 grid gap-2"
        >
          <input type="hidden" name="postId" value={postId} />
          <input type="hidden" name="abschnitt" value="allgemein" />
          <input type="hidden" name="antwortAufId" value={strangId ?? kommentar.id} />
          <KommentarFeld
            erwaehnbar={erwaehnbar}
            platzhalter="Antwort …"
            standardwert={strangId ? `@${kommentar.autorName} ` : ''}
            autoFokus
            intern={alsTeam}
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

/**
 * Freigabe für genau diesen Beitrag. Welche Stufe ansteht, hängt am Status:
 * beim Konzept das Konzept, nach dem Dreh die Vorschau.
 */
export function PostFreigabe({
  token,
  postId,
  erlaubt,
  offen,
  erledigt,
  erteilte,
  gastName,
}: {
  token: string
  postId: string
  erlaubt: boolean
  offen: Freigabestufe | null
  erledigt: boolean
  erteilte: ErteilteFreigabe[]
  gastName: string
}) {
  const [dialog, setDialog] = useState(false)

  // Nichts mehr offen und nichts erteilt — dann gibt es hier nichts zu zeigen.
  if (!offen && erteilte.length === 0) return null

  return (
    <div className="mb-4">
      {erteilte.length > 0 && (
        <ul className="grid gap-1.5">
          {erteilte.map((f) => (
            <li
              key={f.stufe}
              className="rounded-[5px] bg-final-flaeche px-3 py-2"
            >
              <div className="text-[12px] font-medium text-final">
                {STUFE_TEXT[f.stufe]} freigegeben
              </div>
              <div className="mt-0.5 text-[10.5px] text-leiser">
                von {f.autorName} · {ZEIT.format(new Date(f.am))}
                {f.vomTeam && ' · von der Agentur eingetragen'}
              </div>
            </li>
          ))}
        </ul>
      )}

      {erlaubt && offen && !erledigt && (
        <>
          <div className={erteilte.length > 0 ? 'mt-2.5' : ''}>
            <Knopf art="primaer" klein className="w-full" onClick={() => setDialog(true)}>
              {freigabeBeschriftung(offen)}
            </Knopf>
          </div>

          {dialog && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-tinte/25 px-3 sm:px-6">
              <div className="w-full max-w-[420px] rounded-md border border-rahmen bg-flaeche p-5 shadow-xl sm:p-6">
                <h3 className="text-[16px] font-semibold">{freigabeBeschriftung(offen)}</h3>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-leise">
                  Damit bestätigen Sie als <strong>{gastName}</strong>
                  {offen === 'KONZEPT'
                    ? ', dass dieser Beitrag so produziert werden kann.'
                    : ', dass dieser Beitrag so veröffentlicht werden kann.'}{' '}
                  Offene Kommentare bleiben davon unberührt.
                </p>

                <form action={freigabeErteilen.bind(null, token, postId)} className="mt-5 grid gap-3">
                  <Textfeld name="notiz" rows={3} placeholder="Kommentar zur Freigabe (optional)" />
                  <div className="flex justify-end gap-2">
                    <Knopf type="button" art="leise" onClick={() => setDialog(false)}>
                      Abbrechen
                    </Knopf>
                    <Knopf art="primaer" type="submit">
                      {freigabeBeschriftung(offen)}
                    </Knopf>
                  </div>
                </form>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

/** Fortschritt im Kopf der Seite — ersetzt den früheren Sammel-Knopf. */
export function Freigabefortschritt({ erledigt, gesamt }: { erledigt: number; gesamt: number }) {
  if (gesamt === 0) return null

  const fertig = erledigt === gesamt
  return (
    <div className="flex items-center gap-3">
      <span className="hidden text-[12px] text-still md:inline">
        Freigabe-Link · nur für Sie sichtbar
      </span>
      <span
        className="rounded-[5px] px-3.5 py-2 text-[12.5px] font-medium"
        style={
          fertig
            ? { background: 'var(--color-final-flaeche)', color: 'var(--color-final)' }
            : { background: 'var(--color-vorschau-flaeche)', color: 'var(--color-vorschau)' }
        }
      >
        {fertig ? 'Alle Beiträge freigegeben' : `${erledigt} von ${gesamt} freigegeben`}
      </span>
    </div>
  )
}
