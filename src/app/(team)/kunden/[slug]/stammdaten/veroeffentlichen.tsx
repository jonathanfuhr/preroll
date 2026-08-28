import type { Plattform } from '@prisma/client'
import { moeglichePlattformen } from '@/lib/plattformen'
import { PlattformModusWahl } from '@/components/plattform-modus'
import { Auswahl, Feld, Fehler, Hinweis, Knopf, Schalter, Warnung } from '@/components/ui'
import { SpeichernKnopf } from '@/components/speichern-knopf'

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
  /*
    TikTok bleibt dauerhaft gesperrt, nicht bis jemand etwas nachträgt:
    Preroll hat für TikTok keinen Zugang, und einen Kanal, den es nicht gibt,
    kann niemand zuordnen. Der Grund sagt das, statt eine Aufgabe anzudeuten.
  */
  gesperrt.TIKTOK = 'Preroll postet dort nicht — nur planen'
  return { moeglich, gesperrt }
}

/**
 * Wohin dieser Kunde bespielt wird — und wo Preroll das selbst übernimmt.
 *
 * Beides steht jetzt in **einer** Zeile je Plattform: aus, nur planen, planen
 * und posten. Vorher waren es zwei Fragen an zwei Orten — Kästchen oben, ein
 * Schalter darunter — und dazwischen fehlte der häufigste Fall: für Instagram
 * planen und von Hand posten. „Wählbar ist nur, wofür ein Kanal da ist" war
 * dafür die falsche Regel; sie band die Planung an das Posten.
 *
 * Geblieben ist die Bindung nur dort, wo sie stimmt: **„planen und posten"
 * braucht einen Kanal.** Der steht im Abschnitt darunter, deshalb nennt der
 * Grund ihn beim Namen.
 */
export function PlattformwahlKarte({
  speichern,
  plattformen,
  postenPlattformen,
  seitenId,
  igKontoId,
  liOrganisationId,
  offeneBeitraege,
}: {
  speichern: (formular: FormData) => Promise<void>
  plattformen: Plattform[]
  postenPlattformen: Plattform[]
  seitenId: string | null
  igKontoId: string | null
  liOrganisationId: string | null
  /** Beiträge, die noch nicht veröffentlicht sind — nur die lassen sich nachziehen. */
  offeneBeitraege: number
}) {
  const { moeglich, gesperrt } = sperren(seitenId, igKontoId, liOrganisationId)

  return (
    <form action={speichern} className="grid gap-5">
      <Feld
        beschriftung="Plattformen"
        hinweis={
          'Vorbelegung für neue Beiträge; am einzelnen Beitrag lässt sich davon abweichen. ' +
          '„Planen und posten" braucht einen Kanal aus den Abschnitten darunter — ohne ihn ' +
          'bleibt es beim Posten von Hand. YouTube kommt später dazu.'
        }
      >
        <PlattformModusWahl
          wahl={{ plattformen, postenPlattformen }}
          mitKanal={moeglich}
          gruende={gesperrt}
        />
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

      {moeglich.length === 0 && (
        <Hinweis>
          Preroll kann für diesen Kunden noch nicht selbst posten — es ist kein Kanal zugeordnet.
          Das geht in den Abschnitten darunter; fehlt dort auch der Zugang, zuerst unter{' '}
          <a href="/einstellungen/veroeffentlichen" className="text-akzent">
            Einstellungen → Veröffentlichen
          </a>
          . Planen lässt sich eine Plattform trotzdem — dafür braucht es keinen Kanal.
        </Hinweis>
      )}

      <div className="flex justify-end">
        <SpeichernKnopf klein>
          Speichern
        </SpeichernKnopf>
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
        <SpeichernKnopf klein>
          Speichern
        </SpeichernKnopf>
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
        <SpeichernKnopf klein>
          Speichern
        </SpeichernKnopf>
      </div>
    </form>
  )
}
