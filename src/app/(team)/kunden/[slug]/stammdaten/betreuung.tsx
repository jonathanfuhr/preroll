'use client'

import { Auswahl, Knopf, Schalter } from '@/components/ui'

export type TeamZeile = {
  id: string
  name: string
  rolleText: string
  /** Darf als Ansprechpartner stehen — Schnitt nicht. */
  waehlbar: boolean
  /** Nur Design bekommt über die Betreuung Meldungen. */
  betreutMoeglich: boolean
}

/**
 * Hauptansprechpartner und betreuende Konten. Ansprechpartner sind seit dem
 * Rollenumbau Nutzerkonten — eine eigene Kontaktliste gibt es nicht mehr.
 */
export function BetreuungFormular({
  speichern,
  hauptAnsprechpartnerId,
  betreuerIds,
  team,
}: {
  speichern: (formular: FormData) => Promise<void>
  hauptAnsprechpartnerId: string | null
  betreuerIds: string[]
  team: TeamZeile[]
}) {
  const waehlbare = team.filter((n) => n.waehlbar)
  const designer = team.filter((n) => n.betreutMoeglich)

  return (
    <form action={speichern} className="grid gap-5">
      <label className="block">
        <span className="mb-1.5 block text-[10.5px] font-medium uppercase tracking-[0.1em] text-still">
          Hauptansprechpartner
        </span>
        <Auswahl name="hauptAnsprechpartnerId" defaultValue={hauptAnsprechpartnerId ?? ''}>
          <option value="">— noch niemand —</option>
          {waehlbare.map((n) => (
            <option key={n.id} value={n.id}>
              {n.name} · {n.rolleText}
            </option>
          ))}
        </Auswahl>
        <span className="mt-1.5 block text-[11.5px] leading-relaxed text-leiser">
          Steht im Kontakt-Fuß jeder Export-Seite dieses Kunden und bekommt jede Rückmeldung — auch
          dann, wenn für einen einzelnen Link zusätzlich jemand hinterlegt ist.
        </span>
      </label>

      <div>
        <span className="mb-2 block text-[10.5px] font-medium uppercase tracking-[0.1em] text-still">
          Betreut von
        </span>
        {designer.length === 0 ? (
          <p className="text-[12px] text-leiser">
            Noch niemand im Design angelegt. Projektmanagement und Administration hören ohnehin bei
            allen Kunden mit.
          </p>
        ) : (
          <div className="grid gap-2.5">
            {designer.map((n) => (
              <Schalter
                key={n.id}
                name="betreuer"
                value={n.id}
                beschriftung={`${n.name} · ${n.rolleText}`}
                defaultChecked={betreuerIds.includes(n.id)}
              />
            ))}
          </div>
        )}
        <p className="mt-2 text-[11.5px] leading-relaxed text-leiser">
          Wer hier steht, bekommt die Meldungen dieses Kunden. Projektmanagement und Administration
          bekommen sie ohnehin, der Schnitt bekommt keine.
        </p>
      </div>

      <div className="flex justify-end">
        <Knopf klein type="submit">
          Speichern
        </Knopf>
      </div>
    </form>
  )
}
