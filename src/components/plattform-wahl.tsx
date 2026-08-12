import type { Plattform } from '@prisma/client'
import { GEBAUTE_PLATTFORMEN, PLATTFORM_TEXT, sortierePlattformen } from '@/lib/plattformen'
import { PlattformMarke } from './plattform-marken'

/**
 * Die Plattformwahl als Kästchen-Chips — in den Stammdaten, im Anlegen-Dialog
 * und im Editor dieselbe.
 *
 * Bewusst ohne eigenen Zustand: Es sind gewöhnliche Kästchen mit demselben
 * Namen, der Server liest sie mit `formular.getAll`. Ein React-Zustand
 * brächte hier nichts außer einer zweiten Wahrheit.
 *
 * Das versteckte Merkerfeld trennt „nichts angehakt" von „Feld war gar nicht
 * im Formular" — dieselbe Vorsichtsmaßnahme wie beim Referenz-Link, den
 * `postSpeichern` sonst bei jedem Speichern löschen würde.
 *
 * **Was nicht eingerichtet ist, steht gesperrt da statt zu fehlen.** Ein
 * verschwundenes Facebook ließe jemanden suchen, wo nichts ist; ein graues
 * mit Begründung sagt in einem Blick, was zu tun wäre. Gesperrte Kästchen
 * schickt der Browser nicht mit — der Zustand ist damit nicht nur verboten,
 * sondern unerreichbar.
 */
export function PlattformWahl({
  name = 'plattformen',
  auswahl,
  moeglich = GEBAUTE_PLATTFORMEN,
  gesperrt,
  leerText,
}: {
  name?: string
  /** Was angehakt startet. */
  auswahl: readonly Plattform[]
  /**
   * Was wählbar ist. In den Stammdaten das, wofür ein Kanal zugeordnet ist;
   * am Beitrag zusätzlich beschnitten auf das, was der Kunde führt — mehr als
   * sein Kunde kann ein Beitrag nicht.
   */
  moeglich?: readonly Plattform[]
  /** Gezeigt, aber gesperrt: je Plattform der Grund. */
  gesperrt?: Partial<Record<Plattform, string>>
  /** Wenn gar nichts zur Wahl steht. */
  leerText?: string
}) {
  const zurWahl = sortierePlattformen(moeglich)
  const gesperrte = sortierePlattformen(
    (Object.keys(gesperrt ?? {}) as Plattform[]).filter((p) => !zurWahl.includes(p)),
  )

  if (zurWahl.length === 0 && gesperrte.length === 0) {
    return (
      <p className="text-[11.5px] leading-relaxed text-leiser">
        {leerText ?? 'Für diesen Kunden ist keine Plattform eingerichtet. Das wird in den Stammdaten gesetzt.'}
      </p>
    )
  }

  return (
    <div className="flex flex-wrap gap-2">
      <input type="hidden" name={`${name}Gesetzt`} value="1" />

      {zurWahl.map((p) => (
        <label key={p} className="cursor-pointer">
          <input
            type="checkbox"
            name={name}
            value={p}
            defaultChecked={auswahl.includes(p)}
            className="peer sr-only"
          />
          <span className="flex items-center gap-1.5 rounded-[5px] border border-rahmen-3 px-2.5 py-1.5 text-[12.5px] text-leise transition-colors hover:border-rahmen-4 peer-checked:border-akzent peer-checked:bg-akzent-zart peer-checked:text-tinte peer-focus-visible:border-rahmen-4">
            <PlattformMarke plattform={p} groesse={13} />
            {PLATTFORM_TEXT[p]}
          </span>
        </label>
      ))}

      {gesperrte.map((p) => (
        <span
          key={p}
          title={gesperrt?.[p]}
          className="flex cursor-not-allowed items-center gap-1.5 rounded-[5px] border border-dashed border-rahmen-3 bg-flaeche-leise px-2.5 py-1.5 text-[12.5px] text-stiller"
        >
          <PlattformMarke plattform={p} groesse={13} />
          {PLATTFORM_TEXT[p]}
          <span className="text-[11px] text-stiller">· {gesperrt?.[p]}</span>
        </span>
      ))}
    </div>
  )
}
