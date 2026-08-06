import { aktuellerNutzer } from '@/lib/auth'
import { ladeEinstellungen } from '@/lib/einstellungen'
import { Abschnitt, Eingabe, Feld, Fehler, Karte, Knopf } from '@/components/ui'
import { mailSpeichern, testmailSenden } from '../aktionen'
import { MailFelder } from '../mail-felder'

export const metadata = { title: 'Mailversand — Preroll' }

export default async function MailSeite({
  searchParams,
}: {
  searchParams: Promise<{ test?: string; an?: string; meldung?: string }>
}) {
  const e = await ladeEinstellungen()
  const nutzer = await aktuellerNutzer()
  const { test, an, meldung } = await searchParams

  return (
    <Abschnitt
      titel="Mailversand"
      hinweis="Ein aktiver Weg, drei Möglichkeiten. Ohne Mailversand können sich Kunden nicht per Code anmelden."
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
  )
}
