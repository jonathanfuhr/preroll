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

type Ansprechpartner = { id: string; name: string; standard: boolean }

type ExportDaten = {
  id: string
  token: string
  titel: string | null
  zeitraum: string
  zeitraumVon: string
  zeitraumBis: string
  gueltigBis: string
  ansprechpartnerId: string | null
  kommentareErlaubt: boolean
  freigabeButtonZeigen: boolean
  konzepteMitzeigen: boolean
  loginPflicht: boolean
  aufrufe: number
  zuletztGeoeffnet: string | null
  freigegebenAm: string | null
  kommentare: number
}

function AnsprechpartnerWahl({
  liste,
  ausgewaehlt,
}: {
  liste: Ansprechpartner[]
  ausgewaehlt?: string | null
}) {
  return (
    <Auswahl name="ansprechpartnerId" defaultValue={ausgewaehlt ?? ''}>
      <option value="">— kein Ansprechpartner —</option>
      {liste.map((a) => (
        <option key={a.id} value={a.id}>
          {a.name}
          {a.standard ? ' · Standard' : ''}
        </option>
      ))}
    </Auswahl>
  )
}

function Optionen({ exp }: { exp?: ExportDaten }) {
  return (
    <div className="grid gap-2.5">
      <Schalter
        name="kommentareErlaubt"
        beschriftung="Kommentare erlauben"
        defaultChecked={exp?.kommentareErlaubt ?? true}
      />
      <Schalter
        name="freigabeButtonZeigen"
        beschriftung="Freigabe-Button anzeigen"
        defaultChecked={exp?.freigabeButtonZeigen ?? true}
      />
      <Schalter
        name="konzepteMitzeigen"
        beschriftung="Konzept-Beiträge mitzeigen"
        hinweis="Sonst sieht der Kunde nur, was auf Vorschau oder Final steht."
        defaultChecked={exp?.konzepteMitzeigen ?? false}
      />
      <Schalter
        name="loginPflicht"
        beschriftung="Anmeldung per Mail-Code verlangen"
        hinweis="Der Kunde bestätigt seine Adresse mit einem sechsstelligen Code, bevor er den Plan sieht."
        defaultChecked={exp?.loginPflicht ?? false}
      />
    </div>
  )
}

export function ExportAnlegen({
  kundeId,
  ansprechpartner,
}: {
  kundeId: string
  ansprechpartner: Ansprechpartner[]
}) {
  const [offen, setOffen] = useState(false)
  const heute = new Date()
  const ersterTag = new Date(heute.getFullYear(), heute.getMonth(), 1).toISOString().slice(0, 10)
  const letzterTag = new Date(heute.getFullYear(), heute.getMonth() + 1, 0).toISOString().slice(0, 10)

  if (!offen) {
    return (
      <Knopf art="primaer" onClick={() => setOffen(true)}>
        Neuer Export-Link
      </Knopf>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-tinte/25 px-6">
      <div className="w-full max-w-[460px] rounded-md border border-rahmen bg-flaeche p-6 shadow-xl">
        <h3 className="mb-5 text-[16px] font-semibold">Neuer Export-Link</h3>

        <form action={exportAnlegen.bind(null, kundeId)} className="grid gap-4">
          <Feld beschriftung="Titel" hinweis="Erscheint als Überschrift auf der Kundenseite.">
            <Eingabe name="titel" placeholder="Content-Plan August 2026" />
          </Feld>

          <div className="grid grid-cols-2 gap-3">
            <Feld beschriftung="Zeitraum von">
              <Eingabe name="zeitraumVon" type="date" defaultValue={ersterTag} required />
            </Feld>
            <Feld beschriftung="Zeitraum bis">
              <Eingabe name="zeitraumBis" type="date" defaultValue={letzterTag} required />
            </Feld>
          </div>

          <Feld beschriftung="Link gültig bis" hinweis="Leer lassen = unbegrenzt gültig.">
            <Eingabe name="gueltigBis" type="date" />
          </Feld>

          <Feld beschriftung="Ansprechpartner auf der Export-Seite">
            <AnsprechpartnerWahl
              liste={ansprechpartner}
              ausgewaehlt={ansprechpartner.find((a) => a.standard)?.id}
            />
          </Feld>

          <Optionen />

          <div className="mt-1 flex justify-end gap-2">
            <Knopf type="button" art="leise" onClick={() => setOffen(false)}>
              Abbrechen
            </Knopf>
            <Knopf type="submit" art="primaer">
              Link erstellen
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
  ansprechpartner,
  gaeste,
}: {
  exp: ExportDaten
  basisUrl: string
  ansprechpartner: Ansprechpartner[]
  gaeste: Array<{ id: string; name: string; email: string; geoeffnet: string | null }>
}) {
  const [bearbeiten, setBearbeiten] = useState(false)
  const [kopiert, setKopiert] = useState(false)
  const url = `${basisUrl}/f/${exp.token}`

  return (
    <Karte className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h3 className="text-[14.5px] font-semibold">{exp.titel ?? exp.zeitraum}</h3>
            {exp.freigegebenAm ? (
              <span className="rounded-[3px] bg-final-flaeche px-2 py-0.5 text-[11px] font-medium text-final">
                freigegeben {exp.freigegebenAm}
              </span>
            ) : (
              <span className="rounded-[3px] bg-vorschau-flaeche px-2 py-0.5 text-[11px] font-medium text-vorschau">
                im Review
              </span>
            )}
          </div>
          <p className="mt-1 text-[12px] text-leiser">
            {exp.zeitraum} · {exp.aufrufe} Aufrufe
            {exp.zuletztGeoeffnet && ` · zuletzt geöffnet ${exp.zuletztGeoeffnet}`}
            {exp.kommentare > 0 && ` · ${exp.kommentare} Kommentare`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <a
            href={`/f/${exp.token}`}
            target="_blank"
            rel="noreferrer"
            className="rounded-[5px] border border-rahmen-3 px-3 py-1.5 text-[12px] font-medium text-tinte hover:border-rahmen-4"
          >
            Ansehen
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

          <div className="grid grid-cols-3 gap-3">
            <Feld beschriftung="Zeitraum von">
              <Eingabe name="zeitraumVon" type="date" defaultValue={exp.zeitraumVon} required />
            </Feld>
            <Feld beschriftung="Zeitraum bis">
              <Eingabe name="zeitraumBis" type="date" defaultValue={exp.zeitraumBis} required />
            </Feld>
            <Feld beschriftung="Gültig bis">
              <Eingabe name="gueltigBis" type="date" defaultValue={exp.gueltigBis} />
            </Feld>
          </div>

          <Feld beschriftung="Ansprechpartner" hinweis="Gilt nur für diesen Link.">
            <AnsprechpartnerWahl liste={ansprechpartner} ausgewaehlt={exp.ansprechpartnerId} />
          </Feld>

          <Optionen exp={exp} />

          <div className="flex justify-between gap-2">
            <button
              type="submit"
              formAction={exportLoeschen.bind(null, exp.id)}
              className="text-[12px] text-stiller hover:text-akzent"
            >
              Link löschen
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
