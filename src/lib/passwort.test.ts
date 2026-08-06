import { describe, expect, it } from 'vitest'
import { pruefePasswortRegeln } from './passwort'

describe('pruefePasswortRegeln', () => {
  it('lässt ein taugliches Passwort durch', () => {
    expect(pruefePasswortRegeln('Sommer2026x')).toBeNull()
  })

  it('verlangt genug Zeichen', () => {
    expect(pruefePasswortRegeln('kurz1')).toContain('mindestens 10 Zeichen')
  })

  it('verlangt einen Buchstaben', () => {
    expect(pruefePasswortRegeln('1234567890')).toContain('Buchstaben')
  })

  it('verlangt eine Ziffer', () => {
    expect(pruefePasswortRegeln('nurbuchstaben')).toContain('Ziffer')
  })
})
