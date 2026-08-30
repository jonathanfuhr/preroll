/**
 * Wird einmal beim Start einer Serverinstanz aufgerufen — der einzige Ort in
 * Next.js, an dem etwas läuft, ohne dass jemand eine Seite aufruft. Genau das
 * braucht der Zeitplaner: Ein Posting darf nicht davon abhängen, ob gerade
 * jemand im Backend arbeitet.
 *
 * Nur im Node-Prozess. In der Edge-Laufzeit gibt es weder Prisma noch einen
 * langlebigen Prozess, in dem ein Intervall Sinn ergäbe.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  const { starteZeitplaner } = await import('./lib/veroeffentlichung-lauf')
  starteZeitplaner()

  // Kommentar- und Freigabemeldungen gehen gesammelt raus — auch das braucht einen Takt, der
  // nicht davon abhängt, ob gerade jemand im Backend arbeitet.
  const { starteSammelversand } = await import('./lib/meldung-sammlung')
  starteSammelversand()
}
