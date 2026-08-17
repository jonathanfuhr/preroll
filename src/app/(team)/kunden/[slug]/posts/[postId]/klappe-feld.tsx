'use client'

import { useState } from 'react'
import { Auswahl, Fehler, Hinweis, Karte, Knopf } from '@/components/ui'
import {
  klappeFassungAktualisieren,
  klappeVideoErzeugen,
  klappeVideoVerknuepfen,
} from '../../klappe-aktionen'

export type KlappeVideoWahl = {
  id: string
  name: string
  versionCount: number
  hatFreigegebeneFassung: boolean
}

const ZEIT = new Intl.DateTimeFormat('de-DE', { dateStyle: 'short', timeStyle: 'short' })

/**
 * Verknüpfung des Reels mit einem Video in Klappe. Die Auswahl zeigt nur
 * Videos aus dem Projekt dieses Kunden — alles andere wäre auf Dauer
 * unübersichtlich.
 *
 * Dasselbe Feld bedient den Video-Platz einer Fassung: Ein anderes Format
 * heißt in aller Regel ein anderer Schnitt, und der liegt in Klappe als
 * eigenes Video.
 */
export function KlappeFeld({
  postId,
  varianteId = null,
  kundeSlug,
  eingerichtet,
  projektName,
  videos,
  ladefehler,
  verknuepft,
  meldung,
}: {
  postId: string
  /** Gesetzt, wenn die Verknüpfung dem Video-Platz einer Fassung gilt. */
  varianteId?: string | null
  kundeSlug: string
  eingerichtet: boolean
  projektName: string | null
  videos: KlappeVideoWahl[]
  ladefehler: string | null
  verknuepft: {
    videoId: string
    videoName: string | null
    videoUrl: string | null
    versionNummer: number | null
    standAm: string | null
    basisUrl: string | null
    fassungId: string | null
  } | null
  meldung?: string
}) {
  const [auswahlOffen, setAuswahlOffen] = useState(false)

  if (!eingerichtet) {
    return (
      <Hinweis>
        Klappe ist noch nicht angebunden. Unter{' '}
        <a href="/einstellungen" className="text-akzent">
          Einstellungen → Klappe
        </a>{' '}
        koppeln, dann lässt sich das finale Reel direkt von dort holen.
      </Hinweis>
    )
  }

  if (!projektName) {
    return (
      <Hinweis>
        Diesem Kunden ist noch kein Klappe-Projekt zugeordnet. Das geht unter{' '}
        <a href={`/kunden/${kundeSlug}/einstellungen`} className="text-akzent">
          Stammdaten
        </a>
        . Ohne Zuordnung zeigt die Videoauswahl nichts an.
      </Hinweis>
    )
  }

  return (
    <div className="grid gap-3">
      {meldung && <Fehler>{meldung}</Fehler>}
      {ladefehler && <Fehler>{ladefehler}</Fehler>}

      {verknuepft ? (
        <Karte className="p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-[13px] font-medium text-tinte">
                {verknuepft.videoName ?? 'Video in Klappe'}
              </div>
              <p className="mt-1 text-[11.5px] text-leiser">
                {verknuepft.versionNummer
                  ? `Fassung ${verknuepft.versionNummer} · freigegeben`
                  : 'Noch keine freigegebene Fassung'}
                {verknuepft.standAm && ` · Stand ${ZEIT.format(new Date(verknuepft.standAm))}`}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {verknuepft.basisUrl && verknuepft.videoUrl && (
                <a
                  href={`${verknuepft.basisUrl}${verknuepft.videoUrl}`}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-[5px] border border-rahmen-3 px-3 py-1.5 text-[12px] font-medium text-tinte hover:border-rahmen-4"
                >
                  In Klappe öffnen
                </a>
              )}
              <form action={klappeFassungAktualisieren.bind(null, postId, varianteId)}>
                <Knopf klein type="submit">
                  Fassung prüfen
                </Knopf>
              </form>
            </div>
          </div>

          {verknuepft.fassungId && (
            <video
              src={`/api/klappe/${verknuepft.fassungId}`}
              poster={`/api/klappe/${verknuepft.fassungId}?art=poster`}
              controls
              className="mt-3 max-h-64 rounded-[3px] bg-black"
            />
          )}

          <form
            action={klappeVideoVerknuepfen.bind(null, postId, varianteId)}
            className="mt-3 border-t border-rahmen pt-3"
          >
            <input type="hidden" name="videoId" value="" />
            <button type="submit" className="text-[11.5px] text-stiller hover:text-akzent">
              Verknüpfung lösen
            </button>
          </form>
        </Karte>
      ) : (
        <Karte className="p-4">
          <p className="text-[12.5px] leading-relaxed text-leise">
            {varianteId
              ? 'Für diese Fassung liegt noch kein Video in Klappe. Ein anderes Format heißt meist ein anderer Schnitt — der bekommt dort ein eigenes Video.'
              : 'Für diesen Post liegt noch kein Video in Klappe. Beim Anlegen eines Reels entsteht es normalerweise automatisch.'}{' '}
            Projekt: <strong>{projektName}</strong>.
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <form action={klappeVideoErzeugen.bind(null, postId, varianteId)}>
              <Knopf klein art="primaer" type="submit">
                Video in Klappe anlegen
              </Knopf>
            </form>
            <Knopf klein art="leise" onClick={() => setAuswahlOffen((v) => !v)}>
              {auswahlOffen ? 'abbrechen' : 'Vorhandenes Video verknüpfen'}
            </Knopf>
          </div>

          {auswahlOffen && (
            <form action={klappeVideoVerknuepfen.bind(null, postId, varianteId)} className="mt-3 grid gap-2">
              {videos.length === 0 ? (
                <p className="text-[12px] text-leiser">
                  Im Projekt {projektName} liegen noch keine Videos.
                </p>
              ) : (
                <>
                  <Auswahl name="videoId" required defaultValue="">
                    <option value="" disabled>
                      Video wählen …
                    </option>
                    {videos.map((video) => (
                      <option key={video.id} value={video.id}>
                        {video.name}
                        {video.hatFreigegebeneFassung
                          ? ` · ${video.versionCount} Fassungen`
                          : ' · noch keine freigegebene Fassung'}
                      </option>
                    ))}
                  </Auswahl>
                  <div className="flex justify-end">
                    <Knopf klein type="submit">
                      Verknüpfen
                    </Knopf>
                  </div>
                </>
              )}
            </form>
          )}
        </Karte>
      )}
    </div>
  )
}
