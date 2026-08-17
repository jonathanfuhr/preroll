import type { MediumRolle, Plattform, Verhaeltnis } from '@prisma/client'
import { sortierePlattformen } from './plattformen'

/**
 * Abweichende Fassungen eines Beitrags je Plattform — und die Regel, was davon
 * geerbt wird.
 *
 * Dieselbe Sache liest sich auf LinkedIn anders als auf Instagram, und ein
 * 4:5-Bild sitzt dort falsch. Ein zweiter Beitrag wäre die naheliegende Lösung
 * gewesen und die falsche: Er hätte einen eigenen Termin, einen eigenen
 * Freigabestand und eine eigene Zeile im Kalender, obwohl es **eine** Sache
 * ist, die einmal freigegeben wird.
 *
 * **Leer heißt geerbt** — und zwar Feld für Feld. Wer nur die Caption ändert,
 * bekommt das Medium des Beitrags; wer nur ein anderes Bild braucht, dessen
 * Caption. Das ist der eigentliche Grund für die Trennung: Eine Variante, die
 * alles wiederholen müsste, veraltet beim nächsten Umbau des Hauptbeitrags,
 * ohne dass es jemandem auffällt.
 *
 * Diese Datei rechnet nur — kein `server-only`, keine Datenbank. Hier sitzt die
 * Stelle, an der eine falsche Zuordnung teuer wäre: Sie entscheidet, was auf
 * welcher Plattform wirklich rausgeht.
 */

export type VariantenMedium = {
  rolle: MediumRolle
  position: number
  mediumId: string
  medium: { mimeTyp: string }
}

export type Variante<M = VariantenMedium> = {
  id: string
  plattformen: Plattform[]
  caption: string | null
  verhaeltnis: Verhaeltnis | null
  medien: M[]
  /**
   * Die dritte Video-Quelle. Sie gehört zum selben Platz wie das MEDIUM: Eine
   * Fassung, deren Video aus Klappe kommt, hat gar kein eigenes Medium — ohne
   * dieses Feld sähe sie aus wie eine ohne eigenes Video und erbte das des
   * Beitrags.
   */
  klappeVersionId: string | null
  position: number
}

/**
 * Über das Medium ist die Erbregel **generisch**: Sie reicht Listen durch und
 * sieht nie hinein. Die Anzeige braucht den MIME-Typ, das ZIP Pfad und
 * Dateinamen — dieselbe Regel, zwei Sichten auf dasselbe Medium. Ohne den
 * Typparameter stünde die Regel ein zweites Mal im ZIP, und die zweite
 * Fassung liefe irgendwann auseinander.
 */
export type Hauptbeitrag<M = VariantenMedium> = {
  caption: string
  verhaeltnis: Verhaeltnis
  medien: M[]
  klappeVersionId: string | null
}

/** Was auf einer Plattform gilt, nachdem geerbt wurde. */
export type Fassung<M = VariantenMedium> = {
  /** Die Variante, aus der abgewichen wird — `null` beim Hauptformat. */
  varianteId: string | null
  plattformen: Plattform[]
  caption: string
  verhaeltnis: Verhaeltnis
  medien: M[]
  klappeVersionId: string | null
  /** Was tatsächlich abweicht — trägt die Beschriftung beim Kunden. */
  eigeneCaption: boolean
  eigeneMedien: boolean
}

/**
 * Welche Variante für eine Plattform gilt.
 *
 * Steht eine Plattform in mehreren Varianten, gewinnt die **erste** nach
 * Position. Das soll beim Speichern nicht vorkommen, ist aber kein Grund,
 * hier zu werfen: Eine Anzeige, die an einer widersprüchlichen Eingabe
 * abstürzt, ist schlechter als eine, die sich entscheidet.
 */
export function varianteFuer<M>(
  varianten: Variante<M>[],
  plattform: Plattform,
): Variante<M> | null {
  const passend = [...varianten]
    .sort((a, b) => a.position - b.position)
    .find((v) => v.plattformen.includes(plattform))
  return passend ?? null
}

/**
 * Was auf dieser Plattform gilt — Hauptbeitrag plus Abweichungen.
 *
 * Die Medien werden **als Ganzes** geerbt oder ersetzt, nicht Stück für Stück.
 * Ein Karussell, dessen zweiter Slide aus der Variante und dessen dritter aus
 * dem Beitrag kommt, wäre eine Zusammenstellung, die niemand so gemeint hat.
 */
