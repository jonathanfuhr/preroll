import type { Plattform, VeroeffentlichungStand } from '@prisma/client'
import { PLATTFORM_TEXT } from '@/lib/plattformen'
import { veroeffentlichungWiederholen } from './veroeffentlichung-aktionen'

export type VeroeffentlichungZeile = {
  id: string
  plattform: Plattform
  stand: VeroeffentlichungStand
  geplantFuer: Date
  erledigtAm: Date | null
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
 *
 * Bei einem Fehlschlag steht hier auch der Weg zurück. Ohne ihn bliebe eine
 * gescheiterte Veröffentlichung für immer liegen: Der Zeitplaner holt von
 * sich aus nur, was auf `GEPLANT` steht.
 */
export function VeroeffentlichungStandLeiste({
  zeilen,
  slug,
  postId,
}: {
  zeilen: VeroeffentlichungZeile[]
  slug: string
  postId: string
}) {
  if (zeilen.length === 0) return null

  const gescheitert = zeilen.some((z) => z.stand === 'FEHLGESCHLAGEN')

  return (
    <div
      className={`mb-5 rounded-lg border px-4 py-3 ${
        gescheitert ? 'border-[#eec9c6] bg-akzent-zart' : 'border-rahmen bg-flaeche-leise'
      }`}
    >
      <ul className="grid gap-2">
        {zeilen.map((z) => {
          const fehler = z.stand === 'FEHLGESCHLAGEN'
          // Der Zeitpunkt, der zählt: bei Erledigtem der tatsächliche, sonst
          // der geplante. Sie fallen auseinander, wenn ein Termin nachgeholt
          // wurde — und genau das will man dann sehen.
          const zeitpunkt = z.stand === 'ERFOLGT' ? (z.erledigtAm ?? z.geplantFuer) : z.geplantFuer

          return (
            <li key={z.plattform} className="text-[12.5px] leading-relaxed">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <strong className={`font-medium ${fehler ? 'text-akzent-dunkel' : 'text-tinte-3'}`}>
                  {PLATTFORM_TEXT[z.plattform]}
                </strong>
                <span className={fehler ? 'text-akzent-dunkel/80' : 'text-leise'}>
                  {TEXT[z.stand]}
                  {z.stand === 'LAEUFT' || fehler ? '' : ` ${UHRZEIT.format(zeitpunkt)}`}
                  {z.versuche > 1 && z.stand !== 'ERFOLGT' ? ` · ${z.versuche} Versuche` : ''}
                </span>

                {fehler && (
                  <form
                    action={veroeffentlichungWiederholen.bind(null, z.id, slug, postId)}
                    className="contents"
                  >
                    <button
                      type="submit"
                      className="text-[11.5px] font-medium text-akzent underline underline-offset-2 hover:text-akzent-dunkel"
                    >
                      Erneut versuchen
                    </button>
                  </form>
                )}
              </div>

              {z.meldung && (
                <p
                  className={`mt-0.5 text-[11.5px] leading-relaxed ${
                    fehler ? 'text-akzent-dunkel/80' : 'text-leiser'
                  }`}
                >
                  {z.meldung}
                </p>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
