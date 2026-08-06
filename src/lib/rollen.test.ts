import { describe, expect, it } from 'vitest'
import {
  darfAnsprechpartnerSein,
  darfVerwalten,
  empfaenger,
  hoertBeiAllenKundenMit,
  type Kandidat,
} from './rollen'

const team: Kandidat[] = [
  { id: 'admin', rolle: 'ADMIN', aktiv: true },
  { id: 'pm', rolle: 'PROJEKTMANAGER', aktiv: true },
  { id: 'designer-a', rolle: 'DESIGNER', aktiv: true },
  { id: 'designer-b', rolle: 'DESIGNER', aktiv: true },
  { id: 'schnitt', rolle: 'EDITOR', aktiv: true },
]

describe('Rechte', () => {
  it('lässt nur die Administration verwalten', () => {
    expect(darfVerwalten('ADMIN')).toBe(true)
    expect(darfVerwalten('PROJEKTMANAGER')).toBe(false)
    expect(darfVerwalten('DESIGNER')).toBe(false)
    expect(darfVerwalten('EDITOR')).toBe(false)
  })

  it('schließt den Schnitt als Ansprechpartner aus', () => {
    expect(darfAnsprechpartnerSein('EDITOR')).toBe(false)
    expect(darfAnsprechpartnerSein('DESIGNER')).toBe(true)
    expect(darfAnsprechpartnerSein('PROJEKTMANAGER')).toBe(true)
    expect(darfAnsprechpartnerSein('ADMIN')).toBe(true)
  })

  it('lässt Projektmanagement und Administration bei allen Kunden mithören', () => {
    expect(hoertBeiAllenKundenMit('PROJEKTMANAGER')).toBe(true)
    expect(hoertBeiAllenKundenMit('ADMIN')).toBe(true)
    expect(hoertBeiAllenKundenMit('DESIGNER')).toBe(false)
    expect(hoertBeiAllenKundenMit('EDITOR')).toBe(false)
  })
})

describe('empfaenger', () => {
  it('nimmt Projektmanagement und Administration immer mit', () => {
    const ids = empfaenger(team, { hauptAnsprechpartnerId: null, betreuerIds: [] })
    expect(ids).toContain('pm')
    expect(ids).toContain('admin')
  })

  it('lässt den Schnitt außen vor', () => {
    const ids = empfaenger(team, { hauptAnsprechpartnerId: null, betreuerIds: [] })
    expect(ids).not.toContain('schnitt')
  })

  it('benachrichtigt nur die betreuenden Designer', () => {
    const ids = empfaenger(team, {
      hauptAnsprechpartnerId: null,
      betreuerIds: ['designer-a'],
    })
    expect(ids).toContain('designer-a')
    expect(ids).not.toContain('designer-b')
  })

  it('nimmt den Hauptansprechpartner auch dann mit, wenn er sonst nichts bekäme', () => {
    // Schnitt bekommt normalerweise nichts — als Hauptansprechpartner käme er
    // zwar nicht infrage, aber die Regel soll dennoch greifen, falls die Rolle
    // nachträglich geändert wurde.
    const ids = empfaenger(team, { hauptAnsprechpartnerId: 'schnitt', betreuerIds: [] })
    expect(ids).toContain('schnitt')
  })

  it('ergänzt den Zusatz-Ansprechpartner, ohne den Hauptansprechpartner zu ersetzen', () => {
    const ids = empfaenger(team, {
      hauptAnsprechpartnerId: 'designer-a',
      zusatzAnsprechpartnerId: 'designer-b',
      betreuerIds: [],
    })
    expect(ids).toContain('designer-a')
    expect(ids).toContain('designer-b')
  })

  it('überspringt abgeschaltete Konten', () => {
    const ids = empfaenger(
      [
        { id: 'pm', rolle: 'PROJEKTMANAGER', aktiv: false },
        { id: 'admin', rolle: 'ADMIN', aktiv: true },
      ],
      { hauptAnsprechpartnerId: 'pm', betreuerIds: ['pm'] },
    )
    expect(ids).toEqual(['admin'])
  })

  it('nennt niemanden doppelt', () => {
    const ids = empfaenger(team, {
      hauptAnsprechpartnerId: 'pm',
      zusatzAnsprechpartnerId: 'pm',
      betreuerIds: ['designer-a'],
    })
    expect(ids.filter((id) => id === 'pm')).toHaveLength(1)
  })
})
