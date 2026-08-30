import { ladeEinstellungen } from '@/lib/einstellungen'
import { sitzungsumfang } from '@/lib/instagram-cookies'
import { Abschnitt, Eingabe, Fehler, Feld, Hinweis, Karte, Knopf, Schalter, Textfeld, Warnung } from '@/components/ui'
import { SpeichernKnopf } from '@/components/speichern-knopf'
import {
  instagramSitzungSpeichern,
  kennzahlenSpeichern,
  workspaceSpeichern,
} from './aktionen'

export const metadata = { title: 'Workspace — Preroll' }

const DATUM = new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium' })

export default async function WorkspaceSeite({
  searchParams,
}: {
  searchParams: Promise<{ ig?: string; meldung?: string }>
}) {
  const { ig, meldung } = await searchParams
  const e = await ladeEinstellungen()
  // Was in der Sitzung wirklich drinsteht — „hinterlegt" sagt zu wenig.
  const umfang = sitzungsumfang(e.instagramCookies)

  return (
    <>
      <Abschnitt titel="Workspace" hinweis="Name und Akzentfarbe erscheinen in der Oberfläche und in Mails.">
        <Karte className="p-5">
          <form action={workspaceSpeichern} className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Feld beschriftung="Name">
                <Eingabe name="workspaceName" defaultValue={e.workspaceName} />
              </Feld>
              <Feld beschriftung="Akzentfarbe">
                <Eingabe name="akzentfarbe" defaultValue={e.akzentfarbe} placeholder="#b00900" />
              </Feld>
            </div>
            <div className="flex justify-end">
              <SpeichernKnopf klein>
                Speichern
              </SpeichernKnopf>
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
              <SpeichernKnopf klein>
                Speichern
              </SpeichernKnopf>
            </div>
          </form>
        </Karte>
      </Abschnitt>

      <Abschnitt
        titel="Videos von Instagram"
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
                  {umfang && ` · ${umfang.namen.join(', ')}`}
                </span>
              </>
            )}
          </div>

          {/*
            „Hinterlegt" allein sagt zu wenig. Eine Sitzung aus bloßem
            `sessionid` trägt die Reel-Downloads, taugt für die Kennzahlen aber
            nicht — dort verlangt Instagram `csrftoken` und quittiert sonst mit
            400. Vorher sah man der Sitzung das nicht an, und der Fehlschlag
            wirkte wie ein Fehler an ganz anderer Stelle.
          */}
          {umfang && !umfang.csrftoken && (
            <div className="mb-4">
              <Warnung>
                Die Sitzung enthält nur <code className="font-mono text-[11px]">sessionid</code>.
                Für die Reel-Downloads reicht das. Die <strong>Profil-Kennzahlen</strong> brauchen
                zusätzlich <code className="font-mono text-[11px]">csrftoken</code> — ohne ihn
                weist Instagram die Anfrage ab, und der Rückfallweg steht dort nicht zur
                Verfügung. Am einfachsten die ganze{' '}
                <code className="font-mono text-[11px]">cookies.txt</code> einfügen; dieses Feld
                nimmt sie unverändert an.
              </Warnung>
            </div>
          )}

          <form action={instagramSitzungSpeichern} className="grid gap-4">
            <Feld
              beschriftung="Instagram-Sitzung"
              hinweis={
                'Nimmt dreierlei an: eine ganze cookies.txt, mehrere Cookies als ' +
                '„name=wert; name=wert" oder nur den Wert von sessionid. Am besten die ganze ' +
                'Datei — dann ist csrftoken dabei, und die Kennzahlen können sie mitbenutzen.'
              }
            >
              <Textfeld
                name="instagramCookies"
                rows={3}
                placeholder={
                  e.instagramCookies ? 'unverändert' : 'csrftoken=…; sessionid=…  oder ganze cookies.txt'
                }
                className="font-mono text-[11.5px]"
              />
            </Feld>

            <Anleitung />

            <Feld
              beschriftung="Reel-Link zum Prüfen"
              hinweis="Wird abgefragt, nicht geladen. Bleibt gespeichert — Preroll prüft damit täglich nach und meldet sich, wenn die Sitzung abgelaufen ist."
            >
              <Eingabe
                name="testUrl"
                type="url"
                defaultValue={e.instagramTestUrl ?? ''}
                placeholder="https://www.instagram.com/reel/…"
              />
            </Feld>

            <p className="text-[11.5px] leading-relaxed text-stiller">
              Die Sitzung ist so vertraulich wie ein Passwort — wer sie hat, liest als dieses
              Konto mit. Am besten ein Konto verwenden, das nur dafür da ist.
            </p>

            <div className="flex items-center justify-between gap-4">
              {e.instagramCookies ? (
                <Schalter name="cookiesLoeschen" beschriftung="Sitzung löschen" />
              ) : (
                <span />
              )}
              <SpeichernKnopf klein art="primaer">
                Speichern und prüfen
              </SpeichernKnopf>
            </div>
          </form>
        </Karte>
      </Abschnitt>

      <Abschnitt
        titel="Profil-Kennzahlen"
        hinweis="Follower, Gefolgt und Beiträge automatisch von Instagram holen."
      >
        <Karte className="p-5">
          <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[5px] border border-rahmen bg-flaeche-leise px-3.5 py-2.5 text-[12.5px]">
            {!e.kennzahlenAktiv ? (
              <span className="text-leise">Aus — die Zahlen werden von Hand gepflegt.</span>
            ) : (
              <>
                <span className="font-medium text-final">An</span>
                <span className="text-leiser">
                  {e.kennzahlenLaufAm
                    ? `zuletzt geholt ${DATUM.format(e.kennzahlenLaufAm)}`
                    : 'noch kein Lauf'}
                </span>
              </>
            )}
          </div>

          <form action={kennzahlenSpeichern} className="grid gap-4">
            <Schalter
              name="kennzahlenAktiv"
              beschriftung="Kennzahlen automatisch holen"
              defaultChecked={e.kennzahlenAktiv}
            />

            <div className="grid gap-2.5 text-[12px] leading-relaxed text-leise">
              <p>
                Gefragt wird <strong>ohne Anmeldung</strong> — für die öffentlichen Profilzahlen
                verlangt Instagram keine. Die für die Videos hinterlegte Sitzung bleibt damit aus
                dem Spiel; sie kommt nur zum Zug, falls die anonyme Anfrage abgewiesen wird. Ein
                Instagram-Konto ist hierfür also <strong>nicht</strong> nötig.
              </p>
              <p>
                Preroll nimmt sich <strong>ein Profil alle 20 Minuten</strong> vor und jedes
                höchstens einmal am Tag. Angestoßen wird beim Arbeiten im Backend; einen
                Zeitplaner hat Preroll nicht. Der Endpunkt ist nicht von Instagram dokumentiert
                und kann sich jederzeit ändern — deshalb ein eigener Schalter und keine
                Selbstverständlichkeit.
              </p>
              <p>
                Übernommen werden Follower, Gefolgt, Beiträge sowie Bio und Website, wenn Instagram
                dort etwas stehen hat. Das Profilbild wird nur gesetzt, wenn beim Kunden noch
                keines hinterlegt ist. Nebenbei entsteht je Tag ein Wert — daraus wird später die
                Follower-Kurve.
              </p>
            </div>

            <KennzahlenAnleitung />

            <div className="flex justify-end">
              <SpeichernKnopf klein art="primaer">
                Speichern
              </SpeichernKnopf>
            </div>
          </form>
        </Karte>
      </Abschnitt>

    </>
  )
}

