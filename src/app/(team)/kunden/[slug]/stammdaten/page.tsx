import { ladeKunde } from '@/lib/abfragen'
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
  profilSpeichern,
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
import { ProfilFelder } from './plattform-profil'
import { LinkedInKanal, MetaKanaele, PlattformwahlKarte } from './veroeffentlichen'
import { linkedInAppSteht, linkedInOrganisationen, ladeLinkedInZugang } from '@/lib/linkedin-zugang'
import { linkedInKanalSpeichern } from '../veroeffentlichen-aktionen'

/**
 * Stammdaten, nach Plattform gegliedert.
 *
 * Vorher stand alles in einem Abschnitt „Profil": der Instagram-Handle neben
 * dem Kundennamen, die Instagram-Kennzahlen neben der internen Notiz, und die
 * Kanalzuordnung weiter unten unter „Veröffentlichen". Solange es nur Instagram
 * gab, ging das; mit Facebook und LinkedIn wäre daraus eine Liste ohne Ordnung
 * geworden.
 *
 * Jetzt drei Abschnitte:
 *
 * · **Profil** — was den Kunden als Ganzes betrifft: Logo, Name, welche
 *   Plattformen betreut werden, interne Notiz, die zwei Schalter.
 * · **Meta** — alles zu Instagram und Facebook, samt Kanalzuordnung.
 * · **LinkedIn** — dasselbe für LinkedIn, soweit es das schon gibt.
 */
