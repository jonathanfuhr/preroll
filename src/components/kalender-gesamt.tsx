'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ANZEIGEPHASEN, ANZEIGEPHASE_TEXT, type Anzeigephase } from '@/lib/status'
import { Monatskalender, type Kalendereintrag } from './kalender'

/**
 * Der Kalender über **alle** Kunden.
 *
 * Gezeichnet wird mit demselben `Monatskalender` wie beim Kunden — dieselbe
 * Ansicht, nur mit mehr darin. Ein drittes Kalender-Bauteil hätte denselben
 * Fehler dreimal zu beheben; gezogen wird hier ohnehin nicht, das bleibt beim
 * einzelnen Kunden, wo die Ungeplant-Spalte hingehört.
 *
 * Zwei Unterschiede zu den Kundenkalendern, beide mit Absicht:
 *
 * 1. **Der Punkt steht für den Kunden, nicht für den Typ.** Wer über zwanzig
 *    Kunden schaut, sucht zuerst „wo liegt etwas von Café Morgenrot" — der Typ
 *    steht im Tooltip. Die Farben kommen aus `kundenFarbe`.
 * 2. **Voreingestellt sind nur die freigegebenen Phasen** — Final und
 *    Gepostet. Der Kalender beantwortet die Frage „was geht raus und was ist
 *    raus", nicht „woran wird gerade gearbeitet". Wer die frühen Phasen sehen
 *    will, hakt sie an.
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
  /** Am Server gerechnet — „Gepostet" hängt an der Uhr. */
  phase: Anzeigephase
}

export type KundenZeile = { slug: string; name: string; farbe: string }

/**
 * Gespeichert werden bei den Kunden die **abgewählten**, beim Status die
 * **ausgewählten**.
 *
 * Der Unterschied ist kein Versehen: Käme ein neuer Kunde dazu, wäre er bei
 * gespeicherter Auswahl unsichtbar, ohne dass jemand ihn abgewählt hätte — und
 * niemand sucht den Fehler in einem Filter, den er vor Wochen gesetzt hat. Die
 * Phasen dagegen sind ein fester, abgeschlossener Satz; dort ist die Auswahl
 * die ehrlichere Ablage, weil die Voreinstellung nicht „alle" ist.
 */
const SPEICHER_KUNDEN = 'preroll:kalender:abgewaehlt'
const SPEICHER_STATUS = 'preroll:kalender:status'

/**
 * Freigegeben heißt alles drei: Was noch auf seinen Termin wartet, was schon
 * draußen ist — und was rausgehen sollte und nicht ging. Nur `FINAL` ließe
 * einen vergangenen Monat leer aussehen, und Fehlschläge will man sehen, ohne
 * sie erst anzuhaken.
 */
const VOREINSTELLUNG: Anzeigephase[] = ['FINAL', 'GEPOSTET', 'FEHLGESCHLAGEN']

/** Passend zu den Etiketten im Rest des Werkzeugs — Entwurf bleibt farblos. */
const STATUS_PUNKT: Record<Anzeigephase, string> = {
  ENTWURF: 'bg-still',
  KONZEPT: 'bg-konzept',
  VORSCHAU: 'bg-vorschau',
  FINAL: 'bg-final',
  GEPOSTET: 'bg-gepostet',
  FEHLGESCHLAGEN: 'bg-akzent',
}

function lies<T>(schluessel: string, ersatz: T): T {
  try {
    const roh = localStorage.getItem(schluessel)
    return roh ? (JSON.parse(roh) as T) : ersatz
  } catch {
    // Ein kaputter Eintrag darf die Seite nicht mitnehmen.
    return ersatz
  }
}

function schreibe(schluessel: string, wert: unknown) {
  try {
    localStorage.setItem(schluessel, JSON.stringify(wert))
  } catch {
    // Privates Fenster oder volle Ablage: Der Filter gilt dann bis zum
    // Neuladen. Kein Grund, etwas zu melden.
  }
}

