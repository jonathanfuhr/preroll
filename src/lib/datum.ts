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
