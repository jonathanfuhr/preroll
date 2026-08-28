import type { PostStatus, PostTyp, Verhaeltnis } from '@prisma/client'
import Link from 'next/link'
import type { ComponentProps, ReactNode } from 'react'
import {
  anzeigePhase,
  ANZEIGEPHASE_TEXT,
  type Anzeigephase,
  type Veroeffentlichungslage,
} from '@/lib/status'
import { postBezeichnung, standardVerhaeltnis } from '@/lib/verhaeltnis'

// ------------------------------------------------------------------- Etiketten

const STATUS_STIL: Record<Anzeigephase, string> = {
  // Ein Entwurf hat keine eigene Farbe — er ist noch nichts, was jemand
  // beurteilen soll.
  ENTWURF: 'bg-flaeche-tief text-still',
  KONZEPT: 'bg-konzept-flaeche text-konzept',
  // Produktion und Korrektur teilen sich eine Farbe: Für den, der die Liste
  // überfliegt, heißen beide dasselbe — hier wird gearbeitet.
  PRODUKTION: 'bg-arbeit-flaeche text-arbeit',
  VORSCHAU: 'bg-vorschau-flaeche text-vorschau',
  KORREKTUR: 'bg-arbeit-flaeche text-arbeit',
  FINAL: 'bg-final-flaeche text-final',
  /*
    Gepostet bleibt in der Familie von Final, aber als volle Fläche: Das
    zarte Etikett heißt „freigegeben, wartet auf den Termin", das volle „ist
    draußen".
  */
  GEPOSTET: 'bg-gepostet text-white',
  // Rot wie jede Fehlermeldung, und voll wie „Gepostet": Auch das ist ein
  // Endzustand — nur einer, der jemanden braucht.
  FEHLGESCHLAGEN: 'bg-akzent text-white',
}

/**
 * Die Phase eines Beitrags als Etikett.
 *
 * `postenAm` ist **Pflicht**, obwohl es nur für „Gepostet" gebraucht wird:
 * Ohne den Termin lässt sich ein veröffentlichter Beitrag nicht von einem
 * wartenden unterscheiden, und ein Etikett, das je nach Aufrufer mal „Final"
 * und mal „Gepostet" sagt, wäre schlimmer als keins. So zwingt der Typ jede
 * Fundstelle, den Termin mitzugeben.
 */
/** Etikett für eine bereits gerechnete Phase — etwa im Editor, wo der Server
 *  sie ohnehin schon kennt. */
