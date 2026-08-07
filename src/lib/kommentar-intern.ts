import { prisma } from './db'
import { istIntern } from './kommentar-text'

/**
 * Ob ein Kommentar im Haus bleibt.
 *
 * Zwei Wege führen dahin: die Marke `#intern` im Text — oder ein Strang, der
 * schon intern ist. Eine Antwort ohne Marke unter einer internen Anmerkung
 * stünde beim Kunden sonst ohne ihren Bezug da, und aus „ja, machen wir"
 * würde eine Zusage an die falsche Person.
 *
 * Abgeleitet wird beim Schreiben und in `Kommentar.intern` festgehalten:
 * So filtert schon die Abfrage, statt jede Anzeige daran zu erinnern.
 * Vertraulichkeit, die an einer vergessenen Bedingung im Bauteil hängt, ist
 * keine.
 */
export async function internAbleiten(
  text: string,
  antwortAufId: string | null,
  /** Gäste markieren nicht — sie schreiben an den Kunden, nicht über ihn. */
  vomTeam: boolean,
): Promise<boolean> {
  if (vomTeam && istIntern(text)) return true
  if (!antwortAufId) return false

  const eltern = await prisma.kommentar.findUnique({
    where: { id: antwortAufId },
    select: { intern: true },
  })
  return eltern?.intern ?? false
}
