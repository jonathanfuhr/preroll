/**
 * Mindestanforderungen an ein Passwort — dieselben wie in Klappe, damit im
 * Haus nicht zwei Regeln nebeneinander gelten.
 */
export const PASSWORT_MINDESTLAENGE = 10

export function passwortRegelText(): string {
  return `Mindestens ${PASSWORT_MINDESTLAENGE} Zeichen, davon Buchstaben und Ziffern.`
}

/** Gibt den Grund zurück, warum ein Passwort nicht taugt — oder null. */
export function pruefePasswortRegeln(passwort: string): string | null {
  if (passwort.length < PASSWORT_MINDESTLAENGE) {
    return `Das Passwort braucht mindestens ${PASSWORT_MINDESTLAENGE} Zeichen.`
  }
  if (!/[a-zA-Z]/.test(passwort)) return 'Das Passwort braucht mindestens einen Buchstaben.'
  if (!/[0-9]/.test(passwort)) return 'Das Passwort braucht mindestens eine Ziffer.'
  return null
}