export function fassungFuer<M>(
  post: Hauptbeitrag<M>,
  varianten: Variante<M>[],
  plattform: Plattform,
): Fassung<M> {
  const variante = varianteFuer(varianten, plattform)
  if (!variante) {
    return {
      varianteId: null,
      plattformen: [plattform],
      caption: post.caption,
      verhaeltnis: post.verhaeltnis,
      medien: post.medien,
      klappeVersionId: post.klappeVersionId,
      eigeneCaption: false,
      eigeneMedien: false,
    }
  }

  /*
    Der Video-Platz wird als Ganzes geerbt — mit allen drei Quellen. Eine
    Fassung, deren Video aus Klappe kommt, trägt kein eigenes Medium; nur die
    Medienliste zu prüfen hieße, ihr das Video des Beitrags unterzuschieben.
  */
  const eigeneMedien = variante.medien.length > 0 || variante.klappeVersionId !== null
  // Ein eigenes Verhältnis ohne eigene Medien wäre eine Fläche, für die das
  // geerbte Bild nicht gemacht ist — dann gilt das des Beitrags.
  const eigenesVerhaeltnis = eigeneMedien && variante.verhaeltnis !== null

  return {
    varianteId: variante.id,
    plattformen: sortierePlattformen(variante.plattformen),
    caption: variante.caption?.trim() ? variante.caption : post.caption,
    verhaeltnis: eigenesVerhaeltnis ? variante.verhaeltnis! : post.verhaeltnis,
    medien: eigeneMedien ? variante.medien : post.medien,
    klappeVersionId: eigeneMedien ? variante.klappeVersionId : post.klappeVersionId,
    eigeneCaption: Boolean(variante.caption?.trim()),
    eigeneMedien,
  }
}

/**
 * Die Fassungen eines Beitrags für die Kundenansicht: **zuerst das Hauptformat,
 * dann jede Variante einmal.**
 *
 * Gruppiert statt je Plattform aufgelistet: Gilt eine Variante für LinkedIn und
 * Facebook, steht sie einmal da und nennt beide. Zweimal derselbe Text unter
 * zwei Überschriften liest sich wie ein Unterschied, wo keiner ist.
 *
 * `ziele` sind die Plattformen, die wirklich bespielt werden
 * (`angezeigtePlattformen`) — eine Variante für eine Plattform ohne Kanal
 * erscheint nicht. Sonst versprächen wir dem Kunden eine Fassung, die nie
 * irgendwo auftaucht.
 */
export function fassungenFuerAnzeige(
  post: Hauptbeitrag,
  varianten: Variante[],
  ziele: readonly Plattform[],
): Fassung[] {
  const uebrig = sortierePlattformen(ziele)
  if (uebrig.length === 0) return []

  const gruppen: Fassung[] = []
  const hauptformat: Plattform[] = []

  for (const plattform of uebrig) {
    const variante = varianteFuer(varianten, plattform)
    if (!variante) {
      hauptformat.push(plattform)
      continue
    }
    const schon = gruppen.find((g) => g.varianteId === variante.id)
    if (schon) {
      schon.plattformen.push(plattform)
      continue
    }
    gruppen.push({ ...fassungFuer(post, varianten, plattform), plattformen: [plattform] })
  }

  /*
    Das Hauptformat steht immer vorn — auch dann, wenn keine Plattform es
    unverändert nimmt. Es ist der Beitrag, über den geredet wird; die Varianten
    sind Abweichungen davon, und eine Abweichung ohne Bezugspunkt wäre nicht
    verständlich.
  */
  const kopf: Fassung = {
    varianteId: null,
    plattformen: hauptformat,
    caption: post.caption,
    verhaeltnis: post.verhaeltnis,
    medien: post.medien,
    klappeVersionId: post.klappeVersionId,
    eigeneCaption: false,
    eigeneMedien: false,
  }

  return [kopf, ...gruppen]
}

/**
 * Für welche Plattformen eine Variante überhaupt in Frage kommt.
 *
 * Nicht wählbar ist, was schon in einer anderen Variante steht: Welche von
 * zwei Fassungen für dieselbe Plattform gälte, wäre nicht entscheidbar. Die
 * Prüfung gehört an den Server, die Sperre im Formular ist Bequemlichkeit.
 */
export function freiePlattformen(
  moeglich: readonly Plattform[],
  varianten: Variante[],
  ausser?: string,
): Plattform[] {
  const belegt = new Set(
    varianten.filter((v) => v.id !== ausser).flatMap((v) => v.plattformen),
  )
  return sortierePlattformen(moeglich).filter((p) => !belegt.has(p))
}
