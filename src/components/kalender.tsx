import type { Plattform, PostTyp, Verhaeltnis } from '@prisma/client'
import { Sprung } from './sprung'
import { monatsbeginn } from '@/lib/datum'
import { kalenderwoche } from '@/lib/format'
import { postBezeichnung, standardVerhaeltnis } from '@/lib/verhaeltnis'
import { PLATTFORM_TEXT, sortierePlattformen } from '@/lib/plattformen'
import { PlattformMarken } from './plattform-marken'
import { TYP_FARBE, TYP_TEXT, TypPunkt } from './ui'

export type Kalendereintrag = {
  id: string
  typ: PostTyp
  /** Entscheidet, ob ein Video „Reel" oder „Video" heißt. */
  verhaeltnis?: Verhaeltnis
  titel: string
  /** Ohne Termin: der Post ist noch ungeplant. */
  postenAm: Date | null
  /** Sprungmarke oder Link auf den Post. */
  href?: string
  /**
   * Überschreibt die Typfarbe des Punktes. Gesetzt nur im Kalender über alle
   * Kunden, wo der Punkt für den Kunden steht statt für den Typ — dort ist die
   * Frage „von wem" wichtiger als „was".
   */
  farbe?: string
  /**
   * Wohin der Beitrag geht. Nur in den internen Kalendern gesetzt: Beim
   * Kunden ist der Kalender eine Sprungmarkenleiste, und dort steht die
   * Auskunft ohnehin am Beitrag selbst.
   */
  plattformen?: readonly Plattform[]
}

/**
 * Der Tooltip trägt immer alles: Typ, Titel und — wo gesetzt — die
 * Plattformen. In der Zelle ist für drei Angaben kein Platz, im Tooltip
 * schon, und dort sucht man sie auch.
 */
function eintragTitel(eintrag: Kalendereintrag): string {
  const basis = `${postBezeichnung(eintrag.typ, eintrag.verhaeltnis ?? standardVerhaeltnis(eintrag.typ))} · ${eintrag.titel}`
  const plattformen = sortierePlattformen(eintrag.plattformen ?? [])
  return plattformen.length > 0
    ? `${basis} · ${plattformen.map((p) => PLATTFORM_TEXT[p]).join(', ')}`
    : basis
}

export const WOCHENTAGE = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

/** Die Wochenzeilen eines Monats — jede von Montag bis Sonntag. */
export function wochenDesMonats(monat: Date): Date[][] {
  const ersterTag = new Date(monat.getFullYear(), monat.getMonth(), 1)
  const letzterTag = new Date(monat.getFullYear(), monat.getMonth() + 1, 0)

  const wochen: Date[][] = []
  for (let start = wochenbeginn(ersterTag); start <= letzterTag; start.setDate(start.getDate() + 7)) {
    wochen.push(
      Array.from({ length: 7 }, (_, i) => {
        const t = new Date(start)
        t.setDate(t.getDate() + i)
        return t
      }),
    )
  }
  return wochen
}

// Was in eine Zelle fester Höhe passt; der Rest steht als „+n weitere" darunter.
const MAX_EINTRAEGE = 3
// Mobil sind es Punkte statt Zeilen — davon passen mehr nebeneinander.
const MAX_KOMPAKT = 4

/** Montag der Woche, in der das Datum liegt. */
export function wochenbeginn(datum: Date): Date {
  const d = new Date(datum.getFullYear(), datum.getMonth(), datum.getDate())
  const versatz = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - versatz)
  return d
}

