import type { Plattform } from '@prisma/client'
import { moeglichePlattformen } from '@/lib/plattformen'
import { PlattformWahl } from '@/components/plattform-wahl'
import { Auswahl, Feld, Fehler, Hinweis, Knopf, Schalter, Warnung } from '@/components/ui'

export type MetaSeitenZeile = {
  id: string
  name: string
  igName: string | null
  /** Aus welchem Zugang die Seite stammt — nur bei mehreren interessant. */
  zugang: string
}

/**
 * Zwei Fragen, die leicht verwechselt werden — deshalb stehen sie hier
 * untereinander und nicht ineinander:
 *
 * 1. **Wohin geht der Content dieses Kunden?** Das ist Planung. Sie gilt auch
 *    dann, wenn die Agentur von Hand postet — der Kunde soll ja sehen, dass
 *    ein Beitrag auf Instagram *und* Facebook erscheint.
 * 2. **Postet Preroll das selbst?** Das ist der Schalter darunter.
 *
 * Beides hängt trotzdem an derselben Zuordnung: **Wählbar ist nur, wofür ein
 * Kanal hinterlegt ist.** Ein Häkchen, das nichts bewirken kann, wäre eine
 * Falle — lieber gesperrt mit Grund als anhakbar mit Warnung. Der Preis ist
 * die Kopplung: Ohne zugeordnete Seite hat ein Kunde keine Plattformen. Wer
 * nur planen will, ordnet sie trotzdem zu; das Posten schaltet das nicht ein.
 */
export function VeroeffentlichenWahl({
  zuordnen,
  zugangSteht,
  zugangFehler,
  postenAktiv,
  plattformen,
  igKontoId,
  seitenId,
  seitenName,
  igName,
  seiten,
  mehrereZugaenge,
  offeneBeitraege,
  meldung,
}: {
  zuordnen: (formular: FormData) => Promise<void>
  zugangSteht: boolean
  zugangFehler: string | null
  postenAktiv: boolean
  plattformen: Plattform[]
  igKontoId: string | null
  seitenId: string | null
  seitenName: string | null
  igName: string | null
  seiten: MetaSeitenZeile[]
  /**
   * Ob es mehr als einen Meta-Zugang gibt. Nur dann wird die Herkunft je
   * Seite genannt — bei einem einzigen wäre sie bei jedem Eintrag dieselbe
   * und damit Lärm.
   */
  mehrereZugaenge: boolean
  /** Beiträge, die noch nicht veröffentlicht sind — nur die lassen sich nachziehen. */
  offeneBeitraege: number
  meldung: string | null
}) {
  /*
    Wählbar ist nur, wofür ein Kanal zugeordnet ist. Der Rest steht gesperrt
    daneben — mit dem Grund, damit niemand sucht, wo nichts fehlt, sondern
    etwas fehlt, das er selbst nachtragen kann.
  */
  const moeglich = moeglichePlattformen({ fbSeitenId: seitenId, igKontoId })
  const gesperrt: Partial<Record<Plattform, string>> = {}
  if (!moeglich.includes('FACEBOOK')) gesperrt.FACEBOOK = 'keine Seite zugeordnet'
  if (!moeglich.includes('INSTAGRAM')) {
    gesperrt.INSTAGRAM = seitenId ? 'kein Konto an der Seite' : 'keine Seite zugeordnet'
  }

  return (
    <form action={zuordnen} className="grid gap-5">
      {meldung && <Fehler>{meldung}</Fehler>}

      <Feld
        beschriftung="Plattformen"
        hinweis={
          Object.keys(gesperrt).length > 0
            ? 'Wählbar ist nur, wofür unten ein Kanal zugeordnet ist — ein Häkchen, das nichts bewirkt, wäre eine Falle. LinkedIn und YouTube kommen später dazu.'
            : 'Vorbelegung für neue Beiträge. Am einzelnen Beitrag lässt sich davon abweichen. LinkedIn und YouTube kommen später dazu.'
        }
      >
        <PlattformWahl auswahl={plattformen} moeglich={moeglich} gesperrt={gesperrt} />
      </Feld>

      {/*
        Nur wenn es überhaupt etwas zu übernehmen gibt. Ohne zugeordneten
        Kanal wäre die Wahl leer, und der Haken hieße „allen Beiträgen ihre
        Plattformen wegnehmen" — samt der Wahl, die von selbst zurückkäme,
        sobald die Seite wieder hängt. Ein Schalter, der nur zerstören kann,
        gehört nicht hin.
      */}
      {moeglich.length > 0 && offeneBeitraege > 0 && (
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
            . Solange keine Seite zugeordnet ist, lässt sich oben auch keine Plattform wählen.
            Zuordnen allein schaltet das Posten übrigens nicht ein — wer nur planen und weiter
            von Hand posten will, hinterlegt den Kanal trotzdem.
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
                {/*
                  Die hinterlegte Seite steht auch dann in der Liste, wenn Meta
                  sie gerade nicht ausliefert. Ohne sie stünde die Auswahl auf
                  „keine Zuordnung", und das nächste Speichern löschte einen
                  Kanal, den niemand anfassen wollte — samt Plattformwahl.
                */}
                {seitenId && !seiten.some((s) => s.id === seitenId) && (
                  <option value={seitenId}>
                    {seitenName ?? seitenId} · zurzeit nicht erreichbar
                  </option>
                )}
                {seiten.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.igName ? ` · @${s.igName}` : ' · ohne Instagram'}
                    {mehrereZugaenge ? ` · ${s.zugang}` : ''}
                  </option>
                ))}
              </Auswahl>
            </Feld>

            {seiten.length === 0 && (
              <p className="text-[11.5px] text-leiser">
                Es ist gerade keine Seite erreichbar. Entweder ist den Systemnutzern noch keine
                zugewiesen, oder der Kunde hat die Partnerfreigabe noch nicht erteilt.
              </p>
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
