import type { Plattform } from '@prisma/client'
import { PLATTFORM_TEXT } from '@/lib/plattformen'
import { PlattformWahl } from '@/components/plattform-wahl'
import { Auswahl, Feld, Fehler, Hinweis, Knopf, Schalter, Warnung } from '@/components/ui'

export type MetaSeitenZeile = {
  id: string
  name: string
  igName: string | null
}

/**
 * Zwei Fragen, die leicht verwechselt werden — deshalb stehen sie hier
 * untereinander und nicht ineinander:
 *
 * 1. **Wohin geht der Content dieses Kunden?** Das ist Planung. Sie gilt auch
 *    dann, wenn die Agentur von Hand postet — der Kunde soll ja sehen, dass
 *    ein Beitrag auf Instagram *und* Facebook erscheint.
 * 2. **Postet Preroll das selbst?** Das ist Technik und braucht einen Zugang.
 *
 * Früher gab es hier nur die zweite Frage, und ohne Meta-Zugang war die Karte
 * leer. Das war falsch: Die Plattformen eines Kunden stehen fest, lange bevor
 * jemand ein Token hinterlegt.
 */
export function VeroeffentlichenWahl({
  zuordnen,
  zugangSteht,
  zugangFehler,
  postenAktiv,
  plattformen,
  seitenId,
  seitenName,
  igName,
  seiten,
  offeneBeitraege,
  meldung,
}: {
  zuordnen: (formular: FormData) => Promise<void>
  zugangSteht: boolean
  zugangFehler: string | null
  postenAktiv: boolean
  plattformen: Plattform[]
  seitenId: string | null
  seitenName: string | null
  igName: string | null
  seiten: MetaSeitenZeile[]
  /** Beiträge, die noch nicht veröffentlicht sind — nur die lassen sich nachziehen. */
  offeneBeitraege: number
  meldung: string | null
}) {
  // Gewählt, aber technisch nicht erreichbar. Kein Fehler — nur nichts, was
  // von selbst passiert; und das gehört gesagt, bevor jemand darauf wartet.
  const ohneKanal: Plattform[] = []
  if (plattformen.includes('FACEBOOK') && !seitenId) ohneKanal.push('FACEBOOK')
  if (plattformen.includes('INSTAGRAM') && !igName) ohneKanal.push('INSTAGRAM')

  return (
    <form action={zuordnen} className="grid gap-5">
      {meldung && <Fehler>{meldung}</Fehler>}

      <Feld
        beschriftung="Plattformen"
        hinweis="Vorbelegung für neue Beiträge. Am einzelnen Beitrag lässt sich davon abweichen. LinkedIn und YouTube kommen später dazu."
      >
        <PlattformWahl auswahl={plattformen} />
      </Feld>

      {offeneBeitraege > 0 && (
        <Schalter
          name="plattformenUebernehmen"
          beschriftung={`Auch auf die ${offeneBeitraege} noch nicht veröffentlichten Beiträge übernehmen`}
          hinweis="Ohne Haken gilt die Änderung nur für neu angelegte Beiträge. Was bereits draußen ist, bleibt in jedem Fall unangetastet."
        />
      )}

      <div className="border-t border-rahmen pt-5">
        {!zugangSteht ? (
          <Hinweis>
            Preroll kann für diesen Kunden noch nicht selbst posten — es ist kein Meta-Zugang
            hinterlegt. Das geht unter{' '}
            <a href="/einstellungen/veroeffentlichen" className="text-akzent">
              Einstellungen → Veröffentlichen
            </a>
            . Die Plattformwahl darüber gilt trotzdem: Sie steht am Beitrag und auf der
            Kundenseite.
          </Hinweis>
        ) : (
          <div className="grid gap-4">
            <input type="hidden" name="kanalGesetzt" value="1" />
            {zugangFehler && (
              <Warnung>Der Meta-Zugang wird gerade abgelehnt: {zugangFehler}</Warnung>
            )}

            {seitenId && (
              <p className="text-[12.5px] text-leise">
                Verbunden: <strong className="text-tinte">{seitenName ?? seitenId}</strong>
                {igName ? (
                  <> · Instagram <strong className="text-tinte">@{igName}</strong></>
                ) : (
                  <span className="text-leiser"> · ohne Instagram-Konto</span>
                )}
              </p>
            )}

            <Feld
              beschriftung="Facebook-Seite"
              hinweis="Das Instagram-Konto hängt bei Meta an der Seite und kommt automatisch mit — deshalb steht hier nur eine Auswahl."
            >
              <Auswahl name="fbSeitenId" defaultValue={seitenId ?? ''}>
                <option value="">— keine Zuordnung —</option>
                {seiten.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.igName ? ` · @${s.igName}` : ' · ohne Instagram'}
                  </option>
                ))}
              </Auswahl>
            </Feld>

            {seiten.length === 0 && (
              <p className="text-[11.5px] text-leiser">
                Der Zugang erreicht gerade keine Seite. Entweder ist dem Systemnutzer noch keine
                zugewiesen, oder der Kunde hat die Partnerfreigabe noch nicht erteilt.
              </p>
            )}

            {ohneKanal.length > 0 && (
              <Warnung>
                {ohneKanal.map((p) => PLATTFORM_TEXT[p]).join(' und ')}{' '}
                {ohneKanal.length === 1 ? 'ist gewählt, hat' : 'sind gewählt, haben'} aber keinen
                zugeordneten Kanal. Beiträge dorthin plant Preroll ein, veröffentlicht sie aber
                nicht — es passiert schlicht nichts.
              </Warnung>
            )}

            <Schalter
              name="postenAktiv"
              beschriftung="Preroll veröffentlicht für diesen Kunden"
              hinweis="Freigegebene Beiträge gehen zum geplanten Termin von selbst raus — auf die oben gewählten Plattformen. Aus heißt: Es bleibt beim Posten von Hand."
              defaultChecked={postenAktiv}
            />
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <Knopf klein type="submit">
          Speichern
        </Knopf>
      </div>
    </form>
  )
}
