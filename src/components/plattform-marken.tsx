import type { Plattform } from '@prisma/client'
import { PLATTFORM_TEXT, sortierePlattformen } from '@/lib/plattformen'

/**
 * Plattform-Marken — einfarbig, nie in Markenfarben.
 *
 * Auf der Kundenseite steht die Marke des Kunden im Vordergrund; fünf fremde
 * Logos in ihren Hausfarben wären dort ein Farbenspiel, das vom Beitrag
 * ablenkt. Im Backend gilt dasselbe aus einem anderen Grund: Der Kalenderpunkt
 * trägt schon eine Bedeutung tragende Farbe, und eine zweite daneben wäre
 * nicht mehr lesbar. Also `currentColor` und Schluss.
 *
 * Die Glyphen decken **alle** Plattformen ab, auch die noch nicht gebauten:
 * Sobald eine dazukommt, soll hier nichts nachgezogen werden müssen. Der
 * Typ `Record<Plattform, …>` erzwingt das — ein neuer Wert im Enum fällt
 * beim Typecheck auf, nicht erst als leere Stelle in der Oberfläche.
 */

function Facebook() {
  return (
    <path
      d="M9.03 21v-8.1H6.3V9.5h2.73V7.2c0-2.7 1.65-4.18 4.06-4.18 1.16 0 2.15.09 2.44.13v2.83h-1.68c-1.31 0-1.57.62-1.57 1.54V9.5h3.13l-.41 3.4h-2.72V21H9.03Z"
      fill="currentColor"
    />
  )
}

function Instagram() {
  return (
    <>
      <rect x="3.2" y="3.2" width="17.6" height="17.6" rx="5" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="3.9" strokeWidth="1.8" />
      <circle cx="17" cy="7" r="1.15" fill="currentColor" stroke="none" />
    </>
  )
}

function LinkedIn() {
  return (
    <>
      <rect x="3.2" y="3.2" width="17.6" height="17.6" rx="3.5" strokeWidth="1.7" />
      <circle cx="7.6" cy="7.9" r="1.1" fill="currentColor" stroke="none" />
      <path d="M7.6 10.9v5.6" strokeWidth="1.7" strokeLinecap="round" />
      <path
        d="M11.7 16.5v-5.6m0 2.4a2.3 2.3 0 0 1 4.6 0v3.2"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  )
}

function TikTok() {
  /*
    Die Note mit dem Haken — TikToks Zeichen, auf eine Kontur reduziert.
    In Markenfarben stünde hier ein Cyan-Magenta-Versatz; einfarbig bleibt
    davon die Form, und die reicht zum Erkennen.
  */
  return (
    <>
      {/* Der Notenhals mit Fähnchen … */}
      <path
        d="M13.9 3.2v11a3.3 3.3 0 1 1-3.3-3.3c.36 0 .7.06 1.02.17"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* … und der Bogen nach rechts oben, der ihn zum TikTok-Zeichen macht. */}
      <path
        d="M13.9 3.2c.45 2.65 2.36 4.35 4.9 4.5"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  )
}

function YouTube() {
  return (
    <>
      <rect x="2.6" y="5.6" width="18.8" height="12.8" rx="4" strokeWidth="1.7" />
      <path d="M10.4 9.6v4.8l4.2-2.4-4.2-2.4Z" fill="currentColor" stroke="none" />
    </>
  )
}

const GLYPH: Record<Plattform, () => React.ReactElement> = {
  FACEBOOK: Facebook,
  INSTAGRAM: Instagram,
  LINKEDIN: LinkedIn,
  TIKTOK: TikTok,
  YOUTUBE: YouTube,
}

export function PlattformMarke({
  plattform,
  groesse = 13,
}: {
  plattform: Plattform
  groesse?: number
}) {
  const Glyph = GLYPH[plattform]
  return (
    <svg
      width={groesse}
      height={groesse}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      role="img"
      aria-label={PLATTFORM_TEXT[plattform]}
      className="shrink-0"
    >
      <Glyph />
    </svg>
  )
}

/**
 * Mehrere Marken nebeneinander, in fester Reihenfolge.
 *
 * Nichts anzuzeigen, wenn nichts gewählt ist, ist Absicht: Eine leere Reihe
 * ist genauso wenig eine Auskunft wie ein Platzhalter, und wo „geht nirgendwo
 * hin" wirklich zählt — im Editor —, steht es im Klartext daneben.
 */
export function PlattformMarken({
  plattformen,
  groesse = 13,
  klasse = 'text-still',
}: {
  plattformen: readonly Plattform[]
  groesse?: number
  klasse?: string
}) {
  const sortiert = sortierePlattformen(plattformen)
  if (sortiert.length === 0) return null

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 align-middle ${klasse}`}
      title={sortiert.map((p) => PLATTFORM_TEXT[p]).join(' · ')}
    >
      {sortiert.map((p) => (
        <PlattformMarke key={p} plattform={p} groesse={groesse} />
      ))}
    </span>
  )
}
