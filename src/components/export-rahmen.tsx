import type { ReactNode } from 'react'

/**
 * Kopf, Hero und Kontakt-Fuß der Export-Seite — nachgebaut aus Mockup 1a
 * (Desktop) und 1b (Mobil). Die Optik kommt aus Claude Design; die Inhalte
 * folgen dem Konzept in Notion.
 */

// ------------------------------------------------------------------ Topbar

export function ExportTopbar({
  kunde,
  logo,
  titel,
  aktion,
}: {
  kunde: string
  logo: string | null
  titel: string
  aktion: ReactNode
}) {
  return (
    <div className="sticky top-0 z-40 border-b border-rahmen bg-flaeche/95 backdrop-blur">
      {/* Desktop */}
      <div className="mx-auto hidden h-[68px] max-w-[1440px] items-center justify-between px-10 md:flex">
        <div className="flex items-center gap-5">
          <span className="text-[11px] uppercase tracking-[0.24em] text-still">preroll</span>
          <span aria-hidden className="block h-[22px] w-px bg-rahmen-2" />
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt="" className="size-7 rounded-full bg-flaeche-tief object-cover" />
          ) : (
            <span className="schraffur size-7 rounded-full border border-dashed border-rahmen-3" />
          )}
          <span className="text-[14px] font-medium">{kunde}</span>
          <span className="text-[13px] text-leiser">{titel}</span>
        </div>
        <div className="flex items-center gap-[22px]">{aktion}</div>
      </div>

      {/* Mobil */}
      <div className="flex h-[58px] items-center justify-between px-5 md:hidden">
        <div className="flex items-center gap-3">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt="" className="size-[26px] rounded-full bg-flaeche-tief object-cover" />
          ) : (
            <span className="schraffur size-[26px] rounded-full border border-dashed border-rahmen-3" />
          )}
          <div>
            <div className="text-[13px] font-medium leading-tight">{kunde}</div>
            <div className="text-[10.5px] text-still">{titel}</div>
          </div>
        </div>
        <span className="text-[10px] uppercase tracking-[0.22em] text-[#c0bbb5]">preroll</span>
      </div>
    </div>
  )
}

// -------------------------------------------------------------------- Hero

/**
 * Große Überschrift: fette Grotesk-Zeile, darunter der Zeitraum in
 * Instrument Serif und Akzentfarbe.
 */
