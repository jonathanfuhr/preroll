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
 * Wählbar ist nur, wofür ein Kanal zugeordnet ist. Der Rest steht gesperrt
 * daneben — mit dem Grund, damit niemand sucht, wo nichts fehlt, sondern etwas
 * fehlt, das er selbst nachtragen kann.
 *
 * Steht hier und nicht in einem der Bauteile: Die Sperre gehört zur
 * Plattformwahl (Abschnitt Profil), ihr Grund liegt in der Kanalzuordnung
 * (Abschnitt Meta). Beide brauchen dieselbe Rechnung.
 */
function sperren(seitenId: string | null, igKontoId: string | null, liOrgId: string | null) {
  const moeglich = moeglichePlattformen({
    fbSeitenId: seitenId,
    igKontoId,
    liOrganisationId: liOrgId,
  })
  const gesperrt: Partial<Record<Plattform, string>> = {}
  if (!moeglich.includes('FACEBOOK')) gesperrt.FACEBOOK = 'keine Seite zugeordnet'
  if (!moeglich.includes('INSTAGRAM')) {
    gesperrt.INSTAGRAM = seitenId ? 'kein Konto an der Seite' : 'keine Seite zugeordnet'
  }
  if (!moeglich.includes('LINKEDIN')) gesperrt.LINKEDIN = 'keine Firmenseite zugeordnet'
  return { moeglich, gesperrt }
}

/**
 * Wohin dieser Kunde bespielt wird — und ob Preroll das selbst übernimmt.
 *
 * Zwei Fragen, die leicht verwechselt werden:
 *
 * 1. **Wohin geht der Content?** Das ist Planung. Sie gilt auch dann, wenn die
 *    Agentur von Hand postet — der Kunde soll ja sehen, dass ein Beitrag auf
 *    Instagram *und* Facebook erscheint.
 * 2. **Postet Preroll das selbst?** Der Schalter darunter.
 *
 * Beides hängt an der Kanalzuordnung im Abschnitt **Meta**: Wählbar ist nur,
 * wofür ein Kanal hinterlegt ist. Ein Häkchen, das nichts bewirken kann, wäre
 * eine Falle — lieber gesperrt mit Grund als anhakbar mit Warnung. Der Preis
 * ist die Kopplung über zwei Abschnitte hinweg; sie steht im Hinweistext.
 */
export function PlattformwahlKarte({
  speichern,
  plattformen,
  postenAktiv,
  seitenId,
  igKontoId,
  liOrganisationId,
  offeneBeitraege,
}: {
  speichern: (formular: FormData) => Promise<void>
  plattformen: Plattform[]
  postenAktiv: boolean
  seitenId: string | null
  igKontoId: string | null
  liOrganisationId: string | null
  /** Beiträge, die noch nicht veröffentlicht sind — nur die lassen sich nachziehen. */
  offeneBeitraege: number
}) {
  const { moeglich, gesperrt } = sperren(seitenId, igKontoId, liOrganisationId)

  return (
    <form action={speichern} className="grid gap-5">
      <input type="hidden" name="plattformenGesetzt" value="1" />

      <Feld
        beschriftung="Plattformen"
        hinweis={
          Object.keys(gesperrt).length > 0
            ? 'Wählbar ist nur, wofür weiter unten ein Kanal zugeordnet ist — ein Häkchen, das nichts bewirkt, wäre eine Falle. YouTube kommt später dazu.'
            : 'Vorbelegung für neue Beiträge. Am einzelnen Beitrag lässt sich davon abweichen. YouTube kommt später dazu.'
        }
      >
        <PlattformWahl auswahl={plattformen} moeglich={moeglich} gesperrt={gesperrt} />
      </Feld>

      {/*
        Nur wenn es überhaupt etwas zu übernehmen gibt. Ohne zugeordneten Kanal
        wäre die Wahl leer, und der Haken hieße „allen Beiträgen ihre
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

      {/*
        Der Schalter hängt an der Zuordnung, nicht am Zugang eines einzelnen
        Anbieters: Ein Kunde, für den nur LinkedIn eingerichtet ist, soll ihn
        auch bekommen. Vorher war er an den Meta-Zugang gebunden — und wäre
        damit unerreichbar geblieben.
      */}
      {moeglich.length > 0 ? (
        <Schalter
          name="postenAktiv"
          beschriftung="Preroll veröffentlicht für diesen Kunden"
          hinweis="Freigegebene Beiträge gehen zum geplanten Termin von selbst raus — auf die oben gewählten Plattformen. Aus heißt: Es bleibt beim Posten von Hand."
          defaultChecked={postenAktiv}
        />
      ) : (
        <Hinweis>
          Preroll kann für diesen Kunden noch nicht selbst posten — es ist kein Kanal zugeordnet.
          Das geht in den Abschnitten darunter; fehlt dort auch der Zugang, zuerst unter{' '}
          <a href="/einstellungen/veroeffentlichen" className="text-akzent">
            Einstellungen → Veröffentlichen
          </a>
          . Zuordnen allein schaltet das Posten übrigens nicht ein — wer nur planen und weiter von
          Hand posten will, hinterlegt den Kanal trotzdem.
        </Hinweis>
      )}

      <div className="flex justify-end">
        <Knopf klein type="submit">
          Speichern
        </Knopf>
      </div>
    </form>
  )
}

