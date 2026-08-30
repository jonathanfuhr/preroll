import 'server-only'
import { prisma } from './db'

/**
 * Wohin eine Antwort auf eine Benachrichtigung gehen soll.
 *
 * Gesendet wird aus einem reinen **Ausgangspostfach** (etwa
 * `preroll@thdvideo.de`), in das niemand hineinsieht. Ohne `Reply-To` liefe
 * jede Antwort dorthin — oder, schlimmer, an die allgemeine Adresse der
 * Agentur, wo sie zwischen allem anderen untergeht. Genau das war der Anlass:
 * Die Meldungen lagen im Postausgang der Sammeladresse.
 *
 * Zuständig ist die **Projektverantwortliche des Kunden** — der
 * Hauptansprechpartner. Wer auf „Neuer Kommentar bei Beispiel GmbH" antwortet,
 * meint diesen Kunden, und die Antwort soll bei der Person landen, die ihn
 * betreut.
 *
 * Fehlt sie, bleibt das Feld leer: Eine erfundene Adresse wäre schlechter als
 * keine — dann greift der Absender, und der ist wenigstens ehrlich.
 */
export async function antwortadresseFuerKunden(kundeId: string): Promise<string | null> {
  const kunde = await prisma.kunde.findUnique({
    where: { id: kundeId },
    select: { hauptAnsprechpartner: { select: { email: true, aktiv: true } } },
  })

  // Ein stillgelegtes Konto ist keine Antwortadresse mehr.
  const person = kunde?.hauptAnsprechpartner
  return person?.aktiv && person.email ? person.email : null
}
