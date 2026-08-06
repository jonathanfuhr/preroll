import { ladeEinstellungen } from '@/lib/einstellungen'
import { Abschnitt, Eingabe, Feld, Fehler, Hinweis, Karte, Knopf, Schalter } from '@/components/ui'
import { aworkSpeichern, aworkTesten } from '../aktionen'

export const metadata = { title: 'awork — Preroll' }

const DATUM = new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' })

export default async function AworkSeite({
  searchParams,
}: {
  searchParams: Promise<{ test?: string; meldung?: string }>
}) {
  const { test, meldung } = await searchParams
  const e = await ladeEinstellungen()

  return (
    <>
      <Abschnitt
        titel="awork verbinden"
        hinweis="awork ist das Projektmanagement, in dem die Aufträge ohnehin liegen. Vorerst wird nur die Verbindung hergestellt."
      >
        <Karte className="p-5">
          {test === 'ok' && (
            <div className="mb-4">
              <Hinweis>Verbindung steht. {meldung}</Hinweis>
            </div>
          )}
          {test === 'fehler' && (
            <div className="mb-4">
              <Fehler>{meldung ?? 'Die Verbindung kam nicht zustande.'}</Fehler>
            </div>
          )}

          <form action={aworkSpeichern} className="grid gap-4">
            <Schalter
              name="aworkAktiv"
              beschriftung="Anbindung eingeschaltet"
              hinweis="Ohne Schlüssel bleibt sie wirkungslos."
              defaultChecked={e.aworkAktiv}
            />

            <Feld
              beschriftung="API-Schlüssel"
              hinweis={
                e.aworkApiKey
                  ? 'Hinterlegt — nur ausfüllen, um ihn zu ersetzen.'
                  : 'In awork unter Einstellungen → Integrationen → API-Schlüssel anlegen.'
              }
            >
              <Eingabe
                name="aworkApiKey"
                type="password"
                placeholder={e.aworkApiKey ? 'unverändert' : 'awork-API-Schlüssel'}
              />
            </Feld>

            {/*
              Prüfen und Speichern stehen bewusst im **selben** Formular: Nur so
              wandert ein frisch eingetippter Schlüssel in den Verbindungstest.
              Läge der Knopf in einem eigenen Formular, prüfte er stets nur den
              schon gespeicherten.
            */}
            <div className="flex flex-wrap items-end justify-between gap-4 border-t border-rahmen pt-4">
              <div className="text-[12.5px] text-leise">
                {e.aworkGeprueftAm ? (
                  <>
                    Zuletzt geprüft am{' '}
                    <strong className="font-medium text-tinte-3">
                      {DATUM.format(e.aworkGeprueftAm)}
                    </strong>
                    .
                  </>
                ) : (
                  'Noch nie geprüft.'
                )}
                <p className="mt-1 text-[11.5px] text-stiller">
                  Der Test fragt Nutzer und Projekte ab — damit nicht bloß ein Endpunkt „OK" sagt.
                </p>
              </div>

              <div className="flex gap-2">
                <Knopf klein type="submit" formAction={aworkTesten}>
                  Verbindung prüfen
                </Knopf>
                <Knopf klein art="primaer" type="submit">
                  Speichern
                </Knopf>
              </div>
            </div>
          </form>
        </Karte>
      </Abschnitt>

      <Abschnitt titel="Was damit später möglich wird">
        <Karte className="p-5">
          <p className="text-[12.5px] leading-relaxed text-leise">
            Angedacht sind zwei Richtungen: Kundenkommentare aus einem Freigabe-Link werden zu{' '}
            <strong className="font-medium text-tinte-3">Aufgaben</strong> im passenden
            awork-Projekt, und Meldungen ohne Aufgabencharakter — der Kunde hat den Plan geöffnet,
            eine Freigabe ist erteilt — landen als{' '}
            <strong className="font-medium text-tinte-3">Projektkommentar</strong>.
          </p>
          <p className="mt-3 text-[12.5px] leading-relaxed text-leise">
            Welche Ereignisse das genau sein sollen und wie ein Kunde seinem awork-Projekt
            zugeordnet wird, ist noch offen. Deshalb steht hier bewusst nur die Verbindung: Der
            Schlüssel liegt schon bereit, wenn die Entscheidung fällt.
          </p>
        </Karte>
      </Abschnitt>
    </>
  )
}
