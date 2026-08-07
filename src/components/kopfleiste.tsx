'use client'

import type { Rolle } from '@prisma/client'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { ROLLE_TEXT, darfVerwalten } from '@/lib/rollen'

const ZEIT = new Intl.DateTimeFormat('de-DE', { dateStyle: 'short', timeStyle: 'short' })

export type MeldungZeile = {
  id: string
  titel: string
  text: string
  url: string
  am: string
  gelesen: boolean
}

/** Schließt ein Aufklappmenü bei Klick daneben oder mit Escape. */
function useSchliessen(offen: boolean, schliessen: () => void) {
  const huelle = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!offen) return

    const beiKlick = (e: MouseEvent) => {
      if (huelle.current && !huelle.current.contains(e.target as Node)) schliessen()
    }
    const beiTaste = (e: KeyboardEvent) => {
      if (e.key === 'Escape') schliessen()
    }

    document.addEventListener('mousedown', beiKlick)
    document.addEventListener('keydown', beiTaste)
    return () => {
      document.removeEventListener('mousedown', beiKlick)
      document.removeEventListener('keydown', beiTaste)
    }
  }, [offen, schliessen])

  return huelle
}

/** Glocke mit den ungelesenen Meldungen. */
export function Glocke({
  meldungen,
  ungelesen,
  allesGelesen,
}: {
  meldungen: MeldungZeile[]
  ungelesen: number
  allesGelesen: () => Promise<void>
}) {
  const [offen, setOffen] = useState(false)
  const huelle = useSchliessen(offen, () => setOffen(false))

  return (
    <div ref={huelle} className="relative">
      <button
        type="button"
        onClick={() => setOffen((v) => !v)}
        aria-label={ungelesen > 0 ? `${ungelesen} ungelesene Meldungen` : 'Meldungen'}
        className="relative flex size-9 items-center justify-center rounded-[5px] text-tinte-3 transition-colors hover:bg-flaeche-tief"
      >
        <svg width="17" height="17" viewBox="0 0 20 20" fill="none" aria-hidden>
          <path
            d="M10 2.5a5 5 0 0 0-5 5v3l-1.5 2.5h13L15 10.5v-3a5 5 0 0 0-5-5Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path d="M8 15.5a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        {ungelesen > 0 && (
          <span className="absolute right-1.5 top-1.5 flex min-w-[15px] items-center justify-center rounded-full bg-akzent px-1 text-[9.5px] font-medium leading-[15px] text-white">
            {ungelesen > 9 ? '9+' : ungelesen}
          </span>
        )}
      </button>

      {offen && (
        <div className="absolute right-0 top-11 z-50 w-[340px] overflow-hidden rounded-md border border-rahmen bg-flaeche shadow-xl">
          <div className="flex items-center justify-between border-b border-rahmen px-4 py-2.5">
            <span className="text-[12px] font-medium">Meldungen</span>
            {ungelesen > 0 && (
              <form action={allesGelesen}>
                <button type="submit" className="text-[11.5px] text-leise hover:text-akzent">
                  Alle als gelesen
                </button>
              </form>
            )}
          </div>

          {meldungen.length === 0 ? (
            <p className="px-4 py-8 text-center text-[12.5px] text-leiser">
              Nichts Neues. Rückmeldungen Ihrer Kunden erscheinen hier.
            </p>
          ) : (
            <ul className="max-h-[380px] overflow-y-auto">
              {meldungen.map((m) => (
                <li key={m.id} className="border-b border-rahmen last:border-b-0">
                  <Link
                    href={m.url}
                    onClick={() => setOffen(false)}
                    className={`block px-4 py-3 transition-colors hover:bg-flaeche-leise ${
                      m.gelesen ? '' : 'bg-akzent-zart/40'
                    }`}
                  >
                    <div className="flex items-baseline gap-2">
                      {!m.gelesen && (
                        <span aria-hidden className="mt-1 block size-1.5 shrink-0 rounded-full bg-akzent" />
                      )}
                      <span className="text-[12.5px] font-medium text-tinte">{m.titel}</span>
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-[11.5px] leading-relaxed text-leise">{m.text}</p>
                    <span className="mt-1 block text-[10.5px] text-stiller">
                      {ZEIT.format(new Date(m.am))}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

/** Name oben rechts, darunter Profil, Einstellungen und Abmelden. */
export function Benutzermenue({
  name,
  initialen,
  foto,
  rolle,
  workspace,
  abmelden,
}: {
  name: string
  initialen: string
  /** Aus dem Profil oder aus Microsoft — sonst bleiben es die Initialen. */
  foto?: string | null
  rolle: Rolle
  workspace: string
  abmelden: () => Promise<void>
}) {
  const [offen, setOffen] = useState(false)
  const huelle = useSchliessen(offen, () => setOffen(false))

  const punkte = [
    { href: '/profil', text: 'Profil & Sicherheit' },
    ...(darfVerwalten(rolle) ? [{ href: '/einstellungen', text: 'Einstellungen' }] : []),
  ]

  return (
    <div ref={huelle} className="relative">
      <button
        type="button"
        onClick={() => setOffen((v) => !v)}
        className="flex items-center gap-2.5 rounded-[5px] py-1 pl-2 pr-1.5 transition-colors hover:bg-flaeche-tief"
      >
        {/* Am Telefon genügt das Bild — der Name steht im Menü darunter. */}
        <span className="hidden text-right sm:block">
          <span className="block text-[12.5px] font-medium leading-tight text-tinte">{name}</span>
          <span className="block text-[10.5px] leading-tight text-still">{workspace}</span>
        </span>
        {foto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={foto} alt="" className="size-[30px] rounded-full object-cover" />
        ) : (
          <span className="flex size-[30px] items-center justify-center rounded-full bg-akzent-zart text-[11px] font-semibold text-akzent">
            {initialen}
          </span>
        )}
      </button>

      {offen && (
        <div className="absolute right-0 top-12 z-50 w-[230px] overflow-hidden rounded-md border border-rahmen bg-flaeche shadow-xl">
          <div className="border-b border-rahmen px-4 py-3">
            <div className="text-[12.5px] font-medium">{name}</div>
            <div className="mt-0.5 text-[11px] text-still">{ROLLE_TEXT[rolle]}</div>
          </div>

          <div className="py-1">
            {punkte.map((p) => (
              <Link
                key={p.href}
                href={p.href}
                onClick={() => setOffen(false)}
                className="block px-4 py-2 text-[12.5px] text-tinte-3 transition-colors hover:bg-flaeche-leise hover:text-tinte"
              >
                {p.text}
              </Link>
            ))}
          </div>

          <form action={abmelden} className="border-t border-rahmen">
            <button
              type="submit"
              className="w-full px-4 py-2.5 text-left text-[12.5px] text-leise transition-colors hover:bg-flaeche-leise hover:text-akzent"
            >
              Abmelden
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
