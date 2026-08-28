import type { KommentarStatus } from '@prisma/client'
import { KommentarInhalt } from './kommentar-inhalt'
import type { Erwaehnbar } from './kommentar-feld'
import { KommentarSchreiben } from './kommentar-schreiben'
import { InternBadge, Karte } from './ui'
import { KommentarZeile } from '@/app/(team)/kommentare/zeile'

const ZEIT = new Intl.DateTimeFormat('de-DE', { dateStyle: 'short', timeStyle: 'short' })

export type Kommentareintrag = {
  id: string
  autorName: string
  text: string
  am: Date
  bearbeitetAm: Date | null
  status: KommentarStatus
  vomTeam: boolean
  /** Trägt `#intern`: bleibt im Haus, der Kunde sieht ihn nicht. */
  intern: boolean
  exportId: string | null
  antwortAufId: string | null
  /** Ergebnis der Rechteprüfung am Server — hier wird nur angezeigt. */
  darfAendern: boolean
}

/**
 * Die Rückmeldungen zu einem Post — dieselbe Darstellung wie auf der
 * Kommentarseite, nur ohne die Zeile „zu welchem Post". Sie gehören dorthin,
 * wo der Post bearbeitet wird: Wer eine Anmerkung umsetzt, will sie beim
 * Ändern vor Augen haben und nicht in einem zweiten Fenster suchen.
 *
 * Antworten stehen eingerückt unter ihrer Rückmeldung. Ein Strang ist flach:
 * Auf eine Antwort wird nicht noch einmal geantwortet — für „ändere bitte
 * die Farbe" genügt das, und alles andere zerfasert.
 */
export function KommentarListe({
  postId,
  kommentare,
  erwaehnbar,
}: {
  postId: string
  kommentare: Kommentareintrag[]
  erwaehnbar: Erwaehnbar[]
}) {
  const straenge = kommentare.filter((k) => !k.antwortAufId)
  const antwortenZu = (id: string) => kommentare.filter((k) => k.antwortAufId === id)

  return (
    <div className="grid gap-3">
      {/*
        Schreiben, nicht nur lesen. Bisher ging das nur über den
        Freigabe-Link — wer im Beitrag arbeitet und etwas festhalten will,
        musste die Seite wechseln. Das Feld steht **oben**: Ein neuer Strang
        gehört an den Anfang, und bei zwanzig Rückmeldungen sucht man es unten
        vergeblich.
      */}
      <KommentarSchreiben postId={postId} erwaehnbar={erwaehnbar} />

      {straenge.length === 0 && (
        <p className="px-1 text-[12.5px] leading-relaxed text-leiser">
          Noch keine Rückmeldung zu diesem Beitrag. Was der Kunde im Freigabe-Link schreibt,
          erscheint hier.
        </p>
      )}

      {straenge.map((kommentar) => (
        <Karte
          key={kommentar.id}
          className={`p-4 ${kommentar.status === 'ERLEDIGT' ? 'opacity-60' : ''}`}
        >
          <Kopf kommentar={kommentar} />
          <KommentarInhalt text={kommentar.text} />

          <KommentarZeile
            kommentarId={kommentar.id}
            status={kommentar.status}
            postId={postId}
            exportId={kommentar.exportId}
            text={kommentar.text}
            autorName={kommentar.autorName}
            erwaehnbar={erwaehnbar}
            darfAendern={kommentar.darfAendern}
          />

          {antwortenZu(kommentar.id).map((antwort) => (
            <div key={antwort.id} className="mt-3 border-l-2 border-rahmen-3 pl-3.5">
              <Kopf kommentar={antwort} />
              <KommentarInhalt text={antwort.text} klein />
              <KommentarZeile
                kommentarId={antwort.id}
                status={antwort.status}
                postId={postId}
                exportId={antwort.exportId}
                text={antwort.text}
                autorName={antwort.autorName}
                erwaehnbar={erwaehnbar}
                darfAendern={antwort.darfAendern}
                istAntwort
                strangId={kommentar.id}
              />
            </div>
          ))}
        </Karte>
      ))}
    </div>
  )
}

function Kopf({ kommentar }: { kommentar: Kommentareintrag }) {
  return (
    <div className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <span className="text-[13px] font-semibold text-tinte">{kommentar.autorName}</span>
      {kommentar.vomTeam && (
        <span className="text-[10px] uppercase tracking-[0.08em] text-still">Agentur</span>
      )}
      {kommentar.intern && <InternBadge />}
      <span className="ml-auto text-[11px] text-stiller">
        {ZEIT.format(kommentar.am)}
        {kommentar.bearbeitetAm && ' · bearbeitet'}
      </span>
    </div>
  )
}
