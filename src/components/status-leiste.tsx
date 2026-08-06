import { STUFEN, STUFE_TEXT, stufenErklaerung, type Stufe } from '@/lib/status'

/**
 * Der Weg eines Beitrags als waagerechte Leiste: Konzept → Vorschau → Final →
 * Gepostet.
 *
 * Ein einzelnes Etikett sagt nur, wo etwas gerade steht — nicht, was noch
 * kommt. Beim Kunden ist genau das die Frage: Bin ich dran, oder wartet der
 * Beitrag auf uns?
 *
 * Bewusst ohne JavaScript: Die Erklärungsbox hängt an `group-hover`, das
 * genügt und spart eine Client-Insel je Beitrag.
 */

const FARBE: Record<Stufe, string> = {
  KONZEPT: 'var(--color-konzept)',
  VORSCHAU: 'var(--color-vorschau)',
  FINAL: 'var(--color-final)',
  GEPOSTET: 'var(--color-final)',
}

export function StatusLeiste({
  stufe,
  mitFreigaben,
}: {
  stufe: Stufe
  /** Bei eigenen Kanälen entfällt der Satz über die Freigabe. */
  mitFreigaben: boolean
}) {
  const erreicht = STUFEN.indexOf(stufe)

  return (
    <div className="flex w-full max-w-[420px] items-start">
      {STUFEN.map((s, i) => {
        const vorbei = i < erreicht
        const hier = i === erreicht
        const farbe = FARBE[s]

        return (
          <div key={s} className="flex min-w-0 flex-1 flex-col items-center last:flex-none">
            <div className="flex w-full items-center">
              {/* Linie davor — beim ersten Punkt gibt es keine. */}
              {i > 0 && (
                <span
                  aria-hidden
                  className="h-px flex-1"
                  style={{ background: i <= erreicht ? farbe : 'var(--color-rahmen-3)' }}
                />
              )}

              <span className="group relative flex shrink-0 flex-col items-center">
                <span
                  className="block size-[11px] rounded-full transition-colors"
                  style={
                    hier
                      ? {
                          background: s === 'FINAL' ? 'transparent' : farbe,
                          border: `2px solid ${farbe}`,
                          // Der aktive Punkt leuchtet — sonst sucht man ihn.
                          boxShadow: `0 0 0 4px color-mix(in srgb, ${farbe} 22%, transparent)`,
                        }
                      : vorbei
                        ? { background: farbe }
                        : {
                            background: 'var(--color-flaeche)',
                            border: '1.5px solid var(--color-rahmen-3)',
                          }
                  }
                />

                {/* Erklärungsbox. Der letzte Punkt zieht sie nach links, damit
                    sie nicht aus dem Bild läuft. */}
                <span
                  role="tooltip"
                  className={`pointer-events-none absolute bottom-[22px] z-30 w-[230px] rounded-md border border-rahmen bg-flaeche px-3 py-2.5 text-[11.5px] leading-relaxed text-leise opacity-0 shadow-lg transition-opacity duration-200 group-hover:opacity-100 ${
                    i === STUFEN.length - 1
                      ? 'right-0'
                      : i === 0
                        ? 'left-0'
                        : 'left-1/2 -translate-x-1/2'
                  }`}
                >
                  <strong className="mb-0.5 block text-[12px] font-semibold" style={{ color: farbe }}>
                    {STUFE_TEXT[s]}
                  </strong>
                  {stufenErklaerung(s, mitFreigaben)}
                </span>
              </span>

              {/* Linie danach — beim letzten Punkt gibt es keine. */}
              {i < STUFEN.length - 1 && (
                <span
                  aria-hidden
                  className="h-px flex-1"
                  style={{ background: i < erreicht ? FARBE[STUFEN[i + 1]] : 'var(--color-rahmen-3)' }}
                />
              )}
            </div>

            <span
              className={`mt-1.5 whitespace-nowrap text-[10.5px] ${hier ? 'font-semibold' : 'text-still'}`}
              style={hier ? { color: farbe } : undefined}
            >
              {STUFE_TEXT[s]}
            </span>
          </div>
        )
      })}
    </div>
  )
}
