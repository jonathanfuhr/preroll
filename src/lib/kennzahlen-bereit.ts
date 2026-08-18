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
 * **Zwei Wege, und der Unterschied ist kein Zufall.** Instagram und TikTok
 * werden aus ihrer öffentlichen Profilseite gelesen: Dort beobachtet Preroll
 * *fremde* Profile, und einen Weg über die offizielle Schnittstelle gibt es
 * dafür nicht — er setzte eine Anmeldung des Kontoinhabers voraus. Facebook
 * geht über die **Graph API**: Die Seite ist dem Systemnutzer der Agentur
 * zugewiesen, das Token liegt am Kunden. Deshalb hängt Facebook an der
 * Zuordnung, nicht an einem Handle.
 */

/** Woran ein Abruf hängt: das Profil und die Kanalzuordnung des Kunden. */
export type Abrufkontext = {
  handle: string | null
  fbSeitenId: string | null
  fbSeitenToken: string | null
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
    quelle: 'INSTAGRAM_WEB',
    bereit: (k) => Boolean(k.handle?.trim()),
    fehlt: 'Für diesen Kunden ist kein Instagram-Handle hinterlegt.',
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

/** Die Plattformen, die an einem Handle hängen — für die Warteschlange. */
export const UEBER_HANDLE = ABRUFBARE_PLATTFORMEN.filter(
  (p) => !ABRUF_BEDINGUNG[p].bereit({ handle: null, fbSeitenId: 'x', fbSeitenToken: 'y' }),
)
