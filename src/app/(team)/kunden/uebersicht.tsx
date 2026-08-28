'use client'

import { formatiereTermin } from '@/lib/datum'
import type { PostStatus } from '@prisma/client'
import Link from 'next/link'
import { useMemo, useState, useTransition } from 'react'
import type { Veroeffentlichungslage } from '@/lib/status'
import { Karte, KnopfLink, Leerzustand, StatusBadge } from '@/components/ui'

// Zone ausdrücklich: Hier steht ein Posting-Termin, und der gilt in der Zone
// der Agentur — dieses Bauteil rendert im Browser. Siehe `datum.ts`.
const DATUM: Intl.DateTimeFormatOptions = {
  weekday: 'short',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
}

export type Kundenkachel = {
  id: string
  angeheftet: boolean
  slug: string
  name: string
  handle: string | null
  logo: string | null
  naechsterTermin: Date | null
  naechsterStatus: PostStatus | null
  naechsterVeroeffentlichungen: Veroeffentlichungslage
  offenePosts: number
  offeneKommentare: number
  freigabeOffen: number
}

type Filter = 'alle' | 'freigabe' | 'kommentare'

const FILTER: Array<{ wert: Filter; text: string }> = [
  { wert: 'alle', text: 'Alle' },
  { wert: 'freigabe', text: 'Freigabe offen' },
  { wert: 'kommentare', text: 'Neue Kommentare' },
]

/**
 * Kundenübersicht nach Mockup 2a: Suchfeld und Filter über den Karten, in der
 * Unterzeile die Beiträge in Arbeit. Gesucht wird im Browser — ein Bestand von
 * Kunden passt in eine Antwort.
 */
