'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

// „Anmeldung" hat keinen eigenen Reiter mehr — wer Zugänge regelt, ist
// ohnehin bei den Benutzern, und dort steht es jetzt am Ende der Seite.
const REITER = [
  { href: '/einstellungen', text: 'Workspace', exakt: true },
  { href: '/einstellungen/benutzer', text: 'Benutzer' },
  { href: '/einstellungen/mail', text: 'Mailversand' },
  { href: '/einstellungen/klappe', text: 'Klappe' },
  { href: '/einstellungen/awork', text: 'awork' },
]

export function EinstellungenReiter() {
  const pfad = usePathname()

  return (
    <div className="flex flex-wrap gap-1 border-b border-rahmen">
      {REITER.map((r) => {
        const aktiv = r.exakt ? pfad === r.href : pfad.startsWith(r.href)
        return (
          <Link
            key={r.href}
            href={r.href}
            className={`-mb-px border-b-2 px-3.5 py-2.5 text-[13px] transition-colors ${
              aktiv
                ? 'border-tinte font-medium text-tinte'
                : 'border-transparent text-leise hover:text-tinte'
            }`}
          >
            {r.text}
          </Link>
        )
      })}
    </div>
  )
}
