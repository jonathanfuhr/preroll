'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import type { PostTyp } from '@prisma/client'
import { Monatskalender, type Kalendereintrag } from './kalender'
import { TYP_TEXT, TypPunkt } from './ui'

/**
 * Der Kalender über **alle** Kunden.
 *
 * Gezeigt wird derselbe Monatskalender wie beim Kunden (`Monatskalender`) —
 * dieselbe Ansicht, nur mit mehr darin. Ein drittes Kalender-Bauteil hätte
 * denselben Fehler dreimal zu beheben; gezogen wird hier ohnehin nicht, das
 * bleibt beim einzelnen Kunden, wo die Ungeplant-Spalte hingehört.
 *
 * Gefiltert wird **im Browser** auf den bereits geladenen Zeilen, wie in der
 * Post-Liste: Ein Rundgang zum Server je Häkchen wäre spürbar langsamer, und
 * ein Monat über alle Kunden passt bequem in eine Antwort. Der Monat dagegen
 * steht in der Adresse — dafür müssen andere Daten geladen werden, und so
 * lässt sich ein bestimmter Monat verschicken.
 */

export type GesamtEintrag = Kalendereintrag & {
  kundeSlug: string
  kundeName: string
}

export type KundenZeile = { slug: string; name: string }

/**
 * Gespeichert werden die **abgewählten** Kunden, nicht die ausgewählten.
 *
 * Der Unterschied fällt erst später auf: Käme ein neuer Kunde dazu, wäre er
 * bei gespeicherter Auswahl unsichtbar, ohne dass jemand ihn abgewählt hätte
 * — und niemand sucht den Fehler in einem Filter, den er vor Wochen gesetzt
 * hat. So ist neu immer sichtbar.
 */
const SPEICHER = 'preroll:kalender:abgewaehlt'

