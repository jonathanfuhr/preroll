'use client'

import type { PostTyp, Verhaeltnis } from '@prisma/client'
import { useState } from 'react'
import { MedienDialog } from '@/components/medien-dialog'
import type { Downloadstand } from '@/components/download-fortschritt'
import { VERHAELTNIS_WERT } from '@/lib/verhaeltnis'
import { Knopf } from '@/components/ui'
import { VideoQuellen, type KlappeAngaben } from './video-quellen'

export type VariantenMedium = {
  /** Die Zuordnung, nicht das Medium — sie wird gelöst, die Datei bleibt. */
  id: string
  url: string
  istVideo: boolean
  rolle: 'MEDIUM' | 'SLIDE' | 'THUMBNAIL'
}

/** Der Video-Platz dieser Fassung, samt allem, was seine drei Quellen brauchen. */
export type VariantenVideo = {
  quelle: { url: string; herkunft: 'MEDIUM' | 'KLAPPE' } | null
  thumbnailUrl: string | null
  thumbnailAutomatisch: boolean
  videoDownloadUrl: string | null
  downloadstand: Downloadstand
  klappe: KlappeAngaben
}

/**
 * Die eigenen Medien einer Fassung — gezeigt, geändert und wieder gelöst.
 *
 * **Derselbe Dialog wie am Beitrag.** Vorher stand hier ein nackter
 * Dateiwähler; damit fehlte einer Fassung alles, was den Beitrag ausmacht:
 * das Auftrennen eines Karussell-Gesamtbildes, beim Reel die zweite Spalte
 * fürs Thumbnail und die Wahl zwischen Upload, Klappe und Downloadlink. Ein
 * zweiter, ärmerer Weg zu denselben Medien ist keine Vereinfachung, sondern
 * eine Stelle, an der man beim Arbeiten hängen bleibt.
 *
 * **Leer heißt geerbt.** Dann steht hier, was am Beitrag hängt — sichtbar
 * abgesetzt, damit niemand es für die eigene Wahl hält. Das Lösen des letzten
 * Mediums ist deshalb kein Sonderfall, sondern der Weg zurück.
 */
export function VariantenMedien({
  postId,
  varianteId,
  kundeSlug,
  typ,
  verhaeltnis,
  medien,
  geerbt,
  video,
  entfernen,
}: {
  postId: string
  varianteId: string
  kundeSlug: string
  typ: PostTyp
  /** Das Verhältnis, gegen das geprüft wird — eigenes, sonst das des Beitrags. */
  verhaeltnis: Verhaeltnis
  medien: VariantenMedium[]
  /** Was gälte, wenn die Fassung nichts Eigenes hätte. */
  geerbt: VariantenMedium[]
  /** Nur beim Reel — der Video-Platz dieser Fassung. */
  video: VariantenVideo | null
  /** Verwirft alle eigenen Medien dieser Fassung samt Video-Platz. */
  entfernen: () => Promise<void>
}) {
  const [offen, setOffen] = useState(false)

  const eigen = medien.length > 0 || video?.quelle?.herkunft === 'KLAPPE'
  // Beim Reel steht das Standbild in der Kachel: Ein Video als Vorschaubild
  // wäre schwarz, bis jemand es abspielt.
  const gezeigt = eigen ? medien : geerbt
  const kacheln =
    typ === 'REEL'
      ? gezeigt.filter((m) => m.rolle === 'THUMBNAIL')
      : gezeigt.filter((m) => m.rolle !== 'THUMBNAIL')

  const seite = 1 / VERHAELTNIS_WERT[verhaeltnis]

  return (
    <div className="grid gap-2.5">
      <button
        type="button"
        onClick={() => setOffen(true)}
        title="Medien dieser Fassung ändern"
        className="flex flex-wrap items-start gap-2 rounded-md border border-dashed border-rahmen-3 p-2.5 text-left transition-colors hover:border-rahmen-4 hover:bg-flaeche-leise"
      >
        {kacheln.length > 0 ? (
          kacheln.slice(0, 5).map((m) => (
            <span
              key={m.id}
              className={`block w-16 overflow-hidden rounded-[3px] border border-rahmen ${
                eigen ? '' : 'opacity-45 grayscale'
              }`}
              style={{ aspectRatio: String(seite) }}
            >
              {m.istVideo ? (
                <video src={m.url} className="size-full bg-black object-cover" muted />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.url} alt="" className="size-full object-cover" />
              )}
            </span>
          ))
        ) : (
          <span
            className="flex w-16 items-center justify-center rounded-[3px] border border-dashed border-rahmen-3 bg-flaeche-leise text-[18px] leading-none text-stiller"
            style={{ aspectRatio: String(seite) }}
          >
            +
          </span>
        )}

        <span className="min-w-[9rem] flex-1 text-[11.5px] leading-relaxed text-leiser">
          {eigen ? (
            <>
              <strong className="font-medium text-tinte">Eigene Medien</strong> — gelten nur für
              diese Fassung. Klicken zum Ändern.
              {video?.quelle?.herkunft === 'KLAPPE' && ' Das Video kommt aus Klappe.'}
            </>
          ) : kacheln.length > 0 ? (
            <>
              <strong className="font-medium text-tinte">Geerbt vom Beitrag.</strong> Klicken, um
              für diese Fassung eigene Medien zu hinterlegen — ein eigenes Format wirkt erst damit.
            </>
          ) : (
            <>
              Der Beitrag hat noch keine Medien. Klicken, um für diese Fassung eigene zu
              hinterlegen.
            </>
          )}
        </span>
      </button>

      {eigen && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <Knopf klein art="leise" type="button" onClick={() => setOffen(true)}>
            Medien ändern
          </Knopf>
          {/*
            Alles lösen statt Stück für Stück: Medien gelten als Ganzes
            (`fassungFuer`), und ein Karussell, dem ein Slide fehlt, wäre kein
            Zwischenstand, den jemand gewollt hat.

            `formAction` statt eines eigenen `<form>`: Dieser Knopf steht im
            Formular der Fassung, und ein `<form>` darin würde still verworfen.
          */}
          <button
            type="submit"
            formAction={entfernen}
            className="text-[11.5px] text-stiller hover:text-akzent"
          >
            Eigene Medien verwerfen
          </button>
        </div>
      )}

      <MedienDialog
        offen={offen}
        schliessen={() => setOffen(false)}
        postId={postId}
        varianteId={varianteId}
        titel={
          typ === 'REEL'
            ? 'Video und Thumbnail dieser Fassung'
            : typ === 'KARUSSELL'
              ? 'Karussell-Bilder dieser Fassung'
              : 'Grafik dieser Fassung'
        }
        typ={typ}
        verhaeltnis={verhaeltnis}
        videoUrl={video?.quelle?.url ?? null}
        videoHerkunft={video?.quelle?.herkunft ?? null}
        thumbnailUrl={video?.thumbnailUrl ?? null}
        thumbnailAutomatisch={video?.thumbnailAutomatisch}
        videoQuellen={
          video ? (
            <VideoQuellen
              postId={postId}
              varianteId={varianteId}
              kundeSlug={kundeSlug}
              klappe={video.klappe}
              downloadstand={video.downloadstand}
              videoDownloadUrl={video.videoDownloadUrl}
            />
          ) : null
        }
      />
    </div>
  )
}
