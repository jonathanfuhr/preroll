import type { PostStatus, PostTyp } from '@prisma/client'
import Link from 'next/link'
import { StatusBadge } from './ui'

export type FeedKachel = {
  id: string
  typ: PostTyp
  status: PostStatus
  titel: string
  /** Bereits mittig auf 4:5 beschnittenes Vorschaubild. */
  bild: string | null
  href?: string
}

function ReelMarker() {
  return (
    <span
      aria-hidden
      className="absolute right-1.5 top-1.5 block size-0 border-y-[5.5px] border-l-[9px] border-y-transparent border-l-white drop-shadow"
    />
  )
}

function KarussellMarker() {
  return (
    <span
      aria-hidden
      className="absolute right-1.5 top-1.5 block size-2 rounded-[2px] border-[1.5px] border-white drop-shadow"
      style={{ boxShadow: '3px -3px 0 -1px #fff' }}
    />
  )
}

/**
 * Instagram-Profilraster: drei Kacheln je Reihe im Verhältnis 4:5, neueste
 * oben links. Reel-Thumbnails liegen im 9:16-Format vor — gezeigt wird davon
 * der mittige 4:5-Ausschnitt, den `Medium.thumbPfad` bereits enthält.
 */
export function FeedRaster({
  kacheln,
  statusZeigen,
}: {
  kacheln: FeedKachel[]
  statusZeigen?: boolean
}) {
  if (kacheln.length === 0) {
    return (
      <div className="rounded-[3px] border border-dashed border-rahmen-3 bg-flaeche-leise px-6 py-10 text-center text-[12.5px] text-leiser">
        Noch keine Beiträge im Raster.
      </div>
    )
  }

  return (
    <div className="grid grid-cols-3 gap-0.5">
      {kacheln.map((kachel) => {
        const inhalt = (
          <>
            {kachel.bild ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={kachel.bild} alt={kachel.titel} className="h-full w-full object-cover" />
            ) : (
              <span className="schraffur flex h-full w-full items-center justify-center px-2 text-center font-mono text-[9px] leading-tight text-leiser">
                {kachel.titel}
              </span>
            )}
            {kachel.typ === 'REEL' && <ReelMarker />}
            {kachel.typ === 'KARUSSELL' && <KarussellMarker />}
            {statusZeigen && (
              <span className="absolute bottom-1.5 left-1.5">
                <StatusBadge status={kachel.status} klein />
              </span>
            )}
          </>
        )

        const klassen = 'relative block aspect-[4/5] overflow-hidden bg-flaeche-tief'

        return kachel.href ? (
          <Link
            key={kachel.id}
            href={kachel.href}
            className={`${klassen} transition-opacity hover:opacity-90`}
          >
            {inhalt}
          </Link>
        ) : (
          <div key={kachel.id} className={klassen}>
            {inhalt}
          </div>
        )
      })}
    </div>
  )
}

/** Profil-Kopfzeile über dem Raster — wie im Instagram-Profil. */
export function ProfilKopf({
  name,
  handle,
  logo,
  beitraege,
  follower,
  gefolgt,
  bio,
}: {
  name: string
  handle?: string | null
  logo?: string | null
  beitraege?: number | null
  follower?: number | null
  gefolgt?: number | null
  bio?: string | null
}) {
  const zahl = (wert?: number | null) =>
    wert === null || wert === undefined ? '—' : new Intl.NumberFormat('de-DE').format(wert)

  return (
    <div className="pb-3">
      <div className="mb-3 flex items-center gap-5">
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt="" className="size-[62px] shrink-0 rounded-full object-cover" />
        ) : (
          <span className="schraffur flex size-[62px] shrink-0 items-center justify-center rounded-full border border-dashed border-rahmen-3 font-mono text-[8px] text-leiser">
            Logo
          </span>
        )}
        <div className="flex flex-1 justify-around">
          {[
            { wert: beitraege, text: 'Beiträge' },
            { wert: follower, text: 'Follower' },
            { wert: gefolgt, text: 'gefolgt' },
          ].map((k) => (
            <div key={k.text} className="grid justify-items-center gap-1">
              <span className="text-[14px] font-semibold text-tinte">{zahl(k.wert)}</span>
              <span className="text-[10.5px] text-still">{k.text}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="text-[12px] font-semibold text-tinte">{name}</div>
      {handle && <div className="text-[11.5px] text-leiser">@{handle}</div>}
      {bio && <p className="mt-1 text-[11.5px] leading-relaxed text-leise">{bio}</p>}
    </div>
  )
}
