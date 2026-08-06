'use client'

import { useState, type ReactNode } from 'react'

/**
 * Bildfläche und Punktreihe eines Karussells — der Teil, durch den geblättert
 * wird.
 *
 * Das Mockup schaltet per Klick aufs Bild weiter. Hier stattdessen Pfeile,
 * die beim Überfahren erscheinen, plus die Punktreihe zum Springen: Ein Klick
 * mitten aufs Bild ist eine Geste ohne sichtbare Ursache — man sieht ihr
 * nicht an, dass sie etwas tut, und rückwärts kommt man damit gar nicht.
 */
export function KarussellFlaeche({
  slides,
  aufUpload,
  ersetzenKnopf,
}: {
  slides: string[]
  aufUpload?: () => void
  ersetzenKnopf?: ReactNode
}) {
  const [aktiv, setAktiv] = useState(0)
  const anzahl = Math.max(slides.length, 1)
  const bild = slides[Math.min(aktiv, slides.length - 1)]

  return (
    <>
      <div className="group relative h-[400px] w-[320px] shrink-0 border-y border-grund">
        {bild ? (
          <>
            {ersetzenKnopf}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={bild} alt={`Slide ${aktiv + 1}`} className="h-full w-full object-cover" />
          </>
        ) : (
          /*
            Der Platzhalter steht hier und kommt nicht als Funktion von außen:
            Funktionen lassen sich nicht vom Server- ins Client-Bauteil
            reichen — genau daran ist die Kundenseite einmal gescheitert.
          */
          <span className="schraffur flex h-full w-full flex-col items-center justify-center">
            <span className="rounded-[3px] bg-white/85 px-2.5 py-1 font-mono text-[11px] text-leiser">
              Slide {aktiv + 1} · 4:5
            </span>
            {aufUpload && (
              <span className="mt-2 rounded-[5px] bg-akzent px-3 py-1.5 text-[11.5px] font-medium text-white">
                Datei hochladen
              </span>
            )}
          </span>
        )}

        <span className="absolute right-3 top-2.5 z-10 rounded-[10px] bg-black/55 px-2.5 py-[3px] font-mono text-[9.5px] text-white">
          {Math.min(aktiv + 1, anzahl)}/{anzahl}
        </span>

        {slides.length > 1 && (
          <>
            <Pfeil
              richtung="links"
              aus={aktiv === 0}
              aufKlick={() => setAktiv((i) => Math.max(0, i - 1))}
            />
            <Pfeil
              richtung="rechts"
              aus={aktiv >= slides.length - 1}
              aufKlick={() => setAktiv((i) => Math.min(slides.length - 1, i + 1))}
            />
          </>
        )}

        {/* Ohne Slides bleibt die Fläche der Weg zum Upload. */}
        {!bild && aufUpload && (
          <button
            type="button"
            onClick={aufUpload}
            aria-label="Datei hochladen"
            className="absolute inset-0 z-10"
          />
        )}
      </div>

      <div className="flex shrink-0 items-center justify-center gap-[5px] pb-0.5 pt-2.5">
        {Array.from({ length: anzahl }, (_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setAktiv(i)}
            aria-label={`Zu Slide ${i + 1}`}
            aria-current={i === aktiv}
            className="block rounded-full p-1 transition-opacity hover:opacity-60"
          >
            <span
              className="block size-1.5 rounded-full"
              style={{ background: i === aktiv ? '#57534f' : '#d5d1cc' }}
            />
          </button>
        ))}
      </div>
    </>
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
      aria-label={richtung === 'links' ? 'Vorheriger Slide' : 'Nächster Slide'}
      className={`absolute top-1/2 z-20 flex size-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100 focus-visible:opacity-100 disabled:group-hover:opacity-0 ${
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
