import Link from 'next/link'

export type Monatseintrag = {
  token: string
  titel: string
  /** Freigegebene von insgesamt sichtbaren Beiträgen. */
  erledigt: number
  gesamt: number
}

/**
 * Alle Monate eines Kunden — die Leiste, über die er zwischen seinen
 * Freigaben wechselt.
 *
 * Bis hierher war ein Link eine Sackgasse: Wer den Plan vom Juli noch einmal
 * sehen wollte, musste die alte Mail suchen. Da jede Freigabe genau einen
 * Monat umfasst, ist die Liste der Monate zugleich die Navigation.
 *
 * Auf dem Telefon wird daraus eine waagerechte Reihe — eine Seitenleiste
 * neben 375 px Inhalt gibt es nicht.
 */
export function Monatsleiste({
  monate,
  aktiv,
  mitFreigaben,
}: {
  monate: Monatseintrag[]
  aktiv: string
  /** Bei eigenen Kanälen entfällt der Freigabestand. */
  mitFreigaben: boolean
}) {
  // Mit nur einem Monat gibt es nichts zu wechseln.
  if (monate.length < 2) return null

  return (
    <nav
      aria-label="Monate"
      className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:gap-1 lg:overflow-visible lg:pb-0"
    >
      <span className="hidden pb-1 text-[10.5px] uppercase tracking-[0.14em] text-still lg:block">
        Alle Monate
      </span>

      {monate.map((monat) => {
        const hier = monat.token === aktiv
        const fertig = mitFreigaben && monat.gesamt > 0 && monat.erledigt === monat.gesamt

        return (
          <Link
            key={monat.token}
            href={`/f/${monat.token}`}
            aria-current={hier ? 'page' : undefined}
            className={`flex shrink-0 items-center gap-2 rounded-[5px] border px-3 py-2 text-[12.5px] transition-colors lg:justify-between ${
              hier
                ? 'border-rahmen-4 bg-flaeche font-medium text-tinte'
                : 'border-transparent text-leise hover:border-rahmen-3 hover:text-tinte'
            }`}
          >
            <span className="whitespace-nowrap">{monat.titel}</span>

            {mitFreigaben && (
              <span
                aria-hidden
                title={fertig ? 'alle freigegeben' : `${monat.erledigt} von ${monat.gesamt}`}
                className={`block size-[7px] shrink-0 rounded-full ${
                  fertig ? 'bg-final' : 'bg-vorschau'
                }`}
              />
            )}
          </Link>
        )
      })}
    </nav>
  )
}
