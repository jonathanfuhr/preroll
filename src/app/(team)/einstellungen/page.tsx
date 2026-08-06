import { ladeEinstellungen } from '@/lib/einstellungen'
import { Abschnitt, Eingabe, Feld, Hinweis, Karte, Knopf, Schalter, Textfeld } from '@/components/ui'
import { referenzvideoSpeichern, workspaceSpeichern } from './aktionen'

export const metadata = { title: 'Workspace — Preroll' }

export default async function WorkspaceSeite() {
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
        hinweis="Nur nötig, wenn Instagram-Links nicht geladen werden können. YouTube, TikTok und Vimeo brauchen das nicht."
      >
        <Karte className="p-5">
          <form action={referenzvideoSpeichern} className="grid gap-4">
            <Hinweis>
              Instagram gibt viele Reels nur an eine <strong>angemeldete Sitzung</strong> heraus —
              auch wenn sie im privaten Browserfenster zu sehen sind. Abhilfe schafft eine
              <code className="mx-1 font-mono text-[11px]">cookies.txt</code> im Netscape-Format:
              in einem Browser bei Instagram anmelden, mit einer Cookie-Export-Erweiterung sichern
              und den Inhalt hier einfügen.
            </Hinweis>

            <Feld
              beschriftung="cookies.txt"
              hinweis={
                e.instagramCookies
                  ? 'Hinterlegt — nur ausfüllen, um sie zu ersetzen.'
                  : 'Beginnt mit „# Netscape HTTP Cookie File".'
              }
            >
              <Textfeld
                name="instagramCookies"
                rows={4}
                placeholder={e.instagramCookies ? 'unverändert' : '# Netscape HTTP Cookie File …'}
                className="font-mono text-[11.5px]"
              />
            </Feld>

            <p className="text-[11.5px] leading-relaxed text-stiller">
              Das ist eine <strong>Anmeldesitzung</strong> des hinterlegten Instagram-Kontos —
              also so vertraulich wie ein Passwort. Sie läuft nach einigen Monaten ab und muss
              dann erneuert werden. Am besten ein Konto verwenden, das nur dafür da ist.
            </p>

            <div className="flex items-center justify-between gap-4">
              {e.instagramCookies ? (
                <Schalter name="cookiesLoeschen" beschriftung="Hinterlegte Cookies löschen" />
              ) : (
                <span />
              )}
              <Knopf klein type="submit">
                Speichern
              </Knopf>
            </div>
          </form>
        </Karte>
      </Abschnitt>
    </>
  )
}
