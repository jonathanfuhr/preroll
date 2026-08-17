import type { Plattform, Verhaeltnis } from '@prisma/client'
import { PLATTFORM_TEXT } from '@/lib/plattformen'
import { LinkedInVorschau } from './linkedin-vorschau'
import { PlattformMarken } from './plattform-marken'
import { teileCaption } from './post-sektion'
import { VERHAELTNIS_TEXT } from '@/lib/verhaeltnis'

export type AnzeigeFassung = {
  plattformen: Plattform[]
  /** Der öffentliche Name auf diesen Plattformen — @handle oder /company/…. */
  handles: string[]
  caption: string
  verhaeltnis: Verhaeltnis
  medien: string[]
  istVideo: boolean
  thumbnail: string | null
  eigeneCaption: boolean
  eigeneMedien: boolean
}

/**
 * Eine abweichende Fassung unter dem Hauptformat.
 *
 * Bewusst **kein zweiter Geräterahmen**: Der Rahmen oben zeigt den Beitrag, wie
 * er gedacht ist. Ein zweiter daneben stellte die Abweichung auf dieselbe
 * Stufe, obwohl sie eine Abweichung *von etwas* ist — und auf einem Telefon
 * hätte der Kunde zwei Rahmen übereinander, zwischen denen er scrollt.
 *
 * Was abweicht, steht ausdrücklich dabei. Ohne den Hinweis müsste der Kunde
 * zwei Texte nebeneinanderlegen, um zu sehen, ob sich überhaupt etwas geändert
 * hat.
 *
 * Für LinkedIn steht die richtige Vorschau schon bereit — dort ist die
 * Abweichung meist der Grund, warum es überhaupt eine Variante gibt.
 */
export function WeitereFassung({
  fassung,
  kunde,
  logo,
  liFollower,
}: {
  fassung: AnzeigeFassung
  kunde: string
  logo: string | null
  liFollower: number | null
}) {
  const { text, hashtags } = teileCaption(fassung.caption)

  const abweichung = [
    fassung.eigeneCaption ? 'eigene Caption' : null,
    fassung.eigeneMedien ? `eigenes Format · ${VERHAELTNIS_TEXT[fassung.verhaeltnis]}` : null,
  ].filter((x): x is string => x !== null)

  const nurLinkedIn =
    fassung.plattformen.length === 1 && fassung.plattformen[0] === 'LINKEDIN'

  return (
    <div className="mt-6 border-t border-rahmen pt-6 sm:mt-8 sm:pt-8">
      {/* ----------------------------------------------------------- Kopfzeile */}
      <div className="mb-3.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="text-[10.5px] uppercase tracking-[0.14em] text-still sm:text-[11px]">
          Anderes Format
        </span>
        <PlattformMarken plattformen={fassung.plattformen} groesse={14} klasse="text-[#9a9691]" />
        <span className="text-[12.5px] text-leise">
          {fassung.plattformen.map((p) => PLATTFORM_TEXT[p]).join(' · ')}
          {fassung.handles.length > 0 && (
            <span className="text-leiser"> · {fassung.handles.join(' · ')}</span>
          )}
        </span>
        {abweichung.length > 0 && (
          <span className="rounded-[3px] bg-flaeche-leise px-2 py-0.5 text-[11px] text-stiller">
            {abweichung.join(' · ')}
          </span>
        )}
      </div>

      {nurLinkedIn ? (
        <LinkedInVorschau
          kunde={kunde}
          logo={logo}
          follower={liFollower}
          text={fassung.caption}
          medien={fassung.medien}
          istVideo={fassung.istVideo}
          thumbnail={fassung.thumbnail}
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-8">
          <div className="min-w-0">
            <p className="max-w-[600px] whitespace-pre-line text-[13.5px] leading-[1.7] text-[#2e2b28] sm:text-[14.5px] sm:leading-[1.75]">
              {text || '—'}
            </p>
            {hashtags && (
              <p className="mt-3 max-w-[600px] text-[12.5px] leading-[1.65] text-leise sm:text-[13.5px]">
                {hashtags}
              </p>
            )}
          </div>

          {/* Die Medien in der Fläche, die zur Fassung gehört — nicht in der
              des Hauptbeitrags. Sonst zeigte die Vorschau ein Format, das so
              nirgends erscheint. */}
          {fassung.medien.length > 0 && (
            <div className="flex gap-px overflow-hidden rounded-[4px] bg-rahmen-3">
              {(fassung.istVideo && fassung.thumbnail
                ? [fassung.thumbnail]
                : fassung.medien
              ).map((bild, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={bild}
                  src={bild}
                  alt={fassung.medien.length > 1 ? `Bild ${i + 1}` : ''}
                  className="min-w-0 flex-1 object-cover"
                  style={{ aspectRatio: VERHAELTNIS_TEXT[fassung.verhaeltnis].replace(':', ' / ') }}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
