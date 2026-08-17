'use client'

import { useRef, useState, type TouchEvent } from 'react'
import { teileCaption } from './post-sektion'

/**
 * Wie ein Beitrag auf LinkedIn aussieht — je Beitrag, **kein Raster**.
 *
 * Bewusst ohne Geräterahmen, anders als bei Instagram. Der Rahmen dort ist
 * nicht Zierde: Instagram *ist* eine Telefon-App, und im Raster entscheidet der
 * Ausschnitt über die Wirkung. LinkedIn wird genauso am Rechner gelesen, und
 * ein Profilraster, in dem sich Kacheln zu einem Bild fügen, gibt es dort
 * nicht — ein nachgebautes Telefon würde etwas behaupten, was nicht stimmt.
 *
 * Gezeigt wird deshalb, was LinkedIn wirklich zeigt: Absender, Text, Medien.
 * Mehrere Bilder **werden geblättert**, nicht nebeneinandergelegt: LinkedIn hat
 * Karussells. (Hier stand eine Weile das Gegenteil — die Annahme war falsch,
 * und ein Beitrag, dessen Bilder in der Vorschau alle gleichzeitig zu sehen
 * sind, wirkt anders als einer, durch den man wischt.)
 */
export function LinkedInVorschau({
  kunde,
  logo,
  follower,
  text,
  medien,
  istVideo,
  thumbnail,
}: {
  kunde: string
  logo: string | null
  follower: number | null
  text: string
  medien: string[]
  istVideo: boolean
  /** Beim Video steht das Standbild — bewegt wird hier nichts. */
  thumbnail?: string | null
}) {
  const { text: fliesstext, hashtags } = teileCaption(text)
  const bilder = istVideo ? [thumbnail].filter((b): b is string => Boolean(b)) : medien

  return (
    <div className="max-w-[600px] overflow-hidden rounded-[6px] border border-rahmen bg-flaeche">
      {/* -------------------------------------------------------- Absender */}
      <div className="flex items-center gap-3 px-4 pt-4">
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt="" className="size-11 shrink-0 rounded-full object-cover" />
        ) : (
          <span className="schraffur size-11 shrink-0 rounded-full border border-dashed border-rahmen-3" />
        )}
        <div className="min-w-0">
          <div className="truncate text-[13.5px] font-semibold text-tinte">{kunde}</div>
          <div className="text-[11.5px] text-leiser">
            {follower !== null
              ? `${new Intl.NumberFormat('de-DE').format(follower)} Follower`
              : 'Firmenseite'}
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------ Text */}
      <div className="px-4 pb-3 pt-3">
        <p className="whitespace-pre-line text-[13.5px] leading-[1.6] text-[#2e2b28]">
          {fliesstext || '—'}
        </p>
        {hashtags && <p className="mt-2 text-[12.5px] leading-[1.55] text-leise">{hashtags}</p>}
      </div>

      {/* ----------------------------------------------------------- Medien */}
      {bilder.length > 0 && <Blaetterflaeche bilder={bilder} istVideo={istVideo} />}

      {/* Die Leiste ist sichtbar, aber nicht bedienbar — wie beim
          Geräterahmen von Instagram. Sie sagt „so sieht es aus", nicht
          „hier kannst du klicken". */}
      <div className="flex items-center gap-6 border-t border-rahmen px-4 py-2.5 text-[11.5px] text-stiller">
        <span>Gefällt mir</span>
        <span>Kommentieren</span>
        <span>Teilen</span>
        <span>Senden</span>
      </div>
    </div>
  )
}

/**
 * Ein Bild, dazu die Wege weiter: Pfeile beim Überfahren, Punkte zum Springen,
 * Wischen am Telefon — dieselben Gesten wie im Instagram-Karussell.
 *
 * Eigen statt `KarussellFlaeche` wiederverwendet: Die ist auf die 320 px des
 * Geräterahmens und eine feste Flächenhöhe gebaut. LinkedIn zeigt Bilder in
 * ihrer eigenen Höhe, nur nach oben begrenzt — die Fläche vorzuschreiben hieße,
 * jedes Bild in einen Ausschnitt zu zwingen, den LinkedIn gar nicht macht.
 */
