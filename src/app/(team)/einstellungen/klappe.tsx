import { Eingabe, Feld, Fehler, Hinweis, Karte, Knopf } from '@/components/ui'
import { SpeichernKnopf } from '@/components/speichern-knopf'
import {
  kopplungAnstossen,
  kopplungFertigstellen,
  kopplungLoesen,
  medienwegSpeichern,
} from './klappe-aktionen'

const ZEIT = new Intl.DateTimeFormat('de-DE', { dateStyle: 'long', timeStyle: 'short' })

/**
 * Anmeldung an Klappe über die Gerätekopplung — derselbe Ablauf wie bei den
 * Schnittprogramm-Plugins: Code anzeigen, Mensch bestätigt im Browser,
 * danach gilt ein Token.
 */
export function KlappeEinrichtung({
  basisUrl,
  medienUrl,
  gekoppeltAm,
  konto,
  zustand,
  userCode,
  geraetCode,
  bestaetigungsUrl,
  meldung,
}: {
  basisUrl: string | null
  medienUrl: string | null
  gekoppeltAm: Date | null
  konto: string | null
  zustand?: string
  userCode?: string
  geraetCode?: string
  bestaetigungsUrl?: string
  meldung?: string
}) {
  // Zwischenschritt: auf die Bestätigung in Klappe warten.
  if ((zustand === 'bestaetigen' || zustand === 'wartet') && userCode && geraetCode) {
    return (
      <Karte className="p-5">
        <h3 className="text-[14px] font-semibold">Kopplung bestätigen</h3>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-leise">
          Öffnen Sie Klappe und bestätigen Sie dort dieses Gerät. Danach hier auf „Fertig" klicken.
        </p>

        <div className="my-5 rounded-md border border-rahmen bg-flaeche-leise px-5 py-4 text-center">
          <div className="text-[10.5px] uppercase tracking-[0.1em] text-still">Ihr Code</div>
          <div className="mt-1.5 font-mono text-[26px] font-semibold tracking-[0.2em] text-tinte">
            {userCode}
          </div>
        </div>

        {bestaetigungsUrl && (
          <a
            href={bestaetigungsUrl}
            target="_blank"
            rel="noreferrer"
            className="mb-4 block text-center text-[12.5px] text-akzent hover:text-akzent-dunkel"
          >
            In Klappe bestätigen →
          </a>
        )}

        {zustand === 'wartet' && (
          <div className="mb-4">
            <Hinweis>
              Noch nicht bestätigt{meldung ? ` (${meldung})` : ''}. Bitte in Klappe freigeben und
              erneut auf „Fertig" klicken.
            </Hinweis>
          </div>
        )}

        <form action={kopplungFertigstellen} className="flex justify-end gap-2">
          <input type="hidden" name="basisUrl" value={basisUrl ?? ''} />
          <input type="hidden" name="geraet" value={geraetCode} />
          <Knopf klein art="primaer" type="submit">
            Fertig
          </Knopf>
        </form>
      </Karte>
    )
  }

  // Gekoppelt.
  if (gekoppeltAm) {
    return (
      <Karte className="p-5">
        {zustand === 'fertig' && (
          <div className="mb-4 rounded-[5px] border border-[#cfe4d6] bg-final-flaeche px-3.5 py-2.5 text-[12.5px] text-final">
            Kopplung steht — Videos lassen sich jetzt je Kunde verknüpfen.
          </div>
        )}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[13px] font-medium text-tinte">Verbunden mit {basisUrl}</div>
            <p className="mt-1 text-[11.5px] text-leiser">
              Seit {ZEIT.format(gekoppeltAm)}
              {konto && ` · als ${konto}`}
            </p>
            <p className="mt-2 text-[11.5px] leading-relaxed text-stiller">
              Das Klappe-Projekt wird pro Kunde unter Stammdaten zugeordnet. Ohne Zuordnung zeigt
              die Videoauswahl nichts an.
            </p>
          </div>
          <form action={kopplungLoesen} className="shrink-0">
            <Knopf klein art="gefahr" type="submit">
              Kopplung lösen
            </Knopf>
          </form>
        </div>

        <div className="mt-5 border-t border-rahmen pt-5">
          <form action={medienwegSpeichern} className="grid gap-4">
            <Feld
              beschriftung="Kurzer Weg zu den Videodaten (optional)"
              hinweis="Läuft Klappe auf derselben Maschine, holt Preroll die Videos direkt von dort statt über die öffentliche Adresse. Gemessen: eine 115-MB-Fassung braucht öffentlich gut zwei Minuten, direkt eine Sekunde. Nur fürs Abholen — Kopplung und Links bleiben öffentlich."
            >
              <Eingabe
                name="klappeMedienUrl"
                type="url"
                defaultValue={medienUrl ?? ''}
                placeholder="http://host.docker.internal:3000"
              />
            </Feld>
            <div className="flex justify-end">
              <SpeichernKnopf klein>
                Speichern
              </SpeichernKnopf>
            </div>
          </form>
        </div>
      </Karte>
    )
  }

  // Noch nicht gekoppelt.
  return (
    <Karte className="p-5">
      {zustand === 'fehler' && (
        <div className="mb-4">
          <Fehler>{meldung ?? 'Die Kopplung ist fehlgeschlagen.'}</Fehler>
        </div>
      )}
      {zustand === 'url-fehlt' && (
        <div className="mb-4">
          <Fehler>Bitte zuerst die Adresse der Klappe-Instanz angeben.</Fehler>
        </div>
      )}

      <form action={kopplungAnstossen} className="grid gap-4">
        <Feld
          beschriftung="Adresse der Klappe-Instanz"
          hinweis="Die externe Anbindung muss in Klappe freigeschaltet sein."
        >
          <Eingabe
            name="klappeBasisUrl"
            type="url"
            required
            defaultValue={basisUrl ?? ''}
            placeholder="https://klappe.fuhrzwei.de"
          />
        </Feld>
        <div className="flex justify-end">
          <Knopf klein art="primaer" type="submit">
            Koppeln
          </Knopf>
        </div>
      </form>
    </Karte>
  )
}
