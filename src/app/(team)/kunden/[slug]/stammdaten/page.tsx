import { ladeKunde } from '@/lib/abfragen'
import { formatiereTag } from '@/lib/datum'
import { prisma } from '@/lib/db'
import { klappeEingerichtet, klappeProjekte } from '@/lib/klappe'
import { darfAnsprechpartnerSein, ROLLE_TEXT } from '@/lib/rollen'
import { thumbUrl } from '@/lib/urls'
import { Abschnitt, Eingabe, Feld, Hinweis, Karte, Knopf, Textfeld } from '@/components/ui'
import { betreuungSpeichern, customFeldAnlegen, customFeldLoeschen, kundeSpeichern } from '../aktionen'
import { aworkEingerichtet, aworkProjekte } from '@/lib/awork'
import { aworkProjektZuordnen, klappeProjekteAktualisieren, klappeProjektZuordnen } from '../klappe-aktionen'
import { AworkProjektWahl } from './awork-projekt'
import { BetreuungFormular } from './betreuung'
import { CustomFeldFormular } from './custom-felder'
import { KlappeProjektWahl } from './klappe-projekt'
import { LogoAblage } from './logo'

export default async function StammdatenSeite({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const kunde = await ladeKunde(slug)

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

          <form action={kundeSpeichern.bind(null, kunde.id)} className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
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

            <div className="border-t border-rahmen pt-4">
              <h3 className="mb-1 text-[13px] font-semibold">Profil-Kennzahlen</h3>
              <p className="mb-4 text-[11.5px] leading-relaxed text-leiser">
                Erscheinen über der Feed-Vorschau — intern wie auf der Export-Seite. Aktuell von
                Hand gepflegt; der Abruf über die Instagram Graph API kommt, sobald die Meta-App
                durch das App Review ist.
                {kunde.kennzahlenAm &&
                  ` Zuletzt aktualisiert am ${formatiereTag(kunde.kennzahlenAm, { dateStyle: 'long' })}.`}
              </p>
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
