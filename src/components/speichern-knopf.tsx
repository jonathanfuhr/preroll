'use client'

import { useEffect, useRef, useState, type ComponentProps } from 'react'
import { useFormStatus } from 'react-dom'
import { Knopf } from './ui'

/**
 * Ein Speichern-Knopf, der sagt, was er gerade tut.
 *
 * Vorher passierte nach dem Klick sichtbar nichts: Die Aktion lief, die Seite
 * holte ihre Daten neu, und der Knopf stand unverändert da. In den Stammdaten
 * liegen ein Dutzend gleichrangiger Formulare untereinander — welches davon
 * gerade gespeichert hat, war nicht zu erkennen, und im Zweifel klickte man
 * ein zweites Mal.
 *
 * Drei Zustände: „Speichern" · „Speichert …" · „Gespeichert", das letzte für
 * ein paar Sekunden. Während des Laufs ist der Knopf gesperrt — ein zweiter
 * Klick schickte dieselben Daten noch einmal.
 *
 * **Einmal gebaut, überall verwendet.** Je Formular eine eigene Meldung wären
 * dreißig Stellen, an denen jemand eine vergisst; und eine Rückmeldung, die
 * nur bei der Hälfte der Formulare kommt, ist schlechter als gar keine — man
 * lernt ihr nicht zu trauen.
 */

/** Wie lange „Gespeichert" stehen bleibt: lang genug zum Lesen, kurz genug,
 *  um nicht als Dauerzustand des Knopfes gelesen zu werden. */
const NACHGLANZ = 2500

export function SpeichernKnopf({
  children = 'Speichern',
  laeuft,
  className = '',
  ...rest
}: ComponentProps<typeof Knopf> & {
  /**
   * Überschreibt den selbst ermittelten Stand — gebraucht für den einen Knopf,
   * der **außerhalb** seines Formulars steht (der Post-Editor hängt ihn über
   * `form=` an). `useFormStatus` liest den Kontext des umgebenden Formulars,
   * und außerhalb gibt es keinen; dort meldet `SpeichernMelder` von innen.
   */
  laeuft?: boolean
}) {
  const status = useFormStatus()
  /*
    `Boolean(…)` ist kein Zierrat: `useFormStatus` gibt nach dem Lauf nicht
    verlässlich `false` zurück, sondern zwischendurch `undefined`. Ungefiltert
    ist das ein **dritter** Wert, und alles, was daran hängt, springt ein
    weiteres Mal — beim ersten Anlauf reichte das, damit der Wecker für
    „Gespeichert" abgeräumt und keiner mehr gestellt wurde. Der Knopf trug das
    Wort dann für immer.
  */
  const arbeitet = Boolean(laeuft ?? status.pending)

  const [fertig, setFertig] = useState(false)
  const vorher = useRef(false)

  if (vorher.current !== arbeitet) {
    vorher.current = arbeitet
    /*
      Umgeschaltet wird **während des Renderns**, nicht in einem Effekt: Ein
      Effekt läuft erst nach dem Zeichnen, und dazwischen stand einen
      Bildaufbau lang wieder „Speichern" da — ein Blitzen, das aussah, als
      wäre nichts passiert.
    */
    if (!arbeitet) setFertig(true)
  }

  // Der Wecker hängt am sichtbaren Zustand, nicht am Lauf: So gibt es genau
  // einen Grund, aus dem „Gespeichert" wieder verschwindet.
  useEffect(() => {
    if (!fertig) return
    const uhr = setTimeout(() => setFertig(false), NACHGLANZ)
    return () => clearTimeout(uhr)
  }, [fertig])

  return (
    <Knopf
      type="submit"
      disabled={arbeitet}
      aria-live="polite"
      className={`disabled:cursor-progress disabled:opacity-70 ${className}`}
      {...rest}
    >
      {arbeitet ? 'Speichert …' : fertig ? 'Gespeichert' : children}
    </Knopf>
  )
}

/**
 * Meldet den Lauf eines Formulars nach außen. Steht als unsichtbares Bauteil
 * **im** Formular und ist nur dort nötig, wo der Knopf woanders steht.
 */
export function SpeichernMelder({ onLaeuft }: { onLaeuft: (laeuft: boolean) => void }) {
  const { pending } = useFormStatus()
  useEffect(() => {
    onLaeuft(Boolean(pending))
  }, [pending, onLaeuft])
  return null
}
