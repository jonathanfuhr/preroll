import type { Plattform, VeroeffentlichungStand } from '@prisma/client'
import { PLATTFORM_TEXT } from '@/lib/plattformen'

export type VeroeffentlichungZeile = {
  plattform: Plattform
  stand: VeroeffentlichungStand
  geplantFuer: Date
  meldung: string | null
  versuche: number
}

const UHRZEIT = new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' })

const TEXT: Record<VeroeffentlichungStand, string> = {
  GEPLANT: 'geht raus am',
  LAEUFT: 'wird gerade veröffentlicht',
  UEBERGEBEN: 'an die Plattform übergeben für',
  ERFOLGT: 'veröffentlicht am',
  FEHLGESCHLAGEN: 'nicht veröffentlicht',
}

/**
 * Was Preroll mit diesem Beitrag vorhat oder gemacht hat.
 *
 * Steht bewusst **über** dem Editor und nicht darin: Es ist keine Eingabe,
 * sondern eine Auskunft — und wer einen Beitrag öffnet, dessen Termin gerade
 * verstrichen ist, soll es sehen, bevor er anfängt zu tippen.
 */
export function VeroeffentlichungStandLeiste({
  zeilen,
}: {
  zeilen: VeroeffentlichungZeile[]
}) {
  if (zeilen.length === 0) return null

  const gescheitert = zeilen.some((z) => z.stand === 'FEHLGESCHLAGEN')

  return (
    <div
      className={`mb-5 rounded-lg border px-4 py-3 ${
        gescheitert ? 'border-[#eec9c6] bg-akzent-zart' : 'border-rahmen bg-flaeche-leise'
      }`}
    >
      <ul className="grid gap-1.5">
        {zeilen.map((z) => (
          <li key={z.plattform} className="text-[12.5px] leading-relaxed">
            <strong
              className={`font-medium ${
                z.stand === 'FEHLGESCHLAGEN' ? 'text-akzent-dunkel' : 'text-tinte-3'
              }`}
            >
              {PLATTFORM_TEXT[z.plattform]}
            </strong>{' '}
            <span className={z.stand === 'FEHLGESCHLAGEN' ? 'text-akzent-dunkel/80' : 'text-leise'}>
              {TEXT[z.stand]}
              {z.stand === 'LAEUFT' || z.stand === 'FEHLGESCHLAGEN'
                ? ''
                : ` ${UHRZEIT.format(z.geplantFuer)}`}
              {z.meldung ? ` — ${z.meldung}` : ''}
              {z.versuche > 1 && z.stand !== 'ERFOLGT' ? ` (${z.versuche} Versuche)` : ''}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
