import 'server-only'
import { antwortadresseFuerKunden } from './antwortadresse'
import { prisma } from './db'
import { istInterneStufe, STUFE_TEXT } from './freigabe'
import { alsKlartext } from './kommentar-text'
import { sendeMail } from './mail'
import { vorlageSammlung, type Sammeleintrag } from './mail/vorlagen'
import { faelligeGruppen, RUHE } from './sammelfrist'

/**
 * Meldungen sammeln, statt je Ereignis eine Mail zu schicken.
 *
 * Kommentare **und Freigaben** kommen in Schüben: Wer einen Monatsplan
 * durchgeht, kommentiert zu fünf Beiträgen und gibt acht frei — und löste
 * damit dreizehn Mails an dieselbe Person aus. Das liest niemand einzeln; es
 * ist eine Unterbrechung je Klick, und die Meldungen entwerten sich
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
 * Eine Meldung für eine Adresse vormerken.
 *
 * Wer was sehen darf, hat der Verteiler beim Eintreffen schon entschieden —
 * hier wird nur noch gemerkt. Die Rechte beim Versand ein zweites Mal zu
 * rechnen hieße, zwei Antworten auf dieselbe Frage zu haben, und irgendwann
 * gingen sie auseinander.
 */
export async function merkeVor(
  eintrag:
    | { art: 'KOMMENTAR'; kundeId: string; email: string; kommentarId: string; url: string }
    | { art: 'FREIGABE'; kundeId: string; email: string; freigabeId: string; url: string },
): Promise<void> {
  await prisma.meldungSammlung
    .create({
      data:
        eintrag.art === 'KOMMENTAR'
          ? {
              art: 'KOMMENTAR',
              kundeId: eintrag.kundeId,
              email: eintrag.email,
              kommentarId: eintrag.kommentarId,
              url: eintrag.url,
            }
          : {
              art: 'FREIGABE',
              kundeId: eintrag.kundeId,
              email: eintrag.email,
              freigabeId: eintrag.freigabeId,
              url: eintrag.url,
            },
    })
    .catch(() => {})
}

/**
 * Alle fälligen Sammlungen verschicken. Wirft nie — ein Fehler hier darf den
 * Takt nicht mitnehmen, und in einer Minute kommt der nächste.
 */
export async function versendeFaellige(jetzt = new Date()): Promise<number> {
  const offen = await prisma.meldungSammlung.findMany({
    select: { kundeId: true, email: true, erstelltAm: true },
  })
  const gruppen = faelligeGruppen(offen, jetzt)
  if (gruppen.length === 0) return 0

  let versendet = 0

  for (const gruppe of gruppen) {
    /*
      Die Zeilen erst hier laden, samt Ereignis: Zwischen dem Vormerken und dem
      Versand kann jemand einen Kommentar gelöscht oder eine Freigabe
      zurückgenommen haben. Die Zeile ist dann mit weg (`onDelete: Cascade`),
      und die Mail nennt sie gar nicht.
    */
    const zeilen = await prisma.meldungSammlung.findMany({
      where: { kundeId: gruppe.kundeId, email: gruppe.email },
      orderBy: { erstelltAm: 'asc' },
      include: {
        kunde: { select: { name: true } },
        kommentar: { include: { post: { select: { titel: true } } } },
        freigabe: { include: { post: { select: { titel: true } } } },
      },
    })
    if (zeilen.length === 0) continue

    const eintraege: Sammeleintrag[] = []
    for (const z of zeilen) {
      if (z.kommentar?.post) {
        eintraege.push({
          art: 'KOMMENTAR',
          autor: z.kommentar.autorName,
          postTitel: z.kommentar.post.titel,
          text: alsKlartext(z.kommentar.text),
          intern: z.kommentar.intern,
          url: z.url,
        })
      } else if (z.freigabe?.post) {
        eintraege.push({
          art: 'FREIGABE',
          autor: z.freigabe.autorName,
          postTitel: z.freigabe.post.titel,
          // Bei einer Freigabe steht die Stufe da, wo beim Kommentar der Text
          // stünde — sie ist die ganze Aussage.
          text: `${STUFE_TEXT[z.freigabe.stufe]} freigegeben`,
          intern: istInterneStufe(z.freigabe.stufe),
          url: z.url,
        })
      }
    }

    /*
      Erst löschen, dann senden. Bleibt der Versand hängen, geht eine Meldung
      verloren — bliebe die Zeile stehen, ginge sie im Minutentakt immer wieder
      raus. Eine verlorene Meldung ist ärgerlich, eine Mailschleife schlimmer.
    */
    await prisma.meldungSammlung.deleteMany({
      where: { id: { in: zeilen.map((z) => z.id) } },
    })

    if (eintraege.length === 0) continue

    await sendeMail({
      ...vorlageSammlung(gruppe.email, zeilen[0].kunde.name, eintraege),
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
      console.warn('[meldung-sammlung] Versand fehlgeschlagen:', fehler),
    )
  }, TAKT)
  uhr.unref?.()

  console.info(`[meldung-sammlung] Sammelversand läuft, Ruhe ${RUHE / 60_000} min.`)
}
