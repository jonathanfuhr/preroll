'use client'

import type { MailTransport } from '@prisma/client'
import { useState } from 'react'
import { SMTP_PRESETS } from '@/lib/mail/presets'
import { Auswahl, Eingabe, Feld, Knopf, Schalter } from '@/components/ui'

type MailEinstellungen = {
  mailTransport: MailTransport
  mailVonName: string | null
  mailVonAdresse: string | null
  smtpHost: string | null
  smtpPort: number | null
  smtpSicher: boolean
  smtpBenutzer: string | null
  smtpPasswortGesetzt: boolean
  msTenantId: string | null
  msClientId: string | null
  msPostfach: string | null
  msClientSecretGesetzt: boolean
  googleClientId: string | null
  googleAbsender: string | null
  googleClientSecretGesetzt: boolean
  googleRefreshTokenGesetzt: boolean
}

const HINWEIS_GESETZT = 'Hinterlegt — nur ausfüllen, um es zu ersetzen.'

export function MailFelder({
  einstellungen: e,
  speichern,
}: {
  einstellungen: MailEinstellungen
  speichern: (formular: FormData) => Promise<void>
}) {
  const [transport, setTransport] = useState<MailTransport>(e.mailTransport)
  const [host, setHost] = useState(e.smtpHost ?? '')
  const [port, setPort] = useState(String(e.smtpPort ?? ''))
  const [sicher, setSicher] = useState(e.smtpSicher)

  return (
    <form action={speichern} className="grid gap-4">
      <Feld beschriftung="Weg">
        <Auswahl
          name="mailTransport"
          value={transport}
          onChange={(ereignis) => setTransport(ereignis.target.value as MailTransport)}
        >
          <option value="DEAKTIVIERT">Kein Mailversand</option>
          <option value="SMTP">SMTP (beliebiger Anbieter)</option>
          <option value="MICROSOFT365">Microsoft 365 (Graph)</option>
          <option value="GOOGLE">Google (Gmail API)</option>
        </Auswahl>
      </Feld>

      {transport !== 'DEAKTIVIERT' && transport !== 'GOOGLE' && (
        <div className="grid grid-cols-2 gap-4">
          <Feld beschriftung="Absender-Name">
            <Eingabe name="mailVonName" defaultValue={e.mailVonName ?? ''} placeholder="THD Video" />
          </Feld>
          <Feld beschriftung="Absender-Adresse">
            <Eingabe
              name="mailVonAdresse"
              type="email"
              defaultValue={e.mailVonAdresse ?? ''}
              placeholder="preroll@thdvideo.de"
            />
          </Feld>
        </div>
      )}

      {/* --------------------------------------------------------------- SMTP */}
      {transport === 'SMTP' && (
        <>
          <div>
            <span className="mb-1.5 block text-[10.5px] font-medium uppercase tracking-[0.1em] text-still">
              Vorlage
            </span>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(SMTP_PRESETS).map(([name, preset]) => (
                <Knopf
                  key={name}
                  type="button"
                  klein
                  art="leise"
                  className="!border-rahmen-3"
                  onClick={() => {
                    setHost(preset.host)
                    setPort(String(preset.port))
                    setSicher(preset.sicher)
                  }}
                >
                  {name}
                </Knopf>
              ))}
            </div>
            <p className="mt-1.5 text-[11.5px] text-leiser">
              Füllt nur Host und Port vor — Zugangsdaten kommen vom Anbieter.
            </p>
          </div>

          <div className="grid grid-cols-[1fr_100px] gap-4">
            <Feld beschriftung="Host">
              <Eingabe name="smtpHost" value={host} onChange={(ev) => setHost(ev.target.value)} />
            </Feld>
            <Feld beschriftung="Port">
              <Eingabe
                name="smtpPort"
                type="number"
                value={port}
                onChange={(ev) => setPort(ev.target.value)}
              />
            </Feld>
          </div>

          <Schalter
            name="smtpSicher"
            beschriftung="Direkte TLS-Verbindung (Port 465)"
            hinweis="Bei Port 587 ausgeschaltet lassen — dort wird über STARTTLS verschlüsselt."
            checked={sicher}
            onChange={(ev) => setSicher(ev.target.checked)}
          />

          <div className="grid grid-cols-2 gap-4">
            <Feld beschriftung="Benutzer">
              <Eingabe name="smtpBenutzer" defaultValue={e.smtpBenutzer ?? ''} />
            </Feld>
            <Feld
              beschriftung="Passwort"
              hinweis={e.smtpPasswortGesetzt ? HINWEIS_GESETZT : undefined}
            >
              <Eingabe name="smtpPasswort" type="password" placeholder="unverändert" />
            </Feld>
          </div>
        </>
      )}

      {/* ------------------------------------------------------- Microsoft 365 */}
      {transport === 'MICROSOFT365' && (
        <>
          <p className="rounded-[5px] border border-rahmen bg-flaeche-leise px-3.5 py-2.5 text-[12px] leading-relaxed text-leise">
            App-Registrierung im Entra Admin Center mit der <strong>Anwendungsberechtigung</strong>{' '}
            <code className="font-mono">Mail.Send</code> und erteilter Administratorzustimmung.
            Gesendet wird aus dem angegebenen Postfach.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <Feld beschriftung="Verzeichnis-ID (Tenant)">
              <Eingabe name="msTenantId" defaultValue={e.msTenantId ?? ''} />
            </Feld>
            <Feld beschriftung="Anwendungs-ID (Client)">
              <Eingabe name="msClientId" defaultValue={e.msClientId ?? ''} />
            </Feld>
          </div>
          <Feld
            beschriftung="Clientschlüssel"
            hinweis={e.msClientSecretGesetzt ? HINWEIS_GESETZT : undefined}
          >
            <Eingabe name="msClientSecret" type="password" placeholder="unverändert" />
          </Feld>
          <Feld beschriftung="Postfach" hinweis="UPN oder Objekt-ID des sendenden Kontos.">
            <Eingabe name="msPostfach" defaultValue={e.msPostfach ?? ''} placeholder="preroll@thdvideo.de" />
          </Feld>
        </>
      )}

      {/* -------------------------------------------------------------- Google */}
      {transport === 'GOOGLE' && (
        <>
          <p className="rounded-[5px] border border-rahmen bg-flaeche-leise px-3.5 py-2.5 text-[12px] leading-relaxed text-leise">
            OAuth-Client in der Google Cloud Console mit dem Bereich{' '}
            <code className="font-mono">gmail.send</code>. Das Refresh-Token wird einmalig für das
            sendende Konto erzeugt und hier hinterlegt.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <Feld beschriftung="Client-ID">
              <Eingabe name="googleClientId" defaultValue={e.googleClientId ?? ''} />
            </Feld>
            <Feld
              beschriftung="Client-Secret"
              hinweis={e.googleClientSecretGesetzt ? HINWEIS_GESETZT : undefined}
            >
              <Eingabe name="googleClientSecret" type="password" placeholder="unverändert" />
            </Feld>
          </div>
          <Feld
            beschriftung="Refresh-Token"
            hinweis={e.googleRefreshTokenGesetzt ? HINWEIS_GESETZT : undefined}
          >
            <Eingabe name="googleRefreshToken" type="password" placeholder="unverändert" />
          </Feld>
          <Feld beschriftung="Absender-Adresse">
            <Eingabe
              name="googleAbsender"
              type="email"
              defaultValue={e.googleAbsender ?? ''}
              placeholder="preroll@thdvideo.de"
            />
          </Feld>
        </>
      )}

      <div className="flex justify-end">
        <Knopf klein type="submit">
          Speichern
        </Knopf>
      </div>
    </form>
  )
}
