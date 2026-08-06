import { aktuellerNutzer } from '@/lib/auth'
import { ladeEinstellungen } from '@/lib/einstellungen'
import { env } from '@/lib/env'
import {
  Abschnitt,
  Eingabe,
  Feld,
  Fehler,
  Hinweis,
  Karte,
  Knopf,
  Schalter,
} from '@/components/ui'
import {
  anmeldungSpeichern,
  benachrichtigungenSpeichern,
  klappeSpeichern,
  mailSpeichern,
  pushEinrichten,
  testmailSenden,
  workspaceSpeichern,
} from './aktionen'
import { PushAnmeldung } from '@/components/push-anmeldung'
import { KlappeEinrichtung } from './klappe'
import { MailFelder } from './mail-felder'

export const metadata = { title: 'Einstellungen — Preroll' }

export default async function EinstellungenSeite({
  searchParams,
}: {
  searchParams: Promise<{
    test?: string
    an?: string
    meldung?: string
    klappe?: string
    code?: string
    geraet?: string
    url?: string
  }>
}) {
  const nutzer = await aktuellerNutzer()
  const e = await ladeEinstellungen()
  const { test, an, meldung, klappe, code, geraet, url } = await searchParams
  const istAdmin = nutzer?.rolle === 'ADMIN'

  return (
    <div className="max-w-[720px]">
      <h1 className="mb-1.5 text-[24px] font-semibold tracking-[-0.02em]">Einstellungen</h1>
      <p className="mb-8 text-[13px] leading-relaxed text-leise">
        Mailversand, Anmeldung und Anbindungen liegen in der Datenbank — Änderungen greifen ohne
        Neustart des Containers.
      </p>

      {/* -------------------------------------------- Eigene Benachrichtigungen */}
      <Abschnitt titel="Meine Benachrichtigungen" hinweis="Gilt nur für Ihr eigenes Konto.">
        <Karte className="p-5">
          <form action={benachrichtigungenSpeichern} className="grid gap-3">
            <Schalter
              name="mailBenachrichtigungen"
              beschriftung="E-Mail bei neuen Kommentaren und Freigaben"
              defaultChecked={nutzer?.mailBenachrichtigungen}
            />
            <Schalter
              name="pushBenachrichtigungen"
              beschriftung="Push-Benachrichtigung im Browser"
              hinweis={
                e.vapidPublicKey
                  ? 'Das Gerät muss die Benachrichtigungen einmal erlauben.'
                  : 'Push ist noch nicht eingerichtet — siehe unten.'
              }
              defaultChecked={nutzer?.pushBenachrichtigungen}
            />
            <div className="flex items-center justify-between gap-4">
              <PushAnmeldung />
              <Knopf klein type="submit">
                Speichern
              </Knopf>
            </div>
          </form>
        </Karte>
      </Abschnitt>

      {!istAdmin ? (
        <Hinweis>
          Die übrigen Einstellungen kann nur ein Konto mit Administratorrechten ändern.
        </Hinweis>
      ) : (
        <>
          {/* ------------------------------------------------------- Workspace */}
          <Abschnitt titel="Workspace">
            <Karte className="p-5">
              <form action={workspaceSpeichern} className="grid gap-4">
                <Feld beschriftung="Name" hinweis="Erscheint im Kopf und in Mailvorlagen.">
                  <Eingabe name="workspaceName" defaultValue={e.workspaceName} />
                </Feld>
                <Feld beschriftung="Akzentfarbe">
                  <Eingabe name="akzentfarbe" defaultValue={e.akzentfarbe} placeholder="#b00900" />
                </Feld>
                <div className="flex justify-end">
                  <Knopf klein type="submit">
                    Speichern
                  </Knopf>
                </div>
              </form>
            </Karte>
          </Abschnitt>

          {/* ---------------------------------------------------- Mailversand */}
          <Abschnitt
            titel="Mailversand"
            hinweis="Ein aktiver Weg, drei Möglichkeiten. Ohne Mailversand funktioniert die Anmeldung von Kunden per Code nicht."
          >
            {test === 'ok' && (
              <div className="mb-4 rounded-[5px] border border-[#cfe4d6] bg-final-flaeche px-3.5 py-2.5 text-[12.5px] text-final">
                Testmail an {an} verschickt.
              </div>
            )}
            {test === 'fehler' && (
              <div className="mb-4">
                <Fehler>{meldung ?? 'Der Versand ist fehlgeschlagen.'}</Fehler>
              </div>
            )}

            <Karte className="p-5">
              <MailFelder
                einstellungen={{
                  mailTransport: e.mailTransport,
                  mailVonName: e.mailVonName,
                  mailVonAdresse: e.mailVonAdresse,
                  smtpHost: e.smtpHost,
                  smtpPort: e.smtpPort,
                  smtpSicher: e.smtpSicher,
                  smtpBenutzer: e.smtpBenutzer,
                  smtpPasswortGesetzt: Boolean(e.smtpPasswort),
                  msTenantId: e.msTenantId,
                  msClientId: e.msClientId,
                  msPostfach: e.msPostfach,
                  msClientSecretGesetzt: Boolean(e.msClientSecret),
                  googleClientId: e.googleClientId,
                  googleAbsender: e.googleAbsender,
                  googleClientSecretGesetzt: Boolean(e.googleClientSecret),
                  googleRefreshTokenGesetzt: Boolean(e.googleRefreshToken),
                }}
                speichern={mailSpeichern}
              />
            </Karte>

            <form action={testmailSenden} className="mt-3 flex items-end gap-2">
              <div className="w-[240px]">
                <Feld beschriftung="Testmail an">
                  <Eingabe name="testAn" type="email" defaultValue={nutzer?.email} />
                </Feld>
              </div>
              <Knopf klein type="submit">
                Testmail senden
              </Knopf>
            </form>
          </Abschnitt>

          {/* ----------------------------------------------------- Anmeldung */}
          <Abschnitt
            titel="Anmeldung"
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
                  hinweis={
                    e.m365ClientSecret
                      ? 'Hinterlegt — nur ausfüllen, um ihn zu ersetzen.'
                      : 'Noch nicht hinterlegt.'
                  }
                >
                  <Eingabe name="m365ClientSecret" type="password" placeholder="unverändert" />
                </Feld>
                <div className="flex justify-end">
                  <Knopf klein type="submit">
                    Speichern
                  </Knopf>
                </div>
              </form>
            </Karte>
          </Abschnitt>

          {/* -------------------------------------------------------- Push */}
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

          {/* ------------------------------------------------------- Klappe */}
          <Abschnitt
            titel="Klappe"
            hinweis="Finale Reels werden aus Klappe geholt, statt sie erneut hochzuladen. Umgekehrt legt Preroll dort beim Konzipieren eines Reels schon das Video an — dann muss beim Upload aus dem Schnitt kein Name mehr getippt werden."
          >
            <KlappeEinrichtung
              basisUrl={e.klappeBasisUrl}
              gekoppeltAm={e.klappeGekoppeltAm}
              konto={e.klappeKonto}
              zustand={klappe}
              userCode={code}
              geraetCode={geraet}
              bestaetigungsUrl={url}
              meldung={meldung}
            />
          </Abschnitt>
        </>
      )}
    </div>
  )
}
