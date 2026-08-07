import Link from 'next/link'

export type Monatseintrag = {
  token: string
  titel: string
  /** Freigegebene von insgesamt sichtbaren Beiträgen. */
  erledigt: number
  gesamt: number
}

/**
 * Alle Monate eines Kunden — die Seitenleiste, über die er zwischen seinen
 * Freigaben wechselt.
 *
 * Bis hierher war ein Link eine Sackgasse: Wer den Plan vom Juli noch einmal
 * sehen wollte, musste die alte Mail suchen. Da jede Freigabe genau einen
 * Monat umfasst, ist die Liste der Monate zugleich die Navigation.
 *
 * Gebaut wie die Seitenleiste im Backend: am Bildschirmrand, über die volle
 * Höhe, beim Scrollen stehenbleibend. Am Telefon gibt es dafür keinen Platz —
 * dort wird daraus eine waagerechte Reihe über dem Inhalt.
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
    <aside
      aria-label="Monate"
      className="sticky top-0 hidden h-screen w-[200px] shrink-0 flex-col border-r border-rahmen bg-flaeche-leise pt-[26px] lg:flex"
    >
      {/* Dieselbe Marke an derselben Stelle wie im Backend — nur ohne Link,
          der Kunde hat hier keinen Ort, an den er zurückkönnte. */}
      <div className="px-[22px] pb-[30px] text-[12px] uppercase tracking-[0.24em] text-tinte">
        preroll
      </div>

      <div className="px-5 pb-3 text-[10.5px] uppercase tracking-[0.14em] text-still">
        Alle Monate
      </div>

      <nav className="grid gap-0.5 overflow-y-auto px-3">
        {monate.map((monat) => (
          <Eintrag key={monat.token} monat={monat} aktiv={aktiv} mitFreigaben={mitFreigaben} />
        ))}
      </nav>
    </aside>
  )
}

/** Dieselben Monate als waagerechte Reihe — für Telefon und Tablet. */
export function MonatsleisteMobil({
  monate,
  aktiv,
  mitFreigaben,
}: {
  monate: Monatseintrag[]
  aktiv: string
  mitFreigaben: boolean
}) {
  if (monate.length < 2) return null

  return (
    <nav
      aria-label="Monate"
      className="flex gap-1.5 overflow-x-auto border-b border-rahmen bg-flaeche-leise px-4 py-2 lg:hidden"
    >
      {monate.map((monat) => (
        <Eintrag key={monat.token} monat={monat} aktiv={aktiv} mitFreigaben={mitFreigaben} />
      ))}
    </nav>
  )
}

function Eintrag({
  monat,
  aktiv,
  mitFreigaben,
}: {
  monat: Monatseintrag
  aktiv: string
  mitFreigaben: boolean
}) {
  const hier = monat.token === aktiv
  const fertig = mitFreigaben && monat.gesamt > 0 && monat.erledigt === monat.gesamt

  return (
    <Link
      href={`/f/${monat.token}`}
      aria-current={hier ? 'page' : undefined}
      className={`flex shrink-0 items-center gap-2.5 rounded-[5px] px-3 py-2.5 text-[13px] transition-colors lg:justify-between ${
        hier
          ? 'bg-flaeche font-medium text-tinte shadow-[0_1px_2px_rgba(28,22,16,.06)]'
          : 'text-leise hover:text-tinte'
      }`}
    >
      <span className="whitespace-nowrap">{monat.titel}</span>

      {mitFreigaben && (
        <span
          aria-hidden
          title={fertig ? 'alle freigegeben' : `${monat.erledigt} von ${monat.gesamt} freigegeben`}
          className={`block size-[7px] shrink-0 rounded-full ${fertig ? 'bg-final' : 'bg-vorschau'}`}
        />
      )}
    </Link>
  )
}
