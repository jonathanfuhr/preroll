import type { Freigabestufe, PostStatus, Rolle } from '@prisma/client'
import { istSichtbarePhase } from './phasen'

/**
 * Jede Phase außer Final trägt genau eine Freigabe.
 *
 * In den **sichtbaren** Phasen (Konzept, Vorschau) kommt sie vom Kunden — er
 * segnet ab, was er vor sich sieht. In den **Arbeitsphasen** (Entwurf,
 * Produktion, Korrektur) kommt sie aus dem Haus: Sie sagt „das kann so zum
 * Kunden". Die interne Freigabe im Entwurf ist damit das Absegnen des
 * Konzepts, die in der Produktion das der Vorschau, die in der Korrektur das
 * der finalen Fassung — jede interne Runde segnet ab, was in der **nächsten**
 * sichtbaren Phase gezeigt wird.
 *
 * Bei **Final** gibt es nichts mehr abzusegnen; dort steht keine Freigabe an.
 *
 * Welche Stufe ansteht, ergibt sich allein aus der Phase — nie aus dem
 * Formular. Deshalb liegt die Regel hier und nicht verstreut in den Ansichten.
 */

export const STUFE_TEXT: Record<Freigabestufe, string> = {
  ENTWURF: 'Entwurf',
  KONZEPT: 'Konzept',
  PRODUKTION: 'Produktion',
  VORSCHAU: 'Vorschau',
  KORREKTUR: 'Korrektur',
}

/** Die Reihenfolge, in der die Freigaben anfallen. */
export const STUFEN: Freigabestufe[] = ['ENTWURF', 'KONZEPT', 'PRODUKTION', 'VORSCHAU', 'KORREKTUR']

/**
 * Eine interne Freigabe kommt aus dem Haus, eine externe vom Kunden.
 *
 * Abgeleitet aus der Phase statt als eigenes Feld: Zwei Angaben über dieselbe
 * Sache können einander widersprechen, und dann entscheidet der Zufall, welche
 * gilt.
 */
export function istInterneStufe(stufe: Freigabestufe): boolean {
  return !istSichtbarePhase(stufe)
}

/**
 * Wer eine interne Freigabe erteilen darf.
 *
 * Nur Administration und Projektmanagement — es geht darum, ob etwas das Haus
 * verlassen kann, und das ist nicht die Entscheidung derjenigen, die es gebaut
 * haben. Geprüft wird am Server; die Knöpfe sind Bequemlichkeit, so wie bei den
 * Kommentarrechten.
 */
export function darfInternFreigeben(rolle: Rolle): boolean {
  return rolle === 'ADMIN' || rolle === 'PROJEKTMANAGER'
}

/** Die Stufe, die bei dieser Phase ansteht — oder null, wenn nichts offen ist. */
export function offeneStufe(status: PostStatus): Freigabestufe | null {
  // Final ist die einzige Phase ohne Freigabe. Alle anderen heißen wie ihre
  // Stufe, deshalb genügt der Vergleich.
  if (status === 'FINAL') return null
  return status as Freigabestufe
}

/**
 * Die Stufe, um die der **Kunde** gebeten wird — oder null.
 *
 * In einer Arbeitsphase wird nichts von ihm verlangt: Wir arbeiten gerade, er
 * sieht den Stand davor, und eine Freigabe, um die zweimal gebeten wird, sät
 * Zweifel daran, ob die erste angekommen ist.
 */
export function offeneKundenstufe(status: PostStatus): Freigabestufe | null {
  const stufe = offeneStufe(status)
  return stufe && !istInterneStufe(stufe) ? stufe : null
}

/** Beschriftung des Knopfs, z. B. „Konzept freigeben". */
export function freigabeBeschriftung(stufe: Freigabestufe): string {
  return `${STUFE_TEXT[stufe]} freigeben`
}

export type FreigabeStand = {
  /** Welche Stufe jetzt freizugeben ist; null, wenn nichts ansteht. */
  offen: Freigabestufe | null
  /** Ist die anstehende Stufe schon freigegeben? */
  erledigt: boolean
  /** Bereits erteilte Stufen, in der Reihenfolge des Durchlaufs. */
  erteilt: Freigabestufe[]
}

/**
 * Stand eines einzelnen Posts. `stufen` sind die bereits erteilten Freigaben.
 *
 * `nurKunde` schaltet auf die Kundensicht um: Dann zählen nur die externen
 * Stufen. Ohne den Schalter stünde auf der Kundenseite „Produktion freigeben"
 * — eine Aufgabe, die ihn nichts angeht und die er gar nicht erledigen kann.
 */
export function freigabeStand(
  status: PostStatus,
  stufen: Freigabestufe[],
  nurKunde = false,
): FreigabeStand {
  const offen = nurKunde ? offeneKundenstufe(status) : offeneStufe(status)
  const erteilt = STUFEN.filter(
    (s) => stufen.includes(s) && (!nurKunde || !istInterneStufe(s)),
  )

  return {
    offen,
    erledigt: offen !== null && stufen.includes(offen),
    erteilt,
  }
}

/**
 * Zählt für eine Liste von Posts, wie viele ihre anstehende Stufe schon
 * freigegeben haben. Posts ohne offene Stufe zählen als erledigt.
 */
export function freigabeFortschritt(
  posts: Array<{ status: PostStatus; freigaben: Array<{ stufe: Freigabestufe }> }>,
  nurKunde = false,
): { erledigt: number; gesamt: number; vollstaendig: boolean } {
  const gesamt = posts.length
  const erledigt = posts.filter((post) => {
    const stand = freigabeStand(
      post.status,
      post.freigaben.map((f) => f.stufe),
      nurKunde,
    )
    return stand.offen === null || stand.erledigt
  }).length

  return { erledigt, gesamt, vollstaendig: gesamt > 0 && erledigt === gesamt }
}
