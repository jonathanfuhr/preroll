import { ladeEinstellungen } from '@/lib/einstellungen'
import { Abschnitt, Eingabe, Feld, Karte, Knopf, Schalter } from '@/components/ui'
import { klappeSpeichern } from '../aktionen'
import { KlappeEinrichtung } from '../klappe'

export const metadata = { title: 'Klappe — Preroll' }

export default async function KlappeSeite({
  searchParams,
}: {
  searchParams: Promise<{ klappe?: string; code?: string; geraet?: string; url?: string; meldung?: string }>
}) {
  const e = await ladeEinstellungen()
  const { klappe, code, geraet, url, meldung } = await searchParams

  return (
    <>
      <Abschnitt
        titel="Verbindung"
        hinweis="Die Anmeldung läuft über die Gerätekopplung — derselbe Weg wie bei den Schnittprogramm-Plugins."
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

      {e.klappeGekoppeltAm && (
        <>
          <Abschnitt
            titel="Was Preroll in Klappe anlegt"
            hinweis="Damit beim Upload aus dem Schnitt kein Videoname mehr getippt werden muss."
          >
            <Karte className="p-5">
              <form action={klappeSpeichern} className="grid gap-4">
                <Schalter
                  name="klappeVideoAnlegen"
                  beschriftung="Beim Anlegen eines Reels automatisch ein Video erzeugen"
                  hinweis="Im Klappe-Projekt des jeweiligen Kunden. Ohne Zuordnung passiert nichts."
                  defaultChecked={e.klappeVideoAnlegen}
                />
                <Schalter
                  name="klappeNamenNachziehen"
                  beschriftung="Namen nachziehen, wenn sich Titel oder Termin ändern"
                  defaultChecked={e.klappeNamenNachziehen}
                />

                <Feld
                  beschriftung="Namensschema"
                  hinweis="Platzhalter: {datum} für JJMMTT, {titel} für den Post-Titel, {kunde} für den Kundennamen."
                >
                  <Eingabe
                    name="klappeNamensschema"
                    defaultValue={e.klappeNamensschema}
                    placeholder="{datum} {titel}"
                  />
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
            titel="Was Preroll aus Klappe holt"
            hinweis="Betrifft die Videoauswahl im Reel-Editor und die Fassung, die der Kunde zu sehen bekommt."
          >
            <Karte className="p-5">
              <form action={klappeSpeichern} className="grid gap-4">
                <input type="hidden" name="klappeVideoAnlegen" value={e.klappeVideoAnlegen ? 'on' : ''} />
                <input
                  type="hidden"
                  name="klappeNamenNachziehen"
                  value={e.klappeNamenNachziehen ? 'on' : ''}
                />
                <input type="hidden" name="klappeNamensschema" value={e.klappeNamensschema} />

                <Schalter
                  name="klappeNurEndfassung"
                  beschriftung="Nur als Endfassung markierte Fassungen übernehmen"
                  hinweis="Sonst zählt die neueste freigegebene Fassung."
                  defaultChecked={e.klappeNurEndfassung}
                />
                <Schalter
                  name="klappeInterneZeigen"
                  beschriftung="Interne Fassungen mit anzeigen"
                  hinweis="Standardmäßig aus: Was der Kunde sieht, soll auch in Klappe freigegeben sein."
                  defaultChecked={e.klappeInterneZeigen}
                />
                <Schalter
                  name="klappeAutoAktualisieren"
                  beschriftung="Fassung beim Öffnen des Editors prüfen"
                  hinweis="Aus, wenn Klappe langsam antwortet — dann hilft der Knopf „Fassung prüfen“."
                  defaultChecked={e.klappeAutoAktualisieren}
                />

                <Feld
                  beschriftung="Videoauswahl zusätzlich filtern"
                  hinweis="Zeigt nur Videos, deren Name diesen Text enthält. Leer lassen für alle Videos des Kundenprojekts."
                >
                  <Eingabe
                    name="klappeNameEnthaelt"
                    defaultValue={e.klappeNameEnthaelt ?? ''}
                    placeholder="z. B. Reel"
                  />
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
      )}
    </>
  )
}
