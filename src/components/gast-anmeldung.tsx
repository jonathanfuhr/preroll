import { Eingabe, Feld, Fehler, Knopf } from '@/components/ui'
import { codeAnfordern, codeEinloesen, namenSpeichern } from '@/app/f/[token]/aktionen'

const FEHLERTEXT: Record<string, string> = {
  email: 'Bitte eine E-Mail-Adresse angeben.',
  name: 'Bitte einen Namen angeben.',
  versand: 'Der Code konnte nicht verschickt werden. Bitte bei der Agentur melden.',
  unbekannt: 'Der Code stimmt nicht. Bitte prüfen und erneut eingeben.',
  abgelaufen: 'Der Code ist abgelaufen. Bitte einen neuen anfordern.',
  'zu-viele-versuche': 'Zu viele Fehlversuche. Bitte einen neuen Code anfordern.',
}

export type Anmeldeschritt = 'email' | 'code' | 'name'

/**
 * Anmeldung für Kunden in drei Schritten: E-Mail → Code aus der Mail → Name.
 * Ein Freigabe-Link öffnet sich nie ohne diese Hürde; eine bestehende Sitzung
 * gilt 40 Tage, dann genügt der Link allein.
 */
export function GastAnmeldung({
  token,
  schritt,
  email,
  nameVorschlag,
  fehler,
  titel,
  text,
}: {
  token: string | null
  schritt: Anmeldeschritt
  email?: string
  nameVorschlag?: string
  fehler?: string
  titel: string
  text: string
}) {
  const schrittNummer = schritt === 'email' ? 1 : schritt === 'code' ? 2 : 3

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-[380px]">
        <div className="mb-7">
          <div className="text-[11px] uppercase tracking-[0.22em] text-leiser">preroll</div>
          <h1 className="mt-3 text-[24px] font-semibold tracking-[-0.02em]">{titel}</h1>
          <p className="mt-1.5 text-[13px] leading-relaxed text-leise">{text}</p>
        </div>

        <div className="mb-6 flex items-center gap-1.5" aria-hidden>
          {[1, 2, 3].map((n) => (
            <span
              key={n}
              className="h-[3px] flex-1 rounded-full"
              style={{
                background: n <= schrittNummer ? 'var(--color-akzent)' : 'var(--color-rahmen-3)',
              }}
            />
          ))}
        </div>

        {fehler && (
          <div className="mb-5">
            <Fehler>{FEHLERTEXT[fehler] ?? 'Das hat nicht geklappt.'}</Fehler>
          </div>
        )}

        {schritt === 'email' && (
          <form action={codeAnfordern.bind(null, token)} className="grid gap-4">
            <Feld
              beschriftung="E-Mail"
              hinweis="An diese Adresse schicken wir einen sechsstelligen Code. Ein Passwort brauchen Sie nicht."
            >
              <Eingabe
                name="email"
                type="email"
                required
                autoFocus
                autoComplete="email"
                placeholder="name@firma.de"
              />
            </Feld>
            <Knopf art="primaer" type="submit" className="w-full">
              Weiter
            </Knopf>
          </form>
        )}

        {schritt === 'code' && (
          <form action={codeEinloesen.bind(null, token)} className="grid gap-4">
            <input type="hidden" name="email" value={email ?? ''} />
            <Feld
              beschriftung="Code aus der E-Mail"
              hinweis={`Gesendet an ${email}. Gültig 15 Minuten.`}
            >
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
              Weiter
            </Knopf>
            <a
              href={token ? `/f/${token}/anmelden` : '/portal/anmelden'}
              className="text-center text-[12px] text-leiser hover:text-tinte"
            >
              Andere Adresse verwenden
            </a>
          </form>
        )}

        {schritt === 'name' && (
          <form action={namenSpeichern.bind(null, token)} className="grid gap-4">
            <Feld
              beschriftung="Ihr Name"
              hinweis="Steht an Ihren Kommentaren und an der Freigabe, damit die Agentur weiß, von wem sie kommt."
            >
              <Eingabe
                name="name"
                required
                autoFocus
                autoComplete="name"
                defaultValue={nameVorschlag ?? ''}
                placeholder="Vor- und Nachname"
              />
            </Feld>
            <Knopf art="primaer" type="submit" className="w-full">
              Weiter zum Plan
            </Knopf>
          </form>
        )}
      </div>
    </main>
  )
}
