'use client'

import { Fortschrittsbalken, type Downloadstand } from '@/components/download-fortschritt'
import { Eingabe, Knopf, Warnung } from '@/components/ui'
import { videoVonLinkLaden } from '../../video-download-aktionen'
import { KlappeFeld, type KlappeVideoWahl } from './klappe-feld'

export type KlappeAngaben = {
  eingerichtet: boolean
  projektName: string | null
  ladefehler: string | null
  videos: KlappeVideoWahl[]
  verknuepft: {
    videoId: string
    videoName: string | null
    videoUrl: string | null
    versionNummer: number | null
    standAm: string | null
    basisUrl: string | null
    fassungId: string | null
  } | null
}

/**
 * Die anderen beiden Wege zum Reel-Video — aus Klappe holen oder von einem
 * Link laden.
 *
 * Herausgelöst, weil es sie **zweimal** gibt: am Beitrag und an jeder
 * abweichenden Fassung. Inline im Editor stehend hatte eine Fassung nur den
 * Upload, und genau daran fiel auf, dass „eigene Medien" dort weniger konnte
 * als am Beitrag. Der Unterschied ist allein die Adresse des Video-Platzes.
 */
export function VideoQuellen({
  postId,
  varianteId = null,
  kundeSlug,
  klappe,
  downloadstand,
  videoDownloadUrl,
  meldung,
}: {
  postId: string
  varianteId?: string | null
  kundeSlug: string
  klappe: KlappeAngaben
  downloadstand: Downloadstand
  videoDownloadUrl: string | null
  meldung?: string
}) {
  return (
    <>
      {/* --------------------------------------------------------- Aus Klappe */}
      <div className="border-t border-rahmen pt-5">
        <h4 className="mb-2 text-[10.5px] uppercase tracking-[0.1em] text-still">
          Aus Klappe holen
        </h4>
        <p className="mb-3 text-[11.5px] leading-relaxed text-leiser">
          {varianteId
            ? 'Der Schnitt für dieses Format — in Klappe ein eigenes Video, damit beide Fassungen dort auseinanderzuhalten sind.'
            : 'Das fertige Reel aus dem Schnitt. Beim Anlegen entsteht dort automatisch das passende Video — beim Upload muss dann kein Name mehr getippt werden.'}
        </p>
        <KlappeFeld
          postId={postId}
          varianteId={varianteId}
          kundeSlug={kundeSlug}
          eingerichtet={klappe.eingerichtet}
          projektName={klappe.projektName}
          videos={klappe.videos}
          ladefehler={klappe.ladefehler}
          verknuepft={klappe.verknuepft}
          meldung={meldung}
        />
      </div>

      {/* ----------------------------------------------------- Von einem Link */}
      <div className="border-t border-rahmen pt-5">
        <p className="mb-3 text-[11.5px] leading-relaxed text-leiser">
          Instagram, TikTok, YouTube, Vimeo — alles, was sich herunterladen lässt. In der
          Konzeptphase steht hier das Vorbild, später ersetzt es das fertige Reel. Eingebettet wird
          immer die eigene Kopie, weil die Plattformen Einbettungen unvorhersehbar sperren.
        </p>

        {downloadstand.stand === 'FEHLER' && downloadstand.meldung && (
          <div className="mb-3">
            <Warnung>{downloadstand.meldung}</Warnung>
          </div>
        )}

        {downloadstand.stand === 'LAEUFT' && (
          <div className="mb-3">
            <Fortschrittsbalken stand={downloadstand} />
          </div>
        )}

        <form action={videoVonLinkLaden.bind(null, postId, varianteId)} className="grid gap-3">
          <Eingabe
            name="videoDownloadUrl"
            type="url"
            defaultValue={videoDownloadUrl ?? ''}
            placeholder="https://www.instagram.com/reel/…"
          />
          <div>
            <Knopf klein art="primaer" type="submit" disabled={downloadstand.stand === 'LAEUFT'}>
              {downloadstand.stand === 'LAEUFT' ? 'Läuft …' : 'Laden und einsetzen'}
            </Knopf>
          </div>
        </form>
      </div>
    </>
  )
}