function Blaetterflaeche({ bilder, istVideo }: { bilder: string[]; istVideo: boolean }) {
  const [aktiv, setAktiv] = useState(0)
  const start = useRef<{ x: number; y: number } | null>(null)

  function wischEnde(e: TouchEvent) {
    if (!start.current) return
    const dx = e.changedTouches[0].clientX - start.current.x
    const dy = e.changedTouches[0].clientY - start.current.y
    start.current = null

    // Nur waagerechte Gesten zählen — sonst blättert jedes Scrollen weiter.
    if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return
    setAktiv((i) => (dx < 0 ? Math.min(bilder.length - 1, i + 1) : Math.max(0, i - 1)))
  }

  const bild = bilder[Math.min(aktiv, bilder.length - 1)]

  return (
    <div>
      <div
        className="group relative touch-pan-y bg-rahmen-3"
        onTouchStart={(e) => {
          start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
        }}
        onTouchEnd={wischEnde}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={bild}
          alt={bilder.length > 1 ? `Bild ${aktiv + 1}` : ''}
          className="block w-full object-cover"
          // LinkedIn beschneidet Beitragsbilder nicht wie Instagram sein
          // Raster; höher als 4:5 wird nur der Anzeigebereich begrenzt.
          style={{ maxHeight: 520 }}
        />

        {istVideo && (
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-black/55">
              <svg viewBox="0 0 24 24" className="ml-0.5 size-5 fill-white">
                <path d="M8 5v14l11-7z" />
              </svg>
            </span>
          </span>
        )}

        {bilder.length > 1 && (
          <>
            <span className="absolute right-3 top-3 z-10 rounded-[10px] bg-black/55 px-2.5 py-[3px] font-mono text-[10px] text-white">
              {aktiv + 1}/{bilder.length}
            </span>
            <Pfeil
              richtung="links"
              aus={aktiv === 0}
              aufKlick={() => setAktiv((i) => Math.max(0, i - 1))}
            />
            <Pfeil
              richtung="rechts"
              aus={aktiv >= bilder.length - 1}
              aufKlick={() => setAktiv((i) => Math.min(bilder.length - 1, i + 1))}
            />
          </>
        )}
      </div>

      {bilder.length > 1 && (
        <div className="flex items-center justify-center gap-px py-2">
          {bilder.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setAktiv(i)}
              aria-label={`Zu Bild ${i + 1}`}
              aria-current={i === aktiv}
              className="block cursor-pointer rounded-full px-[2px] py-1 transition-opacity hover:opacity-60"
            >
              <span
                className="block size-1.5 rounded-full"
                style={{ background: i === aktiv ? '#57534f' : '#d5d1cc' }}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function Pfeil({
  richtung,
  aus,
  aufKlick,
}: {
  richtung: 'links' | 'rechts'
  aus: boolean
  aufKlick: () => void
}) {
  return (
    <button
      type="button"
      onClick={aufKlick}
      disabled={aus}
      aria-label={richtung === 'links' ? 'Vorheriges Bild' : 'Nächstes Bild'}
      className={`absolute top-1/2 z-20 flex size-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-black/45 text-white opacity-0 backdrop-blur-sm transition-opacity duration-500 group-hover:opacity-100 focus-visible:opacity-100 disabled:group-hover:opacity-0 ${
        richtung === 'links' ? 'left-2' : 'right-2'
      }`}
    >
      <span
        aria-hidden
        className={`block size-0 border-y-[6px] border-y-transparent ${
          richtung === 'links'
            ? 'mr-0.5 border-r-[9px] border-r-white'
            : 'ml-0.5 border-l-[9px] border-l-white'
        }`}
      />
    </button>
  )
}