export function PhasenBadge({ phase, klein }: { phase: Anzeigephase; klein?: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-[3px] font-medium ${STATUS_STIL[phase]} ${
        klein ? 'px-1.5 py-0.5 text-[9.5px]' : 'px-2 py-1 text-[11px]'
      }`}
    >
      {ANZEIGEPHASE_TEXT[phase]}
    </span>
  )
}

export function StatusBadge({
  status,
  postenAm,
  veroeffentlichungen,
  klein,
}: {
  status: PostStatus
  postenAm: Date | null
  /**
   * Ein leeres Array heißt ausdrücklich „für diesen Beitrag postet Preroll
   * nicht" — dann entscheidet die Uhr. Pflichtangabe aus demselben Grund wie
   * `postenAm`: Wer sie vergisst, zeigt „Gepostet" für etwas, das gescheitert
   * ist.
   */
  veroeffentlichungen: Veroeffentlichungslage
  klein?: boolean
}) {
  return <PhasenBadge phase={anzeigePhase(status, postenAm, veroeffentlichungen)} klein={klein} />
}

/**
 * Ein Kommentar, der das Haus nicht verlässt. Deutlich genug, dass niemand
 * ihn für eine Kundenantwort hält — aber ohne Alarmfarbe: Er ist der
 * Normalfall für interne Abstimmungen, kein Fehler.
 */
export function InternBadge() {
  return (
    <span
      title="Nur für das Team sichtbar — der Kunde sieht diesen Kommentar nicht."
      className="inline-flex items-center rounded-[3px] bg-tinte px-1.5 py-0.5 text-[9.5px] font-medium uppercase tracking-[0.06em] text-white"
    >
      Nur intern
    </span>
  )
}

export const TYP_TEXT: Record<PostTyp, string> = {
  REEL: 'Reel',
  KARUSSELL: 'Karussell',
  BEITRAG: 'Beitrag',
}

export const TYP_FARBE: Record<PostTyp, string> = {
  REEL: 'var(--color-typ-reel)',
  KARUSSELL: 'var(--color-typ-karussell)',
  BEITRAG: 'var(--color-typ-beitrag)',
}

/**
 * Farbe kommt vom Typ, das Wort vom Format: Ein hochkantes Video ist ein
 * Reel, dasselbe quer nur noch ein Video. Ohne Angabe gilt der Standard des
 * Typs — dann steht dort wie bisher „Reel".
 */
export function TypBadge({ typ, verhaeltnis }: { typ: PostTyp; verhaeltnis?: Verhaeltnis }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-tinte-3">
      <span
        aria-hidden
        className="block size-[7px] rounded-full"
        style={{ background: TYP_FARBE[typ] }}
      />
      {postBezeichnung(typ, verhaeltnis ?? standardVerhaeltnis(typ))}
    </span>
  )
}

export function TypPunkt({ typ, groesse = 7 }: { typ: PostTyp; groesse?: number }) {
  return (
    <span
      aria-hidden
      className="block rounded-full"
      style={{ background: TYP_FARBE[typ], width: groesse, height: groesse }}
    />
  )
}

// -------------------------------------------------------------------- Bedienung

type KnopfArt = 'primaer' | 'sekundaer' | 'leise' | 'gefahr'

const KNOPF_STIL: Record<KnopfArt, string> = {
  primaer: 'bg-akzent text-white hover:bg-akzent-dunkel border-transparent',
  sekundaer: 'bg-flaeche text-tinte border-rahmen-3 hover:border-rahmen-4',
  leise: 'bg-transparent text-leise border-transparent hover:text-tinte hover:bg-flaeche-tief',
  gefahr: 'bg-transparent text-akzent border-rahmen-3 hover:bg-akzent-zart',
}

export function Knopf({
  art = 'sekundaer',
  klein,
  className = '',
  ...rest
}: ComponentProps<'button'> & { art?: KnopfArt; klein?: boolean }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-[5px] border font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        KNOPF_STIL[art]
      } ${klein ? 'px-3 py-1.5 text-[12px]' : 'px-4 py-2 text-[13px]'} ${className}`}
      {...rest}
    />
  )
}

export function KnopfLink({
  art = 'sekundaer',
  klein,
  className = '',
  ...rest
}: ComponentProps<typeof Link> & { art?: KnopfArt; klein?: boolean }) {
  return (
    <Link
      className={`inline-flex items-center justify-center gap-2 rounded-[5px] border font-medium transition-colors ${
        KNOPF_STIL[art]
      } ${klein ? 'px-3 py-1.5 text-[12px]' : 'px-4 py-2 text-[13px]'} ${className}`}
      {...rest}
    />
  )
}

// --------------------------------------------------------------------- Flächen

