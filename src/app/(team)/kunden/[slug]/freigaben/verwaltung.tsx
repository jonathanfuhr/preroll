'use client'

import { useState } from 'react'
import { Auswahl, Eingabe, Feld, Karte, Knopf } from '@/components/ui'
import {
  einladungZuruecknehmen,
  exportLoeschen,
  exportSpeichern,
  gastEinladen,
} from '../aktionen'

import { ROLLE_TEXT } from '@/lib/rollen'
import type { Rolle } from '@prisma/client'
import type { Plattform } from '@prisma/client'
import { PLATTFORM_TEXT, sortierePlattformen } from '@/lib/plattformen'
import { SpeichernKnopf } from '@/components/speichern-knopf'

/** Konten, die als zusätzlicher Ansprechpartner in Frage kommen. */
type Waehlbar = { id: string; name: string; rolle: Rolle }

export type ZugangDaten = {
  id: string
  token: string
  titel: string | null
  zusatzAnsprechpartnerId: string | null
  aufrufe: number
  zuletztGeoeffnet: string | null
  kommentare: number
}

export type MonatStand = {
  monat: string
  titel: string
  erledigt: number
  gesamt: number
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

/**
 * Dateien eines frei gewählten Zeitraums als ZIP.
 *
 * Steht über dem Zugang, weil ein Zeitraum quer zu den Monaten liegen kann —
 * „von der Konzeptrunde bis zum Dreh" hält sich nicht an Monatsgrenzen.
 *
 * Der Zeitraum geht als Adresse an die Route und nicht durch ein Formular:
 * Ein `<a>` bekommt den Strom direkt vom Server, ohne dass der Browser das
 * ganze Archiv erst im Speicher sammelt.
 */
export function ZipZeitraum({
  exportId,
  von,
  bis,
  plattformen,
}: {
  exportId: string
  von: string
  bis: string
  /** Was dieser Kunde bespielt — nur das steht zur Wahl. */
  plattformen: Plattform[]
}) {
  const [vonWert, setVon] = useState(von)
  const [bisWert, setBis] = useState(bis)
  const [captions, setCaptions] = useState(true)
  const [kommentare, setKommentare] = useState(false)
  /*
    Voreingestellt keine — dann kommt das Hauptformat in einem Ordner je
    Beitrag, so wie bisher. Wer nach Plattform trennen will, sagt es
    ausdrücklich; ein voreingestelltes „alle" gäbe jedem, der nur schnell die
    Dateien braucht, plötzlich die doppelte Menge.
  */
  const [ziele, setZiele] = useState<Plattform[]>([])

  const suche = new URLSearchParams({ von: vonWert, bis: bisWert })
  if (!captions) suche.set('captions', '0')
  if (kommentare) suche.set('kommentare', '1')
  for (const p of ziele) suche.append('plattform', p)

  const gueltig = Boolean(vonWert && bisWert && vonWert <= bisWert)

  return (
    <Karte className="p-5">
      <h3 className="text-[14px] font-semibold">Dateien als ZIP</h3>
      <p className="mt-1 text-[12.5px] leading-relaxed text-leiser">
        Ein Ordner je Beitrag, darin die Dateien mit Termin im Namen.
        {ziele.length > 1 && ' Bei mehreren Plattformen liegt darüber ein Ordner je Plattform.'}
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <Feld beschriftung="Von">
          <Eingabe
            type="date"
            value={vonWert}
            onChange={(e) => setVon(e.currentTarget.value)}
            className="w-[150px]"
          />
        </Feld>
        <Feld beschriftung="Bis">
          <Eingabe
            type="date"
            value={bisWert}
            onChange={(e) => setBis(e.currentTarget.value)}
            className="w-[150px]"
          />
        </Feld>

        {plattformen.length > 0 && (
          <div className="grid gap-1.5 pb-0.5">
            <span className="text-[10.5px] uppercase tracking-[0.1em] text-still">Plattformen</span>
            {sortierePlattformen(plattformen).map((p) => (
              <label key={p} className="flex items-center gap-2 text-[12px] text-tinte-3">
                <input
                  type="checkbox"
                  checked={ziele.includes(p)}
                  onChange={(e) => {
                    // Erst lesen, dann setzen: Die Updater-Funktion läuft
                    // beim Rendern, und bis dahin hat React das Ereignis
                    // geleert — `e.currentTarget` wäre dort `null`.
                    const an = e.currentTarget.checked
                    setZiele((vorher) =>
                      an ? [...vorher, p] : vorher.filter((x) => x !== p),
                    )
                  }}
                />
                {PLATTFORM_TEXT[p]}
              </label>
            ))}
            <span className="text-[10.5px] leading-relaxed text-stiller">
              Keine gewählt: nur das Hauptformat.
            </span>
          </div>
        )}

        <div className="grid gap-1.5 pb-0.5">
          <label className="flex items-center gap-2 text-[12px] text-tinte-3">
            <input
              type="checkbox"
              checked={captions}
              onChange={(e) => setCaptions(e.currentTarget.checked)}
            />
            Captions als Textdatei
          </label>
          <label className="flex items-center gap-2 text-[12px] text-tinte-3">
            <input
              type="checkbox"
              checked={kommentare}
              onChange={(e) => setKommentare(e.currentTarget.checked)}
            />
            Kommentarverlauf als PDF
          </label>
        </div>

        {gueltig ? (
          <a
            href={`/api/export/${exportId}/zip?${suche.toString()}`}
            className="rounded-[5px] bg-akzent px-3.5 py-2 text-[12px] font-medium text-white hover:opacity-90"
          >
            ZIP erzeugen
          </a>
        ) : (
          <span className="rounded-[5px] border border-rahmen-3 px-3.5 py-2 text-[12px] text-stiller">
            ZIP erzeugen
          </span>
        )}
      </div>

      {!gueltig && <p className="mt-2 text-[11.5px] text-stiller">Das Ende liegt vor dem Beginn.</p>}
    </Karte>
  )
}

/**
 * Der Freigabezugang des Kunden — eine Karte, ein Link.
 *
 * Vorher stand hier eine Karte je Monat, jede mit eigenem Link, eigener
 * Gästeliste und eigener Einladung. Das war dieselbe Arbeit jeden Monat, und
 * ein Gast, der im August eingeladen war, kam im September nicht hinein. Der
 * Monat ist keine Eigenschaft des Zugangs — er steht in der Adresse.
 */
export function ZugangKarte({
  zugang,
  basisUrl,
  waehlbare,
  gaeste,
  monate,
  mitFreigaben,
}: {
  zugang: ZugangDaten
  basisUrl: string
  waehlbare: Waehlbar[]
  gaeste: Array<{ id: string; name: string; email: string; geoeffnet: string | null }>
  monate: MonatStand[]
  mitFreigaben: boolean
}) {
  const [bearbeiten, setBearbeiten] = useState(false)
  const [kopiert, setKopiert] = useState(false)
  const url = `${basisUrl}/f/${zugang.token}`

  return (
    <Karte className="p-5">
      {/* ------------------------------------------------------------- Link */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-[14.5px] font-semibold">{zugang.titel ?? 'Freigabelink'}</h3>
          <p className="mt-1 text-[12px] text-leiser">
            {zugang.aufrufe} Aufrufe
            {zugang.zuletztGeoeffnet && ` · zuletzt geöffnet ${zugang.zuletztGeoeffnet}`}
            {zugang.kommentare > 0 && ` · ${zugang.kommentare} Kommentare`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <a
            href={`/f/${zugang.token}`}
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
          <Knopf klein art="leise" onClick={() => setBearbeiten((v) => !v)}>
            {bearbeiten ? 'Schließen' : 'Bearbeiten'}
          </Knopf>
        </div>
      </div>

      <p className="mt-3 break-all font-mono text-[11.5px] text-stiller">{url}</p>
      <p className="mt-1 text-[11.5px] text-stiller">
        Ein Link für alle Monate. Der Kunde wechselt sie in der Leiste am Rand.
      </p>

      {/* ----------------------------------------------------------- Einladen */}
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
                <form action={einladungZuruecknehmen.bind(null, zugang.id, gast.id)}>
                  <button type="submit" className="text-[11.5px] text-stiller hover:text-akzent">
                    entfernen
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}

        <form
          action={gastEinladen.bind(null, zugang.id)}
          className="flex flex-wrap items-end gap-2"
        >
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
          Die Einladung geht als Mail mit dem Link heraus. Eingeladene sehen ihn nach der Anmeldung
          auch in ihrer eigenen Übersicht.
        </p>
      </div>

      {/* ------------------------------------------------------------ Monate */}
      {monate.length > 0 && (
        <div className="mt-5 border-t border-rahmen pt-4">
          <h4 className="mb-2.5 text-[10.5px] font-medium uppercase tracking-[0.1em] text-still">
            Monate
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {monate.map((m) => {
              const fertig = mitFreigaben && m.gesamt > 0 && m.erledigt === m.gesamt
              return (
                <a
                  key={m.monat}
                  href={`/f/${zugang.token}?monat=${m.monat}`}
                  target="_blank"
                  rel="noreferrer"
                  title={
                    mitFreigaben
                      ? `${m.erledigt} von ${m.gesamt} freigegeben`
                      : `${m.gesamt} Beiträge`
                  }
                  className="flex items-center gap-2 rounded-[5px] border border-rahmen-3 px-2.5 py-1.5 text-[12px] text-tinte hover:border-rahmen-4"
                >
                  {m.titel}
                  {mitFreigaben && (
                    <span
                      aria-hidden
                      className={`block size-[7px] shrink-0 rounded-full ${
                        fertig ? 'bg-final' : 'bg-vorschau'
                      }`}
                    />
                  )}
                </a>
              )
            })}
          </div>
          <p className="mt-2 text-[11.5px] text-stiller">
            Aus den Beiträgen abgeleitet — ein Monat erscheint, sobald ein vorzeigbarer Beitrag mit
            Termin darin steht.
          </p>
        </div>
      )}

      {/* --------------------------------------------------------- Bearbeiten */}
      {bearbeiten && (
        <form
          action={exportSpeichern.bind(null, zugang.id)}
          className="mt-5 grid gap-4 border-t border-rahmen pt-5"
        >
          <Feld
            beschriftung="Titel"
            hinweis="Steht in der Kopfzeile der Kundenseite. Leer heißt: Content-Plan plus Monat."
          >
            <Eingabe name="titel" defaultValue={zugang.titel ?? ''} />
          </Feld>

          <Feld
            beschriftung="Zusätzlicher Ansprechpartner"
            hinweis="Kommt zum Hauptansprechpartner dazu, ersetzt ihn nicht."
          >
            <AnsprechpartnerWahl liste={waehlbare} ausgewaehlt={zugang.zusatzAnsprechpartnerId} />
          </Feld>

          <div className="flex justify-between gap-2">
            <button
              type="submit"
              formAction={exportLoeschen.bind(null, zugang.id)}
              className="text-[12px] text-stiller hover:text-akzent"
              title="Der Link wird ungültig. Kommentare und Freigaben bleiben."
            >
              Zugang löschen
            </button>
            <SpeichernKnopf art="primaer">
              Speichern
            </SpeichernKnopf>
          </div>
        </form>
      )}
    </Karte>
  )
}