export default async function StammdatenSeite({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{
    kennzahlen?: string
    meta?: string
    linkedin?: string
    meldung?: string
  }>
}) {
  const { slug } = await params
  const { kennzahlen: kennzahlenStand, meta, linkedin, meldung } = await searchParams
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

  /*
    Ohne Zugang gar nicht erst bei Meta nachfragen. Und ein Fehlschlag darf die
    Stammdaten nicht mitnehmen — sonst kommt niemand mehr an das Formular, in
    dem er die Zuordnung reparieren würde.

    Die Seiten kommen aus **allen** Zugängen in einer Liste. Aus welchem
    Portfolio eine Seite stammt, ist eine Frage der Verwaltung — wer einen
    Kunden einrichtet, sucht seine Seite, nicht seinen Business Manager.
  */
  const zugaenge = await ladeMetaZugaenge()
  const seiten = zugaenge.length > 0 ? await metaSeiten() : []

  // Für den Haken „auch auf bestehende Beiträge übernehmen" — ohne die Zahl
  // wäre das ein Schalter, dessen Wirkung man erst hinterher sieht.
  const offeneBeitraege = await zaehleOffeneBeitraege(kunde.id)

  /*
    LinkedIn: App-Daten, Zugang und die Seiten daran. Die Seiten werden nur
    geholt, wenn ein Zugang steht — und ein Fehlschlag darf die Stammdaten nicht
    mitnehmen, sonst kommt niemand mehr an das Formular, in dem er ihn
    reparieren würde.
  */
  const [liApp, liZugang] = await Promise.all([linkedInAppSteht(), ladeLinkedInZugang()])
  const liOrgs = liZugang ? await linkedInOrganisationen() : null

  const instagram = kunde.profil.INSTAGRAM
  const facebook = kunde.profil.FACEBOOK
  const linkedinProfil = kunde.profil.LINKEDIN
  const tiktokProfil = kunde.profil.TIKTOK

  return (
    <div className="max-w-[760px]">
      <h1 className="mb-6 text-[24px] font-semibold tracking-[-0.02em]">Stammdaten</h1>

      {/* ---------------------------------------------------------- Profil */}
      <Abschnitt
        titel="Profil"
        hinweis="Was für den Kunden als Ganzes gilt. Was zu einem einzelnen Kanal gehört, steht in dessen Abschnitt darunter."
      >
        <Karte className="p-5">
          <div className="mb-5 border-b border-rahmen pb-5">
            <LogoAblage kundeId={kunde.id} logo={thumbUrl(kunde.logoId)} />
          </div>

          <form action={kundeSpeichern.bind(null, kunde.id)} className="grid gap-4">
            <Feld beschriftung="Name">
              <Eingabe name="name" defaultValue={kunde.name} required />
            </Feld>

            <Feld beschriftung="Interne Notiz" hinweis="Sieht der Kunde nicht.">
              <Textfeld name="notiz" defaultValue={kunde.notiz ?? ''} rows={3} />
            </Feld>

            <Schalter
              name="freigabenNoetig"
              beschriftung="Freigaben einholen"
              hinweis="Bei eigenen Kanälen gibt es niemanden, der freigeben müsste. Aus heißt: kein Freigabeschritt im Editor und keiner auf der Freigabe-Seite."
              defaultChecked={kunde.freigabenNoetig}
            />

            <Schalter
              name="zipFuerKunden"
              beschriftung="Kunde darf die Dateien herunterladen"
              hinweis="Setzt auf der Freigabe-Seite einen Knopf, der die finalen Beiträge des Monats als ZIP liefert. Nur Finales — ein Konzept, das noch umgebaut wird, gehört nicht in fremde Ordner."
              defaultChecked={kunde.zipFuerKunden}
            />

            <div className="flex justify-end">
              <Knopf art="primaer" klein type="submit">
                Speichern
              </Knopf>
            </div>
          </form>

          <div className="mt-5 border-t border-rahmen pt-5">
            <PlattformwahlKarte
              speichern={veroeffentlichenSpeichern.bind(null, kunde.id, slug)}
              plattformen={kunde.plattformen}
              postenPlattformen={kunde.postenPlattformen}
              seitenId={kunde.fbSeitenId}
              igKontoId={kunde.igKontoId}
              liOrganisationId={kunde.liOrganisationId}
              offeneBeitraege={offeneBeitraege}
            />
          </div>
        </Karte>
      </Abschnitt>

      {/* ------------------------------------------------------------ Meta */}
      <Abschnitt
        titel="Meta"
        hinweis="Instagram und Facebook. Beide teilen sich einen Zugang: Das Instagram-Konto hängt bei Meta an der Facebook-Seite."
      >
        <Karte className="p-5">
          <h3 className="mb-4 text-[13px] font-semibold">Instagram</h3>

          {/* Eigenes Formular für den Abruf — es darf die Angaben weder
              mitschicken noch überschreiben. Der Knopf steht weiter unten und
              findet es über `form`. */}
          <form
            id="kennzahlen-holen"
            action={kennzahlenHolen.bind(null, kunde.id, slug, 'INSTAGRAM')}
          />

          <ProfilFelder
            speichern={profilSpeichern.bind(null, kunde.id, 'INSTAGRAM')}
            werte={instagram}
            handleBeschriftung="Instagram-Handle"
            handleHinweis="Ohne @."
            handlePlatzhalter="beispiel.handwerk"
            mitBio
            mitGefolgt
            nebenKnopf={
              <>
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
                  Der Knopf steht außerhalb des Profil-Formulars: Er holt Werte
                  und speichert nicht, was gerade in den Feldern steht. Beides in
                  einem Formular hieße, dass ein Klick ungespeicherte Eingaben
                  mitnimmt oder überschreibt.
                */}
                <div className="mb-4 flex flex-wrap items-center gap-3">
                  <Knopf klein type="submit" form="kennzahlen-holen" disabled={!instagram.handle}>
                    Jetzt von Instagram holen
                  </Knopf>
                  {!instagram.handle ? (
                    <span className="text-[11.5px] text-leiser">
                      Dafür oben einen Instagram-Handle eintragen.
                    </span>
                  ) : !einstellungen.kennzahlenAktiv ? (
                    <span className="text-[11.5px] text-leiser">
                      Der tägliche Abruf ist aus — dieser Knopf holt trotzdem.
                    </span>
                  ) : null}
                </div>
              </>
            }
          />
        </Karte>

        <Karte className="mt-4 p-5">
          <h3 className="mb-1 text-[13px] font-semibold">Facebook</h3>
          <p className="mb-4 text-[11.5px] leading-relaxed text-leiser">
            Follower und „Gefällt mir" holt Preroll über die Graph API — mit dem Seiten-Token aus
            der Zuordnung unten. Anders als bei Instagram und TikTok ist das der dokumentierte
            Weg: Die Seite gehört zum Systemnutzer der Agentur.
          </p>

          {/* Eigenes Formular für den Abruf — siehe Instagram. */}
          <form
            id="kennzahlen-holen-facebook"
            action={kennzahlenHolen.bind(null, kunde.id, slug, 'FACEBOOK')}
          />

          <ProfilFelder
            mitLikes
            nebenKnopf={
              <>
                {kennzahlenStand === 'facebook-ok' && (
                  <div className="mb-3">
                    <Hinweis>Kennzahlen von Facebook übernommen.</Hinweis>
                  </div>
                )}
                {kennzahlenStand === 'facebook-fehler' && (
                  <div className="mb-3">
                    <Fehler>{meldung}</Fehler>
                  </div>
                )}

                <div className="mb-4 flex flex-wrap items-center gap-3">
                  <Knopf
                    klein
                    type="submit"
                    form="kennzahlen-holen-facebook"
                    disabled={!kunde.fbSeitenId}
                  >
                    Jetzt von Facebook holen
                  </Knopf>
                  {!kunde.fbSeitenId && (
                    <span className="text-[11.5px] text-leiser">
                      Dafür unten eine Seite zuordnen.
                    </span>
                  )}
                </div>
              </>
            }
            speichern={profilSpeichern.bind(null, kunde.id, 'FACEBOOK')}
            werte={facebook}
            handleBeschriftung="Seitenname"
            handleHinweis="Wie die Seite bei Facebook heißt. Die Zuordnung des Kanals steht darunter."
            beitraegeBeschriftung="Beiträge"
          />
        </Karte>

        <Karte className="mt-4 p-5">
          <h3 className="mb-1 text-[13px] font-semibold">Kanäle zum Veröffentlichen</h3>
          <p className="mb-4 text-[11.5px] leading-relaxed text-leiser">
            Welche Seite Preroll bespielt — und damit welches Instagram-Konto. Ohne Zuordnung
            lässt sich im Abschnitt Profil keine Plattform wählen.
          </p>

          <MetaKanaele
            speichern={veroeffentlichenSpeichern.bind(null, kunde.id, slug)}
            zugangSteht={zugaenge.length > 0}
            zugangFehler={zugaenge.find((z) => z.fehler)?.fehler ?? null}
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
            meldung={meta === 'fehler' ? (meldung ?? 'Die Zuordnung hat nicht geklappt.') : null}
          />
        </Karte>
      </Abschnitt>

      {/* ---------------------------------------------------------- TikTok */}
      <Abschnitt
        titel="TikTok"
        hinweis="Angaben und Zahlen des TikTok-Profils. Preroll plant für TikTok, postet dort aber nicht — dafür gibt es keinen Zugang."
      >
        <Karte className="p-5">
          {/* Eigenes Formular für den Abruf — siehe Instagram. */}
          <form
            id="kennzahlen-holen-tiktok"
            action={kennzahlenHolen.bind(null, kunde.id, slug, 'TIKTOK')}
          />

          <ProfilFelder
            speichern={profilSpeichern.bind(null, kunde.id, 'TIKTOK')}
            werte={tiktokProfil}
            handleBeschriftung="TikTok-Handle"
            handleHinweis="Ohne @."
            handlePlatzhalter="beispiel.handwerk"
            mitBio
            mitGefolgt
            mitLikes
            beitraegeBeschriftung="Videos"
            nebenKnopf={
              <>
                {kennzahlenStand === 'tiktok-ok' && (
                  <div className="mb-3">
                    <Hinweis>Kennzahlen von TikTok übernommen.</Hinweis>
                  </div>
                )}
                {kennzahlenStand === 'tiktok-fehler' && (
                  <div className="mb-3">
                    <Fehler>{meldung}</Fehler>
                  </div>
                )}

                <div className="mb-4 flex flex-wrap items-center gap-3">
                  <Knopf
                    klein
                    type="submit"
                    form="kennzahlen-holen-tiktok"
                    disabled={!tiktokProfil.handle}
                  >
                    Jetzt von TikTok holen
                  </Knopf>
                  {!tiktokProfil.handle ? (
                    <span className="text-[11.5px] text-leiser">
                      Dafür oben einen TikTok-Handle eintragen.
                    </span>
                  ) : (
                    <span className="text-[11.5px] text-leiser">
                      TikTok liefert zeitweise eine Sperrseite statt der Zahlen — dann hilft ein
                      zweiter Versuch.
                    </span>
                  )}
                </div>
              </>
            }
          />
        </Karte>
      </Abschnitt>

      {/* -------------------------------------------------------- LinkedIn */}
      <Abschnitt
        titel="LinkedIn"
        hinweis="Angaben und Zahlen der Firmenseite. Das Veröffentlichen über LinkedIn ist noch nicht gebaut."
      >
        <Karte className="p-5">
          <ProfilFelder
            speichern={profilSpeichern.bind(null, kunde.id, 'LINKEDIN')}
            werte={linkedinProfil}
            handleBeschriftung="Firmenseite"
            handleHinweis="Der Teil hinter linkedin.com/company/ — etwa beispiel-handwerk."
            handlePlatzhalter="beispiel-handwerk"
            beitraegeBeschriftung="Beiträge"
          />
        </Karte>

        <Karte className="mt-4 p-5">
          <h3 className="mb-1 text-[13px] font-semibold">Kanal zum Veröffentlichen</h3>
          <p className="mb-4 text-[11.5px] leading-relaxed text-leiser">
            Welche Firmenseite Preroll bespielt. Ohne Zuordnung lässt sich im Abschnitt Profil
            LinkedIn nicht anhaken.
          </p>

          <LinkedInKanal
            speichern={linkedInKanalSpeichern.bind(null, kunde.id, slug)}
            zugangSteht={liZugang !== null}
            appSteht={liApp}
            organisationId={kunde.liOrganisationId}
            organisation={kunde.liOrganisation}
            organisationen={liOrgs?.ok ? liOrgs.organisationen : []}
            fehler={liOrgs && !liOrgs.ok ? liOrgs.fehler : null}
            meldung={
              linkedin === 'fehler' ? (meldung ?? 'Die Zuordnung hat nicht geklappt.') : null
            }
          />
        </Karte>
      </Abschnitt>

      {/* ------------------------------------------------------- Betreuung */}
      <Abschnitt
        titel="Betreuung"
        hinweis="Der Hauptansprechpartner steht auf jeder Freigabe-Seite dieses Kunden und bekommt jede Rückmeldung."
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
