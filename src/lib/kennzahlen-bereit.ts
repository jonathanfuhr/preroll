import type { KennzahlenQuelle, Plattform } from '@prisma/client'

/**
 * Welche Plattformen Preroll selbst abruft — und woran das jeweils hängt.
 *
 * Bewusst ohne `server-only`: Der Abruf selbst ist Netzwerkarbeit, die
 * **Bedingung** dagegen ist eine Festlegung, und die gehört geprüft. Sie steht
 * an drei Stellen zugleich — in der Warteschlange als SQL, im Abruf als
 * Prüfung, in der Oberfläche als Satz. Ohne eine gemeinsame Quelle liefen die
 * drei irgendwann auseinander, und ein Knopf wäre bedienbar, wo der Lauf
 * längst nichts mehr findet.
 *
 * **Zwei Wege, und der Unterschied ist kein Zufall.** Wo eine Seite dem
 * Systemnutzer der Agentur zugewiesen ist, geht es über die **Graph API** —
 * offiziell, stabil und ohne Drosselung. Wo nicht, bleibt nur das Auslesen der
 * öffentlichen Profilseite.
 *
 * **Instagram kann beides.** Hängt am Kunden eine Facebook-Seite mit
 * verknüpftem Instagram-Konto, liefert die Graph API Follower, Beiträge, Bio
 * und Profilbild — nachgemessen dieselben Zahlen wie das Auslesen, nur ohne
 * dessen Nachteile. Fehlt die Zuordnung, greift weiter der öffentliche Weg;
 * er ist der einzige für Profile, die der Agentur nicht zugewiesen sind.
 *
 * Dass der öffentliche Weg gebraucht wird, hat sich nebenbei bestätigt:
 * Instagram liefert für einen Teil der Business-Konten einen Fehler aus
 * eigenem Haus, und dagegen hilft nur die offizielle Schnittstelle.
 *
 * TikTok bleibt beim Auslesen — dort gibt es keinen Zugang der Agentur.
 */

/** Woran ein Abruf hängt: das Profil und die Kanalzuordnung des Kunden. */
export type Abrufkontext = {
  handle: string | null
  fbSeitenId: string | null
  fbSeitenToken: string | null
  /** Das verknüpfte Instagram-Konto — Voraussetzung für den Weg über Graph. */
  igKontoId: string | null
}

export type Abrufbedingung = {
  quelle: KennzahlenQuelle
  /** Steht alles bereit, was dieser Abruf braucht? */
  bereit: (k: Abrufkontext) => boolean
  /** Was fehlt, in einem Satz — steht so in der Oberfläche. */
  fehlt: string
}

export const ABRUF_BEDINGUNG = {
  INSTAGRAM: {
    // Welche Quelle es am Ende war, entscheidet der Abruf: Mit Zuordnung
    // Graph, ohne sie das Auslesen. Hier steht der häufigere Fall.
    quelle: 'INSTAGRAM_WEB',
    /*
      Zwei Wege, einer genügt: das zugeordnete Konto (Graph) **oder** ein
      Handle (öffentliche Profilseite). Nur mit dem Handle zu prüfen hieße,
      einen Kunden auszusperren, dessen Konto zugeordnet ist, aber dessen
      Handle niemand eingetippt hat — obwohl gerade der den besseren Weg hat.
    */
    bereit: (k) => Boolean((k.igKontoId && k.fbSeitenToken) || k.handle?.trim()),
    fehlt:
      'Für diesen Kunden ist weder ein Instagram-Handle hinterlegt noch ein Instagram-Konto ' +
      'über die Facebook-Seite zugeordnet.',
  },
  TIKTOK: {
    quelle: 'TIKTOK_WEB',
    bereit: (k) => Boolean(k.handle?.trim()),
    fehlt: 'Für diesen Kunden ist kein TikTok-Handle hinterlegt.',
  },
  FACEBOOK: {
    quelle: 'GRAPH_API',
    // Nicht der Handle, sondern die Zuordnung: Gefragt wird über die Seite,
    // nicht über einen Namen — und ohne Seite gibt es kein Token.
    bereit: (k) => Boolean(k.fbSeitenId && k.fbSeitenToken),
    fehlt: 'Diesem Kunden ist keine Facebook-Seite zugeordnet — ohne sie gibt es kein Token.',
  },
} satisfies Partial<Record<Plattform, Abrufbedingung>>

export type AbrufbarePlattform = keyof typeof ABRUF_BEDINGUNG

export const ABRUFBARE_PLATTFORMEN = Object.keys(ABRUF_BEDINGUNG) as AbrufbarePlattform[]

export function istAbrufbar(plattform: Plattform): plattform is AbrufbarePlattform {
  return plattform in ABRUF_BEDINGUNG
}

/**
 * Die Plattformen, für die ein Handle allein genügt — für die Warteschlange.
 *
 * Instagram steht hier mit drin, obwohl es auch über die Zuordnung geht: Ein
 * Handle reicht ihm, und die Warteschlange nimmt den zugeordneten Fall
 * zusätzlich auf (siehe `wacheUeberKennzahlen`).
 */
export const UEBER_HANDLE = ABRUFBARE_PLATTFORMEN.filter((p) =>
  ABRUF_BEDINGUNG[p].bereit({
    handle: 'x',
    fbSeitenId: null,
    fbSeitenToken: null,
    igKontoId: null,
  }),
)
