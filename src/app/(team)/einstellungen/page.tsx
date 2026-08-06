import { ladeEinstellungen } from '@/lib/einstellungen'
import { Abschnitt, Eingabe, Feld, Karte, Knopf } from '@/components/ui'
import { workspaceSpeichern } from './aktionen'

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
    </>
  )
}
