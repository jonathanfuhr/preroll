import 'server-only'
import { antwortadresseFuerKunden } from './antwortadresse'
import { prisma } from './db'
import { alsKlartext } from './kommentar-text'
import { sendeMail } from './mail'
import { vorlageKommentarSammlung } from './mail/vorlagen'
import { faelligeGruppen, RUHE } from './sammelfrist'

/**
 * Kommentar-Mails sammeln, statt je Kommentar eine zu schicken.
 *
 * Wer einen Monatsplan durchgeht, kommentiert fünf Beiträge in zwei Minuten —
 * und löste damit fünf Mails an dieselbe Person aus. Das liest niemand
 * einzeln; es ist eine Unterbrechung je Satz, und die Meldungen entwerten sich
 * gegenseitig.
 *
 * Deshalb: Erst wenn **`RUHE` lang kein neuer Kommentar mehr kam**, geht eine
 * Mail mit allen raus. Nicht fünf Minuten nach dem *ersten* — dann bräche der
 * Versand mitten in eine laufende Durchsicht. Am **letzten** gemessen wartet
 * die Mail, bis jemand wirklich fertig ist.
 *
 * Gruppiert wird **je Kunde**, nicht je Beitrag: Wer einen Plan durchsieht,
 * tut das für einen Kunden, und eine Mail je Beitrag wäre wieder dieselbe Flut.
 *
 * **Push und Glocke bleiben sofort.** Sie unterbrechen nicht auf dieselbe
 * Weise, und wer am Telefon mitliest, will es sofort wissen.
 */

/** Takt des Versands. Feiner als `RUHE`, sonst wartet die Mail fast doppelt so lang. */
const TAKT = 60_000

/**
 * Einen Kommentar für eine Adresse vormerken.
 *
 * Wer welchen Kommentar sehen darf, hat der Verteiler beim Eintreffen schon
 * entschieden — hier wird nur noch gemerkt. Die Rechte beim Versand ein
 * zweites Mal zu rechnen hieße, zwei Antworten auf dieselbe Frage zu haben,
 * und irgendwann gingen sie auseinander.
 */
export async function merkeKommentarVor(
  kundeId: string,
  email: string,
  kommentarId: string,
  url: string,
): Promise<void> {
  await prisma.kommentarSammlung
    .create({ data: { kundeId, email, kommentarId, url } })
    .catch(() => {})
}

/**
 * Alle fälligen Sammlungen verschicken. Wirft nie — ein Fehler hier darf den
 * Takt nicht mitnehmen, und in einer Minute kommt der nächste.
 */
export async function versendeFaellige(jetzt = new Date()): Promise<number> {
  const offen = await prisma.kommentarSammlung.findMany({
    select: { kundeId: true, email: true, erstelltAm: true },
  })
  const gruppen = faelligeGruppen(offen, jetzt)
  if (gruppen.length === 0) return 0

  let versendet = 0

  for (const gruppe of gruppen) {
    /*
      Die Zeilen erst hier laden, samt Kommentar: Zwischen dem Vormerken und
      dem Versand kann jemand einen Kommentar gelöscht haben. Die Zeile ist
      dann mit weg (`onDelete: Cascade`), und die Mail nennt ihn gar nicht.
    */
    const zeilen = await prisma.kommentarSammlung.findMany({
      where: { kundeId: gruppe.kundeId, email: gruppe.email },
      orderBy: { erstelltAm: 'asc' },
      include: {
        kunde: { select: { name: true } },
        kommentar: { include: { post: { select: { titel: true } } } },
      },
    })
    if (zeilen.length === 0) continue

    const eintraege = zeilen
      .filter((z) => z.kommentar.post)
      .map((z) => ({
        autor: z.kommentar.autorName,
        postTitel: z.kommentar.post!.titel,
        text: alsKlartext(z.kommentar.text),
        intern: z.kommentar.intern,
        url: z.url,
      }))

    /*
      Erst löschen, dann senden. Bleibt der Versand hängen, geht eine Meldung
      verloren — bliebe die Zeile stehen, ginge sie im Minutentakt immer wieder
      raus. Eine verlorene Meldung ist ärgerlich, eine Mailschleife schlimmer.
    */
    await prisma.kommentarSammlung.deleteMany({
      where: { id: { in: zeilen.map((z) => z.id) } },
    })

    if (eintraege.length === 0) continue

    await sendeMail({
      ...vorlageKommentarSammlung(gruppe.email, zeilen[0].kunde.name, eintraege),
      antwortAn: await antwortadresseFuerKunden(gruppe.kundeId),
    }).catch(() => {})
    versendet++
  }

  return versendet
}

let gestartet = false

/**
 * Der Takt. Wie beim Zeitplaner der Veröffentlichung an den Prozess gehängt,
 * nicht umgekehrt — und **nicht** hinter dem Schalter für das Veröffentlichen:
 * Eine abgeschaltete Veröffentlichung soll keine Kommentar-Mails verschlucken.
 */
export function starteSammelversand(): void {
  if (gestartet) return
  gestartet = true

  const uhr = setInterval(() => {
    void versendeFaellige().catch((fehler) =>
      console.warn('[kommentar-sammlung] Versand fehlgeschlagen:', fehler),
    )
  }, TAKT)
  uhr.unref?.()

  console.info(`[kommentar-sammlung] Sammelversand läuft, Ruhe ${RUHE / 60_000} min.`)
}
