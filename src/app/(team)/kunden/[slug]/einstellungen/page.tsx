import { ladeKunde } from '@/lib/abfragen'
import { formatiereTag } from '@/lib/datum'
import { Abschnitt, Eingabe, Feld, Hinweis, Karte, Knopf, Textfeld } from '@/components/ui'
import { customFeldAnlegen, customFeldLoeschen, kundeSpeichern } from '../aktionen'
import { CustomFeldFormular } from './custom-felder'

export default async function StammdatenSeite({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const kunde = await ladeKunde(slug)

  return (
    <div className="max-w-[720px]">
      <Abschnitt titel="Stammdaten">
        <Karte className="p-5">
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
                Hand gepflegt; der automatische Abruf über die Instagram Graph API
                (Business Discovery) kommt, sobald die Meta-App durch das App Review ist.
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
