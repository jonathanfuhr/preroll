import { describe, expect, it } from 'vitest'
import { terminAusEingabe, terminFelder, formatiereTermin } from './datum'

/*
  Der Fehler, den diese Tests festhalten: Die Uhrzeit sprang beim Speichern um
  zwei Stunden. Ursache war, dass „Ortszeit" im Container (UTC) etwas anderes
  hieß als im Browser (Berlin). Ein Posting-Termin ist eine Uhrzeit an der Wand
  des Büros — die Zone gehört also ausdrücklich dazu, nicht an die Umgebung.

  Die Tests laufen unabhängig von der Zone der Maschine, auf der sie starten.
*/

describe('terminAusEingabe', () => {
  it('liest die Sommerzeit als UTC+2', () => {
    // 11.08.2026, 10:00 in Berlin ist 08:00 UTC.
    expect(terminAusEingabe('2026-08-11', '10:00').toISOString()).toBe('2026-08-11T08:00:00.000Z')
  })

  it('liest die Winterzeit als UTC+1', () => {
    expect(terminAusEingabe('2026-01-14', '10:00').toISOString()).toBe('2026-01-14T09:00:00.000Z')
  })

  /*
    Die Nacht der Umstellung ist der Grund für den zweiten Rechendurchgang:
    Wer nur einmal rechnet, nimmt den Versatz von vor der Umstellung und
    landet eine Stunde daneben.
  */
  it('trifft auch in der Nacht der Zeitumstellung', () => {
    // 25.10.2026: Um 03:00 MESZ wird auf 02:00 MEZ zurückgestellt.
    expect(terminAusEingabe('2026-10-25', '10:00').toISOString()).toBe('2026-10-25T09:00:00.000Z')
    // 29.03.2026: Um 02:00 MEZ wird auf 03:00 MESZ vorgestellt.
    expect(terminAusEingabe('2026-03-29', '10:00').toISOString()).toBe('2026-03-29T08:00:00.000Z')
  })

  it('nimmt eine fehlende Uhrzeit als Mitternacht', () => {
    expect(terminAusEingabe('2026-08-11', '').toISOString()).toBe('2026-08-10T22:00:00.000Z')
  })
})

describe('terminFelder', () => {
  /*
    Der eigentliche Beweis: Was in die Felder geschrieben wird, kommt beim
    Speichern unverändert zurück. Genau das ging vorher schief.
  */
  it('gibt zurück, was eingegeben wurde', () => {
    for (const [datum, uhrzeit] of [
      ['2026-08-11', '10:00'],
      ['2026-01-14', '07:30'],
      ['2026-12-31', '23:45'],
      ['2026-03-29', '10:00'],
      ['2026-10-25', '10:00'],
    ]) {
      expect(terminFelder(terminAusEingabe(datum, uhrzeit))).toEqual({ datum, uhrzeit })
    }
  })

  it('lässt einen leeren Termin leer', () => {
    expect(terminFelder(null)).toEqual({ datum: '', uhrzeit: '' })
  })

  it('zeigt Mitternacht als 00:00, nicht als 24:00', () => {
    expect(terminFelder(terminAusEingabe('2026-08-11', '00:00')).uhrzeit).toBe('00:00')
  })
})

describe('formatiereTermin', () => {
  it('zeigt die Uhrzeit der Agentur, nicht die der Maschine', () => {
    const termin = new Date('2026-08-11T08:00:00.000Z')
    expect(formatiereTermin(termin, { hour: '2-digit', minute: '2-digit' })).toBe('10:00')
  })
})
