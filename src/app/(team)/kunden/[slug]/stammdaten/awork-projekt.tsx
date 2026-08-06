'use client'

import { Auswahl, Hinweis, Knopf } from '@/components/ui'

export type AworkProjektZeile = {
  id: string
  name: string
  typ: string | null
}

/**
 * Ordnet dem Kunden sein Projekt in awork zu.
 *
 * Was Preroll damit tut, ist noch nicht entschieden — angedacht sind Aufgaben
 * aus Kundenkommentaren und Meldungen als Projektkommentar. Die Zuordnung
 * steht trotzdem schon: Sie ist die Voraussetzung für alles davon, und wer
 * einen Kunden anlegt, hat sein awork-Projekt gerade zur Hand.
 */
export function AworkProjektWahl({
  zuordnen,
  eingerichtet,
  projektId,
  projektName,
  projekte,
}: {
  zuordnen: (formular: FormData) => Promise<void>
  eingerichtet: boolean
  projektId: string | null
  projektName: string | null
  projekte: AworkProjektZeile[]
}) {
  if (!eingerichtet) {
    return (
      <Hinweis>
        awork ist noch nicht verbunden. Das geht unter{' '}
        <a href="/einstellungen/awork" className="text-akzent">
          Einstellungen → awork
        </a>
        ; danach lässt sich hier das Projekt zuordnen.
      </Hinweis>
    )
  }

  return (
    <form action={zuordnen} className="grid gap-4">
      {projektId && (
        <p className="text-[12.5px] text-leise">
          Zugeordnet: <strong className="text-tinte">{projektName ?? projektId}</strong>
        </p>
      )}

      <label className="block">
        <span className="mb-1.5 block text-[10.5px] font-medium uppercase tracking-[0.1em] text-still">
          Projekt in awork
        </span>
        <Auswahl
          name="aworkProjekt"
          defaultValue={projektId ? `${projektId}|${projektName ?? ''}` : ''}
        >
          <option value="">— keine Zuordnung —</option>
          {projekte.map((p) => (
            <option key={p.id} value={`${p.id}|${p.name}`}>
              {p.name}
              {p.typ ? ` · ${p.typ}` : ''}
            </option>
          ))}
        </Auswahl>
      </label>

      {projekte.length === 0 && (
        <p className="text-[11.5px] text-leiser">
          In awork liegen keine Projekte — oder der Schlüssel sieht keine.
        </p>
      )}

      <div className="flex justify-end">
        <Knopf klein type="submit">
          Speichern
        </Knopf>
      </div>
    </form>
  )
}
