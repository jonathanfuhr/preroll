'use client'

import type { Rolle } from '@prisma/client'
import { useState } from 'react'
import { ALLE_ROLLEN, ROLLE_TEXT } from '@/lib/rollen'
import { passwortRegelText } from '@/lib/passwort'
import { Auswahl, Eingabe, Feld, Karte, Knopf, Schalter } from '@/components/ui'
import { nutzerAnlegen, nutzerSpeichern, passwortZuruecksetzen } from '../benutzer-aktionen'

export type NutzerDaten = {
  id: string
  name: string
  email: string
  rolle: Rolle
  aktiv: boolean
  position: string | null
  telefon: string | null
  initialen: string
  foto: string | null
  betreut: string[]
}

function RollenWahl({ name, wert }: { name: string; wert?: Rolle }) {
  return (
    <Auswahl name={name} defaultValue={wert ?? 'EDITOR'}>
      {ALLE_ROLLEN.map((rolle) => (
        <option key={rolle} value={rolle}>
          {ROLLE_TEXT[rolle]}
        </option>
      ))}
    </Auswahl>
  )
}

export function NutzerZeile({ nutzer }: { nutzer: NutzerDaten }) {
  const [offen, setOffen] = useState(false)

  return (
    <Karte className={`p-4 ${nutzer.aktiv ? '' : 'opacity-60'}`}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          {nutzer.foto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={nutzer.foto} alt="" className="size-10 rounded-full object-cover" />
          ) : (
            <span className="flex size-10 items-center justify-center rounded-full bg-akzent-zart text-[12px] font-semibold text-akzent">
              {nutzer.initialen}
            </span>
          )}
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[13.5px] font-medium text-tinte">{nutzer.name}</span>
              {!nutzer.aktiv && (
                <span className="rounded-[3px] bg-konzept-flaeche px-1.5 py-0.5 text-[10px] text-konzept">
                  abgeschaltet
                </span>
              )}
            </div>
            <div className="mt-0.5 text-[11.5px] text-leiser">
              {nutzer.email} · {ROLLE_TEXT[nutzer.rolle]}
              {nutzer.betreut.length > 0 && ` · betreut ${nutzer.betreut.join(', ')}`}
            </div>
          </div>
        </div>

        <Knopf klein art="leise" onClick={() => setOffen((v) => !v)}>
          {offen ? 'Schließen' : 'Bearbeiten'}
        </Knopf>
      </div>

      {offen && (
        <div className="mt-4 grid gap-5 border-t border-rahmen pt-4">
          <form action={nutzerSpeichern.bind(null, nutzer.id)} className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <Feld beschriftung="Name">
                <Eingabe name="name" defaultValue={nutzer.name} required />
              </Feld>
              <Feld beschriftung="E-Mail">
                <Eingabe name="email" type="email" defaultValue={nutzer.email} required />
              </Feld>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Feld beschriftung="Rolle">
                <RollenWahl name="rolle" wert={nutzer.rolle} />
              </Feld>
              <Feld beschriftung="Position" hinweis="Steht im Kontakt-Fuß der Export-Seite.">
                <Eingabe name="position" defaultValue={nutzer.position ?? ''} placeholder="Projektleitung" />
              </Feld>
            </div>

            <Feld beschriftung="Telefon">
              <Eingabe name="telefon" defaultValue={nutzer.telefon ?? ''} />
            </Feld>

            <Schalter
              name="aktiv"
              beschriftung="Konto aktiv"
              hinweis="Abgeschaltete Konten können sich nicht anmelden und bekommen keine Meldungen."
              defaultChecked={nutzer.aktiv}
            />

            <div className="flex justify-end">
              <Knopf klein type="submit">
                Speichern
              </Knopf>
            </div>
          </form>

          <form
            action={passwortZuruecksetzen.bind(null, nutzer.id)}
            className="flex flex-wrap items-end gap-2 border-t border-rahmen pt-4"
          >
            <div className="w-[240px]">
              <Feld beschriftung="Neues Passwort setzen" hinweis={passwortRegelText()}>
                <Eingabe name="passwort" type="password" required />
              </Feld>
            </div>
            <Knopf klein type="submit">
              Zurücksetzen
            </Knopf>
            <p className="w-full text-[11.5px] text-stiller">
              Beendet alle offenen Sitzungen dieses Kontos.
            </p>
          </form>
        </div>
      )}
    </Karte>
  )
}

export function NutzerAnlegen() {
  return (
    <form action={nutzerAnlegen} className="grid gap-4">
      <div className="grid grid-cols-2 gap-4">
        <Feld beschriftung="Name">
          <Eingabe name="name" required placeholder="Vor- und Nachname" />
        </Feld>
        <Feld beschriftung="E-Mail">
          <Eingabe name="email" type="email" required placeholder="name@thdvideo.de" />
        </Feld>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Feld beschriftung="Rolle">
          <RollenWahl name="rolle" />
        </Feld>
        <Feld beschriftung="Position">
          <Eingabe name="position" placeholder="Gestaltung" />
        </Feld>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Feld beschriftung="Telefon">
          <Eingabe name="telefon" />
        </Feld>
        <Feld beschriftung="Startpasswort" hinweis={passwortRegelText()}>
          <Eingabe name="passwort" type="password" required />
        </Feld>
      </div>

      <div className="flex justify-end">
        <Knopf art="primaer" klein type="submit">
          Konto anlegen
        </Knopf>
      </div>
    </form>
  )
}
