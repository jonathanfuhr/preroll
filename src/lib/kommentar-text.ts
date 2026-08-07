/**
 * Erwähnungen in Kommentaren.
 *
 * Im Text steht eine Erwähnung als `@[Anzeigename](n:<id>)` für ein
 * Teamkonto und `@[Anzeigename](g:<id>)` für einen Gast. Der Name liegt
 * bewusst mit im Text: So bleibt ein Kommentar auch dann lesbar, wenn das
 * Konto später umbenannt oder gelöscht wird — in einer Mail, im
 * Kommentar-PDF und in der Glocke steht dann kein toter Verweis.
 *
 * Die Kennungen sind damit die **einzige** Quelle dafür, wer erwähnt wurde;
 * eine zweite Tabelle daneben könnte auseinanderlaufen. Wer benachrichtigt
 * wird, entscheidet trotzdem nicht der Text: `meldeNeuenKommentar` gleicht
 * die Kennungen gegen den Kreis ab, der ohnehin Zutritt hat.
 */

export type Erwaehnung = { art: 'nutzer' | 'gast'; id: string; name: string }

/** `@[Name](n:id)` — der Name darf keine eckigen Klammern enthalten. */
const MUSTER = /@\[([^\]]{1,80})\]\((n|g):([A-Za-z0-9_-]{1,40})\)/g

export function erwaehnungMarke(art: 'nutzer' | 'gast', id: string, name: string): string {
  // Klammern im Namen würden das Muster zerlegen — sie fallen weg.
  return `@[${name.replace(/[[\]()]/g, '')}](${art === 'nutzer' ? 'n' : 'g'}:${id})`
}

export function erwaehnungenAus(text: string): Erwaehnung[] {
  const gefunden = new Map<string, Erwaehnung>()

  for (const treffer of text.matchAll(MUSTER)) {
    const art = treffer[2] === 'n' ? 'nutzer' : 'gast'
    const schluessel = `${art}:${treffer[3]}`
    if (!gefunden.has(schluessel)) {
      gefunden.set(schluessel, { art, id: treffer[3], name: treffer[1] })
    }
  }

  return [...gefunden.values()]
}

/**
 * Der Text ohne Auszeichnung — für Mail, Push und das Kommentar-PDF. Dort
 * gibt es keine Chips, und rohe Kennungen will dort niemand lesen.
 */
export function alsKlartext(text: string): string {
  return text.replace(MUSTER, (_, name: string) => `@${name}`)
}

// ------------------------------------------------------------- #intern

/**
 * `#intern` macht einen Kommentar zur Hausangelegenheit: für Abstimmungen
 * im Team, an denen der Kunde nicht teilnehmen soll. Er sieht ihn nicht und
 * hört auch nichts davon.
 *
 * Am Wortanfang, damit eine Adresse oder ein Hashtag mitten im Satz nicht
 * versehentlich auslöst; `#interne Abstimmung` bleibt gewöhnlicher Text.
 */
const INTERN = /(^|\s)#intern(?![\wäöüß])/i

export const INTERN_MARKE = '#intern'

export function istIntern(text: string): boolean {
  return INTERN.test(text)
}

/** Text in Stücke zerlegt, damit die Anzeige Chips setzen kann. */
export type Stueck =
  | { art: 'text'; inhalt: string }
  | { art: 'erwaehnung'; erwaehnung: Erwaehnung }

export function zerlegeText(text: string): Stueck[] {
  const stuecke: Stueck[] = []
  let zuletzt = 0

  for (const treffer of text.matchAll(MUSTER)) {
    const start = treffer.index
    if (start > zuletzt) stuecke.push({ art: 'text', inhalt: text.slice(zuletzt, start) })
    stuecke.push({
      art: 'erwaehnung',
      erwaehnung: {
        art: treffer[2] === 'n' ? 'nutzer' : 'gast',
        id: treffer[3],
        name: treffer[1],
      },
    })
    zuletzt = start + treffer[0].length
  }

  if (zuletzt < text.length) stuecke.push({ art: 'text', inhalt: text.slice(zuletzt) })
  return stuecke
}
