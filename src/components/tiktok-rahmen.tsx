'use client'

import type { PostTyp, Verhaeltnis } from '@prisma/client'
import { useRef, useState, type TouchEvent } from 'react'
import { VERHAELTNIS_WERT } from '@/lib/verhaeltnis'
import { Geraet, Statusleiste } from './iphone'
import { ReelFlaeche, ReelRahmen, ReelTonKnopf } from './reel-player'

/**
 * Wie ein Beitrag auf TikTok aussieht — nach Mockup 4a–4c
 * (`design/TikTok-Layer.dc.html`).
 *
 * **Derselbe Geräterahmen wie bei Instagram** — das Mockup zeichnet ihn mit
 * denselben Maßen und demselben Verlauf. Und das ist keine Bequemlichkeit:
 * TikTok ist genauso eine Telefon-App, der Schirm ist derselbe (320 × 621), und
 * der Beitrag füllt ihn genauso. Nur was darin steht, ist ein anderes — die
 * Bedienelemente liegen rechts am Rand statt unten, die Caption läuft ohne
 * „mehr" bis zur Kante, und unten steht eine Tab-Leiste statt der
 * Kommentarzeile.
 *
 * **TikTok kennt keine Einzelbeiträge.** Es gibt Video und Foto-Karussell,
 * sonst nichts. Ein Beitrag mit einem Bild erscheint hier deshalb wie ein
 * Karussell mit einem Foto — das ist keine Notlösung, sondern das, was TikTok
 * daraus macht.
 */

/** Alles Hochkantere als das füllt den Schirm; Flacheres steht mittig auf Schwarz. */
const SCHIRM = 320 / 569