export function GesamtKalender({
  monat,
  eintraege,
  kunden,
  vorher,
  naechster,
  heute,
}: {
  monat: Date
  eintraege: GesamtEintrag[]
  kunden: KundenZeile[]
  vorher: string
  naechster: string
  heute: string
}) {
  // Erst nach dem Montieren lesen: `localStorage` gibt es beim Rendern am
  // Server nicht, und ein Unterschied zwischen beiden Läufen wäre ein
  // Hydrationsbruch.
  const [abgewaehlt, setAbgewaehlt] = useState<string[]>([])

  useEffect(() => {
    try {
      const roh = localStorage.getItem(SPEICHER)
      if (roh) setAbgewaehlt(JSON.parse(roh) as string[])
    } catch {
      // Ein kaputter Eintrag darf die Seite nicht mitnehmen — dann eben alle.
    }
  }, [])

  function merke(neu: string[]) {
    setAbgewaehlt(neu)
    try {
      localStorage.setItem(SPEICHER, JSON.stringify(neu))
    } catch {
      // Privates Fenster oder volle Ablage: Der Filter gilt dann nur bis zum
      // Neuladen. Kein Grund, etwas zu melden.
    }
  }

  function umschalten(slug: string) {
    merke(abgewaehlt.includes(slug) ? abgewaehlt.filter((s) => s !== slug) : [...abgewaehlt, slug])
  }

  const versteckt = new Set(abgewaehlt)
  const sichtbar = eintraege.filter((e) => !versteckt.has(e.kundeSlug))

  const anzahlJeKunde = new Map<string, number>()
  for (const e of eintraege) {
    anzahlJeKunde.set(e.kundeSlug, (anzahlJeKunde.get(e.kundeSlug) ?? 0) + 1)
  }

  const monatsName = new Intl.DateTimeFormat('de-DE', {
    month: 'long',
    year: 'numeric',
  }).format(monat)

  return (
    <div className="flex flex-wrap items-start gap-5">
      {/*
        Am Telefon steht die Spalte über dem Kalender statt daneben — genau
        wie die Ungeplant-Spalte im Kundenkalender. Bei 375 px blieben dem
        Monat sonst 95 px für sieben Tage.
      */}
      <div className="w-full shrink-0 self-start rounded-md border border-rahmen bg-flaeche p-3 md:w-[228px]">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-[12.5px] font-medium text-tinte">Kunden</h3>
          <div className="flex items-center gap-2 text-[11px]">
            <button
              type="button"
              onClick={() => merke([])}
              disabled={abgewaehlt.length === 0}
              className="text-leise underline underline-offset-2 hover:text-tinte disabled:no-underline disabled:opacity-40"
            >
              alle
            </button>
            <button
              type="button"
              onClick={() => merke(kunden.map((k) => k.slug))}
              disabled={abgewaehlt.length === kunden.length}
              className="text-leise underline underline-offset-2 hover:text-tinte disabled:no-underline disabled:opacity-40"
            >
              keine
            </button>
          </div>
        </div>

        {/*
          Gedeckelt und rollend: Bei zwanzig Kunden schöbe die Liste den
          Kalender sonst aus dem Bild, und der ist der Grund, warum jemand
          hier ist.
        */}
        <div className="mt-2.5 grid max-h-[260px] gap-0.5 overflow-y-auto">
          {kunden.map((k) => {
            const anzahl = anzahlJeKunde.get(k.slug) ?? 0
            return (
              <label
                key={k.slug}
                className="flex cursor-pointer items-center gap-2 rounded-[4px] px-1 py-1 transition-colors hover:bg-flaeche-tief"
              >
                <input
                  type="checkbox"
                  checked={!versteckt.has(k.slug)}
                  onChange={() => umschalten(k.slug)}
                  className="size-[13px] shrink-0 accent-akzent"
                />
                <span className="min-w-0 flex-1 truncate text-[11.5px] text-tinte-3">{k.name}</span>
                <span
                  className={`shrink-0 font-mono text-[10.5px] ${
                    anzahl > 0 ? 'text-leise' : 'text-stiller'
                  }`}
                >
                  {anzahl}
                </span>
              </label>
            )
          })}
        </div>

        {kunden.length === 0 && (
          <p className="mt-2 text-[11.5px] text-stiller">Noch keine Kunden angelegt.</p>
        )}
      </div>

      {/*
        Sieben Spalten brauchen ihre 520 px. Am Telefon rollt der Kalender
        deshalb waagerecht in seiner Karte, nie die Seite.
      */}
      <div className="min-w-0 flex-1 overflow-x-auto pb-1">
        <div className="min-w-[520px]">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <Link
                  href={vorher}
                  aria-label="Vorheriger Monat"
                  className="flex size-7 items-center justify-center rounded-[5px] border border-rahmen-3 bg-flaeche text-[13px] text-leise transition-colors hover:text-tinte"
                >
                  ‹
                </Link>
                <Link
                  href={naechster}
                  aria-label="Nächster Monat"
                  className="flex size-7 items-center justify-center rounded-[5px] border border-rahmen-3 bg-flaeche text-[13px] text-leise transition-colors hover:text-tinte"
                >
                  ›
                </Link>
              </div>
              <h2 className="text-[15px] font-semibold capitalize text-tinte">{monatsName}</h2>
              <Link
                href={heute}
                className="text-[11.5px] text-leise underline underline-offset-2 hover:text-tinte"
              >
                heute
              </Link>
            </div>

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
            <Monatskalender monat={monat} eintraege={sichtbar} ohneRahmen ohneTypname />
          </div>

          <p className="mt-2 text-[11.5px] text-stiller">
            {eintraege.length === 0
              ? 'In diesem Monat ist nichts geplant.'
              : sichtbar.length === eintraege.length
                ? `${eintraege.length} Beiträge in diesem Monat.`
                : `${sichtbar.length} von ${eintraege.length} Beiträgen — ${abgewaehlt.length} ${
                    abgewaehlt.length === 1 ? 'Kunde' : 'Kunden'
                  } ausgeblendet.`}
          </p>
        </div>
      </div>
    </div>
  )
}
