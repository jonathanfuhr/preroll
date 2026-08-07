'use client'

import type { Rolle } from '@prisma/client'
import { useEffect, useRef, useState, useTransition } from 'react'
import { ALLE_ROLLEN, ROLLE_TEXT } from '@/lib/rollen'
import { passwortRegelText } from '@/lib/passwort'
import { Auswahl, Eingabe, Feld, Karte, Knopf, Schalter } from '@/components/ui'
import {
  nutzerAnlegen,
  nutzerRolleSetzen,
  nutzerSpeichern,
  passwortZuruecksetzen,
} from '../benutzer-aktionen'

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

/**
 * Die Rolle steht direkt in der Zeile. Sie ist das, was man in einer Liste
 * von Konten am ehesten ändert — dafür erst einen Bearbeiten-Bereich
 * aufzuklappen, wäre ein Umweg. Alles Übrige liegt weiter dahinter.
 */
function RolleInZeile({ nutzer }: { nutzer: NutzerDaten }) {
  const [laeuft, starteUebergang] = useTransition()
  // Sofort umschalten, statt auf den Server zu warten. Lehnt er ab — letzter
  // Admin, eigenes Konto —, kommt der alte Wert über die Eigenschaften zurück.
  const [rolle, setRolle] = useState(nutzer.rolle)
  useEffect(() => setRolle(nutzer.rolle), [nutzer.rolle])

  return (
    <select
      value={rolle}
      disabled={laeuft}
      onChange={(e) => {
        const neu = e.target.value as Rolle
        setRolle(neu)
        starteUebergang(async () => {
          await nutzerRolleSetzen(nutzer.id, neu)
        })
      }}
      aria-label={`Rolle von ${nutzer.name}`}
      className="rounded-[5px] border border-rahmen-3 bg-flaeche px-2.5 py-1 text-[12px] text-tinte transition-colors hover:border-rahmen-4 focus:border-rahmen-4 focus:outline-none disabled:opacity-50"
    >
      {ALLE_ROLLEN.map((rolle) => (
        <option key={rolle} value={rolle}>
          {ROLLE_TEXT[rolle]}
        </option>
      ))}
    </select>
  )
}

export function NutzerZeile({ nutzer }: { nutzer: NutzerDaten }) {
  const [offen, setOffen] = useState(false)

  return (
    /*
      `min-w-0`, weil ein Rasterfeld sonst nicht unter seine Mindestbreite
      geht: Die lange Mailzeile mit den betreuten Kunden schob die Karte am
      Telefon über den Rand hinaus, statt sich abschneiden zu lassen.
    */
    <Karte className={`min-w-0 p-4 ${nutzer.aktiv ? '' : 'opacity-60'}`}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3.5">
          {nutzer.foto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={nutzer.foto} alt="" className="size-10 shrink-0 rounded-full object-cover" />
          ) : (
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-akzent-zart text-[12px] font-semibold text-akzent">
              {nutzer.initialen}
            </span>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate text-[13.5px] font-medium text-tinte">{nutzer.name}</span>
              {!nutzer.aktiv && (
                <span className="shrink-0 rounded-[3px] bg-konzept-flaeche px-1.5 py-0.5 text-[10px] text-konzept">
                  abgeschaltet
                </span>
              )}
            </div>
            <div className="mt-0.5 truncate text-[11.5px] text-leiser">
              {nutzer.email}
              {nutzer.betreut.length > 0 && ` · betreut ${nutzer.betreut.join(', ')}`}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <RolleInZeile nutzer={nutzer} />
          <Knopf klein art="leise" onClick={() => setOffen((v) => !v)}>
            {offen ? 'Schließen' : 'Bearbeiten'}
          </Knopf>
        </div>
      </div>

      {offen && (
        <div className="mt-4 grid gap-5 border-t border-rahmen pt-4">
          {/* Die Rolle fehlt hier bewusst — sie steht oben in der Zeile. */}
          <form action={nutzerSpeichern.bind(null, nutzer.id)} className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Feld beschriftung="Name">
                <Eingabe name="name" defaultValue={nutzer.name} required />
              </Feld>
              <Feld beschriftung="E-Mail">
                <Eingabe name="email" type="email" defaultValue={nutzer.email} required />
              </Feld>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Feld beschriftung="Position" hinweis="Steht im Kontakt-Fuß der Export-Seite.">
                <Eingabe
                  name="position"
                  defaultValue={nutzer.position ?? ''}
                  placeholder="Projektleitung"
                />
              </Feld>
              <Feld beschriftung="Telefon">
                <Eingabe name="telefon" defaultValue={nutzer.telefon ?? ''} />
              </Feld>
            </div>

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

/**
 * Ein Konto legt man selten an — als Dauerformular unter der Liste nimmt es
 * nur Platz weg. Deshalb ein Knopf, der einen Dialog öffnet.
 */
export function NutzerAnlegen() {
  const [offen, setOffen] = useState(false)
  const formular = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (!offen) return

    const vorher = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const beiTaste = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOffen(false)
    }
    window.addEventListener('keydown', beiTaste)

    return () => {
      document.body.style.overflow = vorher
      window.removeEventListener('keydown', beiTaste)
    }
  }, [offen])

  if (!offen) {
    return (
      <Knopf art="primaer" klein onClick={() => setOffen(true)}>
        Konto anlegen
      </Knopf>
    )
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-tinte/25 px-3 py-6 sm:px-6 sm:py-10"
      onClick={() => setOffen(false)}
    >
      <div
        className="w-full max-w-[520px] rounded-md border border-rahmen bg-flaeche p-5 shadow-xl sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-[16px] font-semibold">Konto anlegen</h3>
            <p className="mt-1 text-[12.5px] text-leise">
              Für Kolleginnen und Kollegen ohne Microsoft-Konto. Wer sich über Microsoft anmeldet,
              bekommt sein Konto von selbst.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOffen(false)}
            className="text-[18px] leading-none text-still hover:text-tinte"
            aria-label="Schließen"
          >
            ×
          </button>
        </div>

        <form ref={formular} action={nutzerAnlegen} className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Feld beschriftung="Name">
              <Eingabe name="name" required autoFocus placeholder="Vor- und Nachname" />
            </Feld>
            <Feld beschriftung="E-Mail">
              <Eingabe name="email" type="email" required placeholder="name@thdvideo.de" />
            </Feld>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Feld beschriftung="Rolle">
              <RollenWahl name="rolle" />
            </Feld>
            <Feld beschriftung="Position">
              <Eingabe name="position" placeholder="Gestaltung" />
            </Feld>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Feld beschriftung="Telefon">
              <Eingabe name="telefon" />
            </Feld>
            <Feld beschriftung="Startpasswort" hinweis={passwortRegelText()}>
              <Eingabe name="passwort" type="password" required />
            </Feld>
          </div>

          <div className="flex justify-end gap-2">
            <Knopf klein art="leise" type="button" onClick={() => setOffen(false)}>
              Abbrechen
            </Knopf>
            <Knopf art="primaer" klein type="submit">
              Anlegen
            </Knopf>
          </div>
        </form>
      </div>
    </div>
  )
}
