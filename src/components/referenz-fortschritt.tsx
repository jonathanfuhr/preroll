'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export type Ladestand = 'LAEUFT' | 'FERTIG' | 'FEHLER' | null

export type Referenzstand = {
  stand: Ladestand
  fortschritt: number
  meldung: string | null
  mediumUrl: string | null
}

/**
 * Fragt den Stand des Downloads ab, solange einer läuft — und hört auf,
 * sobald er fertig ist. Der Haken sitzt hier und nicht im Balken selbst,
 * damit Dialog und Editor denselben Stand sehen, ohne zweimal zu fragen.
 */
export function useReferenzstand(postId: string, start: Referenzstand): Referenzstand {
  const router = useRouter()
  const [stand, setStand] = useState(start)

  // Kommt der Server mit neuen Daten, gewinnt er.
  useEffect(() => setStand(start), [start.stand, start.fortschritt, start.mediumUrl])

  useEffect(() => {
    if (stand.stand !== 'LAEUFT') return

    let abgemeldet = false
    const takt = setInterval(async () => {
      try {
        const antwort = await fetch(`/api/posts/${postId}/referenz`, { cache: 'no-store' })
        if (!antwort.ok || abgemeldet) return
        const neu = (await antwort.json()) as Referenzstand
        setStand(neu)

        // Fertig oder gescheitert: einmal die Seite nachladen, damit Video
        // und Meldungen überall stimmen.
        if (neu.stand !== 'LAEUFT') router.refresh()
      } catch {
        // Ein verpasster Takt ist kein Fehler — beim nächsten klappt es.
      }
    }, 1500)

    return () => {
      abgemeldet = true
      clearInterval(takt)
    }
  }, [postId, stand.stand, router])

  return stand
}

/** Schmaler Balken mit Prozentzahl — dieselbe Optik im Dialog und im Editor. */
export function Fortschrittsbalken({
  stand,
  titel = 'Referenzvideo wird geladen',
}: {
  stand: Referenzstand
  titel?: string
}) {
  if (stand.stand !== 'LAEUFT') return null

  return (
    <div className="rounded-md border border-rahmen bg-flaeche px-4 py-3">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <span className="text-[12.5px] font-medium text-tinte">{titel}</span>
        <span className="font-mono text-[11.5px] text-leise">{stand.fortschritt}%</span>
      </div>

      <div
        role="progressbar"
        aria-valuenow={stand.fortschritt}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-[5px] overflow-hidden rounded-full bg-flaeche-tief"
      >
        <div
          className="h-full rounded-full bg-akzent transition-[width] duration-500"
          style={{ width: `${Math.max(2, stand.fortschritt)}%` }}
        />
      </div>

      <p className="mt-2 text-[11.5px] leading-relaxed text-leiser">
        Läuft im Hintergrund weiter — der Dialog darf zu, und die Seite lässt sich verlassen.
      </p>
    </div>
  )
}