export function Karte({
  className = '',
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return (
    <div className={`rounded-md border border-rahmen bg-flaeche ${className}`}>{children}</div>
  )
}

export function Abschnitt({
  titel,
  hinweis,
  aktion,
  children,
}: {
  titel: string
  hinweis?: string
  aktion?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="mb-8">
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <div>
          <h2 className="text-[13px] font-semibold tracking-[0.02em] text-tinte">{titel}</h2>
          {hinweis && <p className="mt-1 text-[12px] leading-relaxed text-leiser">{hinweis}</p>}
        </div>
        {aktion}
      </div>
      {children}
    </section>
  )
}

export function Leerzustand({ titel, text, aktion }: { titel: string; text?: string; aktion?: ReactNode }) {
  return (
    <div className="rounded-md border border-dashed border-rahmen-3 bg-flaeche-leise px-6 py-12 text-center">
      <p className="text-[13.5px] font-medium text-tinte-3">{titel}</p>
      {text && <p className="mx-auto mt-1.5 max-w-md text-[12.5px] leading-relaxed text-leiser">{text}</p>}
      {aktion && <div className="mt-5 flex justify-center">{aktion}</div>}
    </div>
  )
}

// ---------------------------------------------------------------- Warn/Fehler

/** Einheitliche Warnoptik: auffällig, aber nicht blockierend. */
export function Warnung({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-[5px] border border-[#f0dcb8] bg-vorschau-flaeche px-3.5 py-2.5 text-[12.5px] leading-relaxed text-[#8a5807]">
      <span aria-hidden className="mt-px shrink-0 font-semibold">
        !
      </span>
      <div>{children}</div>
    </div>
  )
}

/** Einheitliche Fehleroptik: blockierend. */
export function Fehler({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-[5px] border border-[#eec9c6] bg-akzent-zart px-3.5 py-2.5 text-[12.5px] leading-relaxed text-akzent-dunkel">
      <span aria-hidden className="mt-px shrink-0 font-semibold">
        ×
      </span>
      <div>{children}</div>
    </div>
  )
}

export function Hinweis({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-[5px] border border-rahmen bg-flaeche-leise px-3.5 py-2.5 text-[12.5px] leading-relaxed text-leise">
      {children}
    </div>
  )
}

// -------------------------------------------------------------------- Formular

export function Feld({
  beschriftung,
  hinweis,
  children,
}: {
  beschriftung: string
  hinweis?: string
  children: ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10.5px] font-medium uppercase tracking-[0.1em] text-still">
        {beschriftung}
      </span>
      {children}
      {hinweis && <span className="mt-1.5 block text-[11.5px] leading-relaxed text-leiser">{hinweis}</span>}
    </label>
  )
}

const EINGABE_STIL =
  'w-full rounded-[5px] border border-rahmen-3 bg-flaeche px-3 py-2 text-[13px] text-tinte placeholder:text-stiller focus:border-akzent focus:outline-none'

export function Eingabe({ className = '', ...rest }: ComponentProps<'input'>) {
  return <input className={`${EINGABE_STIL} ${className}`} {...rest} />
}

export function Textfeld({ className = '', ...rest }: ComponentProps<'textarea'>) {
  return <textarea className={`${EINGABE_STIL} leading-relaxed ${className}`} {...rest} />
}

export function Auswahl({ className = '', ...rest }: ComponentProps<'select'>) {
  return <select className={`${EINGABE_STIL} ${className}`} {...rest} />
}

export function Schalter({
  beschriftung,
  hinweis,
  ...rest
}: ComponentProps<'input'> & { beschriftung: string; hinweis?: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5">
      <input
        type="checkbox"
        className="mt-0.5 size-[15px] shrink-0 accent-[var(--color-akzent)]"
        {...rest}
      />
      <span>
        <span className="block text-[13px] text-tinte">{beschriftung}</span>
        {hinweis && <span className="mt-0.5 block text-[11.5px] leading-relaxed text-leiser">{hinweis}</span>}
      </span>
    </label>
  )
}

/**
 * Der Kippschalter aus Mockup 2e — 38 × 22 px, Knopf 16 px, Beschriftung
 * links daneben. Wo ein Häkchen in einer Liste von Feldern richtig ist, steht
 * `Schalter`; dieser hier gehört in eine Kopfzeile, wo er eine ganze Sektion
 * umlegt und das auch aussehen soll.
 */
export function Umschalter({
  beschriftung,
  checked,
  ...rest
}: ComponentProps<'input'> & { beschriftung: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5">
      <span className="text-[12.5px] text-tinte-3">{beschriftung}</span>
      <input type="checkbox" checked={checked} className="peer sr-only" {...rest} />
      {/*
        Farbe und Knopfstellung hängen am Zustand, nicht an `peer-checked`:
        Der Nachbarselektor tut dasselbe, aber wer den Schalter liest, sieht
        so unmittelbar, was an welchem Zustand hängt.
      */}
      <span
        aria-hidden
        className={`relative block h-[22px] w-[38px] shrink-0 rounded-full transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-rahmen-4 ${
          checked ? 'bg-akzent' : 'bg-rahmen-2'
        }`}
      >
        <span
          className={`absolute top-[3px] block size-4 rounded-full bg-white transition-[left] ${
            checked ? 'left-[19px]' : 'left-[3px]'
          }`}
        />
      </span>
    </label>
  )
}

// ----------------------------------------------------------------- Kleinkram

export function Kennzahl({ wert, beschriftung }: { wert: ReactNode; beschriftung: string }) {
  return (
    <div className="grid justify-items-center gap-1">
      <span className="text-[15px] font-semibold text-tinte">{wert}</span>
      <span className="text-[10.5px] text-still">{beschriftung}</span>
    </div>
  )
}

export function Initialen({ text, groesse = 30 }: { text: string; groesse?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-flaeche-tief font-medium text-tinte-3"
      style={{ width: groesse, height: groesse, fontSize: groesse * 0.36 }}
    >
      {text}
    </span>
  )
}
