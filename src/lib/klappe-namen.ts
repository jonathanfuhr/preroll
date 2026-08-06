/**
 * Namensgebung für Videos in Klappe.
 *
 * Bewusst ohne `server-only`: die Funktionen sind reine Textarbeit und sollen
 * sich testen lassen, ohne den ganzen Klappe-Client zu laden.
 */

/**
 * Name des Videos in Klappe. Datum voran, damit die Liste dort chronologisch
 * lesbar bleibt — dieselbe Logik wie bei den ZIP-Dateinamen.
 */
export function klappeVideoName(postenAm: Date, titel: string): string {
  const jj = String(postenAm.getFullYear() % 100).padStart(2, '0')
  const mm = String(postenAm.getMonth() + 1).padStart(2, '0')
  const tt = String(postenAm.getDate()).padStart(2, '0')
  return `${jj}${mm}${tt} ${titel}`
}

export function klappeVideoBeschreibung(postenAm: Date, kunde: string): string {
  const termin = new Intl.DateTimeFormat('de-DE', {
    dateStyle: 'full',
    timeStyle: 'short',
  }).format(postenAm)
  return `Aus Preroll · ${kunde} · geplant für ${termin} Uhr`
}
