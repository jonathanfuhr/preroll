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
 * Mehrere Bilder liegen bei LinkedIn nicht als Karussell zum Wischen, sondern
 * als Beitrag mit mehreren Bildern nebeneinander — also stehen sie hier auch so.
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
      {bilder.length > 0 && (
        <div className={`flex gap-px bg-rahmen-3 ${bilder.length > 1 ? '' : 'block'}`}>
          {bilder.map((bild, i) => (
            <div key={bild} className="relative min-w-0 flex-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={bild}
                alt={bilder.length > 1 ? `Bild ${i + 1}` : ''}
                className="block w-full object-cover"
                // LinkedIn beschneidet Beitragsbilder nicht wie Instagram sein
                // Raster; höher als 4:5 wird nur der Anzeigebereich begrenzt.
                style={{ maxHeight: 520 }}
              />
              {istVideo && i === 0 && (
                <span className="absolute inset-0 flex items-center justify-center">
                  <span className="flex size-12 items-center justify-center rounded-full bg-black/55">
                    <svg viewBox="0 0 24 24" className="ml-0.5 size-5 fill-white">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </span>
                </span>
              )}
            </div>
          ))}
        </div>
      )}

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
