import Link from 'next/link'

export type Ansicht = 'liste' | 'kalender' | 'feed'

const ANSICHTEN: Array<{ wert: Ansicht; text: string }> = [
  { wert: 'liste', text: 'Liste' },
  { wert: 'kalender', text: 'Kalender' },
  { wert: 'feed', text: 'Feed' },
]

/** Umschalter zwischen den drei Sichten auf denselben Bestand. */
export function AnsichtsSchalter({ slug, aktiv }: { slug: string; aktiv: Ansicht }) {
  return (
    <div className="flex overflow-hidden rounded-[5px] border border-rahmen-3">
      {ANSICHTEN.map((ansicht) => (
        <Link
          key={ansicht.wert}
          href={ansicht.wert === 'liste' ? `/kunden/${slug}` : `/kunden/${slug}?ansicht=${ansicht.wert}`}
          className={`px-3.5 py-1.5 text-[12px] transition-colors ${
            aktiv === ansicht.wert
              ? 'bg-tinte font-medium text-white'
              : 'bg-flaeche text-leise hover:bg-flaeche-tief'
          }`}
        >
          {ansicht.text}
        </Link>
      ))}
    </div>
  )
}
