'use client'

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'

/**
 * Der Reel-Player im Geräterahmen.
 *
 * Die Standard-Bedienleiste des Browsers taugt hier nicht: Sie legt sich über
 * das untere Drittel — also genau dorthin, wo bei Instagram Name und Caption
 * stehen — und lässt sich nicht wegnehmen. Deshalb eigene Bedienung, so knapp
 * wie auf Instagram.
 *
 * Solange nichts läuft, steht das Thumbnail davor. Nach dem Pausieren kommt
 * es nach zwei Sekunden zurück: sofort wäre hektisch, gar nicht ließe den
 * Beitrag im Standbild irgendeiner Sekunde stehen.
 *
 * Der Ton-Knopf sitzt **außerhalb** des Geräts. Im ersten Anlauf steckte er
 * innen und war unsichtbar — der Schirm hat `overflow: hidden`. Deshalb
 * umschließt `ReelRahmen` den Geräterahmen, statt in ihm zu stecken, und die
 * Fläche im Inneren holt sich ihren Zustand über einen kleinen Kontext.
 */

type Steuerung = {
  video: React.RefObject<HTMLVideoElement | null>
  laeuft: boolean
  zeigeThumbnail: boolean
  schalte: () => void
  thumbnail: string | null
  quelle: string | null
}

const Kontext = createContext<Steuerung | null>(null)

export function ReelRahmen({
  quelle,
  thumbnail,
  children,
}: {
  quelle: string | null
  thumbnail: string | null
  /** Der Geräterahmen; die Videofläche kommt über `ReelFlaeche` hinein. */
  children: ReactNode
}) {
  const video = useRef<HTMLVideoElement>(null)
  const [laeuft, setLaeuft] = useState(false)
  const [stumm, setStumm] = useState(true)
  const [zeigeThumbnail, setZeigeThumbnail] = useState(true)

  useEffect(() => {
    const v = video.current
    if (v) v.muted = stumm
  }, [stumm])

  useEffect(() => {
    const v = video.current
    if (!v) return

    const an = () => setLaeuft(true)
    const aus = () => setLaeuft(false)
    v.addEventListener('play', an)
    v.addEventListener('pause', aus)
    v.addEventListener('ended', aus)
    return () => {
      v.removeEventListener('play', an)
      v.removeEventListener('pause', aus)
      v.removeEventListener('ended', aus)
    }
  }, [quelle])

  // Nach dem Pausieren kehrt das Thumbnail verzögert zurück.
  useEffect(() => {
    if (laeuft) {
      setZeigeThumbnail(false)
      return
    }
    const uhr = setTimeout(() => setZeigeThumbnail(true), 2000)
    return () => clearTimeout(uhr)
  }, [laeuft])

  function schalte() {
    const v = video.current
    if (!v) return
    if (v.paused) void v.play()
    else v.pause()
  }

  return (
    <Kontext.Provider value={{ video, laeuft, zeigeThumbnail, schalte, thumbnail, quelle }}>
      {/* Mobil sitzt der Ton-Knopf oben — dafür braucht es dort Luft. */}
      <div className={`relative ${quelle ? 'pt-11 sm:pt-0' : ''}`}>
        {quelle && (
          <button
            type="button"
            onClick={() => setStumm((s) => !s)}
            aria-label={stumm ? 'Ton einschalten' : 'Stummschalten'}
            title={stumm ? 'Ton einschalten' : 'Stummschalten'}
            /*
              Am Telefon über dem Rahmen, sonst links daneben. Neben dem
              Gerät ist links kein Platz — auf 375 px steht der Rahmen selbst
              schon fast an der Kante, und der Knopf rutschte aus dem Bild.
              Innen kann er nicht sitzen: Der Schirm ist `overflow: hidden`.
            */
            className="absolute top-0 right-0 z-30 flex size-9 items-center justify-center rounded-full border border-rahmen bg-flaeche text-tinte shadow-sm transition-colors hover:border-rahmen-4 sm:-left-11 sm:right-auto sm:top-2"
          >
            {stumm ? <StummZeichen /> : <TonZeichen />}
          </button>
        )}

        {children}
      </div>
    </Kontext.Provider>
  )
}

/** Die Videofläche im Schirm. Braucht einen `ReelRahmen` um sich herum. */
export function ReelFlaeche({ platzhalter }: { platzhalter?: ReactNode }) {
  const s = useContext(Kontext)
  if (!s) throw new Error('ReelFlaeche gehört in einen ReelRahmen.')
  if (!s.quelle) return <>{platzhalter}</>

  return (
    <>
      <video
        ref={s.video}
        src={s.quelle}
        className="absolute inset-0 h-full w-full object-cover"
        muted
        loop
        playsInline
        preload="metadata"
      />

      {s.zeigeThumbnail && s.thumbnail && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={s.thumbnail} alt="" className="absolute inset-0 h-full w-full object-cover" />
      )}

      <button
        type="button"
        onClick={s.schalte}
        aria-label={s.laeuft ? 'Pause' : 'Abspielen'}
        className="absolute inset-0 z-10 flex items-center justify-center"
      >
        {!s.laeuft && (
          <span className="flex size-14 items-center justify-center rounded-full bg-black/45 backdrop-blur-sm">
            <span
              aria-hidden
              className="ml-1 block size-0 border-y-[11px] border-l-[18px] border-y-transparent border-l-white"
            />
          </span>
        )}
      </button>
    </>
  )
}

/** Kleiner Player für Dialoge — dieselbe Bedienung, ohne Geräterahmen. */
export function EinfacherPlayer({
  quelle,
  thumbnail,
}: {
  quelle: string
  thumbnail: string | null
}) {
  return (
    <ReelRahmen quelle={quelle} thumbnail={thumbnail}>
      <div className="relative aspect-[9/16] w-full overflow-hidden rounded-[5px] bg-black">
        <ReelFlaeche />
      </div>
    </ReelRahmen>
  )
}

function TonZeichen() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M8 2.5 4.5 5.5H2v5h2.5L8 13.5v-11Z" fill="currentColor" />
      <path
        d="M10.5 5.5a3.5 3.5 0 0 1 0 5M12.5 3.5a6.5 6.5 0 0 1 0 9"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  )
}

function StummZeichen() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M8 2.5 4.5 5.5H2v5h2.5L8 13.5v-11Z" fill="currentColor" />
      <path
        d="m10.5 6 4 4M14.5 6l-4 4"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  )
}