/**
 * Die Kanalzuordnung bei Meta — welche Facebook-Seite, und damit welches
 * Instagram-Konto.
 *
 * Getrennt von der Plattformwahl gespeichert, aber über dieselbe Aktion: Beide
 * Blöcke tragen ein verstecktes Merkerfeld, und die Aktion fasst nur an, was
 * mitgeschickt wurde. Ohne das würde ein Speichern des einen Blocks den anderen
 * leeren, obwohl niemand ihn angefasst hat.
 *
 * Zuordnen schaltet das Posten **nicht** ein — wer nur planen und weiter von
 * Hand posten will, hinterlegt den Kanal trotzdem.
 */
export function MetaKanaele({
  speichern,
  zugangSteht,
  zugangFehler,
  postenAktiv,
  seitenId,
  seitenName,
  igName,
  seiten,
  mehrereZugaenge,
  meldung,
}: {
  speichern: (formular: FormData) => Promise<void>
  zugangSteht: boolean
  zugangFehler: string | null
  /** Wird mitgeschickt, damit das Speichern der Seite ihn nicht ausschaltet. */
  postenAktiv: boolean
  seitenId: string | null
  seitenName: string | null
  igName: string | null
  seiten: MetaSeitenZeile[]
  /**
   * Ob es mehr als einen Meta-Zugang gibt. Nur dann wird die Herkunft je Seite
   * genannt — bei einem einzigen wäre sie bei jedem Eintrag dieselbe und damit
   * Lärm.
   */
  mehrereZugaenge: boolean
  meldung: string | null
}) {
  if (!zugangSteht) {
    return (
      <Hinweis>
        Es ist kein Meta-Zugang hinterlegt. Solange keiner steht, lässt sich für diesen Kunden
        keine Seite zuordnen — und damit auch keine Plattform wählen. Einzurichten unter{' '}
        <a href="/einstellungen/veroeffentlichen" className="text-akzent">
          Einstellungen → Veröffentlichen
        </a>
        .
      </Hinweis>
    )
  }

  return (
    <form action={speichern} className="grid gap-4">
      <input type="hidden" name="kanalGesetzt" value="1" />
      {/*
        Der Schalter „Preroll veröffentlicht" steht im Abschnitt Profil, sein
        Wert muss hier trotzdem mitkommen: Die Aktion schreibt `postenAktiv` im
        Kanalblock, und ohne das Feld stünde er nach jedem Speichern der Seite
        auf aus.
      */}
      {postenAktiv && <input type="hidden" name="postenAktiv" value="on" />}

      {meldung && <Fehler>{meldung}</Fehler>}
      {zugangFehler && <Warnung>Der Meta-Zugang wird gerade abgelehnt: {zugangFehler}</Warnung>}

      {seitenId && (
        <p className="text-[12.5px] text-leise">
          Verbunden: <strong className="text-tinte">{seitenName ?? seitenId}</strong>
          {igName ? (
            <>
              {' '}
              · Instagram <strong className="text-tinte">@{igName}</strong>
            </>
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
            Die hinterlegte Seite steht auch dann in der Liste, wenn Meta sie
            gerade nicht ausliefert. Ohne sie stünde die Auswahl auf „keine
            Zuordnung", und das nächste Speichern löschte einen Kanal, den
            niemand anfassen wollte — samt Plattformwahl.
          */}
          {seitenId && !seiten.some((s) => s.id === seitenId) && (
            <option value={seitenId}>{seitenName ?? seitenId} · zurzeit nicht erreichbar</option>
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

      <div className="flex justify-end">
        <Knopf klein type="submit">
          Speichern
        </Knopf>
      </div>
    </form>
  )
}

export type LinkedInOrgZeile = { id: string; name: string; handle: string | null }

/**
 * Die LinkedIn-Zuordnung eines Kunden — welche Firmenseite Preroll bespielt.
 *
 * Eigenes Formular neben dem Meta-Block: Die beiden Anbieter haben nichts
 * miteinander zu tun. Eine Facebook-Seite ist keine LinkedIn-Seite, und ein
 * gemeinsames Speichern hätte bei jedem Anfassen des einen das andere
 * mitgeschickt.
 */
export function LinkedInKanal({
  speichern,
  zugangSteht,
  appSteht,
  organisationId,
  organisation,
  organisationen,
  fehler,
  meldung,
}: {
  speichern: (formular: FormData) => Promise<void>
  zugangSteht: boolean
  appSteht: boolean
  organisationId: string | null
  organisation: string | null
  organisationen: LinkedInOrgZeile[]
  /** Der Stand des Zugangs, falls die letzte Prüfung schieflief. */
  fehler: string | null
  meldung: string | null
}) {
  if (!appSteht) {
    return (
      <Hinweis>
        Preroll postet noch nicht auf LinkedIn — dafür braucht es die Community Management API, und
        die gibt LinkedIn nur nach einer Freigabe heraus. Sobald die App eingetragen ist (
        <a href="/einstellungen/veroeffentlichen" className="text-akzent">
          Einstellungen → Veröffentlichen
        </a>
        ), lässt sich hier eine Firmenseite zuordnen. Bis dahin wird geplant wie bisher und von Hand
        gepostet.
      </Hinweis>
    )
  }

  if (!zugangSteht) {
    return (
      <Hinweis>
        Die App steht, aber es ist noch kein Konto verbunden. Das geht unter{' '}
        <a href="/einstellungen/veroeffentlichen" className="text-akzent">
          Einstellungen → Veröffentlichen
        </a>
        .
      </Hinweis>
    )
  }

  return (
    <form action={speichern} className="grid gap-4">
      {meldung && <Fehler>{meldung}</Fehler>}
      {fehler && <Warnung>Der LinkedIn-Zugang wird gerade abgelehnt: {fehler}</Warnung>}

      {organisationId && (
        <p className="text-[12.5px] text-leise">
          Verbunden: <strong className="text-tinte">{organisation ?? organisationId}</strong>
        </p>
      )}

      <Feld
        beschriftung="Firmenseite"
        hinweis="Angezeigt wird, wofür das verbundene Konto Administrator ist. Fehlt eine Seite, muss sie dort erst freigegeben werden."
      >
        <Auswahl name="liOrganisationId" defaultValue={organisationId ?? ''}>
          <option value="">— keine Zuordnung —</option>
          {/*
            Die zugeordnete Seite steht auch dann in der Liste, wenn LinkedIn
            sie gerade nicht ausliefert. Ohne sie stünde die Auswahl auf „keine
            Zuordnung", und das nächste Speichern löschte einen Kanal, den
            niemand anfassen wollte — dieselbe Falle wie bei Meta.
          */}
          {organisationId && !organisationen.some((o) => o.id === organisationId) && (
            <option value={organisationId}>
              {organisation ?? organisationId} · zurzeit nicht erreichbar
            </option>
          )}
          {organisationen.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
              {o.handle ? ` · /company/${o.handle}` : ''}
            </option>
          ))}
        </Auswahl>
      </Feld>

      {organisationen.length === 0 && (
        <p className="text-[11.5px] text-leiser">
          Es ist gerade keine Firmenseite erreichbar. Entweder ist das verbundene Konto nirgends
          Administrator, oder der Zugang muss geprüft werden.
        </p>
      )}

      <div className="flex justify-end">
        <Knopf klein type="submit">
          Speichern
        </Knopf>
      </div>
    </form>
  )
}
