import type { PostTyp } from '@prisma/client'
import type { ReactNode } from 'react'

/**
 * Geräterahmen aus dem Mockup `iPhone-Layer.dc.html`:
 * 344 × 645 px außen, 320 × 621 px Bildschirm, Reel-Fläche 320 × 569 px.
 * Uhrzeit und Batterie sind fix — sie sollen echt wirken, nicht aktuell sein.
 */

export function Geraet({ dunkel, children }: { dunkel?: boolean; children: ReactNode }) {
  return (
    <div className="geraet">
      <div className="geraet-innen">
        <div className="geraet-schirm" style={dunkel ? { background: '#000' } : undefined}>
          {children}
        </div>
      </div>
    </div>
  )
}

export function Statusleiste({ hell }: { hell?: boolean }) {
  const farbe = hell ? '#fff' : '#000'
  return (
    <div
      className="relative flex h-[42px] shrink-0 items-center justify-between px-[22px]"
      style={{ fontFamily: '-apple-system, "Helvetica Neue", Helvetica, Arial, sans-serif' }}
    >
      <span className="text-[13px] font-semibold" style={{ color: farbe }}>
        15:15
      </span>
      <div className="absolute left-1/2 top-1.5 h-[26px] w-[84px] -translate-x-1/2 rounded-[13px] bg-geraet" />
      <div className="flex items-end gap-1.5">
        <div className="flex items-end gap-0.5">
          {[4, 6, 8, 10].map((h) => (
            <span key={h} className="block w-[3px] rounded-[1px]" style={{ height: h, background: farbe }} />
          ))}
        </div>
        <div
          className="relative h-[11px] w-[23px] rounded-[3px] p-[1.5px]"
          style={{ border: `1.4px solid ${farbe}` }}
        >
          <span className="block h-full w-[60%] rounded-[1px]" style={{ background: farbe }} />
        </div>
      </div>
    </div>
  )
}

function Avatar({ bild, groesse = 34 }: { bild?: string | null; groesse?: number }) {
  return bild ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={bild}
      alt=""
      className="shrink-0 rounded-full object-cover"
      style={{ width: groesse, height: groesse }}
    />
  ) : (
    <div
      className="schraffur flex shrink-0 items-center justify-center rounded-full border border-dashed border-rahmen-3 font-mono text-leiser"
      style={{ width: groesse, height: groesse, fontSize: groesse * 0.2 }}
    >
      Logo
    </div>
  )
}

export function Kopfzeile({ name, logo }: { name: string; logo?: string | null }) {
  return (
    <div className="flex shrink-0 items-center gap-2.5 px-3.5 pb-2.5 pt-1">
      <Avatar bild={logo} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[12px] font-semibold text-tinte">{name}</div>
      </div>
      <span className="tracking-[2px] text-[14px] text-rahmen-4">···</span>
    </div>
  )
}

function Herz() {
  return <span className="text-[21px] leading-none">♡</span>
}

function Sprechblase() {
  return (
    <svg width="18" height="16" viewBox="0 0 18 16" aria-hidden>
      <rect x="0.9" y="0.9" width="16.2" height="13" rx="4.5" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M4 13.5 L4 16 L7 13.5 Z" fill="currentColor" />
    </svg>
  )
}

function Papierflieger() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <polygon
        points="16.2,2 1.8,8.2 8.2,10.1 10.2,16.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function Aktionsleiste() {
  return (
    <div className="flex shrink-0 items-center gap-[18px] px-3.5 pb-2.5 pt-3 text-tinte-3">
      <Herz />
      <Sprechblase />
      <Papierflieger />
      <span className="flex-1" />
      <span
        className="block h-[17px] w-[14px] border-[1.7px] border-current"
        style={{ clipPath: 'polygon(0 0,100% 0,100% 100%,50% 74%,0 100%)' }}
      />
    </div>
  )
}

export function Caption({ name, text }: { name: string; text: string }) {
  return (
    <div className="min-h-0 flex-1 overflow-hidden px-3.5">
      <p className="whitespace-pre-wrap text-[10.5px] leading-[1.75] text-tinte-3">
        <span className="font-bold text-tinte">{name}</span>{' '}
        <span className="text-leise">{text}</span>
      </p>
    </div>
  )
}

function Platzhalter({ text }: { text: string }) {
  return (
    <div className="schraffur flex h-full w-full items-center justify-center">
      <span className="rounded-[3px] bg-white/85 px-2.5 py-1 font-mono text-[11px] text-leiser">
        {text}
      </span>
    </div>
  )
}

// ----------------------------------------------------------------- Beitrag 4:5

export function IPhoneBeitrag({
  kunde,
  logo,
  bild,
  caption,
}: {
  kunde: string
  logo?: string | null
  bild?: string | null
  caption: string
}) {
  return (
    <Geraet>
      <Statusleiste />
      <Kopfzeile name={kunde} logo={logo} />
      <div className="h-[400px] w-[320px] shrink-0 border-y border-grund">
        {bild ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={bild} alt="" className="h-full w-full object-cover" />
        ) : (
          <Platzhalter text="Grafik 4:5 · 1080 × 1350" />
        )}
      </div>
      <Aktionsleiste />
      <Caption name={kunde} text={caption} />
    </Geraet>
  )
}

// --------------------------------------------------------------- Karussell 4:5

