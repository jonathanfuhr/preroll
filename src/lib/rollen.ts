import type { Rolle } from '@prisma/client'

/**
 * Rollen im Team.
 *
 * Alle vier dürfen **alles lesen und bearbeiten** — die Rolle entscheidet nur
 * über zwei Dinge: wer die Verwaltung öffnen darf, und wer worüber
 * benachrichtigt wird. Bewusst so flach: In einer Agentur dieser Größe
 * bremsen feingliedrige Schreibrechte mehr, als sie schützen.
 */

export const ROLLE_TEXT: Record<Rolle, string> = {
  ADMIN: 'Administrator',
  PROJEKTMANAGER: 'Projektmanagement',
  DESIGNER: 'Design',
  EDITOR: 'Schnitt',
}

export const ROLLE_BESCHREIBUNG: Record<Rolle, string> = {
  ADMIN: 'Darf zusätzlich Einstellungen und Konten verwalten. Bekommt Meldungen aller Kunden.',
  PROJEKTMANAGER: 'Bekommt Meldungen aller Kunden. Als Ansprechpartner wählbar.',
  DESIGNER:
    'Bekommt Meldungen der betreuten Kunden und der Exporte, bei denen sie oder er hinterlegt ist. Als Ansprechpartner wählbar.',
  EDITOR: 'Liest und bearbeitet alles, bekommt aber keine Meldungen und ist nicht als Ansprechpartner wählbar.',
}

export const ALLE_ROLLEN: Rolle[] = ['ADMIN', 'PROJEKTMANAGER', 'DESIGNER', 'EDITOR']

/** Einstellungen und Benutzerverwaltung. */
export function darfVerwalten(rolle: Rolle): boolean {
  return rolle === 'ADMIN'
}

/**
 * Wer als Ansprechpartner auf einer Export-Seite stehen darf. Schnitt ist
 * bewusst außen vor — dort landen Rückfragen zum Inhalt, nicht zur Montage.
 */
export function darfAnsprechpartnerSein(rolle: Rolle): boolean {
  return rolle !== 'EDITOR'
}

/** Wer Meldungen unabhängig vom einzelnen Kunden bekommt. */
export function hoertBeiAllenKundenMit(rolle: Rolle): boolean {
  return rolle === 'ADMIN' || rolle === 'PROJEKTMANAGER'
}

export type Empfaengerlage = {
  /** Hauptansprechpartner des Kunden — bekommt immer alles. */
  hauptAnsprechpartnerId: string | null
  /** Zusätzlicher Ansprechpartner dieses Export-Links, falls gesetzt. */
  zusatzAnsprechpartnerId?: string | null
  /** Kennungen der Konten, die diesen Kunden betreuen. */
  betreuerIds: string[]
}

export type Kandidat = {
  id: string
  rolle: Rolle
  aktiv: boolean
}

/**
 * Wer über ein Ereignis dieses Kunden benachrichtigt wird.
 *
 * Die Regel in Worten: Der Hauptansprechpartner bekommt es immer — auch dann,
 * wenn für den Export zusätzlich jemand anderes hinterlegt ist; der ersetzt
 * ihn nicht, sondern kommt dazu. Projektmanagement und Administration hören
 * bei allen Kunden mit. Design bekommt, was zu den betreuten Kunden gehört.
 * Schnitt bekommt nichts.
 */
export function empfaenger(kandidaten: Kandidat[], lage: Empfaengerlage): string[] {
  const betreuer = new Set(lage.betreuerIds)
  const ids = new Set<string>()

  for (const kandidat of kandidaten) {
    if (!kandidat.aktiv) continue

    const istAnsprechpartner =
      kandidat.id === lage.hauptAnsprechpartnerId || kandidat.id === lage.zusatzAnsprechpartnerId

    if (istAnsprechpartner) {
      ids.add(kandidat.id)
      continue
    }
    if (hoertBeiAllenKundenMit(kandidat.rolle)) {
      ids.add(kandidat.id)
      continue
    }
    if (kandidat.rolle === 'DESIGNER' && betreuer.has(kandidat.id)) {
      ids.add(kandidat.id)
    }
  }

  return [...ids]
}
