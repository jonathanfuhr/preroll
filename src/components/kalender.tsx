import type { PostTyp } from '@prisma/client'
import Link from 'next/link'
import { kalenderwoche } from '@/lib/format'
import { TYP_FARBE, TYP_TEXT, TypPunkt } from './ui'

export type Kalendereintrag = {
  id: string
  typ: PostTyp
  titel: string
  postenAm: Date
  /** Sprungmarke oder Link auf den Post. */
  href?: string
}

const WOCHENTAGE = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

/** Montag der Woche, in der das Datum liegt. */
function wochenbeginn(datum: Date): Date {
  const d = new Date(datum.getFullYear(), datum.getMonth(), datum.getDate())
  const versatz = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - versatz)
  return d
}

function gleicherTag(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  )
}

/**
 * Monatskalender mit KW-Zeilen und farbigen Punkten je Post-Typ — angelehnt
 * an den bisherigen Content-Kalender der Agentur. Deckt der Zeitraum mehrere
 * Monate ab, wird der Kalender je Monat wiederholt.
 */
export function Monatskalender({
  monat,
  eintraege,
  kompakt,
}: {
  monat: Date
  eintraege: Kalendereintrag[]
  kompakt?: boolean
}) {
  const ersterTag = new Date(monat.getFullYear(), monat.getMonth(), 1)
  const letzterTag = new Date(monat.getFullYear(), monat.getMonth() + 1, 0)

  const wochen: Date[][] = []
  for (let start = wochenbeginn(ersterTag); start <= letzterTag; start.setDate(start.getDate() + 7)) {
    const woche = Array.from({ length: 7 }, (_, i) => {
      const t = new Date(start)
      t.setDate(t.getDate() + i)
      return t
    })
    wochen.push(woche)
  }

  const monatsName = new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' }).format(monat)

  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="text-[15px] font-semibold capitalize text-tinte">{monatsName}</h3>
        <div className="flex items-center gap-3.5">
          {(['REEL', 'KARUSSELL', 'BEITRAG'] as PostTyp[]).map((typ) => (
            <span key={typ} className="flex items-center gap-1.5 text-[10.5px] text-leiser">
              <TypPunkt typ={typ} groesse={6} />
              {TYP_TEXT[typ]}
            </span>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-md border border-rahmen bg-flaeche">
        <div className="grid grid-cols-[38px_repeat(7,1fr)] border-b border-rahmen bg-flaeche-leise">
          <span className="px-2 py-2 text-[9.5px] font-medium uppercase tracking-[0.1em] text-still">
            KW
          </span>
          {WOCHENTAGE.map((tag) => (
            <span
              key={tag}
              className="px-2 py-2 text-center text-[10.5px] font-medium text-still"
            >
              {tag}
            </span>
          ))}
        </div>

        {wochen.map((woche) => (
          <div
            key={woche[0].toISOString()}
            className="grid grid-cols-[38px_repeat(7,1fr)] border-b border-rahmen last:border-b-0"
          >
            <span className="flex items-start justify-center border-r border-rahmen bg-flaeche-leise px-1 py-2 font-mono text-[10.5px] text-still">
              {kalenderwoche(woche[0])}
            </span>

            {woche.map((tag) => {
              const imMonat = tag.getMonth() === monat.getMonth()
              const desTages = eintraege.filter((e) => gleicherTag(e.postenAm, tag))

              return (
                <div
                  key={tag.toISOString()}
                  className={`min-h-[${kompakt ? '54' : '78'}px] border-r border-rahmen px-1.5 py-1.5 last:border-r-0 ${
                    imMonat ? '' : 'bg-flaeche-leise/60'
                  }`}
                  style={{ minHeight: kompakt ? 54 : 78 }}
                >
                  <span
                    className={`block text-[10.5px] ${imMonat ? 'text-leise' : 'text-stiller'}`}
                  >
                    {tag.getDate()}
                  </span>

                  <div className="mt-1 grid gap-1">
                    {desTages.map((eintrag) => {
                      const inhalt = (
                        <span className="flex items-center gap-1.5">
                          <span
                            aria-hidden
                            className="block size-[6px] shrink-0 rounded-full"
                            style={{ background: TYP_FARBE[eintrag.typ] }}
                          />
                          {!kompakt && (
                            <span className="truncate text-[9.5px] leading-tight text-tinte-3">
                              {TYP_TEXT[eintrag.typ]} · {eintrag.titel}
                            </span>
                          )}
                        </span>
                      )

                      return eintrag.href ? (
                        <Link
                          key={eintrag.id}
                          href={eintrag.href}
                          className="block rounded-[3px] px-0.5 py-0.5 transition-colors hover:bg-flaeche-tief"
                          title={`${TYP_TEXT[eintrag.typ]} · ${eintrag.titel}`}
                        >
                          {inhalt}
                        </Link>
                      ) : (
                        <span key={eintrag.id} className="block px-0.5 py-0.5" title={eintrag.titel}>
                          {inhalt}
                        </span>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

/** Alle Monate zwischen zwei Daten — der Zeitraum darf mehr als einen umfassen. */
export function monateImZeitraum(von: Date, bis: Date): Date[] {
  const monate: Date[] = []
  const lauf = new Date(von.getFullYear(), von.getMonth(), 1)
  const ende = new Date(bis.getFullYear(), bis.getMonth(), 1)
  while (lauf <= ende) {
    monate.push(new Date(lauf))
    lauf.setMonth(lauf.getMonth() + 1)
  }
  return monate.length > 0 ? monate : [new Date(von.getFullYear(), von.getMonth(), 1)]
}
