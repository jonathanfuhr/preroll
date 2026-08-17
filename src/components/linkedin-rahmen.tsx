'use client'

import type { PostTyp, Verhaeltnis } from '@prisma/client'
import { useRef, useState, type TouchEvent } from 'react'
import { VERHAELTNIS_WERT } from '@/lib/verhaeltnis'
import { teileCaption } from './post-sektion'

/**
 * Wie ein Beitrag auf LinkedIn aussieht — nach Mockup 5a–5d
 * (`design/LinkedIn-Layer.dc.html`).
 *
 * Das Mockup zeichnet 552 px; hier ist der Rahmen auf die **Breite des
 * Geräterahmens** begrenzt (344 px). Beide stehen in derselben Spalte und
 * wechseln sich über den Umschalter ab — zwei verschieden breite Vorschauen
 * ließen die Spalte bei jedem Wechsel springen. Alles darin rechnet ohnehin
 * in Anteilen, nicht in festen Pixeln.
 *
 * **Kein Geräterahmen, aber ein eigener Rahmen.** Instagram *ist* eine
 * Telefon-App, und im Profilraster entscheidet der Ausschnitt über die
 * Wirkung — deshalb dort das nachgebaute Gerät. LinkedIn wird am Rechner
 * gelesen; ein Telefon davor würde etwas behaupten, was nicht stimmt. Ohne
 * jeden Rahmen fehlte dem Kunden aber der Maßstab: Wie viel Text vor „mehr"
 * stehen bleibt und wie hoch ein Bild wirklich wird, sieht man erst im
 * Fenster.
 *
 * **Die Höhe kommt vom Inhalt, nicht aus einer Zahl.** Kurze Caption, kurzer
 * Beitrag; ein 16:9-Bild macht das Fenster niedriger als ein 4:5. Feste Höhen
 * gäbe es nur um den Preis leerer Flächen, die es auf LinkedIn nicht gibt.
 * Die einzige feste Grenze ist die, die LinkedIn selbst zieht — siehe
 * `HOECHSTES_BILD`.
 */

/**
 * Höher als das zeigt LinkedIn kein Medium: Bei 552 px Fensterbreite endet es
 * nach 690 px, also bei 4:5. Was höher ist, behält seine Höhe und wird
 * **schmaler** — ein 9:16-Bild steht in der Mitte, nicht über die volle Breite.
 */
const HOECHSTES_BILD = 690 / 550

/** Die Nachbarslides eines Karussells lugen je 47 px hervor, Fuge 6 px. */
const NACHBAR = `${(47 / 550) * 100}%`
const FUGE = 6

