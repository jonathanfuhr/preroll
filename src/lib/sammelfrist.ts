/**
 * Wann eine gesammelte Kommentar-Mail fällig ist.
 *
 * Bewusst ohne `server-only`: Der Versand daneben ist Netzwerkarbeit, die
 * **Frist** dagegen ist eine Festlegung — und die gehört geprüft. Dieselbe
 * Trennung wie bei `kennzahlen-bereit.ts`.
 */

/** Wie lange Ruhe herrschen muss, bevor die Sammel-Mail rausgeht. */
export const RUHE = 5 * 60_000

export type Gruppe = { kundeId: string; email: string }

/**
 * Welche Gruppen fällig sind: die, in denen seit `RUHE` nichts mehr dazukam.
 *
 * Gemessen am **letzten** Kommentar, nicht am ersten. Fünf Minuten nach dem
 * ersten gerechnet bräche der Versand mitten in eine laufende Durchsicht —
 * die Hälfte der Anmerkungen käme in einer Mail, der Rest in der nächsten.
 * Am letzten gemessen wartet sie, bis jemand wirklich fertig ist.
 */
export function faelligeGruppen(
  zeilen: Array<{ kundeId: string; email: string; erstelltAm: Date }>,
  jetzt: Date,
  ruhe = RUHE,
): Gruppe[] {
  const juengste = new Map<string, { gruppe: Gruppe; am: Date }>()

  for (const z of zeilen) {
    const schluessel = `${z.kundeId} ${z.email}`
    const bisher = juengste.get(schluessel)
    if (!bisher || z.erstelltAm > bisher.am) {
      juengste.set(schluessel, { gruppe: { kundeId: z.kundeId, email: z.email }, am: z.erstelltAm })
    }
  }

  return [...juengste.values()]
    .filter(({ am }) => jetzt.getTime() - am.getTime() >= ruhe)
    .map(({ gruppe }) => gruppe)
}
