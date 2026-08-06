import type { Freigabestufe, PostStatus } from '@prisma/client'

/**
 * Der Kunde gibt zweimal frei: einmal das Konzept, nach dem Dreh die Vorschau.
 * Welche Stufe ansteht, ergibt sich allein aus dem Status des Posts — deshalb
 * liegt die Regel hier und nicht verstreut in den Ansichten.
 */

export const STUFE_TEXT: Record<Freigabestufe, string> = {
  KONZEPT: 'Konzept',
  VORSCHAU: 'Vorschau',
}

/** Die Stufe, die bei diesem Status ansteht — oder null, wenn nichts offen ist. */
export function offeneStufe(status: PostStatus): Freigabestufe | null {
  if (status === 'KONZEPT') return 'KONZEPT'
  if (status === 'VORSCHAU') return 'VORSCHAU'
  // Final heißt: Konzept und Vorschau sind durch, es gibt nichts mehr zu tun.
  return null
}

/** Beschriftung des Knopfs, z. B. „Konzept freigeben". */
export function freigabeBeschriftung(stufe: Freigabestufe): string {
  return `${STUFE_TEXT[stufe]} freigeben`
}

export type FreigabeStand = {
  /** Welche Stufe der Kunde jetzt freigeben soll; null, wenn nichts ansteht. */
  offen: Freigabestufe | null
  /** Ist die anstehende Stufe schon freigegeben? */
  erledigt: boolean
  /** Bereits erteilte Stufen, in der Reihenfolge Konzept → Vorschau. */
  erteilt: Freigabestufe[]
}

/**
 * Stand eines einzelnen Posts. `stufen` sind die bereits erteilten Freigaben.
 */
export function freigabeStand(status: PostStatus, stufen: Freigabestufe[]): FreigabeStand {
  const offen = offeneStufe(status)
  const erteilt = (['KONZEPT', 'VORSCHAU'] as Freigabestufe[]).filter((s) => stufen.includes(s))

  return {
    offen,
    erledigt: offen !== null && stufen.includes(offen),
    erteilt,
  }
}

/**
 * Zählt für eine Liste von Posts, wie viele ihre anstehende Stufe schon
 * freigegeben haben. Posts ohne offene Stufe (Final) zählen als erledigt.
 */
export function freigabeFortschritt(
  posts: Array<{ status: PostStatus; freigaben: Array<{ stufe: Freigabestufe }> }>,
): { erledigt: number; gesamt: number; vollstaendig: boolean } {
  const gesamt = posts.length
  const erledigt = posts.filter((post) => {
    const stand = freigabeStand(
      post.status,
      post.freigaben.map((f) => f.stufe),
    )
    return stand.offen === null || stand.erledigt
  }).length

  return { erledigt, gesamt, vollstaendig: gesamt > 0 && erledigt === gesamt }
}
