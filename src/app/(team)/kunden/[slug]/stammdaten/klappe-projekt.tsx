'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { Auswahl, Fehler, Hinweis, Knopf } from '@/components/ui'

export type KlappeProjektZeile = {
  id: string
  name: string
  kunde: string | null
  videos: number
}

/**
 * Ordnet dem Kunden sein Projekt in Klappe zu. Ohne diese Zuordnung zeigt der
 * Reel-Editor keine Videos an — sonst stünden dort alle Videos aller Kunden.
 */
export function KlappeProjektWahl({
  zuordnen,
  aktualisieren,
  eingerichtet,
  projektId,
  projektName,
  projekte,
  fehler,
}: {
  zuordnen: (formular: FormData) => Promise<void>
  /** Holt die Liste frisch bei Klappe — für neu angelegte Projekte. */
  aktualisieren: () => Promise<void>
  eingerichtet: boolean
  projektId: string | null
  projektName: string | null
  projekte: KlappeProjektZeile[]
  fehler: string | null
}) {
  const router = useRouter()
  const [laeuft, starte] = useTransition()
  if (!eingerichtet) {
    return (
      <Hinweis>
        Klappe ist noch nicht angebunden. Das geht unter{' '}
        <a href="/einstellungen/klappe" className="text-akzent">
          Einstellungen → Klappe
        </a>
        ; danach lässt sich hier das Projekt zuordnen.
      </Hinweis>
    )
  }

  return (
    <form action={zuordnen} className="grid gap-4">
      {fehler && <Fehler>{fehler}</Fehler>}

      {projektId && (
        <p className="text-[12.5px] text-leise">
          Zugeordnet: <strong className="text-tinte">{projektName ?? projektId}</strong>
        </p>
      )}

      <label className="block">
        <span className="mb-1.5 block text-[10.5px] font-medium uppercase tracking-[0.1em] text-still">
          Projekt in Klappe
        </span>
        <Auswahl
          name="klappeProjekt"
          defaultValue={projektId ? `${projektId}|${projektName ?? ''}` : ''}
        >
          <option value="">— keine Zuordnung —</option>
          {projekte.map((p) => (
            <option key={p.id} value={`${p.id}|${p.name}`}>
              {p.name}
              {p.kunde ? ` · ${p.kunde}` : ''} · {p.videos} Videos
            </option>
          ))}
        </Auswahl>
      </label>

      {projekte.length === 0 && !fehler && (
        <p className="text-[11.5px] text-leiser">
          In Klappe liegen noch keine Projekte — oder das gekoppelte Konto sieht keine.
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => starte(async () => { await aktualisieren(); router.refresh() })}
          disabled={laeuft}
          className="text-[11.5px] text-leise underline underline-offset-2 hover:text-tinte disabled:opacity-50"
        >
          {laeuft ? 'Wird geholt …' : `Projektliste aktualisieren (${projekte.length})`}
        </button>
        <Knopf klein type="submit">
          Speichern
        </Knopf>
      </div>
    </form>
  )
}
