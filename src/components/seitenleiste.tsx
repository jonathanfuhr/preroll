'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createPortal } from 'react-dom'
import { useEffect, useState, useTransition } from 'react'
import type { ReactNode } from 'react'

/**
 * Seitenleiste nach Mockup 2b: 224 px breit, heller Grund, rechts abgesetzt.
 * Der geöffnete Kunde steht unter „Kunden" und klappt seine Bereiche darunter
 * auf — so bleibt sichtbar, wo man ist, ohne eine zweite Navigationsebene.
 */

export type KundeEintrag = {
  id: string
  slug: string
  name: string
  logo: string | null
}

/**
 * Eine Kundenzeile mit Logo, offenen Kommentaren und dem Stern zum Anheften.
 * Der Stern erscheint erst beim Überfahren — angeheftet bleibt er stehen,
 * sonst wüsste niemand, wie man wieder loswird, was man angeheftet hat.
 */
function Kundenzeile({
  kunde,
  aktiv,
  kommentare,
  angeheftet,
  umschalten,
}: {
  kunde: KundeEintrag
  aktiv: boolean
  kommentare: number
  angeheftet: boolean
  umschalten: (kundeId: string) => Promise<void>
}) {
  const [, starte] = useTransition()

  return (
    <div className="group/kunde relative">
      <Punkt href={`/kunden/${kunde.slug}`} aktiv={aktiv}>
        {kunde.logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={kunde.logo} alt="" className="size-[18px] shrink-0 rounded-[4px] object-cover" />
        ) : (
          <span className="schraffur size-[18px] shrink-0 rounded-[4px] border border-rahmen-3" />
        )}
        {/* Rechts bleibt Platz für den Stern, sonst schiebt er sich über den Namen. */}
        <span className="min-w-0 flex-1 truncate pr-5">{kunde.name}</span>

        {kommentare > 0 && (
          <span
            title={`${kommentare} offene Kommentare`}
            className="mr-5 shrink-0 rounded-full bg-akzent px-1.5 py-px text-[10px] font-medium text-white"
          >
            {kommentare}
          </span>
        )}
      </Punkt>

      <button
        type="button"
        onClick={() => starte(async () => { await umschalten(kunde.id) })}
        aria-label={angeheftet ? `${kunde.name} lösen` : `${kunde.name} anheften`}
        title={angeheftet ? 'Nicht mehr anheften' : 'An die Leiste heften'}
        className={`absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 transition-opacity ${
          angeheftet ? 'text-akzent opacity-100' : 'text-stiller opacity-0 group-hover/kunde:opacity-100'
        }`}
      >
        <Stern gefuellt={angeheftet} />
      </button>
    </div>
  )
}

