import type { PostTyp, Verhaeltnis } from '@prisma/client'
import { KarussellFlaeche } from './karussell-blaettern'
import { Sprung } from './sprung'
import { flaechenHoehe, VERHAELTNIS_MASSE, VERHAELTNIS_TEXT } from '@/lib/verhaeltnis'
import { ReelFlaeche, ReelRahmen, ReelTonKnopf } from './reel-player'
import type { ReactNode } from 'react'

/**
 * Geräterahmen aus dem Mockup `iPhone-Layer.dc.html`:
 * 344 × 645 px außen, 320 × 621 px Bildschirm, Reel-Fläche 320 × 569 px.
 * Uhrzeit und Batterie sind fix — sie sollen echt wirken, nicht aktuell sein.
 */

export function Geraet({
  dunkel,
  zusatz,
  children,
}: {
  dunkel?: boolean
  /** Zusätzliche Klassen am Rahmen, etwa `geraet-gross`. */
  zusatz?: string
  children: ReactNode
}) {
  return (
    <div className={zusatz ? `geraet ${zusatz}` : 'geraet'}>
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

export function Avatar({ bild, groesse = 34 }: { bild?: string | null; groesse?: number }) {
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

function Platzhalter({ text, aufKlick }: { text: string; aufKlick?: () => void }) {
  const inhalt = (
    <>
      <span className="rounded-[3px] bg-white/85 px-2.5 py-1 font-mono text-[11px] text-leiser">
        {text}
      </span>
      {aufKlick && (
        <span className="mt-2 rounded-[5px] bg-akzent px-3 py-1.5 text-[11.5px] font-medium text-white">
          Datei hochladen
        </span>
      )}
    </>
  )

  // Im Bearbeitungsmodus ist die leere Medienfläche selbst die Ablage — dort
  // erwartet man sie, nicht in einem Formular weiter unten.
  return aufKlick ? (
    <button
      type="button"
      onClick={aufKlick}
      className="schraffur flex h-full w-full cursor-pointer flex-col items-center justify-center transition-opacity hover:opacity-80"
    >
      {inhalt}
    </button>
  ) : (
    <div className="schraffur flex h-full w-full flex-col items-center justify-center">{inhalt}</div>
  )
}

/** Kleiner Knopf über einem vorhandenen Medium, zum Ersetzen. */
function ErsetzenKnopf({ aufKlick }: { aufKlick: () => void }) {
  return (
    <button
      type="button"
      onClick={aufKlick}
      className="absolute right-2 top-2 z-10 rounded-[4px] bg-black/55 px-2.5 py-1 text-[10.5px] font-medium text-white backdrop-blur transition-colors hover:bg-black/75"
    >
      ersetzen
    </button>
  )
}

// ----------------------------------------------------------------- Beitrag 3:4

export function IPhoneBeitrag({
  kunde,
  logo,
  bild,
  caption,
  verhaeltnis,
  istVideo,
  thumbnail,
  aufUpload,
}: {
  kunde: string
  logo?: string | null
  bild?: string | null
  caption: string
  verhaeltnis: Verhaeltnis
  /** Ein Video im Feed — 1:1 oder 16:9. Hochkant wäre es ein Reel. */
  istVideo?: boolean
  thumbnail?: string | null
  aufUpload?: () => void
}) {
  const inhalt = (
    // Die Höhe folgt dem Verhältnis, damit die Vorschau nicht lügt.
    <div
      className="relative w-[320px] shrink-0 border-y border-grund"
      style={{ height: flaechenHoehe(verhaeltnis) }}
    >
      {bild ? (
        <>
          {aufUpload && <ErsetzenKnopf aufKlick={aufUpload} />}
          {istVideo ? (
            <ReelFlaeche />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={bild} alt="" className="h-full w-full object-cover" />
          )}
        </>
      ) : (
        <Platzhalter
          text={`${istVideo ? 'Video' : 'Grafik'} ${VERHAELTNIS_TEXT[verhaeltnis]} · ${VERHAELTNIS_MASSE[verhaeltnis]}`}
          aufKlick={aufUpload}
        />
      )}
    </div>
  )

  const rahmen = (
    <Geraet>
      <Statusleiste />
      <Kopfzeile name={kunde} logo={logo} />
      {inhalt}
      <Aktionsleiste />
      <Caption name={kunde} text={caption} />
    </Geraet>
  )

  // Ein Video braucht den Player-Zusammenhang; ein Bild nicht.
  return istVideo ? (
    <ReelRahmen quelle={bild ?? null} thumbnail={thumbnail ?? null}>
      {rahmen}
    </ReelRahmen>
  ) : (
    rahmen
  )
}

// --------------------------------------------------------------- Karussell 3:4

export function IPhoneKarussell({
  kunde,
  logo,
  slides,
  caption,
  verhaeltnis,
  aufUpload,
}: {
  kunde: string
  logo?: string | null
  slides: string[]
  caption: string
  verhaeltnis: Verhaeltnis
  aufUpload?: () => void
}) {
  return (
    <Geraet>
      <Statusleiste />
      <Kopfzeile name={kunde} logo={logo} />

      {/* Blättern liegt im eigenen Bauteil — dafür braucht es Zustand. */}
      <KarussellFlaeche
        slides={slides}
        verhaeltnis={verhaeltnis}
        aufUpload={aufUpload}
        ersetzenKnopf={aufUpload ? <ErsetzenKnopf aufKlick={aufUpload} /> : null}
      />

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
  aufUpload,
  thumbnail,
}: {
  kunde: string
  logo?: string | null
  medium?: string | null
  istVideo?: boolean
  caption: string
  aufUpload?: () => void
  /** Steht vor dem Video, solange nichts läuft. */
  thumbnail?: string | null
}) {
  return (
    <ReelRahmen
      quelle={istVideo ? (medium ?? null) : null}
      thumbnail={thumbnail ?? null}
      tonKnopfAussen={false}
    >
      <Geraet dunkel>
      <div
        className="relative h-[569px] w-[320px] shrink-0 overflow-hidden"
        style={{
          background: 'repeating-linear-gradient(135deg,#2b2724 0 8px,#343029 8px 16px)',
        }}
      >
        {medium ? (
          istVideo ? (
            <ReelFlaeche />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={medium} alt="" className="absolute inset-0 h-full w-full object-cover" />
          )
        ) : aufUpload ? (
          <button
            type="button"
            onClick={aufUpload}
            className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 transition-opacity hover:opacity-80"
          >
            <span className="rounded-[3px] bg-black/40 px-2.5 py-1.5 font-mono text-[11px] text-white/80">
              Reel 9:16 · 1080 × 1920
            </span>
            <span className="rounded-[5px] bg-akzent px-3 py-1.5 text-[11.5px] font-medium text-white">
              Datei hochladen
            </span>
          </button>
        ) : (
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-[3px] bg-black/40 px-2.5 py-1.5 font-mono text-[11px] text-white/80">
            Reel 9:16 · 1080 × 1920
          </span>
        )}

        {medium && aufUpload && <ErsetzenKnopf aufKlick={aufUpload} />}

        <div className="relative z-10">
          <Statusleiste hell />
          <div className="flex items-center justify-between px-4 pt-1.5">
            <span
              className="text-[16px] font-semibold text-white"
              style={{ fontFamily: '-apple-system, Helvetica, Arial, sans-serif' }}
            >
              Reels
            </span>
            {/* Ton links, Kamera rechts — so steht es bei Instagram. Die
                Kamera bleibt Zierde, der Ton ist bedienbar. */}
            <span className="flex items-center gap-3.5">
              <ReelTonKnopf />
              <span className="block h-4 w-[18px] rounded-[4px] border-[1.5px] border-white/85" />
            </span>
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
    </ReelRahmen>
  )
}

// ------------------------------------------------------------- Feed-Raster

function RasterIcon({ aktiv }: { aktiv?: boolean }) {
  return (
    <span className="grid grid-cols-3 gap-[2px]">
      {Array.from({ length: 9 }, (_, i) => (
        <span
          key={i}
          className="block size-[3.5px]"
          style={{ background: aktiv ? '#1c1a18' : '#c9c4be' }}
        />
      ))}
    </span>
  )
}

/**
 * Profilraster im Geräterahmen — Mockup 3d. Zeigt, wie das Instagram-Profil
 * nach der geplanten Periode aussieht: drei Kacheln je Reihe im Verhältnis
 * 3:4, neueste oben links.
 *
 * Das Gerät behält seine Maße; gerollt wird **darin**, wie am echten
 * Telefon. Die Statusleiste bleibt dabei stehen — Uhrzeit und Akku wandern
 * nicht mit dem Profil weg.
 */
export function IPhoneFeed({
  kunde,
  handle,
  logo,
  beitraege,
  follower,
  gefolgt,
  kacheln,
  gross,
  fuss,
}: {
  kunde: string
  handle?: string | null
  logo?: string | null
  beitraege?: number | null
  follower?: number | null
  gefolgt?: number | null
  kacheln: Array<{ id: string; bild: string | null; typ: PostTyp; titel: string; href?: string }>
  /** Vergrößert den Rahmen. */
  gross?: boolean
  /** Steht unter dem Raster im Schirm — etwa „Mehr anzeigen". */
  fuss?: ReactNode
}) {
  const zahl = (wert?: number | null) =>
    wert === null || wert === undefined ? '—' : new Intl.NumberFormat('de-DE').format(wert)

  return (
    <Geraet zusatz={gross ? 'geraet-gross' : undefined}>
      {/* Steht auf Weiß und bleibt stehen — der Inhalt rollt darunter durch. */}
      <div className="shrink-0 bg-flaeche">
        <Statusleiste />
      </div>

      <div
        // Ohne `overscroll-contain`: Am Ende der Liste rollt die Seite weiter.
        // Sonst säße man am Telefon in einem Rahmen fest, der nicht loslässt.
        className="flex min-h-0 flex-1 flex-col overflow-y-auto"
      >
        <div className="flex shrink-0 items-center justify-between gap-2.5 px-4 pb-3">
          <span className="truncate text-[13px] font-semibold text-tinte">{handle ?? kunde}</span>
          <span className="tracking-[2px] text-[14px] text-rahmen-4">···</span>
        </div>

        <div className="flex shrink-0 items-center gap-5 px-4 pb-3">
          <Avatar bild={logo} groesse={62} />
          <div className="flex flex-1 justify-around">
            {[
              { wert: beitraege, text: 'Beiträge' },
              { wert: follower, text: 'Follower' },
              { wert: gefolgt, text: 'gefolgt' },
            ].map((k) => (
              <div key={k.text} className="grid justify-items-center gap-1">
                <span className="text-[13px] font-semibold text-tinte">{zahl(k.wert)}</span>
                <span className="text-[9.5px] text-still">{k.text}</span>
              </div>
            ))}
        </div>
      </div>

      <div className="shrink-0 px-4 pb-3">
        <span className="text-[11.5px] font-semibold text-tinte">{kunde}</span>
      </div>

      <div className="flex shrink-0 border-t border-grund">
        <div className="flex flex-1 items-center justify-center border-b-[1.5px] border-tinte py-2.5">
          <RasterIcon aktiv />
        </div>
        <div className="flex flex-1 items-center justify-center border-b-[1.5px] border-transparent py-2.5">
          <span className="block size-[13px] rotate-45 rounded-[3px] border-[1.6px] border-rahmen-4" />
        </div>
      </div>

      <div className="grid grid-cols-3 content-start gap-[2px] pt-[2px]">
        {kacheln.length === 0 ? (
          <span className="schraffur col-span-3 flex aspect-[12/5] items-center justify-center font-mono text-[10px] text-leiser">
            Noch keine Beiträge
          </span>
        ) : (
          kacheln.map((kachel) => (
            <Kachelrahmen key={kachel.id} href={kachel.href}>
              {kachel.bild ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={kachel.bild} alt={kachel.titel} className="h-full w-full object-cover" />
              ) : (
                <span className="schraffur flex h-full w-full items-center justify-center px-1 text-center font-mono text-[8px] leading-tight text-leiser">
                  {kachel.titel}
                </span>
              )}
              {kachel.typ === 'REEL' && (
                <span
                  aria-hidden
                  className="absolute right-1.5 top-1.5 block size-0 border-y-[5.5px] border-l-[9px] border-y-transparent border-l-white drop-shadow"
                />
              )}
              {kachel.typ === 'KARUSSELL' && (
                <span
                  aria-hidden
                  className="absolute right-1.5 top-1.5 block size-2 rounded-[2px] border-[1.5px] border-white drop-shadow"
                  style={{ boxShadow: '3px -3px 0 -1px #fff' }}
                />
              )}
            </Kachelrahmen>
          ))
        )}
        </div>

        {fuss}
      </div>
    </Geraet>
  )
}

/** Kachel im Profilraster — verlinkt, wenn ein Ziel mitkommt. */
function Kachelrahmen({ href, children }: { href?: string; children: ReactNode }) {
  const klassen = 'relative block aspect-[3/4] overflow-hidden bg-flaeche-tief'
  return href ? (
    <Sprung href={href} className={klassen}>
      {children}
    </Sprung>
  ) : (
    <div className={klassen}>{children}</div>
  )
}

/** Wählt anhand des Typs den passenden Rahmen. */
export function IPhoneVorschau({
  typ,
  verhaeltnis,
  kunde,
  logo,
  medien,
  caption,
  istVideo,
  aufUpload,
  thumbnail,
}: {
  typ: PostTyp
  verhaeltnis: Verhaeltnis
  kunde: string
  logo?: string | null
  medien: string[]
  caption: string
  istVideo?: boolean
  /** Gesetzt im Editor — dann ist die Medienfläche selbst die Ablage. */
  aufUpload?: () => void
  /** Beim Reel: steht vor dem Video, solange nichts läuft. */
  thumbnail?: string | null
}) {
  // Nur hochkant füllt ein Video den Schirm — so sieht ein Reel aus. Quer
  // oder quadratisch erscheint dasselbe Video im Feed, zwischen Kopfzeile
  // und Caption; es dort bildschirmfüllend zu zeigen wäre gelogen.
  if (typ === 'REEL' && verhaeltnis === 'VERTIKAL_9_16') {
    return (
      <IPhoneReel
        kunde={kunde}
        logo={logo}
        medium={medien[0]}
        istVideo={istVideo}
        caption={caption}
        aufUpload={aufUpload}
        thumbnail={thumbnail}
      />
    )
  }
  if (typ === 'KARUSSELL') {
    return (
      <IPhoneKarussell
        kunde={kunde}
        logo={logo}
        slides={medien}
        caption={caption}
        verhaeltnis={verhaeltnis}
        aufUpload={aufUpload}
      />
    )
  }
  return (
    <IPhoneBeitrag
      kunde={kunde}
      logo={logo}
      bild={medien[0]}
      caption={caption}
      verhaeltnis={verhaeltnis}
      istVideo={typ === 'REEL' && istVideo}
      thumbnail={thumbnail}
      aufUpload={aufUpload}
    />
  )
}
