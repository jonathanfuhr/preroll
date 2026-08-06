import { ladeEinstellungen } from '@/lib/einstellungen'
import { env } from '@/lib/env'
import { Abschnitt, Eingabe, Feld, Hinweis, Karte, Knopf, Schalter } from '@/components/ui'
import { anmeldungSpeichern, pushEinrichten } from '../aktionen'

export const metadata = { title: 'Anmeldung — Preroll' }

export default async function AnmeldungSeite() {
  const e = await ladeEinstellungen()

  return (
    <>
      <Abschnitt
        titel="Team-Anmeldung"
        hinweis="Kunden melden sich immer passwortlos per Mail-Code an — das hier betrifft nur das Team."
      >
        <Karte className="p-5">
          <form action={anmeldungSpeichern} className="grid gap-4">
            <Schalter
              name="lokalerLoginErlaubt"
              beschriftung="Lokale Konten (E-Mail + Passwort)"
              defaultChecked={e.lokalerLoginErlaubt}
            />
            <Schalter
              name="m365LoginErlaubt"
              beschriftung="Microsoft 365 über Entra ID"
              hinweis={`Redirect-URI im Entra Admin Center: ${env.appUrl}/api/auth/m365/callback`}
              defaultChecked={e.m365LoginErlaubt}
            />
            <div className="grid grid-cols-2 gap-4">
              <Feld beschriftung="Verzeichnis-ID (Tenant)">
                <Eingabe name="m365TenantId" defaultValue={e.m365TenantId ?? ''} />
              </Feld>
              <Feld beschriftung="Anwendungs-ID (Client)">
                <Eingabe name="m365ClientId" defaultValue={e.m365ClientId ?? ''} />
              </Feld>
            </div>
            <Feld
              beschriftung="Clientschlüssel"
              hinweis={e.m365ClientSecret ? 'Hinterlegt — nur ausfüllen, um ihn zu ersetzen.' : undefined}
            >
              <Eingabe name="m365ClientSecret" type="password" placeholder="unverändert" />
            </Feld>

            <Hinweis>
              Wer sich zum ersten Mal über Microsoft anmeldet, bekommt automatisch ein Konto mit
              der Rolle <strong>Design</strong> — nur Konten aus eurem Tenant kommen bis hierher.
              Position, Telefonnummer und Profilbild holt Preroll dabei aus dem Verzeichnis
              (Berechtigung <code className="font-mono text-[11px]">User.Read</code>), aber nur für
              Felder, die hier noch leer sind. Wer seine Angaben in Preroll selbst ändert, behält
              sie.
            </Hinweis>
            <div className="flex justify-end">
              <Knopf klein type="submit">
                Speichern
              </Knopf>
            </div>
          </form>
        </Karte>
      </Abschnitt>

      <Abschnitt
        titel="Push-Benachrichtigungen"
        hinweis="Web-Push braucht ein Schlüsselpaar (VAPID). Preroll erzeugt es selbst — nichts einzutragen."
      >
        <Karte className="p-5">
          {e.vapidPublicKey ? (
            <p className="text-[12.5px] text-leise">
              Eingerichtet. Öffentlicher Schlüssel:{' '}
              <code className="font-mono text-[11.5px] text-tinte-3">
                {e.vapidPublicKey.slice(0, 24)}…
              </code>
            </p>
          ) : (
            <form action={pushEinrichten} className="flex items-center justify-between gap-4">
              <p className="text-[12.5px] text-leise">Noch nicht eingerichtet.</p>
              <Knopf klein type="submit">
                Schlüssel erzeugen
              </Knopf>
            </form>
          )}
        </Karte>
      </Abschnitt>
    </>
  )
}