export function TikTokRahmen({
  kunde,
  handle,
  logo,
  text,
  medien,
  istVideo,
  thumbnail,
  verhaeltnis,
  typ,
}: {
  kunde: string
  /** Der öffentliche Name — steht über der Caption, wie bei TikTok. */
  handle: string | null
  logo: string | null
  text: string
  medien: string[]
  istVideo: boolean
  thumbnail?: string | null
  verhaeltnis: Verhaeltnis
  typ: PostTyp
}) {
  const videoQuelle = istVideo ? (medien[0] ?? null) : null
  const bilder = istVideo ? [] : medien
  const [aktiv, setAktiv] = useState(0)
  const start = useRef<{ x: number; y: number } | null>(null)

  const seite = VERHAELTNIS_WERT[verhaeltnis]
  // Der Schirm ist 9:16. Was breiter ist, bekommt oben und unten Schwarz —
  // TikTok schneidet nicht, es legt das Bild mittig hinein.
  const fuellt = seite <= SCHIRM

  function wischEnde(e: TouchEvent) {
    if (!start.current || bilder.length < 2) return
    const dx = e.changedTouches[0].clientX - start.current.x
    const dy = e.changedTouches[0].clientY - start.current.y
    start.current = null
    if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return
    setAktiv((i) => (dx < 0 ? Math.min(bilder.length - 1, i + 1) : Math.max(0, i - 1)))
  }

  return (
    <ReelRahmen quelle={videoQuelle} thumbnail={thumbnail ?? null} tonKnopfAussen={false}>
      <Geraet dunkel>
        <div
          className="relative h-[569px] w-[320px] shrink-0 touch-pan-y overflow-hidden bg-black"
          onTouchStart={(e) => {
            start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
          }}
          onTouchEnd={wischEnde}
        >
          {/* ------------------------------------------------------- Medium */}
          {videoQuelle ? (
            <ReelFlaeche />
          ) : bilder[aktiv] ? (
            <div className={`absolute inset-0 flex items-center justify-center ${fuellt ? '' : 'bg-black'}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={bilder[aktiv]}
                alt={bilder.length > 1 ? `Foto ${aktiv + 1}` : ''}
                className={fuellt ? 'size-full object-cover' : 'w-full object-contain'}
                style={fuellt ? undefined : { aspectRatio: seite }}
              />
            </div>
          ) : (
            <div
              className="absolute inset-0"
              style={{
                background: 'repeating-linear-gradient(135deg,#2b2724 0 8px,#343029 8px 16px)',
              }}
            >
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-[3px] bg-black/40 px-2.5 py-1.5 font-mono text-[11px] text-white/80">
                {typ === 'REEL' ? 'Video 9:16' : 'Foto 9:16'} · 1080 × 1920
              </span>
            </div>
          )}

          {/* ------------------------------------------------------ Kopfzeile */}
          <div className="relative z-10">
            <Statusleiste hell />
            <div
              className="flex items-center justify-center gap-5 pt-1"
              style={{ fontFamily: '-apple-system, Helvetica, Arial, sans-serif' }}
            >
              <span className="text-[13.5px] text-white/60">Folge ich</span>
              <span className="border-b-2 border-white pb-[5px] text-[13.5px] font-semibold text-white">
                Für dich
              </span>
            </div>
          </div>

          {/* Der Zähler beim Foto-Karussell, wie im Mockup oben rechts. Beim
              Video steht dort der Ton-Knopf — beides zugleich wäre eng. */}
          <div className="absolute right-3.5 top-14 z-10 flex items-center gap-3">
            {bilder.length > 1 && (
              <span className="rounded-[10px] bg-black/50 px-2 py-[3px] font-mono text-[9.5px] text-white">
                {aktiv + 1}/{bilder.length}
              </span>
            )}
            <ReelTonKnopf />
          </div>

          {/* --------------------------------------------------- Aktionsleiste */}
          <div className="absolute bottom-[104px] right-3 z-10 grid justify-items-center gap-[18px]">
            <span className="relative flex size-[38px] items-center justify-center overflow-visible rounded-full border-[1.5px] border-white/60 bg-white/15">
              {logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logo} alt="" className="size-full rounded-full object-cover" />
              ) : (
                <span className="font-mono text-[6.5px] text-white/85">Logo</span>
              )}
              <span className="absolute -bottom-[7px] left-1/2 flex size-4 -translate-x-1/2 items-center justify-center rounded-full bg-akzent text-[11px] leading-none text-white">
                +
              </span>
            </span>

            <Aktion zeichen={<span className="text-[23px] leading-none">♡</span>} />
            <Aktion
              zeichen={
                <span className="relative block h-4 w-[19px] rounded-[5px] border-[1.8px] border-current">
                  <span className="absolute -bottom-[5px] left-[3px] block size-0 border-b-[5px] border-l-[6px] border-b-transparent border-l-current" />
                </span>
              }
            />
            <Aktion
              zeichen={
                <span
                  className="block h-[19px] w-4 border-[1.8px] border-current"
                  style={{ clipPath: 'polygon(0 0,100% 0,100% 100%,50% 74%,0 100%)' }}
                />
              }
            />
            <Aktion
              zeichen={
                <svg width="18" height="18" viewBox="0 0 18 18" className="block">
                  <polygon
                    points="16.2,2 1.8,8.2 8.2,10.1 10.2,16.2"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinejoin="round"
                  />
                </svg>
              }
            />
            {/* Die Plattenscheibe — bei TikTok dreht sie sich; hier steht sie. */}
            <span className="mt-1 block size-[34px] rounded-full border-[1.5px] border-dashed border-white/50 bg-white/10" />
          </div>

          {/* ------------------------------------------- Konto und Caption */}
          <div className="absolute bottom-3.5 left-3.5 right-[66px] z-10 grid gap-2">
            {bilder.length > 1 && (
              <div className="flex items-center gap-[5px]">
                {bilder.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setAktiv(i)}
                    aria-label={`Zu Foto ${i + 1}`}
                    aria-current={i === aktiv}
                    className={
                      i === aktiv
                        ? 'block h-[5px] w-4 rounded-[3px] bg-white'
                        : 'block size-[5px] rounded-full bg-white/50'
                    }
                  />
                ))}
              </div>
            )}

            <span className="text-[12.5px] font-semibold text-white">
              {handle ? (handle.startsWith('@') ? handle : `@${handle}`) : kunde}
            </span>

            {/*
              Ohne „mehr": TikTok kürzt die Caption nicht, sie läuft bis zur
              Unterkante und wird dort abgeschnitten. Genau das zeigt der
              Rahmen — wer wissen will, wie viel ankommt, sieht es hier.
            */}
            <p className="max-h-[84px] overflow-hidden whitespace-pre-line text-[11.5px] leading-[1.5] text-white/90">
              {text || '—'}
            </p>
          </div>
        </div>

        {/* ------------------------------------------------------ Tab-Leiste */}
        {/* Statt der Kommentarzeile bei Instagram — sichtbar, nicht bedienbar. */}
        <div className="flex h-[52px] shrink-0 items-center justify-between bg-[#141210] px-[18px] opacity-85">
          <TabZeichen
            zeichen={
              <span
                className="block h-3.5 w-[15px] bg-white/85"
                style={{ clipPath: 'polygon(50% 0,100% 42%,100% 100%,0 100%,0 42%)' }}
              />
            }
            hell
          />
          <TabZeichen
            zeichen={<span className="block size-[15px] rounded-full border-[1.6px] border-white/50" />}
          />
          <span className="block h-[26px] w-10 rounded-lg border border-dashed border-white/45 bg-white/10" />
          <TabZeichen
            zeichen={
              <span className="relative block h-3.5 w-4 rounded border-[1.6px] border-white/50">
                <span className="absolute -bottom-1 left-[3px] block size-0 border-b-4 border-l-[5px] border-b-transparent border-l-white/50" />
              </span>
            }
          />
          <TabZeichen
            zeichen={
              <span className="block size-3.5 border-[1.6px] border-white/50 [border-radius:50%_50%_50%_50%/60%_60%_40%_40%]" />
            }
          />
        </div>
      </Geraet>
    </ReelRahmen>
  )
}

/** Ein Zeichen der rechten Leiste, darunter der Balken für die Zahl. */
function Aktion({ zeichen }: { zeichen: React.ReactNode }) {
  return (
    <span className="grid justify-items-center gap-[5px] text-white/90">
      {zeichen}
      <span className="block h-[7px] w-5 rounded-[3px] bg-white/30" />
    </span>
  )
}

function TabZeichen({ zeichen, hell }: { zeichen: React.ReactNode; hell?: boolean }) {
  return (
    <span className="grid justify-items-center gap-[3px]">
      {zeichen}
      <span className={`block h-[5px] w-5 rounded-sm ${hell ? 'bg-white/30' : 'bg-white/20'}`} />
    </span>
  )
}
