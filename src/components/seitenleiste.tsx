'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'

/**
 * Seitenleiste nach Mockup 2b: 224 px breit, heller Grund, rechts abgesetzt.
 * Der geöffnete Kunde steht unter „Kunden" und klappt seine Bereiche darunter
 * auf — so bleibt sichtbar, wo man ist, ohne eine zweite Navigationsebene.
 */

export type KundeEintrag = {
  slug: string
  name: string
  logo: string | null
}

const BEREICHE = [
  { pfad: '', text: 'Posts' },
  { pfad: '/kommentare', text: 'Kommentare' },
  { pfad: '/freigaben', text: 'Freigaben' },
  { pfad: '/export', text: 'Export' },
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

export function Seitenleiste({
  kunden,
  offeneKommentare,
}: {
  kunden: KundeEintrag[]
  offeneKommentare: Record<string, number>
}) {
  const pfad = usePathname()
  const slug = offenerKunde(pfad, kunden)
  const kunde = kunden.find((k) => k.slug === slug) ?? null
  const basis = kunde ? `/kunden/${kunde.slug}` : ''

  return (
    <aside className="sticky top-0 flex h-screen w-[224px] shrink-0 flex-col border-r border-rahmen bg-flaeche-leise pb-6 pt-[26px]">
      <div className="px-[22px] pb-[30px]">
        <Link href="/kunden" className="text-[12px] uppercase tracking-[0.24em] text-tinte">
          preroll
        </Link>
      </div>

      <nav className="grid gap-0.5 px-3">
        <Punkt href="/kunden" aktiv={pfad === '/kunden'}>
          Kunden
        </Punkt>

        {kunde && (
          <>
            <Punkt href={basis} aktiv={pfad.startsWith(basis)}>
              {kunde.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={kunde.logo} alt="" className="size-[18px] rounded-[4px] object-cover" />
              ) : (
                <span className="schraffur size-[18px] rounded-[4px] border border-rahmen-3" />
              )}
              <span className="truncate">{kunde.name}</span>
            </Punkt>

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

        <div className="mt-1.5">
          <Punkt href="/bibliothek" aktiv={pfad.startsWith('/bibliothek')}>
            Bibliothek
          </Punkt>
        </div>
      </nav>

      <div className="flex-1" />
    </aside>
  )
}