export function gleicherTag(a: Date, b: Date): boolean {
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
  ohneRahmen,
  ohneTypname,
}: {
  monat: Date
  eintraege: Kalendereintrag[]
  kompakt?: boolean
  /** Wenn der Kalender schon in einer Karte mit eigener Kopfzeile sitzt. */
  ohneRahmen?: boolean
  /**
   * Lässt „Reel · " vor dem Titel weg — nur in der Anzeige, im Tooltip bleibt
   * es. Für den Kalender über alle Kunden: Dort steht der Kundenname vorn, und
   * neben ihm ist das Typwort verschenkter Platz, weil der farbige Punkt es
   * ohnehin sagt.
   */
  ohneTypname?: boolean
}) {
  const wochen = wochenDesMonats(monat)

  const monatsName = new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' }).format(monat)

  return (
    <div>
      {!ohneRahmen && (
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
      )}

      <div
        className={
          ohneRahmen
            ? 'overflow-hidden bg-flaeche'
            : 'overflow-hidden rounded-md border border-rahmen bg-flaeche'
        }
      >
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
              const desTages = eintraege.filter((e) => e.postenAm && gleicherTag(e.postenAm, tag))
              const sichtbar = desTages.slice(0, kompakt ? MAX_KOMPAKT : MAX_EINTRAEGE)
              const weitere = desTages.length - sichtbar.length

              return (
                <div
                  key={tag.toISOString()}
                  // Feste Höhe: ein Kalender, dessen Zeilen je nach Textlänge
                  // springen, ist als Übersicht wertlos. Mobil niedriger, weil
                  // dort nur Punkte stehen.
                  className={`flex min-w-0 flex-col overflow-hidden border-r border-rahmen px-1 py-1.5 last:border-r-0 sm:px-1.5 ${
                    imMonat ? '' : 'bg-flaeche-leise/60'
                  } ${kompakt ? 'h-[54px]' : 'h-[52px] sm:h-[82px]'}`}
                >
                  <span
                    className={`block shrink-0 text-center text-[10.5px] leading-none sm:text-left ${
                      imMonat ? 'text-leise' : 'text-stiller'
                    }`}
                  >
                    {tag.getDate()}
                  </span>

                  {/*
                   * Zwei Darstellungen statt einer, die beides versucht:
                   * mobil nur Punkte — mittig, etwas größer und ohne Limit,
                   * weil Punkte umbrechen können. Ab sm die Textzeilen mit
                   * „+n weitere", wo der Platz begrenzt ist.
                   */}
                  <div className="mt-1 flex min-h-0 flex-1 flex-wrap items-center justify-center gap-1 overflow-hidden sm:hidden">
                    {desTages.map((eintrag) => {
                      const beschriftung = eintragTitel(eintrag)
                      const punkt = (
                        <span
                          aria-hidden
                          className="block size-[9px] rounded-full"
                          style={{ background: eintrag.farbe ?? TYP_FARBE[eintrag.typ] }}
                        />
                      )
                      return eintrag.href ? (
                        <Sprung key={eintrag.id} href={eintrag.href} title={beschriftung} className="block">
                          {punkt}
                        </Sprung>
                      ) : (
                        <span key={eintrag.id} title={beschriftung} className="block">
                          {punkt}
                        </span>
                      )
                    })}
                  </div>

                  <div className="mt-1 hidden min-h-0 flex-1 flex-col gap-[3px] overflow-hidden sm:flex">
                    {sichtbar.map((eintrag) => {
                      const beschriftung = eintragTitel(eintrag)
                      // Der Tooltip trägt immer alles; gekürzt wird nur, was
                      // in der Zelle steht.
                      const anzeige = ohneTypname ? eintrag.titel : beschriftung
                      const inhalt = (
                        <span className="flex min-w-0 items-center gap-1.5">
                          <span
                            aria-hidden
                            className="block size-[6px] shrink-0 rounded-full"
                            style={{ background: eintrag.farbe ?? TYP_FARBE[eintrag.typ] }}
                          />
                          {!kompakt && (
                            <span className="min-w-0 flex-1 truncate text-[9.5px] leading-none text-tinte-3">
                              {anzeige}
                            </span>
                          )}
                          {/*
                            Hinter dem Titel und `shrink-0`: In einer Tagzelle
                            ist der Titel das Wichtigste und darf zuerst
                            gekürzt werden — die Marken sind zwei feste Glyphen
                            oder gar nichts.
                          */}
                          {!kompakt && (
                            <PlattformMarken
                              plattformen={eintrag.plattformen ?? []}
                              groesse={9}
                              klasse="text-stiller"
                            />
                          )}
                        </span>
                      )

                      return eintrag.href ? (
                        <Sprung
                          key={eintrag.id}
                          href={eintrag.href}
                          className="block shrink-0 rounded-[3px] px-0.5 py-[3px] transition-colors hover:bg-flaeche-tief"
                          title={beschriftung}
                        >
                          {inhalt}
                        </Sprung>
                      ) : (
                        <span
                          key={eintrag.id}
                          className="block shrink-0 px-0.5 py-[3px]"
                          title={beschriftung}
                        >
                          {inhalt}
                        </span>
                      )
                    })}

                    {weitere > 0 && (
                      <span
                        className="shrink-0 px-0.5 text-[9px] leading-none text-stiller"
                        title={desTages
                          .slice(sichtbar.length)
                          .map(eintragTitel)
                          .join('\n')}
                      >
                        +{weitere} weitere
                      </span>
                    )}
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

/**
 * Alle Monate zwischen zwei reinen Datumswerten — der Zeitraum darf mehr als
 * einen umfassen. `von` und `bis` kommen als UTC-Mitternacht aus der Datenbank.
 */
export function monateImZeitraum(von: Date, bis: Date): Date[] {
  const monate: Date[] = []
  const lauf = monatsbeginn(von)
  const ende = monatsbeginn(bis)
  while (lauf <= ende) {
    monate.push(new Date(lauf))
    lauf.setMonth(lauf.getMonth() + 1)
  }
  return monate.length > 0 ? monate : [monatsbeginn(von)]
}