function Stern({ gefuellt }: { gefuellt: boolean }) {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
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

const BEREICHE = [
  { pfad: '', text: 'Posts' },
  { pfad: '/kommentare', text: 'Kommentare' },
  { pfad: '/freigaben', text: 'Freigaben' },
  { pfad: '/stammdaten', text: 'Stammdaten' },
] as const

/** Der Kunde, dessen Bereich gerade offen ist. */
function offenerKunde(pfad: string, kunden: Array<{ slug: string }>): string | null {
  const treffer = /^\/kunden\/([^/]+)/.exec(pfad)
  if (!treffer) return null
  const slug = treffer[1]
  return kunden.some((k) => k.slug === slug) ? slug : null
}

function Punkt({
  href,
  aktiv,
  eingerueckt,
  children,
}: {
  href: string
  aktiv: boolean
  eingerueckt?: boolean
  children: ReactNode
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-2.5 rounded-[5px] transition-colors ${
        eingerueckt
          ? `py-2 pl-10 pr-3 text-[12.5px] ${
              aktiv ? 'font-medium text-akzent' : 'text-leise hover:text-tinte'
            }`
          : `px-3 py-2.5 text-[13.5px] ${
              aktiv
                ? 'bg-flaeche font-medium text-tinte shadow-[0_1px_2px_rgba(28,22,16,.06)]'
                : 'text-leise hover:text-tinte'
            }`
      }`}
    >
      {children}
    </Link>
  )
}

export type Navigationsdaten = {
  kunden: KundeEintrag[]
  /** Angeheftete Kunden dieses Nutzers — stehen dauerhaft in der Leiste. */
  favoriten: KundeEintrag[]
  offeneKommentare: Record<string, number>
  umschalten: (kundeId: string) => Promise<void>
}

/**
 * Die Leiste am Rand — ab `md` (768 px) immer da. Darunter bliebe für die
 * Arbeitsfläche zu wenig übrig; dort steckt derselbe Inhalt in der Schublade
 * hinter dem Knopf in der Kopfzeile (`Navigationsknopf`).
 */
export function Seitenleiste(daten: Navigationsdaten) {
  return (
    <aside className="sticky top-0 hidden h-screen w-[224px] shrink-0 flex-col border-r border-rahmen bg-flaeche-leise pb-6 pt-[26px] md:flex">
      <Navigationsinhalt {...daten} />
      <div className="flex-1" />
    </aside>
  )
}

function Navigationsinhalt({
  kunden,
  favoriten,
  offeneKommentare,
  umschalten,
  aufAuswahl,
}: Navigationsdaten & {
  /** In der Schublade schließt jeder Sprung sie wieder. */
  aufAuswahl?: () => void
}) {
  const pfad = usePathname()
  const slug = offenerKunde(pfad, kunden)
  const kunde = kunden.find((k) => k.slug === slug) ?? null
  const basis = kunde ? `/kunden/${kunde.slug}` : ''

  return (
    <div onClick={aufAuswahl}>
      <div className="px-[22px] pb-[30px]">
        <Link href="/kunden" className="text-[12px] uppercase tracking-[0.24em] text-tinte">
          preroll
        </Link>
      </div>

      <nav className="grid gap-0.5 px-3">
        <Punkt href="/kunden" aktiv={pfad === '/kunden'}>
          Kunden
        </Punkt>

        {/*
          Angeheftete Kunden stehen immer da — der Weg von einem zum nächsten
          führte sonst jedes Mal über die Übersicht.
        */}
        {favoriten
          .filter((f) => f.slug !== slug)
          .map((f) => (
            <Kundenzeile
              key={f.slug}
              kunde={f}
              aktiv={false}
              kommentare={offeneKommentare[f.slug] ?? 0}
              angeheftet
              umschalten={umschalten}
            />
          ))}

        {kunde && (
          <>
            <Kundenzeile
              kunde={kunde}
              aktiv={pfad.startsWith(basis)}
              kommentare={offeneKommentare[kunde.slug] ?? 0}
              angeheftet={favoriten.some((f) => f.slug === kunde.slug)}
              umschalten={umschalten}
            />

            {BEREICHE.map((bereich) => {
              const href = `${basis}${bereich.pfad}`
              const aktiv =
                bereich.pfad === ''
                  ? pfad === basis || pfad.startsWith(`${basis}/posts`)
                  : pfad.startsWith(href)
              const zahl = bereich.pfad === '/kommentare' ? (offeneKommentare[kunde.slug] ?? 0) : 0

              return (
                <Punkt key={bereich.text} href={href} aktiv={aktiv} eingerueckt>
                  <span className="flex-1">{bereich.text}</span>
                  {zahl > 0 && (
                    <span className="rounded-full bg-akzent px-1.5 py-px text-[10px] font-medium text-white">
                      {zahl}
                    </span>
                  )}
                </Punkt>
              )
            })}
          </>
        )}

        {/*
          Die beiden Ansichten über alle Kunden hinweg, abgesetzt von der
          Kundenliste darüber — sie gehören keinem einzelnen.
        */}
        <div className="mt-1.5 grid gap-0.5">
          <Punkt href="/kalender" aktiv={pfad.startsWith('/kalender')}>
            Kalender
          </Punkt>
          <Punkt href="/bibliothek" aktiv={pfad.startsWith('/bibliothek')}>
            Bibliothek
          </Punkt>
        </div>
      </nav>
    </div>
  )
}

/**
 * Am Telefon steht die Navigation hinter einem Knopf in der Kopfzeile. Als
 * feste Leiste bliebe vom Bildschirm nichts übrig — 224 px von 390.
 *
 * Geschlossen wird beim Sprung: Ein Overlay, das nach dem Klick noch über
 * der Zielseite liegt, fühlt sich an wie ein hängengebliebener Klick.
 */
export function Navigationsknopf(daten: Navigationsdaten) {
  const [offen, setOffen] = useState(false)
  // `document` gibt es beim Rendern am Server nicht — das Tor davor.
  const [montiert, setMontiert] = useState(false)
  const pfad = usePathname()

  useEffect(() => setMontiert(true), [])

  // Auch die Rücktaste des Browsers schließt sie — sonst bleibt sie offen,
  // während sich die Seite darunter schon geändert hat.
  useEffect(() => setOffen(false), [pfad])

  // Solange sie offen ist, rollt die Seite dahinter nicht mit.
  useEffect(() => {
    if (!offen) return
    const vorher = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = vorher
    }
  }, [offen])

  return (
    <>
      <button
        type="button"
        onClick={() => setOffen(true)}
        aria-label="Navigation öffnen"
        aria-expanded={offen}
        className="-ml-1.5 shrink-0 rounded-[5px] p-2 text-tinte-3 transition-colors hover:bg-flaeche-tief hover:text-tinte md:hidden"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
          {[4, 9, 14].map((y) => (
            <line key={y} x1="1.5" y1={y} x2="16.5" y2={y} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          ))}
        </svg>
      </button>

      {/*
        Die Schublade hängt am `body`, nicht an der Kopfzeile. Deren
        `backdrop-blur` macht sie zum Bezugsrahmen für alles Feste — die
        Schublade lag dadurch **in** der Kopfzeile und damit hinter dem
        Seiteninhalt statt darüber. Dasselbe gälte für `transform` oder
        `filter` an einem Elternteil.
      */}
      {offen &&
        montiert &&
        createPortal(
          <div className="fixed inset-0 z-50 flex md:hidden">
            <div className="flex h-full w-[264px] max-w-[82vw] flex-col overflow-y-auto border-r border-rahmen bg-flaeche-leise pb-6 pt-[26px]">
              <Navigationsinhalt {...daten} aufAuswahl={() => setOffen(false)} />
            </div>
            <button
              type="button"
              aria-label="Navigation schließen"
              onClick={() => setOffen(false)}
              className="h-full flex-1 bg-tinte/25"
            />
          </div>,
          document.body,
        )}
    </>
  )
}