export function Kundenuebersicht({
  kunden,
  umschalten,
}: {
  kunden: Kundenkachel[]
  umschalten: (kundeId: string) => Promise<void>
}) {
  const [suche, setSuche] = useState('')
  const [filter, setFilter] = useState<Filter>('alle')
  const [, starte] = useTransition()

  const gefiltert = useMemo(() => {
    const begriff = suche.trim().toLowerCase()
    return kunden.filter((kunde) => {
      if (filter === 'freigabe' && kunde.freigabeOffen === 0) return false
      if (filter === 'kommentare' && kunde.offeneKommentare === 0) return false
      if (!begriff) return true
      return (
        kunde.name.toLowerCase().includes(begriff) ||
        (kunde.handle ?? '').toLowerCase().includes(begriff)
      )
    })
  }, [kunden, suche, filter])

  const inArbeit = kunden.reduce((summe, k) => summe + k.offenePosts, 0)

  if (kunden.length === 0) {
    return (
      <>
        <Kopf
          untertitel="Noch kein Kunde angelegt"
          suche={suche}
          setSuche={setSuche}
          filter={filter}
          setFilter={setFilter}
          filterZeigen={false}
        />
        <Leerzustand
          titel="Noch kein Kunde angelegt"
          text="Lege den ersten Kunden an, um Posting-Termine zu planen und Freigabe-Links zu verschicken."
          aktion={
            <KnopfLink art="primaer" href="/kunden/neu">
              Kunde anlegen
            </KnopfLink>
          }
        />
      </>
    )
  }

  return (
    <>
      <Kopf
        untertitel={`${kunden.length} ${kunden.length === 1 ? 'aktiver Kunde' : 'aktive Kunden'} · ${inArbeit} ${
          inArbeit === 1 ? 'Beitrag' : 'Beiträge'
        } in Arbeit`}
        suche={suche}
        setSuche={setSuche}
        filter={filter}
        setFilter={setFilter}
        filterZeigen
      />

      {gefiltert.length === 0 ? (
        <Leerzustand titel="Nichts gefunden" text="Andere Suche oder anderer Filter." />
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-5">
          {gefiltert.map((kunde) => (
            <div key={kunde.id} className="group relative">
              <button
                type="button"
                onClick={() => starte(async () => { await umschalten(kunde.id) })}
                aria-label={kunde.angeheftet ? `${kunde.name} lösen` : `${kunde.name} anheften`}
                title={kunde.angeheftet ? 'Nicht mehr anheften' : 'An die Seitenleiste heften'}
                className={`absolute right-3 top-3 z-10 rounded p-1.5 transition-opacity ${
                  kunde.angeheftet
                    ? 'text-akzent opacity-100'
                    : 'text-stiller opacity-0 group-hover:opacity-100'
                }`}
              >
                <Stern gefuellt={kunde.angeheftet} />
              </button>

              <Link href={`/kunden/${kunde.slug}`} className="block">
              <Karte className="h-full p-[22px] transition-all hover:border-rahmen-4 hover:shadow-[0_6px_20px_rgba(28,22,16,.07)]">
                <div className="flex items-center gap-3.5">
                  {kunde.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={kunde.logo}
                      alt=""
                      className="size-[46px] shrink-0 rounded-lg object-cover"
                    />
                  ) : (
                    <span className="schraffur flex size-[46px] shrink-0 items-center justify-center rounded-lg border border-dashed border-rahmen-3 font-mono text-[8px] text-leiser">
                      Logo
                    </span>
                  )}
                  <div className="min-w-0">
                    <div className="truncate text-[15px] font-semibold text-tinte">{kunde.name}</div>
                    {kunde.handle && (
                      <div className="truncate text-[12px] text-leiser">@{kunde.handle}</div>
                    )}
                  </div>
                </div>

                <dl className="mt-[22px] grid gap-2.5 border-t border-rahmen pt-4 text-[12px]">
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-[11px] uppercase tracking-[0.1em] text-still">
                      Nächster Post
                    </dt>
                    <dd className="text-right text-[13px] text-tinte-3">
                      {kunde.naechsterTermin ? (
                        <span className="flex items-center gap-2">
                          {kunde.naechsterStatus && (
                            <StatusBadge
                              status={kunde.naechsterStatus}
                              postenAm={kunde.naechsterTermin}
                              veroeffentlichungen={kunde.naechsterVeroeffentlichungen}
                              klein
                            />
                          )}
                          {formatiereTermin(kunde.naechsterTermin, DATUM)}
                        </span>
                      ) : (
                        '—'
                      )}
                    </dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-still">Beiträge in Arbeit</dt>
                    <dd className="text-tinte-3">{kunde.offenePosts}</dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-still">Freigabe offen</dt>
                    <dd className={kunde.freigabeOffen > 0 ? 'font-medium text-vorschau' : 'text-tinte-3'}>
                      {kunde.freigabeOffen}
                    </dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-still">Offene Kommentare</dt>
                    <dd
                      className={
                        kunde.offeneKommentare > 0 ? 'font-medium text-akzent' : 'text-tinte-3'
                      }
                    >
                      {kunde.offeneKommentare}
                    </dd>
                  </div>
                </dl>
              </Karte>
              </Link>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

function Kopf({
  untertitel,
  suche,
  setSuche,
  filter,
  setFilter,
  filterZeigen,
}: {
  untertitel: string
  suche: string
  setSuche: (wert: string) => void
  filter: Filter
  setFilter: (wert: Filter) => void
  filterZeigen: boolean
}) {
  return (
    <>
      <div className="mb-7 flex flex-wrap items-end justify-between gap-6">
        <div>
          <h1 className="text-[24px] font-semibold tracking-[-0.02em]">Kunden</h1>
          <p className="mt-1 text-[13.5px] text-leise">{untertitel}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3.5">
          <input
            type="search"
            value={suche}
            onChange={(e) => setSuche(e.target.value)}
            placeholder="Kunde suchen …"
            className="w-[240px] rounded-[5px] border border-rahmen-3 bg-flaeche px-3 py-[9px] text-[12.5px] text-tinte placeholder:text-stiller focus:border-rahmen-4 focus:outline-none"
          />
          <KnopfLink art="primaer" href="/kunden/neu">
            Neuer Kunde
          </KnopfLink>
        </div>
      </div>

      {filterZeigen && (
        <div className="mb-8 flex flex-wrap items-center gap-2">
          {FILTER.map((eintrag) => (
            <button
              key={eintrag.wert}
              type="button"
              onClick={() => setFilter(eintrag.wert)}
              aria-pressed={filter === eintrag.wert}
              className={`rounded-full border px-3.5 py-2 text-[12.5px] transition-colors ${
                filter === eintrag.wert
                  ? 'border-tinte text-tinte'
                  : 'border-rahmen-3 text-leise hover:border-rahmen-4'
              }`}
            >
              {eintrag.text}
            </button>
          ))}
        </div>
      )}
    </>
  )
}

function Stern({ gefuellt }: { gefuellt: boolean }) {
  return (
    <svg width="15" height="15" viewBox="0 0 12 12" aria-hidden>
      <path
        d="M6 1 7.55 4.2 11 4.7 8.5 7.15 9.1 10.6 6 8.97 2.9 10.6l.6-3.45L1 4.7l3.45-.5L6 1Z"
        fill={gefuellt ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1"
        strokeLinejoin="round"
      />
    </svg>
  )
}
