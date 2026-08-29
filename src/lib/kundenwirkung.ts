import type { PostStatus } from '@prisma/client'
import { geltendePhase, istSichtbarePhase } from './phasen'
import { abgeleiteteStufe, STUFE_TEXT, type Stufe } from './status'

/**
 * Was ein Phasenwechsel **beim Kunden** bewirkt.
 *
 * Seit es Arbeitsphasen gibt, ist ein Phasenwechsel keine reine
 * Hausangelegenheit mehr: Er kann einen Beitrag von der Kundenseite nehmen,
 * ihn dorthin stellen, den gezeigten Stand einfrieren — oder den Kunden auf
 * einen **früheren** Stand zurückwerfen, den er längst hinter sich hatte.
 *
 * Vorher war das nicht zu sehen. Man klickte „Produktion" und erfuhr erst beim
 * Nachsehen im Freigabe-Link, dass der Kunde jetzt wieder das Konzept vor sich
 * hat. Deshalb sagt die Oberfläche es vorher — und **nur dann**, wenn wirklich
 * etwas passiert: Eine Rückfrage, die bei jedem Klick kommt, wird weggeklickt,
 * ohne gelesen zu werden.
 *
 * Gerechnet wird allein aus den beiden Phasen und dem Termin. Kein Vergleich
 * der Inhalte: Der bräuchte die eingefrorenen Stände von dreißig Beiträgen und
 * beantwortete am Ende doch nur, ob sich zufällig etwas geändert hat — die
 * Frage ist aber, **was der Wechsel tut**.
 */

export type Sichtbarkeitswirkung = 'erscheint' | 'verschwindet'

export type Inhaltswirkung =
  /** Was der Kunde sieht, wird festgeschrieben; spätere Änderungen erreichen ihn nicht mehr. */
  | 'friert-ein'
  /** Er sieht wieder den aktuellen Stand — auch alles, was inzwischen geändert wurde. */
  | 'wird-live'
  /** Er wird auf einen früheren Stand zurückgeworfen, den er schon hinter sich hatte. */
  | 'springt-zurueck'
  /** Er bekommt den Stand einer anderen Phase zu sehen. */
  | 'wechselt-stand'

export type Kundenwirkung = {
  sichtbarkeit: Sichtbarkeitswirkung | null
  inhalt: Inhaltswirkung | null
  /** Die Stufe in seiner Zeitleiste, vorher und nachher — null, wenn gleich. */
  stufe: { vorher: Stufe; nachher: Stufe } | null
}

/** Bewirkt der Wechsel beim Kunden überhaupt etwas? */
export function hatWirkung(w: Kundenwirkung): boolean {
  return w.sichtbarkeit !== null || w.inhalt !== null || w.stufe !== null
}

export function kundenwirkung(
  vorher: PostStatus,
  nachher: PostStatus,
  postenAm: Date | null,
  jetzt = new Date(),
): Kundenwirkung {
  const leer: Kundenwirkung = { sichtbarkeit: null, inhalt: null, stufe: null }
  if (vorher === nachher) return leer

  /*
    Der Entwurf verlässt das Haus nie. Kommt ein Beitrag von dort oder geht er
    dorthin, ist das die ganze Nachricht — über Stufen und Stände zu reden,
    während der Beitrag gar nicht dasteht, wäre nur Lärm.
  */
  if (vorher === 'ENTWURF') return { ...leer, sichtbarkeit: 'erscheint' }
  if (nachher === 'ENTWURF') return { ...leer, sichtbarkeit: 'verschwindet' }

  const stufeVorher = abgeleiteteStufe(vorher, postenAm, jetzt)
  const stufeNachher = abgeleiteteStufe(nachher, postenAm, jetzt)

  return {
    sichtbarkeit: null,
    inhalt: inhaltswirkung(vorher, nachher),
    stufe: stufeVorher === stufeNachher ? null : { vorher: stufeVorher, nachher: stufeNachher },
  }
}

function inhaltswirkung(vorher: PostStatus, nachher: PostStatus): Inhaltswirkung | null {
  const altSichtbar = istSichtbarePhase(vorher)
  const neuSichtbar = istSichtbarePhase(nachher)

  // Sichtbar → sichtbar: vorher live, nachher live. Am Inhalt ändert sich nichts.
  if (altSichtbar && neuSichtbar) return null

  if (altSichtbar && !neuSichtbar) {
    /*
      Gilt in der neuen Phase der Stand der Phase, die wir gerade verlassen,
      dann wird genau das eingefroren, was der Kunde ohnehin vor sich hat — er
      merkt im Moment nichts. Gilt eine frühere (Vorschau → Produktion), fällt
      er auf sie zurück.
    */
    return geltendePhase(nachher) === vorher ? 'friert-ein' : 'springt-zurueck'
  }

  if (!altSichtbar && neuSichtbar) return 'wird-live'

  // Arbeitsphase → Arbeitsphase: es zählt, welcher Stand nun gilt.
  const gAlt = geltendePhase(vorher)
  const gNeu = geltendePhase(nachher)
  // Ohne geltende Phase gibt es nichts zu zeigen — das ist nur der Entwurf,
  // und der ist oben schon abgehandelt.
  if (!gAlt || !gNeu || gAlt === gNeu) return null
  return REIHE.indexOf(gNeu) < REIHE.indexOf(gAlt) ? 'springt-zurueck' : 'wechselt-stand'
}

const REIHE = ['KONZEPT', 'VORSCHAU', 'FINAL'] as const

/**
 * Die Wirkung in ganzen Sätzen — für die Rückfrage vor dem Wechsel.
 *
 * Jeder Satz sagt, was **der Kunde** erlebt, nicht was das Werkzeug tut. „Der
 * Stand wird eingefroren" ist eine Auskunft über uns; „Der Kunde sieht ab
 * jetzt diesen Stand, spätere Änderungen erreichen ihn nicht mehr" ist eine
 * über ihn — und nur die hilft bei der Entscheidung.
 */
export function wirkungSaetze(w: Kundenwirkung): string[] {
  const saetze: string[] = []

  if (w.sichtbarkeit === 'verschwindet') {
    saetze.push('Der Beitrag verschwindet von der Kundenseite — aus der Zeitleiste, dem Kalender und dem Profilraster.')
    return saetze
  }
  if (w.sichtbarkeit === 'erscheint') {
    saetze.push('Der Beitrag erscheint auf der Kundenseite.')
  }

  switch (w.inhalt) {
    case 'friert-ein':
      saetze.push(
        'Der Kunde sieht ab jetzt den Stand von genau diesem Moment. Was Sie danach ändern, erreicht ihn nicht mehr — bis der Beitrag wieder in eine Phase kommt, die er sieht.',
      )
      break
    case 'wird-live':
      saetze.push(
        'Der Kunde sieht wieder den aktuellen Stand — auch alles, was seit dem Einfrieren geändert wurde.',
      )
      break
    case 'springt-zurueck':
      saetze.push(
        'Der Kunde wird auf einen früheren Stand zurückgeworfen: Er sieht wieder das, was er in einer vorangegangenen Phase vor sich hatte.',
      )
      break
    case 'wechselt-stand':
      saetze.push('Der Kunde bekommt den festgeschriebenen Stand einer anderen Phase zu sehen.')
      break
  }

  if (w.stufe) {
    saetze.push(
      `In seiner Zeitleiste rückt der Beitrag von „${STUFE_TEXT[w.stufe.vorher]}" auf „${STUFE_TEXT[w.stufe.nachher]}".`,
    )
  }

  return saetze
}
