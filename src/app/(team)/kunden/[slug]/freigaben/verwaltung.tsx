'use client'

import { useState } from 'react'
import { Auswahl, Eingabe, Feld, Karte, Knopf, Schalter } from '@/components/ui'
import {
  einladungZuruecknehmen,
  exportAnlegen,
  exportLoeschen,
  exportSpeichern,
  gastEinladen,
} from '../aktionen'

import { ROLLE_TEXT } from '@/lib/rollen'
import type { Rolle } from '@prisma/client'

/** Konten, die als zusätzlicher Ansprechpartner in Frage kommen. */
type Waehlbar = { id: string; name: string; rolle: Rolle }

type ExportDaten = {
  id: string
  token: string
  titel: string | null
  /** `2026-08` — der Wert des Monatsfeldes. */
  monat: string
  /** „August 2026" — die Überschrift. */
  monatTitel: string
  zusatzAnsprechpartnerId: string | null
  aufrufe: number
  zuletztGeoeffnet: string | null
  stand: { erledigt: number; gesamt: number; vollstaendig: boolean }
  kommentare: number
}

function AnsprechpartnerWahl({
  liste,
  ausgewaehlt,
}: {
  liste: Waehlbar[]
  ausgewaehlt?: string | null
}) {
  return (
    <Auswahl name="zusatzAnsprechpartnerId" defaultValue={ausgewaehlt ?? ''}>
      <option value="">— nur der Hauptansprechpartner —</option>
      {liste.map((a) => (
        <option key={a.id} value={a.id}>
          {a.name} · {ROLLE_TEXT[a.rolle]}
        </option>
      ))}
    </Auswahl>
  )
}

