/**
 * Eine Farbe je Kunde — für den Kalender über alle Kunden.
 *
 * Dort steht der Punkt **nicht** für den Post-Typ wie in den Kundenkalendern,
 * sondern für den Kunden: Wer über zwanzig Kunden schaut, sucht zuerst „wo
 * liegt diese Woche etwas von Café Morgenrot", nicht „welche davon sind
 * Reels". Der Typ steht weiterhin im Tooltip.
 *
 * Die Farbe ist **abgeleitet, nicht gespeichert**. Ein Zufallswert bei jedem
 * Laden wäre unbrauchbar — die Farbe muss stehen bleiben, sonst ist sie keine
 * Wiedererkennung. Ein Feld an `Kunde` wiederum müsste bei jedem neuen Kunden
 * belegt und im Bestand nachgetragen werden. Aus dem Slug gerechnet ist sie
 * dauerhaft, überall gleich (Server wie Browser) und für einen neuen Kunden
 * sofort da.
 *
 * **Preis:** Bei mehr Kunden als Farben teilen sich zwei dieselbe. Das ist
 * hinnehmbar, weil der Kundenname im Kalender daneben steht — die Farbe ist
 * eine Lesehilfe, nicht die Auskunft. Wer das ändern will, braucht ein Feld
 * am Kunden und eine Auswahl in den Stammdaten.
 */

/**
 * Zwölf Töne, die als 7-px-Punkt auf Weiß wirklich auseinanderzuhalten sind.
 *
 * Bewusst **zwölf und nicht mehr**: Ein erster Anlauf hatte sechzehn, darunter
 * drei Grüntöne — nebeneinander im Kalender war Smaragd von Tanne nicht zu
 * unterscheiden, und eine Farbe, die man verwechselt, ist schlechter als eine
 * geteilte. Lieber selten dieselbe Farbe zweimal als zwei, die gleich aussehen.
 *
 * Ohne den Akzentton des Werkzeugs (`#b00900`): Der gehört der Oberfläche und
 * soll nicht mit einem Kunden verwechselt werden.
 */
export const KUNDENFARBEN = [
  '#2563eb', // Blau
  '#0891b2', // Türkis
  '#15803d', // Grün
  '#65a30d', // Oliv
  '#ca8a04', // Senf
  '#ea580c', // Orange
  '#dc2626', // Rot
  '#db2777', // Pink
  '#a21caf', // Magenta
  '#7c3aed', // Violett
  '#78350f', // Braun
  '#475569', // Schiefer
] as const

/**
 * FNV-1a — klein, ohne Abhängigkeit und in jeder Laufzeit dasselbe Ergebnis.
 * Auf einen 32-Bit-Bereich gehalten, damit Server und Browser nicht ab einer
 * gewissen Länge auseinanderlaufen.
 */
function streuwert(text: string): number {
  let wert = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    wert ^= text.charCodeAt(i)
    wert = Math.imul(wert, 0x01000193) >>> 0
  }
  return wert
}

/** Die Farbe eines Kunden. Gleicher Slug, gleiche Farbe — immer. */
export function kundenFarbe(slug: string): string {
  return KUNDENFARBEN[streuwert(slug) % KUNDENFARBEN.length]
}
