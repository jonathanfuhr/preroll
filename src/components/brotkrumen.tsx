'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

/**
 * Pfadanzeige in der Kopfleiste.
 *
 * Der Kunde ergibt sich aus der Adresse, der Titel eines Posts aber nicht —
 * deshalb meldet ihn die Post-Seite über `BrotkrumeSetzen` nach. Ohne das
 * stünde dort nur der Kunde, und der Weg zurück zu ihm fehlte.
 */

type Stufe = { text: string; href?: string }

const Speicher = createContext<{
  zusatz: Stufe[]
  setzeZusatz: (stufen: Stufe[]) => void
}>({ zusatz: [], setzeZusatz: () => {} })

export function BrotkrumenSpeicher({ children }: { children: ReactNode }) {
  const [zusatz, setzeZusatz] = useState<Stufe[]>([])
  const wert = useMemo(() => ({ zusatz, setzeZusatz }), [zusatz])
  return <Speicher.Provider value={wert}>{children}</Speicher.Provider>
}

/** Meldet zusätzliche Stufen an, solange die Seite offen ist. */
export function BrotkrumeSetzen({ stufen }: { stufen: Stufe[] }) {
  const { setzeZusatz } = useContext(Speicher)
  const schluessel = JSON.stringify(stufen)

  useEffect(() => {
    setzeZusatz(JSON.parse(schluessel) as Stufe[])
    return () => setzeZusatz([])
  }, [schluessel, setzeZusatz])

  return null
}

function offenerKunde(pfad: string, kunden: Array<{ slug: string }>): string | null {
  const treffer = /^\/kunden\/([^/]+)/.exec(pfad)
  if (!treffer) return null
  return kunden.some((k) => k.slug === treffer[1]) ? treffer[1] : null
}

export function Brotkrumen({ kunden }: { kunden: Array<{ slug: string; name: string }> }) {
  const pfad = usePathname()
  const { zusatz } = useContext(Speicher)

  const kunde = kunden.find((k) => k.slug === offenerKunde(pfad, kunden))
  const stufen: Stufe[] = []

  if (pfad.startsWith('/kunden')) {
    stufen.push({ text: 'Kunden', href: '/kunden' })
    if (kunde) stufen.push({ text: kunde.name, href: `/kunden/${kunde.slug}` })
  } else if (pfad.startsWith('/bibliothek')) {
    stufen.push({ text: 'Bibliothek' })
  } else if (pfad.startsWith('/einstellungen')) {
    stufen.push({ text: 'Einstellungen', href: '/einstellungen' })
  } else if (pfad.startsWith('/profil')) {
    stufen.push({ text: 'Profil & Sicherheit' })
  }

  stufen.push(...zusatz)

  return (
    <nav className="flex min-w-0 items-center gap-2.5 text-[13px] text-leiser">
      {stufen.map((stufe, i) => {
        const letzte = i === stufen.length - 1
        return (
          <span key={`${stufe.text}-${i}`} className="flex min-w-0 items-center gap-2.5">
            {i > 0 && (
              <span aria-hidden className="text-rahmen-4">
                /
              </span>
            )}
            {stufe.href && !letzte ? (
              <Link href={stufe.href} className="truncate hover:text-tinte">
                {stufe.text}
              </Link>
            ) : (
              <span className="truncate text-tinte">{stufe.text}</span>
            )}
          </span>
        )
      })}
    </nav>
  )
}