export function ExportAnlegen({ kundeId, waehlbare }: { kundeId: string; waehlbare: Waehlbar[] }) {
  const [offen, setOffen] = useState(false)
  const heute = new Date()
  const dieserMonat = `${heute.getFullYear()}-${String(heute.getMonth() + 1).padStart(2, '0')}`

  if (!offen) {
    return (
      <Knopf art="primaer" onClick={() => setOffen(true)}>
        Neue Freigabe
      </Knopf>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-tinte/25 px-3 sm:px-6">
      <div className="w-full max-w-[460px] rounded-md border border-rahmen bg-flaeche p-5 shadow-xl sm:p-6">
        <h3 className="mb-5 text-[16px] font-semibold">Neue Freigabe</h3>

        {/* Schließt nach dem Anlegen — ein Dialog, der stehen bleibt, sieht
            aus, als wäre nichts passiert. */}
        <form
          action={async (formular: FormData) => {
            await exportAnlegen(kundeId, formular)
            setOffen(false)
          }}
          className="grid gap-4"
        >
          <Feld beschriftung="Titel" hinweis="Erscheint als Überschrift auf der Kundenseite.">
            <Eingabe name="titel" placeholder="Content-Plan August 2026" />
          </Feld>

          <Feld
            beschriftung="Monat"
            hinweis="Eine Freigabe umfasst immer den ganzen Monat. Gibt es ihn schon, wird er aktualisiert."
          >
            <Eingabe name="monat" type="month" defaultValue={dieserMonat} required />
          </Feld>

          <Feld
            beschriftung="Zusätzlicher Ansprechpartner"
            hinweis="Erscheint neben dem Hauptansprechpartner des Kunden und bekommt dessen Rückmeldungen mit — ersetzt ihn also nicht."
          >
            <AnsprechpartnerWahl liste={waehlbare} />
          </Feld>

          <div className="mt-1 flex justify-end gap-2">
            <Knopf type="button" art="leise" onClick={() => setOffen(false)}>
              Abbrechen
            </Knopf>
            <Knopf type="submit" art="primaer">
              Freigabe erstellen
            </Knopf>
          </div>
        </form>
      </div>
    </div>
  )
}

export function ExportKarte({
  exp,
  basisUrl,
  waehlbare,
  gaeste,
}: {
  exp: ExportDaten
  basisUrl: string
  waehlbare: Waehlbar[]
  gaeste: Array<{ id: string; name: string; email: string; geoeffnet: string | null }>
}) {
  const [bearbeiten, setBearbeiten] = useState(false)
  const [kopiert, setKopiert] = useState(false)
  const url = `${basisUrl}/f/${exp.token}`

  return (
    <Karte className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h3 className="text-[14.5px] font-semibold">{exp.titel ?? exp.monatTitel}</h3>
            {exp.stand.vollstaendig ? (
              <span className="rounded-[3px] bg-final-flaeche px-2 py-0.5 text-[11px] font-medium text-final">
                alle freigegeben
              </span>
            ) : (
              <span className="rounded-[3px] bg-vorschau-flaeche px-2 py-0.5 text-[11px] font-medium text-vorschau">
                {exp.stand.gesamt > 0
                  ? `${exp.stand.erledigt} von ${exp.stand.gesamt} freigegeben`
                  : 'im Review'}
              </span>
            )}
          </div>
          <p className="mt-1 text-[12px] text-leiser">
            {exp.monatTitel} · {exp.aufrufe} Aufrufe
            {exp.zuletztGeoeffnet && ` · zuletzt geöffnet ${exp.zuletztGeoeffnet}`}
            {exp.kommentare > 0 && ` · ${exp.kommentare} Kommentare`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <a
            href={`/f/${exp.token}`}
            target="_blank"
            rel="noreferrer"
            title="Öffnet die Kundenseite mit Ihrem Konto — ohne Gast-Anmeldung."
            className="rounded-[5px] border border-rahmen-3 px-3 py-1.5 text-[12px] font-medium text-tinte hover:border-rahmen-4"
          >
            Vorschau ansehen
          </a>
          <Knopf
            klein
            onClick={() => {
              void navigator.clipboard.writeText(url)
              setKopiert(true)
              setTimeout(() => setKopiert(false), 1800)
            }}
          >
            {kopiert ? 'Kopiert' : 'Link kopieren'}
          </Knopf>
          <a
            href={`/api/export/${exp.id}/zip`}
            className="rounded-[5px] border border-rahmen-3 px-3 py-1.5 text-[12px] font-medium text-tinte hover:border-rahmen-4"
          >
            Dateien als ZIP
          </a>
          <Knopf klein art="leise" onClick={() => setBearbeiten((v) => !v)}>
            {bearbeiten ? 'Schließen' : 'Bearbeiten'}
          </Knopf>
        </div>
      </div>

      <p className="mt-3 font-mono text-[11.5px] text-stiller">{url}</p>

      {/* ------------------------------------------------------------- Gäste */}
      <div className="mt-5 border-t border-rahmen pt-4">
        <h4 className="mb-2.5 text-[10.5px] font-medium uppercase tracking-[0.1em] text-still">
          Eingeladen
        </h4>

        {gaeste.length > 0 && (
          <ul className="mb-3 grid gap-1.5">
            {gaeste.map((gast) => (
              <li key={gast.id} className="flex items-center justify-between gap-3 text-[12.5px]">
                <span className="text-tinte-3">
                  {gast.name} <span className="text-stiller">· {gast.email}</span>
                  {gast.geoeffnet && (
                    <span className="ml-2 text-[11px] text-stiller">
                      zuletzt geöffnet {gast.geoeffnet}
                    </span>
                  )}
                </span>
                <form action={einladungZuruecknehmen.bind(null, exp.id, gast.id)}>
                  <button type="submit" className="text-[11.5px] text-stiller hover:text-akzent">
                    entfernen
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}

        <form action={gastEinladen.bind(null, exp.id)} className="flex flex-wrap items-end gap-2">
          <div className="w-[190px]">
            <Eingabe name="email" type="email" required placeholder="kunde@beispiel.de" />
          </div>
          <div className="w-[150px]">
            <Eingabe name="name" placeholder="Name (optional)" />
          </div>
          <Knopf klein type="submit">
            Einladen
          </Knopf>
        </form>
        <p className="mt-2 text-[11.5px] text-stiller">
          Eingeladene sehen den Link nach der Anmeldung auch in ihrer eigenen Übersicht.
        </p>
      </div>

      {/* --------------------------------------------------------- Bearbeiten */}
      {bearbeiten && (
        <form
          action={exportSpeichern.bind(null, exp.id)}
          className="mt-5 grid gap-4 border-t border-rahmen pt-5"
        >
          <Feld beschriftung="Titel">
            <Eingabe name="titel" defaultValue={exp.titel ?? ''} />
          </Feld>

          <Feld beschriftung="Monat">
            <Eingabe name="monat" type="month" defaultValue={exp.monat} required />
          </Feld>

          <Feld
            beschriftung="Zusätzlicher Ansprechpartner"
            hinweis="Nur für diesen Link. Kommt zum Hauptansprechpartner dazu, ersetzt ihn nicht."
          >
            <AnsprechpartnerWahl liste={waehlbare} ausgewaehlt={exp.zusatzAnsprechpartnerId} />
          </Feld>

          <div className="flex justify-between gap-2">
            <button
              type="submit"
              formAction={exportLoeschen.bind(null, exp.id)}
              className="text-[12px] text-stiller hover:text-akzent"
            >
              Freigabe löschen
            </button>
            <Knopf art="primaer" type="submit">
              Speichern
            </Knopf>
          </div>
        </form>
      )}
    </Karte>
  )
}
