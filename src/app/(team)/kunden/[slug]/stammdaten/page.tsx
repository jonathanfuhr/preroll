import { ladeKunde } from '@/lib/abfragen'
import { formatiereTag } from '@/lib/datum'
import { prisma } from '@/lib/db'
import { klappeEingerichtet, klappeProjekte } from '@/lib/klappe'
import { darfAnsprechpartnerSein, ROLLE_TEXT } from '@/lib/rollen'
import { thumbUrl } from '@/lib/urls'
import { ladeEinstellungen } from '@/lib/einstellungen'
import { Abschnitt, Eingabe, Fehler, Feld, Hinweis, Karte, Knopf, Schalter, Textfeld } from '@/components/ui'
import {
  betreuungSpeichern,
  customFeldAnlegen,
  customFeldLoeschen,
  kennzahlenHolen,
  kundeSpeichern,
} from '../aktionen'
import { aworkEingerichtet, aworkProjekte } from '@/lib/awork'
import { aworkProjektZuordnen, klappeProjekteAktualisieren, klappeProjektZuordnen } from '../klappe-aktionen'
import { ladeMetaZugaenge, metaSeiten } from '@/lib/plattform-zugang'
import { veroeffentlichenSpeichern } from '../veroeffentlichen-aktionen'
import { zaehleOffeneBeitraege } from '@/lib/kunde-plattformen'
import { AworkProjektWahl } from './awork-projekt'
import { BetreuungFormular } from './betreuung'
import { CustomFeldFormular } from './custom-felder'
import { KlappeProjektWahl } from './klappe-projekt'
import { LogoAblage } from './logo'
import { VeroeffentlichenWahl } from './veroeffentlichen'

