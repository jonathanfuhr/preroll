import { Eingabe, Feld, Fehler, Knopf } from '@/components/ui'
import { codeAnfordern, codeEinloesen } from '@/app/f/[token]/aktionen'

const FEHLERTEXT: Record<string, string> = {
  email: 'Bitte eine E-Mail-Adresse angeben.',
  versand: 'Der Code konnte nicht verschickt werden. Bitte bei der Agentur melden.',
  unbekannt: 'Der Code stimmt nicht. Bitte prüfen und erneut eingeben.',
  abgelaufen: 'Der Code ist abgelaufen. Bitte einen neuen anfordern.',
  'zu-viele-versuche': 'Zu viele Fehlversuche. Bitte einen neuen Code anfordern.',
}

/**
 * Passwortlose Anmeldung für Kunden: Name und E-Mail, dann ein sechsstelliger
 * Code aus der Mail. Wird sowohl vor einem geschützten Freigabe-Link als auch
 * vor der eigenen Übersicht verwendet.
 */
export function GastAnmeldung({
  token,
  schritt,
  email,
  fehler,
  titel,
  text,
}: {
  token: string | null
  schritt: string | undefined
  email: string | undefined
  fehler: string | undefined
  titel: string
  text: string
}) {
  const codeSchritt = schritt === 'code' && email

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-[380px]">
        <div className="mb-8">
          <div className="text-[11px] uppercase tracking-[0.22em] text-leiser">preroll</div>
          <h1 className="mt-3 text-[24px] font-semibold tracking-[-0.02em]">{titel}</h1>
          <p className="mt-1.5 text-[13px] leading-relaxed text-leise">{text}</p>
        </div>

        {fehler && (
          <div className="mb-5">
            <Fehler>{FEHLERTEXT[fehler] ?? 'Das hat nicht geklappt.'}</Fehler>
          </div>
        )}

        {codeSchritt ? (
          <form action={codeEinloesen.bind(null, token)} className="grid gap-4">
            <input type="hidden" name="email" value={email} />
            <Feld beschriftung="Code aus der E-Mail" hinweis={`Gesendet an ${email}. Gültig 15 Minuten.`}>
              <Eingabe
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                required
                autoFocus
                placeholder="000000"
                className="text-center font-mono text-[20px] tracking-[0.3em]"
              />
            </Feld>
            <Knopf art="primaer" type="submit" className="w-full">
              Anmelden
            </Knopf>
            <a
              href={token ? `/f/${token}/anmelden` : '/portal/anmelden'}
              className="text-center text-[12px] text-leiser hover:text-tinte"
            >
              Andere Adresse verwenden
            </a>
          </form>
        ) : (
          <form action={codeAnfordern.bind(null, token)} className="grid gap-4">
            <Feld beschriftung="Name">
              <Eingabe name="name" required placeholder="Vor- und Nachname" autoFocus />
            </Feld>
            <Feld beschriftung="E-Mail">
              <Eingabe name="email" type="email" required placeholder="name@firma.de" />
            </Feld>
            <Knopf art="primaer" type="submit" className="mt-1 w-full">
              Code anfordern
            </Knopf>
            <p className="text-[11.5px] leading-relaxed text-stiller">
              Sie erhalten einen sechsstelligen Code per E-Mail. Ein Passwort brauchen Sie nicht.
            </p>
          </form>
        )}
      </div>
    </main>
  )
}
