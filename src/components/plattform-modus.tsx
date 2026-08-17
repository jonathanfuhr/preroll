import type { Plattform } from '@prisma/client'
import {
  GEBAUTE_PLATTFORMEN,
  MODUS_TEXT,
  modusFuer,
  PLATTFORM_TEXT,
  sortierePlattformen,
  type PlattformModus,
  type Plattformwahl,
} from '@/lib/plattformen'
import { PlattformMarke } from './plattform-marken'

/**
 * Je Plattform ein Auswahlfeld mit drei Zuständen.
 *
 * Vorher waren es Kästchen, und wählbar war nur, wofür ein Kanal zugeordnet
 * war. Damit ließ sich der häufigste Fall nicht ausdrücken: für Instagram
 * planen und von Hand posten. Ein Kästchen kann eben nur „ja" und „nein"; die
 * dritte Auskunft — geplant, aber nicht automatisch — brauchte einen dritten
 * Zustand.
 *
 * **„Planen und posten" steht ohne Kanal gesperrt da, nicht versteckt.** Wer
 * es nicht findet, sucht; wer es grau mit Grund sieht, weiß in einem Blick,
 * was zu tun wäre. Der Server stuft es ohnehin herunter, falls es doch
 * ankommt — die Sperre hier ist Bequemlichkeit, keine Absicherung.
 */
export function PlattformModusWahl({
  wahl,
  mitKanal,
  gruende,
}: {
  wahl: Plattformwahl
  /** Wofür ein Kanal zugeordnet ist — nur dort ist „posten" erlaubt. */
  mitKanal: readonly Plattform[]
  /** Je Plattform ohne Kanal der Grund, damit niemand raten muss. */
  gruende?: Partial<Record<Plattform, string>>
}) {
  return (
    <div className="grid gap-2">
      {/* Trennt „alles auf aus" von „Feld war gar nicht im Formular". */}
      <input type="hidden" name="plattformenGesetzt" value="1" />

      {sortierePlattformen(GEBAUTE_PLATTFORMEN).map((plattform) => {
        const modus = modusFuer(wahl, plattform)
        const kanal = mitKanal.includes(plattform)
        const grund = gruende?.[plattform]

        return (
          <div
            key={plattform}
            className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-[5px] border border-rahmen px-3 py-2"
          >
            <PlattformMarke plattform={plattform} groesse={14} />
            <span className="text-[12.5px] font-medium text-tinte">
              {PLATTFORM_TEXT[plattform]}
            </span>

            <select
              name={`modus_${plattform}`}
              defaultValue={modus}
              className="ml-auto rounded-[5px] border border-rahmen-3 bg-flaeche px-2.5 py-1.5 text-[12.5px] text-tinte focus:border-rahmen-4 focus:outline-none"
            >
              {(['AUS', 'PLANEN', 'POSTEN'] as PlattformModus[]).map((m) => (
                <option key={m} value={m} disabled={m === 'POSTEN' && !kanal}>
                  {MODUS_TEXT[m]}
                  {m === 'POSTEN' && !kanal ? ' — kein Kanal' : ''}
                </option>
              ))}
            </select>

            {!kanal && grund && (
              <span className="w-full text-[11px] text-stiller">{grund}</span>
            )}
          </div>
        )
      })}
    </div>
  )
}
