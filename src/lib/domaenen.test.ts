import { describe, expect, it } from 'vitest'
import { domaeneVon, istEigeneDomaene, leseDomaenen, schreibeDomaenen } from './domaenen'

describe('leseDomaenen', () => {
  it('trennt an Komma, Semikolon, Leerzeichen und Zeilenumbruch', () => {
    expect(leseDomaenen('thdvideo.de, beispiel.de;dritte.de\nvierte.de')).toEqual([
      'thdvideo.de',
      'beispiel.de',
      'dritte.de',
      'vierte.de',
    ])
  })

  it('nimmt ein vorangestelltes @ und Großschreibung weg', () => {
    expect(leseDomaenen('@THDVideo.de')).toEqual(['thdvideo.de'])
  })

  it('siebt Einträge ohne Punkt aus — die sind keine Domäne', () => {
    expect(leseDomaenen('thdvideo.de, tippfehler')).toEqual(['thdvideo.de'])
  })

  it('lässt jede Domäne nur einmal übrig', () => {
    expect(leseDomaenen('thdvideo.de, THDVIDEO.de')).toEqual(['thdvideo.de'])
  })

  it('macht aus leer eine leere Liste', () => {
    expect(leseDomaenen(null)).toEqual([])
    expect(leseDomaenen('   ')).toEqual([])
  })

  it('schreibt für das Formular wieder lesbar zurück', () => {
    expect(schreibeDomaenen(['thdvideo.de', 'beispiel.de'])).toBe('thdvideo.de, beispiel.de')
  })
})

describe('istEigeneDomaene', () => {
  const erlaubt = ['thdvideo.de']

  it('erkennt die Domäne selbst', () => {
    expect(istEigeneDomaene('helena@thdvideo.de', erlaubt)).toBe(true)
    expect(istEigeneDomaene('Helena@THDVideo.de', erlaubt)).toBe(true)
  })

  it('erkennt Subdomänen', () => {
    expect(istEigeneDomaene('helena@mail.thdvideo.de', erlaubt)).toBe(true)
  })

  it('fällt nicht auf eine angehängte Domäne herein', () => {
    expect(istEigeneDomaene('angreifer@nicht-thdvideo.de', erlaubt)).toBe(false)
    expect(istEigeneDomaene('angreifer@thdvideo.de.example.com', erlaubt)).toBe(false)
  })

  it('sagt ohne eingetragene Domäne immer nein', () => {
    expect(istEigeneDomaene('helena@thdvideo.de', [])).toBe(false)
  })

  it('liest die Domäne auch aus krummen Eingaben', () => {
    expect(domaeneVon('  Helena@THDVideo.DE ')).toBe('thdvideo.de')
    expect(domaeneVon('ohne-at')).toBe('ohne-at')
  })
})