/** Was zu tun ist, damit die Zahlen kommen — und was zu tun ist, wenn nicht. */
function KennzahlenAnleitung() {
  return (
    <details className="rounded-[5px] border border-rahmen bg-flaeche-leise px-3.5 py-2.5">
      <summary className="cursor-pointer text-[12.5px] font-medium text-tinte">
        So wird es eingerichtet
      </summary>

      <div className="mt-3 grid gap-4 text-[12px] leading-relaxed text-leise">
        <ol className="grid list-decimal gap-2 pl-4">
          <li>
            <strong>Diesen Schalter einschalten</strong> und speichern. Sonst ist nichts
            einzurichten — für die öffentlichen Profilzahlen verlangt Instagram keine Anmeldung.
          </li>
          <li>
            <strong>Bei jedem Kunden den Handle eintragen</strong> — Stammdaten → Instagram-Handle,
            ohne @. Ohne Handle wird der Kunde übersprungen.
          </li>
          <li>
            <strong>Einmal von Hand anstoßen</strong> — in den Stammdaten steht „Jetzt von
            Instagram holen". So sieht man sofort, ob es klappt, statt bis zum nächsten Lauf zu
            warten. Der Knopf geht auch bei ausgeschaltetem Schalter.
          </li>
        </ol>

        <div>
          <div className="mb-1 text-[12.5px] font-medium text-tinte">Danach läuft es von selbst</div>
          <p>
            Preroll holt beim Arbeiten im Backend jeweils <strong>ein</strong> Profil, höchstens
            alle 20 Minuten, und jedes Profil höchstens einmal am Tag. Bei zehn Kunden ist damit
            nach gut drei Stunden jeder einmal dran. Läuft niemand im Backend, passiert nichts —
            Preroll hat keinen Zeitplaner.
          </p>
        </div>

        <div>
          <div className="mb-1 text-[12.5px] font-medium text-tinte">Wenn keine Zahlen kommen</div>
          <p>
            „Das Profil gibt es nicht (mehr)" heißt: Der Handle stimmt nicht — Tippfehler oder
            umbenannt. Bei „Instagram bremst gerade ab" einfach später noch einmal, das legt
            sich. Steht „Instagram hat die Anfrage abgewiesen", ist meist die Adresse des Servers
            vorübergehend gesperrt; auch das geht vorbei. Mit dem Video-Download hat das nichts
            zu tun — der läuft über einen anderen Weg und ist davon nicht betroffen.
          </p>
        </div>

        <div>
          <div className="mb-1 text-[12.5px] font-medium text-tinte">Was von Hand bleibt</div>
          <p>
            Getippte Zahlen werden beim nächsten Lauf überschrieben. Wer einen Wert dauerhaft
            selbst pflegen will, lässt den Schalter aus. Bio und Website werden nur übernommen,
            wenn Instagram dort etwas stehen hat — eine gepflegte Angabe wird nicht geleert.
          </p>
        </div>
      </div>
    </details>
  )
}

