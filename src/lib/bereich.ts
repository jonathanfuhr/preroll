/**
 * Bereichsanfragen (`Range`) auswerten.
 *
 * Steht als eigene, prüfbare Funktion neben der Medien-Route, weil hier ein
 * Fehler lange unbemerkt bleibt: Ein Browser, der ein falsches Stück bekommt,
 * meldet keinen Fehler — er zeigt einfach kein Video.
 *
 * Genau das war der Fall. `bytes=-100000` bedeutet nach RFC 7233 **die letzten**
 * 100 000 Bytes, nicht die ersten. Die alte Auswertung las die leere Zahl vor
 * dem Bindestrich als 0 und lieferte den Dateianfang. Ein Player, der bei einem
 * MP4 ohne `faststart` das `moov`-Kästchen am Ende sucht, bekam damit immer den
 * Anfang — und blieb beim Laden stehen, ohne dass irgendwo ein Fehler auftauchte.
 */

export type Bereich = { start: number; ende: number }

/**
 * Der angeforderte Ausschnitt, oder `null`, wenn die Kopfzeile nicht zu
 * gebrauchen ist. Ein `null` heißt „ganze Datei ausliefern" — bei einer
 * unverständlichen Kopfzeile ist das die freundlichere Antwort als ein 416.
 *
 * `'ungueltig'` dagegen heißt: verstanden, aber außerhalb der Datei. Darauf
 * gehört ein 416, sonst rät der Player weiter.
 */
export function leseBereich(kopfzeile: string | null, groesse: number): Bereich | null | 'ungueltig' {
  if (!kopfzeile || groesse <= 0) return null

  // Mehrere Bereiche in einer Anfrage kommen vor, sind aber selten; wir
  // beantworten dann die ganze Datei, statt einen davon herauszugreifen und
  // damit etwas anderes zu schicken als gefragt war.
  const treffer = /^bytes=(\d*)-(\d*)$/.exec(kopfzeile.trim())
  if (!treffer) return null

  const [, vonRoh, bisRoh] = treffer
  if (vonRoh === '' && bisRoh === '') return null

  // Suffix: `bytes=-500` sind die letzten 500 Bytes.
  if (vonRoh === '') {
    const laenge = Number(bisRoh)
    if (laenge <= 0) return 'ungueltig'
    return { start: Math.max(0, groesse - laenge), ende: groesse - 1 }
  }

  const start = Number(vonRoh)
  // Offenes Ende: `bytes=500-` geht bis zum Dateiende.
  const ende = bisRoh === '' ? groesse - 1 : Math.min(Number(bisRoh), groesse - 1)

  if (start >= groesse || start > ende) return 'ungueltig'
  return { start, ende }
}
