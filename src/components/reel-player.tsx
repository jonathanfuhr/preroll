'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Der Player im Geräterahmen.
 *
 * Die Standard-Bedienleiste des Browsers taugt hier nicht: Sie legt sich über
 * das untere Drittel des Reels — also genau dorthin, wo bei Instagram Name und
 * Caption stehen — und lässt sich nicht wegnehmen. Deshalb eigene Bedienung,
 * so knapp wie auf Instagram: Klick aufs Bild schaltet, der Ton hängt an einem
 * eigenen Knopf **neben** dem Rahmen, wo er nichts verdeckt.
 *
 * Stumm startet es trotzdem — Browser spielen Video mit Ton nicht von selbst
 * ab, und ein Video, das gar nicht erst anläuft, wäre schlechter.
 */
export function ReelPlayer({ quelle }: { quelle: string }) {
  const video = useRef<HTMLVideoElement>(null)
  const [laeuft, setLaeuft] = useState(false)
  const [stumm, setStumm] = useState(true)

  useEffect(() => {
    const v = video.current
    if (!v) return
    v.muted = stumm
  }, [stumm])

  function schalte() {
    const v = video.current
    if (!v) return
    if (v.paused) void v.play()
    else v.pause()
  }

  return (
    <div className="relative h-full w-full">
      <video
        ref={video}
        src={quelle}
        className="absolute inset-0 h-full w-full object-cover"
        muted
        loop
        playsInline
        onPlay={() => setLaeuft(true)}
        onPause={() => setLaeuft(false)}
      />

      {/* Die ganze Fläche schaltet — wie auf Instagram. */}
      <button
        type="button"
        onClick={schalte}
        aria-label={laeuft ? 'Pause' : 'Abspielen'}
        className="absolute inset-0 z-10 flex items-center justify-center"
      >
        {!laeuft && (
          <span className="flex size-14 items-center justify-center rounded-full bg-black/45 backdrop-blur-sm">
            <span
              aria-hidden
              className="ml-1 block size-0 border-y-[11px] border-l-[18px] border-y-transparent border-l-white"
            />
          </span>
        )}
      </button>

      {/*
        Der Ton-Knopf sitzt außerhalb des Rahmens — im Rahmen verdeckte er
        entweder die Caption oder die Bedienspalte rechts.
      */}
      <button
        type="button"
        onClick={() => setStumm((s) => !s)}
        aria-label={stumm ? 'Ton einschalten' : 'Stummschalten'}
        title={stumm ? 'Ton einschalten' : 'Stummschalten'}
        className="absolute -left-[52px] top-0 z-20 flex size-9 items-center justify-center rounded-full border border-rahmen bg-flaeche text-tinte shadow-sm transition-colors hover:border-rahmen-4"
      >
        {stumm ? <StummZeichen /> : <TonZeichen />}
      </button>
    </div>
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
