'use client'

import { useState } from 'react'
import { FeedRaster, type FeedKachel } from '@/components/feed'
import { IPhoneFeed } from '@/components/iphone'
import { Hinweis, Knopf } from '@/components/ui'

/** Ein Schub — fünf volle Reihen im Profilraster. */
const SCHRITT = 15

/**
 * Feed-Vorschau im großen Geräterahmen. Geladen wird in Schüben: ein Profil
 * mit hundert Kacheln braucht niemand auf einmal, und die ersten fünfzehn
 * entscheiden, ob das Raster stimmt.
 */
export function FeedPlanung({
  kunde,
  kacheln,
}: {
  kunde: {
    name: string
    handle: string | null
    logo: string | null
    beitraege: number | null
    follower: number | null
    gefolgt: number | null
  }
  kacheln: FeedKachel[]
}) {
  const [sichtbar, setSichtbar] = useState(SCHRITT)
  const gezeigt = kacheln.slice(0, sichtbar)
  const rest = kacheln.length - gezeigt.length

  return (
    <div className="flex flex-wrap items-start gap-10">
      <div className="shrink-0">
        <IPhoneFeed
          gross
          kunde={kunde.name}
          handle={kunde.handle}
          logo={kunde.logo}
          beitraege={kunde.beitraege}
          follower={kunde.follower}
          gefolgt={kunde.gefolgt}
          kacheln={gezeigt.map((k) => ({
            id: k.id,
            typ: k.typ,
            titel: k.titel,
            bild: k.bild,
            href: k.href,
          }))}
          fuss={
            rest > 0 ? (
              <button
                type="button"
                onClick={() => setSichtbar((n) => n + SCHRITT)}
                className="shrink-0 border-t border-grund py-3 text-center text-[12px] font-medium text-tinte transition-colors hover:bg-flaeche-leise"
              >
                Mehr anzeigen · noch {rest}
              </button>
            ) : null
          }
        />
      </div>

      <div className="max-w-[420px] flex-1">
        <Hinweis>
          So sieht das Profil mit <strong>allen</strong> Posts aus — auch mit denen, die noch nicht
          zur Freigabe verschickt wurden. Auf der Export-Seite sieht der Kunde nur, was für seinen
          Zeitraum freigegeben ist.
        </Hinweis>

        <div className="mt-4 rounded-md border border-rahmen bg-flaeche p-4">
          <h3 className="mb-2.5 text-[12.5px] font-medium text-tinte">Mit Status je Kachel</h3>
          <FeedRaster kacheln={gezeigt} statusZeigen />

          {rest > 0 && (
            <div className="mt-3 flex justify-center">
              <Knopf klein onClick={() => setSichtbar((n) => n + SCHRITT)}>
                Mehr anzeigen · noch {rest}
              </Knopf>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
