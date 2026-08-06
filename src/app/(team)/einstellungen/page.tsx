import { ladeEinstellungen } from '@/lib/einstellungen'
import { Abschnitt, Eingabe, Fehler, Feld, Hinweis, Karte, Knopf, Schalter, Textfeld } from '@/components/ui'
import { referenzvideoSpeichern, workspaceSpeichern } from './aktionen'

export const metadata = { title: 'Workspace — Preroll' }

const DATUM = new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium' })

export default async function WorkspaceSeite({
  searchParams,
}: {
  searchParams: Promise<{ ig?: string; meldung?: string }>
}) {
  const { ig, meldung } = await searchParams
  const e = await ladeEinstellungen()

  return (
    <>
      <Abschnitt titel="Workspace" hinweis="Name und Akzentfarbe erscheinen in der Oberfläche und in Mails.">
        <Karte className="p-5">
          <form action={workspaceSpeichern} className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <Feld beschriftung="Name">
                <Eingabe name="workspaceName" defaultValue={e.workspaceName} />
              </Feld>
              <Feld beschriftung="Akzentfarbe">
                <Eingabe name="akzentfarbe" defaultValue={e.akzentfarbe} placeholder="#b00900" />
              </Feld>
            </div>
            <div className="flex justify-end">
              <Knopf klein type="submit">
                Speichern
              </Knopf>
            </div>
          </form>
        </Karte>
      </Abschnitt>

      <Abschnitt
        titel="Agentur"
        hinweis="Steht im Kontakt-Fuß jeder Export-Seite — dieselbe Anschrift für alle Kunden."
      >
        <Karte className="p-5">
          <form action={workspaceSpeichern} className="grid gap-4">
            <input type="hidden" name="workspaceName" value={e.workspaceName} />
            <input type="hidden" name="akzentfarbe" value={e.akzentfarbe} />

            <Feld beschriftung="Name der Agentur">
              <Eingabe name="agenturName" defaultValue={e.agenturName ?? ''} placeholder="THD Video" />
            </Feld>
            <Feld beschriftung="Adresse">
              <Eingabe
                name="agenturAdresse"
                defaultValue={e.agenturAdresse ?? ''}
                placeholder="Musterstraße 1, 12345 Musterstadt"
              />
            </Feld>
            <Feld beschriftung="Website">
              <Eingabe name="agenturWebsite" defaultValue={e.agenturWebsite ?? ''} />
            </Feld>
            <div className="flex justify-end">
              <Knopf klein type="submit">
                Speichern
              </Knopf>
            </div>
          </form>
        </Karte>
      </Abschnitt>

      <Abschnitt
        titel="Referenzvideos von Instagram"
        hinweis="Nur für Instagram nötig. YouTube, TikTok und Vimeo laden ohne alles."
      >
        <Karte className="p-5">
          {ig === 'ok' && (
            <div className="mb-4">
              <Hinweis>
                Die Sitzung wirkt: <strong>{meldung}</strong> wurde gefunden.
              </Hinweis>
            </div>
          )}
          {ig === 'fehler' && (
            <div className="mb-4">
              <Fehler>{meldung}</Fehler>
            </div>
          )}

          {/* Der Stand auf einen Blick — sonst fällt eine abgelaufene Sitzung
              erst auf, wenn jemand ein Video braucht. */}
          <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[5px] border border-rahmen bg-flaeche-leise px-3.5 py-2.5 text-[12.5px]">
            {!e.instagramCookies ? (
              <span className="text-leise">Keine Sitzung hinterlegt.</span>
            ) : e.instagramFehler ? (
              <>
                <span className="font-medium text-akzent">Abgelaufen</span>
                <span className="text-leiser">{e.instagramFehler}</span>
              </>
            ) : (
              <>
                <span className="font-medium text-final">Hinterlegt</span>
                <span className="text-leiser">
                  seit {e.instagramCookiesAm ? DATUM.format(e.instagramCookiesAm) : '—'}
                  {e.instagramGeprueftAm && ` · geprüft ${DATUM.format(e.instagramGeprueftAm)}`}
                </span>
              </>
            )}
          </div>

          <form action={referenzvideoSpeichern} className="grid gap-4">
            <Feld
              beschriftung="Instagram-Sitzung"
              hinweis="Bei Instagram im Browser anmelden, dann in den Entwicklerwerkzeugen unter Anwendung → Cookies den Wert von „sessionid“ kopieren. Eine ganze cookies.txt geht auch."
            >
              <Textfeld
                name="instagramCookies"
                rows={2}
                placeholder={e.instagramCookies ? 'unverändert' : 'sessionid=…'}
                className="font-mono text-[11.5px]"
              />
            </Feld>

            <Feld
              beschriftung="Zum Prüfen: ein Reel-Link"
              hinweis="Wird nur abgefragt, nicht geladen. Leer lassen, um nur zu speichern."
            >
              <Eingabe
                name="testUrl"
                type="url"
                placeholder="https://www.instagram.com/reel/…"
              />
            </Feld>

            <p className="text-[11.5px] leading-relaxed text-stiller">
              Die Sitzung ist so vertraulich wie ein Passwort — wer sie hat, liest als dieses
              Konto mit. Am besten ein Konto verwenden, das nur dafür da ist. Sie hält
              üblicherweise Monate und verlängert sich durch die Nutzung; abgelaufen steht sie
              oben.
            </p>

            <div className="flex items-center justify-between gap-4">
              {e.instagramCookies ? (
                <Schalter name="cookiesLoeschen" beschriftung="Sitzung löschen" />
              ) : (
                <span />
              )}
              <Knopf klein art="primaer" type="submit">
                Speichern und prüfen
              </Knopf>
            </div>
          </form>
        </Karte>
      </Abschnitt>

    </>
  )
}