export function LinkedInRahmen({
  kunde,
  logo,
  follower,
  text,
  medien,
  istVideo,
  thumbnail,
  verhaeltnis,
  typ,
}: {
  kunde: string
  logo: string | null
  follower: number | null
  text: string
  medien: string[]
  istVideo: boolean
  /** Beim Video steht das Standbild — bewegt wird hier nichts. */
  thumbnail?: string | null
  verhaeltnis: Verhaeltnis
  typ: PostTyp
}) {
  const { text: fliesstext, hashtags } = teileCaption(text)
  const bilder = istVideo ? [thumbnail].filter((b): b is string => Boolean(b)) : medien
  const seite = VERHAELTNIS_WERT[verhaeltnis]

  return (
    /*
      `@container`, nicht Bildschirmbreite: Wie viel in die Leiste passt,
      hängt an der **Karte** — und die ist am Telefon so breit wie die Seite,
      im Backend aber auch mal 350 px in einer Spalte. Eine Abfrage aufs
      Fenster träfe im zweiten Fall daneben.
    */
    <div className="@container w-full max-w-[344px] overflow-hidden rounded-lg border border-[#e0dfdc] bg-flaeche shadow-[0_1px_2px_rgba(28,22,16,.06),0_14px_40px_rgba(28,22,16,.08)]">
      {/* -------------------------------------------------------- Kopfzeile */}
      <div className="flex items-start gap-3 px-4 pt-3.5">
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt="" className="size-12 shrink-0 rounded-full object-cover" />
        ) : (
          <span className="schraffur size-12 shrink-0 rounded-full border border-dashed border-rahmen-3" />
        )}

        <div className="grid min-w-0 flex-1 gap-1">
          <div className="flex items-baseline gap-2">
            <span className="truncate text-[14px] font-semibold text-tinte">{kunde}</span>
            <span className="shrink-0 text-[12px] text-[#5f5b57]">· Firmenseite</span>
          </div>
          <span className="truncate text-[12px] text-leiser">
            {follower !== null
              ? `${new Intl.NumberFormat('de-DE').format(follower)} Follower`
              : 'LinkedIn'}
          </span>
          {/*
            Zeitangabe und Weltkugel stehen im Mockup als Platzhalter. Hier
            trägt die Zeile keinen erfundenen Zeitpunkt: Der Beitrag ist noch
            nicht draußen, und „vor 2 Std." wäre eine Behauptung.
          */}
          <span className="flex items-center gap-1.5 text-[11.5px] text-stiller">
            geplant
            <span className="block size-3 rounded-full border-[1.3px] border-[#c9c4be]" />
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-3.5 text-leiser">
          <span className="text-[16px] leading-none tracking-[2px]">···</span>
          <span className="relative block size-3.5">
            <span className="absolute left-0 top-[6px] block h-[1.6px] w-3.5 rotate-45 bg-current" />
            <span className="absolute left-0 top-[6px] block h-[1.6px] w-3.5 -rotate-45 bg-current" />
          </span>
        </div>
      </div>

      {/* ---------------------------------------------------------- Caption */}
      <div className="px-4 py-3">
        <Caption text={fliesstext} hashtags={hashtags} />
      </div>

      {/* ----------------------------------------------------------- Medien */}
      {bilder.length > 0 &&
        (typ === 'KARUSSELL' && bilder.length > 1 ? (
          <Karussell slides={bilder} seite={seite} />
        ) : (
          <Flaeche bild={bilder[0]} seite={seite} istVideo={istVideo} />
        ))}

      {/* ---------------------------------------------------- Reaktionszeile */}
      <div className="flex items-center justify-between gap-4 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="flex">
            {['#dcd8d3', '#e6e3df', '#efece8'].map((farbe, i) => (
              <span
                key={farbe}
                className="block size-[17px] rounded-full border-[1.5px] border-white"
                style={{ background: farbe, marginLeft: i === 0 ? 0 : -5 }}
              />
            ))}
          </span>
          <span className="text-[12px] text-stiller">Reaktionen</span>
        </div>
        <span className="hidden text-[12px] text-stiller @min-[380px]:inline">
          Kommentare · Reposts
        </span>
      </div>

      {/*
        Die Leiste ist sichtbar, aber nicht bedienbar — wie die Kommentarzeile
        im Geräterahmen. Sie sagt „so sieht es aus", nicht „hier kannst du
        klicken".
      */}
      <div className="flex items-center justify-between gap-2 border-t border-[#eceae7] px-3 pb-2.5 pt-1.5 text-[#5f5b57]">
        {[
          { text: 'Gefällt mir', icon: <Daumen /> },
          { text: 'Kommentieren', icon: <Sprechblase /> },
          { text: 'Reposten', icon: <Repost /> },
          { text: 'Senden', icon: <Senden /> },
        ].map((k) => (
          <span key={k.text} className="flex items-center gap-2 rounded px-2 py-2 @min-[430px]:px-3">
            {k.icon}
            {/* Schmal bleibt nur das Symbol — vier Wörter nebeneinander
                sprengen die Karte, und LinkedIn macht es am Telefon genauso. */}
            <span className="hidden text-[13.5px] font-semibold @min-[430px]:inline">{k.text}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

/**
 * LinkedIn klappt nach drei Zeilen ein und setzt „… mehr" ans Ende.
 *
 * Nachgebaut mit `line-clamp`, aufklappbar: Der Kunde soll den ganzen Text
 * lesen können — die drei Zeilen zeigen ihm nur, was im Feed davon ankommt.
 */
function Caption({ text, hashtags }: { text: string; hashtags: string }) {
  const [offen, setOffen] = useState(false)
  const ganzerText = [text, hashtags].filter(Boolean).join('\n\n')

  if (!ganzerText) return <p className="text-[13.5px] text-stiller">—</p>

  return (
    <div className="text-[13.5px] leading-[1.55] text-[#1c1a18]">
      <p className={`whitespace-pre-line ${offen ? '' : 'line-clamp-3'}`}>{ganzerText}</p>
      {!offen && (
        <button
          type="button"
          onClick={() => setOffen(true)}
          className="mt-0.5 text-[13.5px] text-[#5f5b57] hover:text-tinte"
        >
          … mehr
        </button>
      )}
    </div>
  )
}

/**
 * Ein Bild oder Video im Fenster.
 *
 * Zwei Fälle, und die Grenze liegt bei 4:5 (`HOECHSTES_BILD`): Bis dahin füllt
 * das Medium die Breite und das Fenster wächst mit. Alles Höhere behält die
 * Höhe von 4:5 und wird schmaler — beim Video legt LinkedIn unscharfe
 * Seitenflächen dahinter, beim Bild bleibt es weiß.
 */
function Flaeche({
  bild,
  seite,
  istVideo,
}: {
  bild: string
  seite: number
  istVideo: boolean
}) {
  const gekappt = 1 / seite > HOECHSTES_BILD

  if (!gekappt) {
    return (
      <div className="relative bg-black">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={bild} alt="" className="block w-full object-cover" style={{ aspectRatio: seite }} />
        {istVideo && <Spielleiste />}
      </div>
    )
  }

  return (
    <div
      className="relative flex items-center justify-center overflow-hidden bg-flaeche"
      style={{ aspectRatio: HOECHSTES_BILD > 0 ? 550 / 690 : 1 }}
    >
      {istVideo && (
        // Die unscharfen Seitenflächen sind dasselbe Bild, groß gezogen und
        // weichgezeichnet — genau das macht LinkedIn.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={bild}
          alt=""
          aria-hidden
          className="absolute inset-0 size-full scale-110 object-cover blur-2xl"
        />
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={bild} alt="" className="relative block h-full w-auto max-w-full object-contain" />
      {istVideo && <Spielleiste />}
    </div>
  )
}

/**
 * Das Karussell: der aktive Slide in der Mitte, die Nachbarn je 47 px
 * angeschnitten.
 *
 * Der Anschnitt ist nicht Zierde — er ist die einzige Stelle, an der man
 * sieht, dass es überhaupt weitergeht. LinkedIn zeigt es so, und wer beim
 * Gestalten weiß, dass links und rechts etwas hineinragt, legt den Text nicht
 * an den Rand.
 */
function Karussell({ slides, seite }: { slides: string[]; seite: number }) {
  const [aktiv, setAktiv] = useState(0)
  const start = useRef<{ x: number; y: number } | null>(null)

  function wischEnde(e: TouchEvent) {
    if (!start.current) return
    const dx = e.changedTouches[0].clientX - start.current.x
    const dy = e.changedTouches[0].clientY - start.current.y
    start.current = null

    // Nur waagerechte Gesten zählen — sonst blättert jedes Scrollen weiter.
    if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return
    setAktiv((i) => (dx < 0 ? Math.min(slides.length - 1, i + 1) : Math.max(0, i - 1)))
  }

  return (
    <div
      className="relative flex touch-pan-y items-stretch overflow-hidden bg-flaeche"
      style={{ gap: FUGE }}
      onTouchStart={(e) => {
        start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
      }}
      onTouchEnd={wischEnde}
    >
      <Nachbar bild={slides[aktiv - 1]} />

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={slides[aktiv]}
        alt={`Slide ${aktiv + 1}`}
        className="min-w-0 flex-1 object-cover"
        style={{ aspectRatio: seite }}
      />

      <Nachbar bild={slides[aktiv + 1]} />

      {aktiv > 0 && <Pfeil richtung="links" aufKlick={() => setAktiv((i) => i - 1)} />}
      {aktiv < slides.length - 1 && (
        <Pfeil richtung="rechts" aufKlick={() => setAktiv((i) => i + 1)} />
      )}

      <span className="absolute right-3.5 top-3.5 rounded px-2.5 py-1 font-mono text-[11px] text-white [background:rgba(20,16,12,.72)]">
        {aktiv + 1}/{slides.length}
      </span>
    </div>
  )
}

/** Der angeschnittene Nachbar. Ohne Nachbar bleibt die Spur leer, damit der
 *  aktive Slide beim Blättern nicht springt. */
function Nachbar({ bild }: { bild?: string }) {
  return (
    <span className="block shrink-0 overflow-hidden" style={{ width: NACHBAR }}>
      {bild && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={bild} alt="" aria-hidden className="size-full object-cover" />
      )}
    </span>
  )
}

function Pfeil({ richtung, aufKlick }: { richtung: 'links' | 'rechts'; aufKlick: () => void }) {
  return (
    <button
      type="button"
      onClick={aufKlick}
      aria-label={richtung === 'links' ? 'Vorheriger Slide' : 'Nächster Slide'}
      className={`absolute top-1/2 z-10 flex size-[38px] -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-[15px] text-white [background:rgba(20,16,12,.72)] hover:[background:rgba(20,16,12,.9)] ${
        richtung === 'links' ? 'left-[34px]' : 'right-[34px]'
      }`}
    >
      {richtung === 'links' ? '❮' : '❯'}
    </button>
  )
}

/** Die Player-Leiste über dem Video — sichtbar, nicht bedienbar. */
function Spielleiste() {
  return (
    <div className="absolute inset-x-0 bottom-0 flex items-center gap-3.5 bg-gradient-to-t from-black/55 to-transparent px-4 py-3.5">
      <span className="flex shrink-0 gap-[3px]">
        <span className="block h-4 w-1 rounded-[1px] bg-white" />
        <span className="block h-4 w-1 rounded-[1px] bg-white" />
      </span>
      <span className="relative h-[3px] min-w-0 flex-1 rounded-sm bg-white/40">
        <span className="absolute inset-y-0 left-0 block w-[16%] rounded-sm bg-white" />
        <span className="absolute -top-[3.5px] left-[16%] block size-2.5 rounded-full bg-white" />
      </span>
      <span className="shrink-0 text-[12px] text-white">1x</span>
      <span className="shrink-0 rounded-[3px] border-[1.3px] border-white px-1 py-px text-[9px] font-bold text-white">
        CC
      </span>
      <span
        className="block size-3 shrink-0 bg-white"
        style={{ clipPath: 'polygon(0 33%,33% 33%,66% 0,66% 100%,33% 66%,0 66%)' }}
      />
      <span className="block size-3 shrink-0 rounded-[2px] border-[1.4px] border-white" />
    </div>
  )
}

// ---------------------------------------------------------------- Symbole
// Nachgezeichnet wie im Mockup: aus Rahmen und Ecken statt als Bilddatei —
// sie erben damit die Farbe der Leiste und bleiben bei jeder Größe scharf.

function Daumen() {
  return (
    <span className="relative block h-[15px] w-[17px] rounded-[3px_3px_4px_4px] border-[1.6px] border-current">
      <span className="absolute -bottom-[1.6px] -left-[1.6px] block h-2 w-1.5 rounded-[2px] border-[1.6px] border-current bg-flaeche" />
    </span>
  )
}

function Sprechblase() {
  return (
    <span className="relative block h-3.5 w-[17px] rounded border-[1.6px] border-current">
      <span className="absolute -bottom-[5px] left-[3px] block size-0 border-b-[5px] border-l-[6px] border-b-transparent border-l-current" />
    </span>
  )
}

function Repost() {
  return (
    <span className="relative block h-3 w-[17px] border-y-[1.6px] border-current">
      <span className="absolute -top-[5px] left-0 block size-0 border-y-[3.5px] border-r-[6px] border-y-transparent border-r-current" />
      <span className="absolute -bottom-[5px] right-0 block size-0 border-y-[3.5px] border-l-[6px] border-y-transparent border-l-current" />
    </span>
  )
}

function Senden() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" className="block">
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
