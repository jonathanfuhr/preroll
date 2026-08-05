'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export function KundenReiter({
  slug,
  offeneKommentare,
}: {
  slug: string
  offeneKommentare: number
}) {
  const pfad = usePathname()
  const basis = `/kunden/${slug}`

  const reiter = [
    { href: basis, text: 'Posts', exakt: true },
    { href: `${basis}/feed`, text: 'Feed-Vorschau' },
    { href: `${basis}/kalender`, text: 'Kalender' },
    { href: `${basis}/kommentare`, text: 'Kommentare', zaehler: offeneKommentare },
    { href: `${basis}/export`, text: 'Export' },
    { href: `${basis}/ansprechpartner`, text: 'Ansprechpartner' },
    { href: `${basis}/einstellungen`, text: 'Stammdaten' },
  ]

  return (
    <div className="flex gap-1 border-b border-rahmen">
      {reiter.map((r) => {
        const aktiv = r.exakt ? pfad === r.href : pfad.startsWith(r.href)
        return (
          <Link
            key={r.href}
            href={r.href}
            className={`-mb-px flex items-center gap-2 border-b-2 px-3.5 py-2.5 text-[13px] transition-colors ${
              aktiv
                ? 'border-tinte font-medium text-tinte'
                : 'border-transparent text-leise hover:text-tinte'
            }`}
          >
            {r.text}
            {r.zaehler ? (
              <span className="rounded-full bg-akzent px-1.5 py-px text-[10px] font-medium text-white">
                {r.zaehler}
              </span>
            ) : null}
          </Link>
        )
      })}
    </div>
  )
}
