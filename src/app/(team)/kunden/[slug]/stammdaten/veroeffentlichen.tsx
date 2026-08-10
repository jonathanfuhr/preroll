import { Auswahl, Fehler, Hinweis, Knopf, Schalter, Warnung } from '@/components/ui'

export type MetaSeitenZeile = {
  id: string
  name: string
  igName: string | null
}

/**
 * Ordnet dem Kunden seine Facebook-Seite zu — und damit auch das daran
 * hängende Instagram-Konto. Beides läuft über denselben Zugang, deshalb gibt
 * es hier nur eine Auswahl statt zweier.
 */
export function VeroeffentlichenWahl({
  zuordnen,
  zugangSteht,
  zugangFehler,
  postenAktiv,
  seitenId,
  seitenName,
  igName,
  seiten,
  meldung,
}: {
  zuordnen: (formular: FormData) => Promise<void>
  zugangSteht: boolean
  zugangFehler: string | null
  postenAktiv: boolean
  seitenId: string | null
  seitenName: string | null
  igName: string | null
  seiten: MetaSeitenZeile[]
  meldung: string | null
}) {
  if (!zugangSteht) {
    return (
      <Hinweis>
        Es ist kein Meta-Zugang hinterlegt. Das geht unter{' '}
        <a href="/einstellungen/veroeffentlichen" className="text-akzent">
          Einstellungen → Veröffentlichen
        </a>
        ; danach lässt sich hier die Seite zuordnen.
      </Hinweis>
    )
  }

  return (
    <form action={zuordnen} className="grid gap-4">
      {meldung && <Fehler>{meldung}</Fehler>}
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

      <label className="block">
        <span className="mb-1.5 block text-[10.5px] font-medium uppercase tracking-[0.1em] text-still">
          Facebook-Seite
        </span>
        <Auswahl name="fbSeitenId" defaultValue={seitenId ?? ''}>
          <option value="">— keine Zuordnung —</option>
          {seiten.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
              {s.igName ? ` · @${s.igName}` : ' · ohne Instagram'}
            </option>
          ))}
        </Auswahl>
      </label>

      {seiten.length === 0 && (
        <p className="text-[11.5px] text-leiser">
          Der Zugang erreicht gerade keine Seite. Entweder ist dem Systemnutzer noch keine
          zugewiesen, oder der Kunde hat die Partnerfreigabe noch nicht erteilt.
        </p>
      )}

      <Schalter
        name="postenAktiv"
        beschriftung="Preroll veröffentlicht für diesen Kunden"
        hinweis="Freigegebene Beiträge gehen zum geplanten Termin von selbst raus — auf Facebook und Instagram, mit demselben Inhalt. Aus heißt: Es bleibt beim Posten von Hand."
        defaultChecked={postenAktiv}
      />

      <div className="flex justify-end">
        <Knopf klein type="submit">
          Speichern
        </Knopf>
      </div>
    </form>
  )
}
