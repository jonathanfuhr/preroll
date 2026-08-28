/**
 * Umgang mit reinen Datumsfeldern.
 *
 * Zeiträume (`zeitraumVon`, `zeitraumBis`, `gueltigBis`) sind in der Datenbank
 * als `DATE` abgelegt und kommen als UTC-Mitternacht zurück. Posting-Termine
 * dagegen sind echte Zeitstempel in Ortszeit. Wer beides mischt, verschiebt
 * Zeiträume je nach Zeitzone um einen Tag — deshalb laufen alle Umrechnungen
 * über diese Stelle.
 */

/** Kalendertag eines reinen Datumswerts, in UTC gelesen. */
export function tagesteile(datum: Date): { jahr: number; monat: number; tag: number } {
  return {
    jahr: datum.getUTCFullYear(),
    monat: datum.getUTCMonth(),
    tag: datum.getUTCDate(),
  }
}

/** Reines Datum aus einer Eingabe im Format JJJJ-MM-TT. */
export function ausEingabe(wert: string): Date {
  return new Date(`${wert}T00:00:00.000Z`)
}

/** Eingabewert JJJJ-MM-TT für ein reines Datum. */
export function alsEingabe(datum: Date): string {
  return datum.toISOString().slice(0, 10)
}

/** Ortszeit-Beginn des Kalendertags — Untergrenze beim Vergleich mit Zeitstempeln. */
export function beginnLokal(datum: Date): Date {
  const { jahr, monat, tag } = tagesteile(datum)
  return new Date(jahr, monat, tag, 0, 0, 0, 0)
}

/** Ortszeit-Ende des Kalendertags — Obergrenze beim Vergleich mit Zeitstempeln. */
export function endeLokal(datum: Date): Date {
  const { jahr, monat, tag } = tagesteile(datum)
  return new Date(jahr, monat, tag, 23, 59, 59, 999)
}

/** Formatiert ein reines Datum, ohne es in die Ortszeit zu schieben. */
export function formatiereTag(
  datum: Date,
  optionen: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit', year: 'numeric' },
): string {
  return new Intl.DateTimeFormat('de-DE', { ...optionen, timeZone: 'UTC' }).format(datum)
}

/** Erster Tag des Monats, in dem ein reines Datum liegt — als lokales Datum. */
export function monatsbeginn(datum: Date): Date {
  const { jahr, monat } = tagesteile(datum)
  return new Date(jahr, monat, 1)
}

/**
 * Eine Freigabe umfasst immer einen ganzen Monat. Aus `2026-08` werden der
 * erste und der letzte Tag — als reine Datumswerte in UTC, wie die Spalten
 * sie erwarten.
 */
export function monatsgrenzen(monat: string): { von: Date; bis: Date } | null {
  const treffer = /^(\d{4})-(\d{2})$/.exec(monat.trim())
  if (!treffer) return null

  const jahr = Number(treffer[1])
  const nummer = Number(treffer[2])
  if (nummer < 1 || nummer > 12) return null

  return {
    von: new Date(Date.UTC(jahr, nummer - 1, 1)),
    // Tag 0 des Folgemonats ist dessen letzter Tag.
    bis: new Date(Date.UTC(jahr, nummer, 0)),
  }
}

/** `2026-08` aus einem Datum — die Kennung des Monats. */
export function alsMonat(datum: Date): string {
  return `${datum.getUTCFullYear()}-${String(datum.getUTCMonth() + 1).padStart(2, '0')}`
}

const MONATSNAME = new Intl.DateTimeFormat('de-DE', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})

/** „August 2026“ — die Überschrift einer Freigabe. */
export function monatsTitel(von: Date): string {
  return MONATSNAME.format(von)
}

// ------------------------------------------------------------ Posting-Termine

