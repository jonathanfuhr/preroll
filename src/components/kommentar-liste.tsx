import type { KommentarStatus } from '@prisma/client'
import { Karte } from './ui'
import { KommentarZeile } from '@/app/(team)/kommentare/zeile'

const ZEIT = new Intl.DateTimeFormat('de-DE', { dateStyle: 'short', timeStyle: 'short' })

export type Kommentareintrag = {
  id: string
  autorName: string
  text: string
  am: Date
  status: KommentarStatus
  vomTeam: boolean
  exportId: string | null
}

/**
 * Die Rückmeldungen zu einem Post — dieselbe Darstellung wie auf der
 * Kommentarseite, nur ohne die Zeile „zu welchem Post". Sie gehören dorthin,
 * wo der Post bearbeitet wird: Wer eine Anmerkung umsetzt, will sie beim
 * Ändern vor Augen haben und nicht in einem zweiten Fenster suchen.
 */
export function KommentarListe({
  postId,
  kommentare,
}: {
  postId: string
  kommentare: Kommentareintrag[]
}) {
  if (kommentare.length === 0) {
    return (
      <Karte className="p-5">
        <p className="text-[12.5px] leading-relaxed text-leiser">
          Noch keine Rückmeldung zu diesem Beitrag. Was der Kunde im Freigabe-Link schreibt,
          erscheint hier.
        </p>
      </Karte>
    )
  }

  return (
    <div className="grid gap-3">
      {kommentare.map((kommentar) => (
        <Karte
          key={kommentar.id}
          className={`p-4 ${kommentar.status === 'ERLEDIGT' ? 'opacity-60' : ''}`}
        >
          <div className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-[13px] font-semibold text-tinte">{kommentar.autorName}</span>
            {kommentar.vomTeam && (
              <span className="text-[10px] uppercase tracking-[0.08em] text-still">Agentur</span>
            )}
            <span className="ml-auto text-[11px] text-stiller">{ZEIT.format(kommentar.am)}</span>
          </div>

          <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-tinte-3">
            {kommentar.text}
          </p>

          <KommentarZeile
            kommentarId={kommentar.id}
            status={kommentar.status}
            postId={postId}
            exportId={kommentar.exportId}
          />
        </Karte>
      ))}
    </div>
  )
}