export function ExportHero({
  titel,
  zeitraum,
  einleitung,
  eckdaten,
  aktionMobil,
}: {
  titel: string
  zeitraum: string
  einleitung: string
  eckdaten: Array<{ t: string; w: string }>
  aktionMobil: ReactNode
}) {
  return (
    <div className="mx-auto max-w-[1440px] px-5 pb-7 pt-9 md:flex md:items-end md:justify-between md:gap-16 md:px-[72px] md:pb-12 md:pt-[72px]">
      <div className="md:max-w-[620px]">
        <div className="mb-3.5 text-[10px] uppercase tracking-[0.2em] text-still md:mb-[22px] md:text-[11px]">
          Content-Plan zur Freigabe
        </div>
        <h1 className="m-0 text-[32px] font-semibold leading-[1.05] tracking-[-0.02em] md:text-[60px] md:leading-[1.02] md:tracking-[-0.03em]">
          {titel}
        </h1>
        <div
          className="text-[32px] leading-[1.1] text-akzent md:mt-1 md:text-[56px] md:leading-[1.05]"
          style={{ fontFamily: 'var(--font-serif)' }}
        >
          {zeitraum}
        </div>
        <p className="mt-[18px] text-[13.5px] leading-[1.7] text-[#5f5b57] md:mt-[26px] md:text-[14.5px] md:leading-[1.75]">
          {einleitung}
        </p>
        <div className="mt-[22px] md:hidden">{aktionMobil}</div>
      </div>

      <dl className="mt-8 grid min-w-[240px] gap-3.5 md:mt-0 md:pb-1.5">
        {eckdaten.map((e, index) => (
          <div
            key={e.t}
            className={`flex justify-between gap-5 ${
              index < eckdaten.length - 1 ? 'border-b border-rahmen pb-2.5' : ''
            }`}
          >
            <dt className="text-[11px] uppercase tracking-[0.1em] text-still">{e.t}</dt>
            <dd className="text-[13px]">{e.w}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

// --------------------------------------------------------------- Kontakt

export type Kontakt = {
  name: string
  position: string | null
  telefon: string | null
  email: string | null
  foto: string | null
}

/**
 * Kontakt-Fuß nach Mockup 1a. Steht für diesen Link zusätzlich jemand bereit,
 * erscheinen beide nebeneinander — der Hauptansprechpartner des Kunden zuerst.
 */
export function KontaktFuss({
  kontakte,
  agenturAdresse,
  agenturWebsite,
}: {
  kontakte: Kontakt[]
  agenturAdresse: string | null
  agenturWebsite: string | null
}) {
  const [erster, ...weitere] = kontakte

  const felder = [
    { t: 'Telefon', w: erster.telefon, href: erster.telefon ? `tel:${erster.telefon.replace(/\s/g, '')}` : null },
    { t: 'E-Mail', w: erster.email, href: erster.email ? `mailto:${erster.email}` : null },
    { t: 'Adresse', w: agenturAdresse, href: null },
    {
      t: 'Web',
      w: agenturWebsite,
      href: agenturWebsite
        ? agenturWebsite.startsWith('http')
          ? agenturWebsite
          : `https://${agenturWebsite}`
        : null,
    },
  ].filter((f) => f.w)

  return (
    <footer className="border-t border-rahmen bg-flaeche-leise">
      <div className="mx-auto grid max-w-[1440px] items-end gap-12 px-5 py-12 md:grid-cols-[1fr_300px] md:gap-16 md:px-[72px] md:pb-[76px] md:pt-[72px]">
        <div>
          <div
            className="mb-7 text-[38px] leading-none text-akzent md:mb-9 md:text-[52px]"
            style={{ fontFamily: 'var(--font-serif)' }}
          >
            Kontakt
          </div>
          <p className="mb-7 max-w-[440px] text-[13.5px] leading-[1.75] text-[#5f5b57] md:mb-8 md:text-[14px]">
            Fragen zum Plan oder etwas Dringendes? Melden Sie sich direkt bei{' '}
            {kontakte.length > 1 ? 'Ihren Ansprechpartnern' : 'Ihrer Ansprechperson'}.
          </p>

          <dl className="grid grid-cols-2 gap-x-8 gap-y-5 md:max-w-[490px] md:gap-x-12 md:gap-y-[22px]">
            {felder.map((feld) => (
              <div key={feld.t}>
                <dt className="mb-[5px] text-[11px] uppercase tracking-[0.1em] text-still">{feld.t}</dt>
                <dd className="whitespace-pre-line text-[13.5px] leading-[1.55] md:text-[14px]">
                  {feld.href ? (
                    <a href={feld.href} target={feld.t === 'Web' ? '_blank' : undefined} rel="noreferrer">
                      {feld.w}
                    </a>
                  ) : (
                    feld.w
                  )}
                </dd>
              </div>
            ))}
          </dl>

          {weitere.length > 0 && (
            <div className="mt-8 border-t border-rahmen pt-6">
              <div className="mb-3 text-[11px] uppercase tracking-[0.1em] text-still">
                Für diesen Plan ebenfalls zuständig
              </div>
              <ul className="grid gap-3">
                {weitere.map((k) => (
                  <li key={k.name} className="flex items-center gap-3">
                    {k.foto ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={k.foto} alt="" className="size-10 rounded-full object-cover grayscale" />
                    ) : (
                      <span className="schraffur size-10 rounded-full border border-dashed border-rahmen-3" />
                    )}
                    <div>
                      <div className="text-[13.5px] font-medium">{k.name}</div>
                      <div className="text-[11.5px] text-leiser">
                        {[k.position, k.email].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="relative w-[240px] justify-self-start md:w-[300px]">
          {erster.foto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={erster.foto}
              alt={erster.name}
              className="block h-[280px] w-full object-cover grayscale md:h-[340px]"
              style={{ objectPosition: '60% 20%' }}
            />
          ) : (
            <div className="schraffur h-[280px] w-full border border-dashed border-rahmen-3 md:h-[340px]" />
          )}
          <div className="absolute -bottom-[18px] -left-6 bg-akzent px-[22px] pb-3.5 pt-4 text-white">
            <div className="text-[22px] leading-[1.1] md:text-[26px]" style={{ fontFamily: 'var(--font-serif)' }}>
              {erster.name}
            </div>
            {erster.position && <div className="mt-0.5 text-[11.5px] text-white/85">{erster.position}</div>}
          </div>
        </div>
      </div>
    </footer>
  )
}

// ------------------------------------------------------------- Kalenderkarte

/** Rahmen um den Monatskalender, wie im Mockup mit eigener Kopfzeile. */
export function KalenderKarte({
  monat,
  jahr,
  children,
}: {
  monat: string
  jahr: string
  children: ReactNode
}) {
  return (
    <div className="overflow-hidden rounded-md border border-rahmen bg-flaeche">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-rahmen px-5 py-4 md:px-6 md:py-5">
        <div className="flex items-baseline gap-2.5">
          <span className="text-[15px] font-semibold md:text-[17px]">{monat}</span>
          <span
            className="text-[19px] text-akzent md:text-[22px]"
            style={{ fontFamily: 'var(--font-serif)' }}
          >
            {jahr}
          </span>
        </div>
        <div className="flex items-center gap-4 md:gap-[22px]">
          {[
            { text: 'Reel', farbe: 'var(--color-typ-reel)' },
            { text: 'Karussell', farbe: 'var(--color-typ-karussell)' },
            { text: 'Beitrag', farbe: 'var(--color-typ-beitrag)' },
          ].map((t) => (
            <div key={t.text} className="flex items-center gap-2">
              <span aria-hidden className="block size-2 rounded-full" style={{ background: t.farbe }} />
              <span className="text-[11.5px] text-[#5f5b57] md:text-[12px]">{t.text}</span>
            </div>
          ))}
        </div>
      </div>
      {children}
    </div>
  )
}
