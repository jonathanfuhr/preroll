import { prisma } from '@/lib/db'
import { ladeEinstellungen } from '@/lib/einstellungen'
import { env } from '@/lib/env'
import { ALLE_ROLLEN, ROLLE_BESCHREIBUNG, ROLLE_TEXT } from '@/lib/rollen'
import { thumbUrl } from '@/lib/urls'
import { Abschnitt, Eingabe, Feld, Fehler, Hinweis, Karte, Knopf, Schalter } from '@/components/ui'
import { anmeldungSpeichern, pushEinrichten } from '../aktionen'
import { NutzerAnlegen, NutzerZeile } from './verwaltung'
import { SpeichernKnopf } from '@/components/speichern-knopf'

export const metadata = { title: 'Benutzer — Preroll' }

const FEHLERTEXT: Record<string, string> = {
  pflicht: 'Bitte Name und E-Mail ausfüllen.',
  vorhanden: 'Für diese Adresse gibt es bereits ein Konto.',
  selbst: 'Sich selbst die Administratorrechte oder den Zugang zu nehmen, würde Sie aussperren.',
  'letzter-admin': 'Es muss mindestens ein aktives Administratorkonto geben.',
}

export default async function BenutzerSeite({
  searchParams,
}: {
  searchParams: Promise<{ fehler?: string; meldung?: string }>
}) {
  const { fehler, meldung } = await searchParams

  const [nutzer, e] = await Promise.all([
    prisma.nutzer.findMany({
      orderBy: [{ aktiv: 'desc' }, { name: 'asc' }],
      include: { foto: true, betreut: { include: { kunde: true } } },
    }),
    ladeEinstellungen(),
  ])

  return (
    <>
      {fehler && (
        <div className="mb-5">
          <Fehler>{meldung ?? FEHLERTEXT[fehler] ?? 'Das hat nicht geklappt.'}</Fehler>
        </div>
      )}

      <Abschnitt
        titel="Konten"
        hinweis="Alle Rollen dürfen alles lesen und bearbeiten. Sie unterscheiden sich darin, wer verwalten darf und wer worüber benachrichtigt wird."
        aktion={<NutzerAnlegen />}
      >
        <div className="grid gap-3">
          {nutzer.map((n) => (
            <NutzerZeile
              key={n.id}
              nutzer={{
                id: n.id,
                name: n.name,
                email: n.email,
                rolle: n.rolle,
                aktiv: n.aktiv,
                position: n.position,
                telefon: n.telefon,
                initialen: n.initialen,
                foto: thumbUrl(n.fotoId),
                betreut: n.betreut.map((b) => b.kunde.name),
              }}
            />
          ))}
        </div>
      </Abschnitt>

      <Abschnitt titel="Was die Rollen bedeuten">
        <Karte className="overflow-hidden">
          {ALLE_ROLLEN.map((rolle) => (
            <div key={rolle} className="border-b border-rahmen px-4 py-3 last:border-b-0">
              <div className="text-[13px] font-medium text-tinte">{ROLLE_TEXT[rolle]}</div>
              <p className="mt-0.5 text-[12px] leading-relaxed text-leise">
                {ROLLE_BESCHREIBUNG[rolle]}
              </p>
            </div>
          ))}
        </Karte>
      </Abschnitt>

      {/* ------------------------------------------------------- Anmeldung */}

      <Abschnitt
        titel="Wie sich das Team anmeldet"
        hinweis="Kunden melden sich immer passwortlos per Mail-Code an — das hier betrifft nur das Team."
      >
        <Karte className="p-5">
          <form action={anmeldungSpeichern} className="grid gap-4">
            <Schalter
              name="lokalerLoginErlaubt"
              beschriftung="Lokale Konten (E-Mail + Passwort)"
              hinweis="Aus heißt: Auf der Anmeldeseite erscheint kein Passwortfeld mehr."
              defaultChecked={e.lokalerLoginErlaubt}
            />
            <Schalter
              name="m365LoginErlaubt"
              beschriftung="Microsoft 365 über Entra ID"
              hinweis={`Redirect-URI im Entra Admin Center: ${env.appUrl}/api/auth/m365/callback`}
              defaultChecked={e.m365LoginErlaubt}
            />
            <div className="grid gap-4 sm:grid-cols-2">
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
                e.m365ClientSecret ? 'Hinterlegt — nur ausfüllen, um ihn zu ersetzen.' : undefined
              }
            >
              <Eingabe name="m365ClientSecret" type="password" placeholder="unverändert" />
            </Feld>

            <Feld
              beschriftung="Eigene Domänen"
              hinweis="Mehrere durch Komma trennen. Subdomänen zählen mit."
            >
              <Eingabe
                name="m365Domaenen"
                defaultValue={e.m365Domaenen ?? ''}
                placeholder="thdvideo.de"
              />
            </Feld>

            <Hinweis>
              Adressen aus diesen Domänen werden auf der Anmeldeseite direkt zu Microsoft
              geschickt, und wer dort zum ersten Mal ankommt, bekommt automatisch ein Konto mit der
              Rolle <strong>{ROLLE_TEXT.DESIGNER}</strong>. <strong>Leer heißt: niemand</strong> —
              dann legt Konten weiter jemand von Hand an. Position, Telefonnummer und Profilbild
              holt Preroll dabei aus dem Verzeichnis (Berechtigung{' '}
              <code className="font-mono text-[11px]">User.Read</code>), aber nur für Felder, die
              hier noch leer sind: Wer seine Angaben in Preroll ändert oder ein anderes Bild
              hochlädt, behält sie.
            </Hinweis>

            <div className="flex justify-end">
              <SpeichernKnopf klein>
                Speichern
              </SpeichernKnopf>
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