function Kasten({
  an,
  umschalten,
  punkt,
  name,
  anzahl,
}: {
  an: boolean
  umschalten: () => void
  punkt: React.ReactNode
  name: string
  anzahl: number
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-[4px] px-1 py-1 transition-colors hover:bg-flaeche-tief">
      <input
        type="checkbox"
        checked={an}
        onChange={umschalten}
        className="size-[13px] shrink-0 accent-akzent"
      />
      {punkt}
      <span className="min-w-0 flex-1 truncate text-[11.5px] text-tinte-3">{name}</span>
      <span
        className={`shrink-0 font-mono text-[10.5px] ${anzahl > 0 ? 'text-leise' : 'text-stiller'}`}
      >
        {anzahl}
      </span>
    </label>
  )
}

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
  const [phasen, setPhasen] = useState<Anzeigephase[]>(VOREINSTELLUNG)

  useEffect(() => {
    setAbgewaehlt(lies<string[]>(SPEICHER_KUNDEN, []))
    setPhasen(lies<Anzeigephase[]>(SPEICHER_STATUS, VOREINSTELLUNG))
  }, [])

  function merkeKunden(neu: string[]) {
    setAbgewaehlt(neu)
    schreibe(SPEICHER_KUNDEN, neu)
  }

  function merkePhasen(neu: Anzeigephase[]) {
    setPhasen(neu)
    schreibe(SPEICHER_STATUS, neu)
  }

  const versteckt = new Set(abgewaehlt)
  const anPhasen = new Set(phasen)

  const nachKunde = eintraege.filter((e) => !versteckt.has(e.kundeSlug))
  const nachPhase = eintraege.filter((e) => anPhasen.has(e.phase))
  const sichtbar = nachKunde.filter((e) => anPhasen.has(e.phase))

  // Die Zahlen zeigen, was ein Häkchen brächte: beim Kunden gezählt wird, was
  // die Phasenwahl ohnehin durchlässt — und umgekehrt. Sonst verspricht eine
  // 7 neben einem Kunden sieben Beiträge, von denen dann einer erscheint.
  const jeKunde = new Map<string, number>()
  for (const e of nachPhase) jeKunde.set(e.kundeSlug, (jeKunde.get(e.kundeSlug) ?? 0) + 1)

  const jePhase = new Map<Anzeigephase, number>()
  for (const e of nachKunde) jePhase.set(e.phase, (jePhase.get(e.phase) ?? 0) + 1)

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
        {/*
          Die Phasen stehen oben, obwohl die Kunden der eigentliche Filter
          sind: Voreingestellt sind nur Final und Gepostet, und wer sich
          wundert, warum so wenig dasteht, soll den Grund sehen, bevor er
          scrollt.
        */}
        <h3 className="text-[12.5px] font-medium text-tinte">Phase</h3>
        <div className="mt-2 grid gap-0.5">
          {ANZEIGEPHASEN.map((phase) => (
            <Kasten
              key={phase}
              an={anPhasen.has(phase)}
              umschalten={() =>
                merkePhasen(
                  anPhasen.has(phase) ? phasen.filter((p) => p !== phase) : [...phasen, phase],
                )
              }
              punkt={
                <span
                  aria-hidden
                  className={`block size-[7px] shrink-0 rounded-full ${STATUS_PUNKT[phase]}`}
                />
              }
              name={ANZEIGEPHASE_TEXT[phase]}
              anzahl={jePhase.get(phase) ?? 0}
            />
          ))}
        </div>

        <div className="mt-3 flex items-baseline justify-between gap-2 border-t border-rahmen pt-3">
          <h3 className="text-[12.5px] font-medium text-tinte">Kunden</h3>
          <div className="flex items-center gap-2 text-[11px]">
            <button
              type="button"
              onClick={() => merkeKunden([])}
              disabled={abgewaehlt.length === 0}
              className="text-leise underline underline-offset-2 hover:text-tinte disabled:no-underline disabled:opacity-40"
            >
              alle
            </button>
            <button
              type="button"
              onClick={() => merkeKunden(kunden.map((k) => k.slug))}
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
          hier ist. Die Liste ist zugleich die Legende zu den Punkten.
        */}
        <div className="mt-2 grid max-h-[260px] gap-0.5 overflow-y-auto">
          {kunden.map((k) => (
            <Kasten
              key={k.slug}
              an={!versteckt.has(k.slug)}
              umschalten={() =>
                merkeKunden(
                  versteckt.has(k.slug)
                    ? abgewaehlt.filter((s) => s !== k.slug)
                    : [...abgewaehlt, k.slug],
                )
              }
              punkt={
                <span
                  aria-hidden
                  className="block size-[7px] shrink-0 rounded-full"
                  style={{ background: k.farbe }}
                />
              }
              name={k.name}
              anzahl={jeKunde.get(k.slug) ?? 0}
            />
          ))}
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
          <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2">
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

          <div className="overflow-hidden rounded-md border border-rahmen bg-flaeche">
            <Monatskalender monat={monat} eintraege={sichtbar} ohneRahmen ohneTypname />
          </div>

          <p className="mt-2 text-[11.5px] text-stiller">
            {eintraege.length === 0
              ? 'In diesem Monat ist nichts geplant.'
              : sichtbar.length === eintraege.length
                ? `${eintraege.length} Beiträge in diesem Monat.`
                : `${sichtbar.length} von ${eintraege.length} Beiträgen dieses Monats.`}
          </p>
        </div>
      </div>
    </div>
  )
}