/**
 * Die Zone, in der geplant wird.
 *
 * Ein Posting-Termin ist eine **Uhrzeit an der Wand des Büros**: „Dienstag um
 * zehn". Gespeichert wird ein Zeitstempel, und der ist ohne Zone mehrdeutig —
 * genau daran hing der Fehler, dass die Uhrzeit beim Speichern um zwei Stunden
 * sprang: Der Container läuft in UTC, der Browser in Berlin, und beide lasen
 * dieselben Werte als „Ortszeit".
 *
 * Deshalb zwei Dinge zusammen:
 *
 * 1. Der Container bekommt `TZ=Europe/Berlin` (`docker-compose.yml`). Damit
 *    stimmt jede serverseitige Ortszeit-Rechnung — und davon gibt es viele:
 *    ZIP-Dateinamen, Kalenderwoche, Monatsraster.
 * 2. Was **im Browser** formatiert wird, nennt die Zone ausdrücklich. Sonst
 *    verschöbe sich die Anzeige, sobald jemand aus einer anderen Zone
 *    hineinsieht — und im Zweifel gilt die Zone der Agentur, nicht die des
 *    Betrachters.
 */
export const ZONE = 'Europe/Berlin'

/** Der Versatz der Zone zu UTC an einem bestimmten Zeitpunkt, in Millisekunden. */
function zonenversatz(zeitpunkt: Date): number {
  const teile = new Intl.DateTimeFormat('en-US', {
    timeZone: ZONE,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(zeitpunkt)

  const zahl = (art: Intl.DateTimeFormatPartTypes) =>
    Number(teile.find((t) => t.type === art)?.value ?? 0)

  // `hour12: false` liefert je nach ICU-Fassung 24 statt 0 für Mitternacht.
  const alsUtc = Date.UTC(
    zahl('year'),
    zahl('month') - 1,
    zahl('day'),
    zahl('hour') % 24,
    zahl('minute'),
    zahl('second'),
  )
  return alsUtc - zeitpunkt.getTime()
}

/**
 * Aus `2026-08-11` und `10:00` den Zeitpunkt machen, der in der Zone der
 * Agentur so aussieht.
 *
 * Zweimal gerechnet: Der erste Versuch liest die Eingabe als UTC und zieht den
 * Versatz ab; er trifft daneben, wenn genau in dieser Nacht die Uhr umgestellt
 * wird, weil dann der Versatz **vor** und **nach** der Korrektur verschieden
 * ist. Der zweite Durchgang rechnet mit dem Versatz am nun richtigen Zeitpunkt
 * und trifft.
 */
export function terminAusEingabe(datum: string, uhrzeit: string): Date {
  const [jahr, monat, tag] = datum.split('-').map(Number)
  const [stunde, minute] = (uhrzeit || '00:00').split(':').map(Number)
  const wanduhr = Date.UTC(jahr, monat - 1, tag, stunde, minute)

  let zeitpunkt = new Date(wanduhr - zonenversatz(new Date(wanduhr)))
  zeitpunkt = new Date(wanduhr - zonenversatz(zeitpunkt))
  return zeitpunkt
}

/** `2026-08-11` und `10:00` — die Werte, die `<input type="date|time">` erwartet. */
export function terminFelder(termin: Date | null): { datum: string; uhrzeit: string } {
  if (!termin) return { datum: '', uhrzeit: '' }

  const teile = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONE,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(termin)

  const wert = (art: Intl.DateTimeFormatPartTypes) =>
    teile.find((t) => t.type === art)?.value ?? '00'

  return {
    datum: `${wert('year')}-${wert('month')}-${wert('day')}`,
    uhrzeit: `${String(Number(wert('hour')) % 24).padStart(2, '0')}:${wert('minute')}`,
  }
}

/** Einen Posting-Termin anzeigen — immer in der Zone der Agentur. */
export function formatiereTermin(
  termin: Date,
  optionen: Intl.DateTimeFormatOptions,
): string {
  return new Intl.DateTimeFormat('de-DE', { ...optionen, timeZone: ZONE }).format(termin)
}