/**
 * Wo die Session-ID steht. Beide Browser haben denselben Kurzbefehl; bei
 * Safari muss vorher einmal das Entwicklermenü an — daran scheitert es sonst.
 */
function Anleitung() {
  return (
    <details className="rounded-[5px] border border-rahmen bg-flaeche-leise px-3.5 py-2.5">
      <summary className="cursor-pointer text-[12.5px] font-medium text-tinte">
        Wo finde ich die Cookies?
      </summary>

      <div className="mt-3 grid gap-4 text-[12px] leading-relaxed text-leise">
        <p>
          Am besten in einem <strong>privaten Fenster</strong>: Zum Schluss das Fenster einfach
          schließen — <strong>nicht abmelden</strong>. Abmelden macht die Sitzung sofort ungültig,
          das Schließen nicht.
        </p>

        <div>
          <div className="mb-1 text-[12.5px] font-medium text-tinte">Chrome</div>
          <ol className="ml-4 list-decimal space-y-1">
            <li>
              Privates Fenster mit <Taste>⇧⌘N</Taste>, bei instagram.com anmelden.
            </li>
            <li>
              Entwicklerwerkzeuge mit <Taste>⌥⌘I</Taste> öffnen.
            </li>
            <li>
              Oben auf <strong>Application</strong> (deutsch: <strong>Anwendung</strong>) — steht
              eventuell hinter dem <strong>»</strong> am Ende der Reiter.
            </li>
            <li>
              Links unter <strong>Storage → Cookies</strong> auf{' '}
              <code className="font-mono text-[11px]">https://www.instagram.com</code>.
            </li>
            <li>
              <strong>Zwei</strong> Zeilen suchen und ihre Werte aus der Spalte{' '}
              <strong>Value</strong> kopieren:{' '}
              <code className="font-mono text-[11px]">sessionid</code> und{' '}
              <code className="font-mono text-[11px]">csrftoken</code>.
            </li>
          </ol>
        </div>

        <div>
          <div className="mb-1 text-[12.5px] font-medium text-tinte">Safari</div>
          <ol className="ml-4 list-decimal space-y-1">
            <li>
              Einmalig: <strong>Safari → Einstellungen → Erweitert</strong> →{' '}
              <strong>„Funktionen für Webentwickler anzeigen"</strong> einschalten. Ohne das gibt
              es die Werkzeuge nicht.
            </li>
            <li>
              Privates Fenster mit <Taste>⇧⌘N</Taste>, bei instagram.com anmelden.
            </li>
            <li>
              Web-Inspector mit <Taste>⌥⌘I</Taste> öffnen.
            </li>
            <li>
              Oben auf <strong>Speicher</strong> (englisch: <strong>Storage</strong>) →{' '}
              <strong>Cookies</strong> → <strong>instagram.com</strong>.
            </li>
            <li>
              <strong>Zwei</strong> Zeilen brauchen Sie:{' '}
              <code className="font-mono text-[11px]">sessionid</code> und{' '}
              <code className="font-mono text-[11px]">csrftoken</code>. Die Spalte{' '}
              <strong>Wert</strong> schneidet ab — auf den Wert{' '}
              <strong>doppelklicken</strong>, dann mit <Taste>⌘A</Taste> alles markieren und mit{' '}
              <Taste>⌘C</Taste> kopieren.
            </li>
          </ol>
        </div>

        <div className="rounded-[5px] border border-rahmen-3 bg-flaeche px-3 py-2.5">
          <div className="mb-1 text-[12.5px] font-medium text-tinte">So wird es eingefügt</div>
          <p>
            Beide Werte in <strong>eine</strong> Zeile, durch Semikolon getrennt:
          </p>
          <pre className="mt-1.5 overflow-x-auto rounded-[4px] bg-flaeche-leise px-2.5 py-2 font-mono text-[11px] text-tinte-3">
            csrftoken=AbCdEf…; sessionid=12345678%3AXyZ…
          </pre>
          <p className="mt-1.5">
            Die Reihenfolge ist gleichgültig. Eine ganze{' '}
            <code className="font-mono text-[11px]">cookies.txt</code> aus einer
            Browser-Erweiterung geht genauso — Safari kann so eine Datei nicht ausgeben, die
            Kurzform oben reicht aber völlig.
          </p>
        </div>

        <p className="text-stiller">
          Der <code className="font-mono text-[11px]">sessionid</code>-Wert ist lang und enthält{' '}
          <code className="font-mono text-[11px]">%3A</code> — das gehört so. Vollständig
          einfügen, nichts abschneiden.
        </p>

        <p className="text-stiller">
          Ohne <code className="font-mono text-[11px]">csrftoken</code> laufen die
          Reel-Downloads, die <strong>Profil-Kennzahlen</strong> aber nicht: Instagram weist die
          Anfrage dann ab.
        </p>
      </div>
    </details>
  )
}

function Taste({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded-[3px] border border-rahmen-3 bg-flaeche px-1.5 py-px font-mono text-[11px] text-tinte">
      {children}
    </kbd>
  )
}
