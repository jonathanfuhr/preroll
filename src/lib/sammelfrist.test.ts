import { describe, expect, it } from 'vitest'
import { faelligeGruppen, RUHE } from './sammelfrist'

const A = 'kunde-a'
const B = 'kunde-b'
const vor = (minuten: number) => new Date(Date.now() - minuten * 60_000)
const JETZT = new Date()

describe('Wann eine Sammlung fällig ist', () => {
  /*
    Der Kern: Gemessen wird am **letzten** Kommentar, nicht am ersten. Sonst
    bräche der Versand mitten in eine laufende Durchsicht.
  */
  it('wartet, solange noch Kommentare nachkommen', () => {
    const zeilen = [
      { kundeId: A, email: 'x@y.de', erstelltAm: vor(20) },
      { kundeId: A, email: 'x@y.de', erstelltAm: vor(1) },
    ]
    expect(faelligeGruppen(zeilen, JETZT)).toEqual([])
  })

  it('schickt, sobald es lange genug ruhig war', () => {
    const zeilen = [
      { kundeId: A, email: 'x@y.de', erstelltAm: vor(20) },
      { kundeId: A, email: 'x@y.de', erstelltAm: vor(6) },
    ]
    expect(faelligeGruppen(zeilen, JETZT)).toEqual([{ kundeId: A, email: 'x@y.de' }])
  })

  /* Je Kunde, nicht je Beitrag — und je Empfänger, versteht sich. */
  it('trennt nach Kunde und Adresse', () => {
    const zeilen = [
      { kundeId: A, email: 'x@y.de', erstelltAm: vor(6) },
      { kundeId: B, email: 'x@y.de', erstelltAm: vor(6) },
      { kundeId: A, email: 'z@y.de', erstelltAm: vor(1) },
    ]
    const faellig = faelligeGruppen(zeilen, JETZT)
    expect(faellig).toHaveLength(2)
    expect(faellig).toContainEqual({ kundeId: A, email: 'x@y.de' })
    expect(faellig).toContainEqual({ kundeId: B, email: 'x@y.de' })
    // z@y.de wartet noch — dort kam vor einer Minute etwas dazu.
    expect(faellig).not.toContainEqual({ kundeId: A, email: 'z@y.de' })
  })

  it('nimmt eine einzelne Anmerkung genauso mit', () => {
    const zeilen = [{ kundeId: A, email: 'x@y.de', erstelltAm: vor(6) }]
    expect(faelligeGruppen(zeilen, JETZT)).toHaveLength(1)
  })

  it('macht aus nichts nichts', () => {
    expect(faelligeGruppen([], JETZT)).toEqual([])
  })

  /* Genau an der Grenze zählt als fällig — sonst rutscht es einen Takt weiter. */
  it('zählt die Grenze selbst als erreicht', () => {
    // Beide Zeitpunkte aus **einem** Moment, sonst fehlen ein paar
    // Millisekunden und der Test misst seine eigene Laufzeit.
    const jetzt = new Date()
    const zeilen = [
      { kundeId: A, email: 'x@y.de', erstelltAm: new Date(jetzt.getTime() - RUHE) },
    ]
    expect(faelligeGruppen(zeilen, jetzt)).toHaveLength(1)
  })
})