export function IPhoneKarussell({
  kunde,
  logo,
  slides,
  caption,
  aktiv = 0,
}: {
  kunde: string
  logo?: string | null
  slides: string[]
  caption: string
  aktiv?: number
}) {
  const anzahl = Math.max(slides.length, 1)
  return (
    <Geraet>
      <Statusleiste />
      <Kopfzeile name={kunde} logo={logo} />
      <div className="relative h-[400px] w-[320px] shrink-0 border-y border-grund">
        {slides[aktiv] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={slides[aktiv]} alt="" className="h-full w-full object-cover" />
        ) : (
          <Platzhalter text={`Slide ${aktiv + 1} · 4:5`} />
        )}
        <span className="absolute right-3 top-2.5 rounded-[10px] bg-black/55 px-2.5 py-[3px] font-mono text-[9.5px] text-white">
          {aktiv + 1}/{anzahl}
        </span>
      </div>
      <div className="flex shrink-0 items-center justify-center gap-[5px] pb-0.5 pt-2.5">
        {Array.from({ length: anzahl }, (_, i) => (
          <span
            key={i}
            className="block size-1.5 rounded-full"
            style={{ background: i === aktiv ? '#57534f' : '#d5d1cc' }}
          />
        ))}
      </div>
      <Aktionsleiste />
      <Caption name={kunde} text={caption} />
    </Geraet>
  )
}

// -------------------------------------------------------------------- Reel 9:16

export function IPhoneReel({
  kunde,
  logo,
  medium,
  istVideo,
  caption,
}: {
  kunde: string
  logo?: string | null
  medium?: string | null
  istVideo?: boolean
  caption: string
}) {
  return (
    <Geraet dunkel>
      <div
        className="relative h-[569px] w-[320px] shrink-0 overflow-hidden"
        style={{
          background: 'repeating-linear-gradient(135deg,#2b2724 0 8px,#343029 8px 16px)',
        }}
      >
        {medium ? (
          istVideo ? (
            <video
              src={medium}
              className="absolute inset-0 h-full w-full object-cover"
              muted
              loop
              playsInline
              controls
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={medium} alt="" className="absolute inset-0 h-full w-full object-cover" />
          )
        ) : (
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-[3px] bg-black/40 px-2.5 py-1.5 font-mono text-[11px] text-white/80">
            Reel 9:16 · 1080 × 1920
          </span>
        )}

        <div className="relative z-10">
          <Statusleiste hell />
          <div className="flex items-center justify-between px-4 pt-1.5">
            <span
              className="text-[16px] font-semibold text-white"
              style={{ fontFamily: '-apple-system, Helvetica, Arial, sans-serif' }}
            >
              Reels
            </span>
            <span className="block h-4 w-[18px] rounded-[4px] border-[1.5px] border-white/85" />
          </div>
        </div>

        <div className="absolute bottom-[112px] right-3 z-10 grid justify-items-center gap-[18px] text-white/90">
          <div className="grid justify-items-center gap-1.5">
            <Herz />
            <span className="block h-[7px] w-5 rounded-[3px] bg-white/30" />
          </div>
          <div className="grid justify-items-center gap-1.5">
            <Sprechblase />
            <span className="block h-[7px] w-5 rounded-[3px] bg-white/30" />
          </div>
          <div className="grid justify-items-center gap-1.5">
            <Papierflieger />
            <span className="block h-[7px] w-5 rounded-[3px] bg-white/30" />
          </div>
          <span className="text-[15px] leading-none tracking-[2px] text-white/90">···</span>
        </div>

        <div className="absolute bottom-4 left-3.5 right-16 z-10 grid gap-2">
          <div className="flex items-center gap-2.5">
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo} alt="" className="size-[30px] shrink-0 rounded-full object-cover" />
            ) : (
              <span className="size-[30px] shrink-0 rounded-full border border-dashed border-white/60 bg-white/15" />
            )}
            <span className="text-[12px] font-semibold text-white">{kunde}</span>
            <span
              className="rounded-[4px] border border-white/60 px-2 py-[3px] text-[10.5px] text-white"
              style={{ fontFamily: '-apple-system, Helvetica, Arial, sans-serif' }}
            >
              Folgen
            </span>
          </div>
          <p className="line-clamp-2 text-[11px] leading-snug text-white/90">{caption}</p>
        </div>
      </div>

      {/* Kommentarzeile gibt es nur beim Reel — sichtbar, aber nicht bedienbar. */}
      <div className="flex h-[52px] shrink-0 items-center gap-2.5 bg-[#141210] px-3.5 opacity-85">
        <span className="size-[26px] shrink-0 rounded-full border border-dashed border-white/35 bg-white/10" />
        <span
          className="flex h-[30px] min-w-0 flex-1 items-center rounded-[15px] border border-white/20 bg-white/5 px-3 text-[11.5px] text-white/45"
          style={{ fontFamily: '-apple-system, Helvetica, Arial, sans-serif' }}
        >
          Kommentar hinzufügen …
        </span>
      </div>
    </Geraet>
  )
}

/** Wählt anhand des Typs den passenden Rahmen. */
export function IPhoneVorschau({
  typ,
  kunde,
  logo,
  medien,
  caption,
  istVideo,
}: {
  typ: PostTyp
  kunde: string
  logo?: string | null
  medien: string[]
  caption: string
  istVideo?: boolean
}) {
  if (typ === 'REEL') {
    return (
      <IPhoneReel kunde={kunde} logo={logo} medium={medien[0]} istVideo={istVideo} caption={caption} />
    )
  }
  if (typ === 'KARUSSELL') {
    return <IPhoneKarussell kunde={kunde} logo={logo} slides={medien} caption={caption} />
  }
  return <IPhoneBeitrag kunde={kunde} logo={logo} bild={medien[0]} caption={caption} />
}