export default async function StammdatenSeite({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ kennzahlen?: string; meta?: string; meldung?: string }>
}) {
  const { slug } = await params
  const { kennzahlen: kennzahlenStand, meta, meldung } = await searchParams
  const kunde = await ladeKunde(slug)
  const einstellungen = await ladeEinstellungen()

  const [team, angebunden] = await Promise.all([
    prisma.nutzer.findMany({ where: { aktiv: true }, orderBy: { name: 'asc' } }),
    klappeEingerichtet(),
  ])

  const projekte = angebunden ? await klappeProjekte() : null

  // awork antwortet mit einer leeren Liste, solange es nicht eingerichtet ist
  // — der Aufruf ist also auch dann unschädlich.
  const [aworkAn, aworkListe] = await Promise.all([
    aworkEingerichtet(),
    aworkProjekte().catch(() => []),
  ])

  // Ohne Zugang gar nicht erst bei Meta nachfragen. Und ein Fehlschlag darf
  // die Stammdaten nicht mitnehmen — sonst kommt niemand mehr an das
  // Formular, in dem er die Zuordnung reparieren würde.
  /*
    Die Seiten kommen aus **allen** Zugängen in einer Liste. Aus welchem
    Portfolio eine Seite stammt, ist eine Frage der Verwaltung — wer einen
    Kunden einrichtet, sucht seine Seite, nicht seinen Business Manager.
  */
  const zugaenge = await ladeMetaZugaenge()
  const seiten = zugaenge.length > 0 ? await metaSeiten() : []

  // Für den Haken „auch auf bestehende Beiträge übernehmen" — ohne die Zahl
  // wäre das ein Schalter, dessen Wirkung man erst hinterher sieht.
  const offeneBeitraege = await zaehleOffeneBeitraege(kunde.id)

  return (
    <div className="max-w-[760px]">
      <h1 className="mb-6 text-[24px] font-semibold tracking-[-0.02em]">Stammdaten</h1>

      <Abschnitt
        titel="Profil"
        hinweis="Logo und Angaben erscheinen in der Feed-Vorschau und auf der Export-Seite."
      >
        <Karte className="p-5">
          <div className="mb-5 border-b border-rahmen pb-5">
            <LogoAblage kundeId={kunde.id} logo={thumbUrl(kunde.logoId)} />
          </div>

          {/* Eigenes Formular für den Abruf — es darf die Stammdaten weder
              mitschicken noch überschreiben. Der Knopf steht weiter unten
              und findet es über `form`. */}
          <form id="kennzahlen-holen" action={kennzahlenHolen.bind(null, kunde.id, slug)} />

          <form action={kundeSpeichern.bind(null, kunde.id)} className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Feld beschriftung="Name">
                <Eingabe name="name" defaultValue={kunde.name} required />
              </Feld>
              <Feld beschriftung="Instagram-Handle" hinweis="Ohne @.">
                <Eingabe name="handle" defaultValue={kunde.handle ?? ''} placeholder="beispiel.handwerk" />
              </Feld>
            </div>

            <Feld beschriftung="Bio" hinweis="Erscheint in der Feed-Vorschau unter dem Namen.">
              <Eingabe name="bio" defaultValue={kunde.bio ?? ''} />
            </Feld>

            <Feld beschriftung="Website">
              <Eingabe name="website" defaultValue={kunde.website ?? ''} />
            </Feld>

            <Feld beschriftung="Interne Notiz" hinweis="Sieht der Kunde nicht.">
              <Textfeld name="notiz" defaultValue={kunde.notiz ?? ''} rows={3} />
            </Feld>

            <Schalter
              name="freigabenNoetig"
              beschriftung="Freigaben einholen"
              hinweis="Bei eigenen Kanälen gibt es niemanden, der freigeben müsste. Aus heißt: kein Freigabeschritt im Editor und keiner auf der Export-Seite."
              defaultChecked={kunde.freigabenNoetig}
            />

            <div className="border-t border-rahmen pt-4">
              <h3 className="mb-1 text-[13px] font-semibold">Profil-Kennzahlen</h3>
              <p className="mb-3 text-[11.5px] leading-relaxed text-leiser">
                Erscheinen über der Feed-Vorschau — intern wie auf der Export-Seite.
                {kunde.kennzahlenAm &&
                  ` Zuletzt aktualisiert am ${formatiereTag(kunde.kennzahlenAm, { dateStyle: 'long' })}${
                    kunde.kennzahlenTyp === 'MANUELL' ? ' von Hand' : ' über Instagram'
                  }.`}
              </p>

              {kennzahlenStand === 'ok' && (
                <div className="mb-3">
                  <Hinweis>Kennzahlen von Instagram übernommen.</Hinweis>
                </div>
              )}
              {kennzahlenStand === 'fehler' && (
                <div className="mb-3">
                  <Fehler>{meldung}</Fehler>
                </div>
              )}

              {/*
                Der Knopf steht außerhalb des Stammdaten-Formulars: Er holt
                Werte und speichert nicht, was gerade in den Feldern steht.
                Beides in einem Formular hieße, dass ein Klick ungespeicherte
                Eingaben mitnimmt oder überschreibt.
              */}
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <Knopf klein type="submit" form="kennzahlen-holen" disabled={!kunde.handle}>
                  Jetzt von Instagram holen
                </Knopf>
                {!kunde.handle ? (
                  <span className="text-[11.5px] text-leiser">
                    Dafür oben einen Instagram-Handle eintragen.
                  </span>
                ) : !einstellungen.kennzahlenAktiv ? (
                  <span className="text-[11.5px] text-leiser">
                    Der tägliche Abruf ist aus — dieser Knopf holt trotzdem.
                  </span>
                ) : null}
              </div>
              <div className="grid grid-cols-3 gap-4">
                <Feld beschriftung="Beiträge">
                  <Eingabe name="beitraege" inputMode="numeric" defaultValue={kunde.beitraege ?? ''} />
                </Feld>
                <Feld beschriftung="Follower">
                  <Eingabe name="follower" inputMode="numeric" defaultValue={kunde.follower ?? ''} />
                </Feld>
                <Feld beschriftung="Gefolgt">
                  <Eingabe name="gefolgt" inputMode="numeric" defaultValue={kunde.gefolgt ?? ''} />
                </Feld>
              </div>
            </div>

            <div className="flex justify-end">
              <Knopf art="primaer" klein type="submit">
                Speichern
              </Knopf>
            </div>
          </form>
        </Karte>
      </Abschnitt>

      <Abschnitt
        titel="Betreuung"
        hinweis="Der Hauptansprechpartner steht auf jeder Export-Seite dieses Kunden und bekommt jede Rückmeldung."
      >
        <Karte className="p-5">
          <BetreuungFormular
            speichern={betreuungSpeichern.bind(null, kunde.id)}
            hauptAnsprechpartnerId={kunde.hauptAnsprechpartnerId}
            betreuerIds={kunde.betreuer.map((b) => b.nutzerId)}
            team={team.map((n) => ({
              id: n.id,
              name: n.name,
              rolleText: ROLLE_TEXT[n.rolle],
              waehlbar: darfAnsprechpartnerSein(n.rolle),
              betreutMoeglich: n.rolle === 'DESIGNER',
            }))}
          />
        </Karte>
      </Abschnitt>

      <Abschnitt
        titel="Veröffentlichen"
        hinweis="Auf welche Plattformen dieser Kunde bespielt wird — und ob Preroll das selbst übernimmt. Facebook und Instagram bekommen denselben Inhalt."
      >
        <Karte className="p-5">
          <VeroeffentlichenWahl
            zuordnen={veroeffentlichenSpeichern.bind(null, kunde.id, slug)}
            zugangSteht={zugaenge.length > 0}
            zugangFehler={zugaenge.find((z) => z.fehler)?.fehler ?? null}
            postenAktiv={kunde.postenAktiv}
            plattformen={kunde.plattformen}
            igKontoId={kunde.igKontoId}
            seitenId={kunde.fbSeitenId}
            seitenName={kunde.fbSeitenName}
            igName={kunde.igName}
            seiten={seiten.map((s) => ({
              id: s.id,
              name: s.name,
              igName: s.igName,
              zugang: s.zugangName,
            }))}
            mehrereZugaenge={zugaenge.length > 1}
            offeneBeitraege={offeneBeitraege}
            meldung={meta === 'fehler' ? (meldung ?? 'Die Zuordnung hat nicht geklappt.') : null}
          />
        </Karte>
      </Abschnitt>

      <Abschnitt
        titel="Klappe"
        hinweis="Ordnet diesem Kunden sein Projekt in Klappe zu. Ohne Zuordnung bleibt die Videoauswahl im Reel-Editor leer."
      >
        <Karte className="p-5">
          <KlappeProjektWahl
            zuordnen={klappeProjektZuordnen.bind(null, kunde.id)}
            eingerichtet={angebunden}
            projektId={kunde.klappeProjektId}
            projektName={kunde.klappeProjektName}
            projekte={
              projekte?.ok
                ? projekte.daten.map((p) => ({
                    id: p.id,
                    name: p.name,
                    kunde: p.customer,
                    videos: p.videoCount,
                  }))
                : []
            }
            fehler={projekte && !projekte.ok ? projekte.fehler : null}
            aktualisieren={klappeProjekteAktualisieren.bind(null, slug)}
          />
        </Karte>
      </Abschnitt>

      <Abschnitt
        titel="awork"
        hinweis="Das Gegenstück in eurem Projektmanagement. Was Preroll damit tut, ist noch offen — die Zuordnung steht schon bereit."
      >
        <Karte className="p-5">
          <AworkProjektWahl
            zuordnen={aworkProjektZuordnen.bind(null, kunde.id)}
            eingerichtet={aworkAn}
            projektId={kunde.aworkProjektId}
            projektName={kunde.aworkProjektName}
            projekte={aworkListe.map((p) => ({
              id: p.id,
              name: p.name,
              typ: p.projectTypeName ?? null,
            }))}
          />
        </Karte>
      </Abschnitt>

      <Abschnitt
        titel="Eigene Felder"
        hinweis="Gelten für alle Posts dieses Kunden und erscheinen auch in der Kundenvorschau."
      >
        {kunde.customFelder.length === 0 ? (
          <div className="mb-4">
            <Hinweis>Noch keine eigenen Felder — etwa Drehort, Drehtermin oder Musik-Lizenz.</Hinweis>
          </div>
        ) : (
          <Karte className="mb-4 overflow-hidden">
            {kunde.customFelder.map((feld) => (
              <div
                key={feld.id}
                className="flex items-center justify-between gap-4 border-b border-rahmen px-4 py-2.5 last:border-b-0"
              >
                <span className="text-[13px] text-tinte">{feld.name}</span>
                <div className="flex items-center gap-4">
                  <span className="text-[11.5px] text-still">
                    {feld.typ === 'TEXT' ? 'Text' : feld.typ === 'DATUM' ? 'Datum' : 'Ja / Nein'}
                  </span>
                  <form action={customFeldLoeschen.bind(null, feld.id)}>
                    <button type="submit" className="text-[11.5px] text-stiller hover:text-akzent">
                      entfernen
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </Karte>
        )}

        <CustomFeldFormular anlegen={customFeldAnlegen.bind(null, kunde.id)} />
      </Abschnitt>
    </div>
  )
}
