import { describe, expect, it } from 'vitest'
import {
  istGepflegt,
  kennzahlenText,
  LEERES_PROFIL,
  profilKarte,
  type ProfilZeile,
} from './plattform-profil'

function zeile(teil: Partial<ProfilZeile> & { plattform: ProfilZeile['plattform'] }): ProfilZeile {
  return { ...LEERES_PROFIL, ...teil }
}

describe('profilKarte', () => {
  it('führt jede Plattform, auch die ohne Zeile', () => {
    // Sonst müsste jede Anzeigestelle prüfen, ob es das Profil schon gibt.
    const karte = profilKarte([zeile({ plattform: 'INSTAGRAM', handle: 'beispiel.handwerk' })])

    expect(karte.INSTAGRAM.handle).toBe('beispiel.handwerk')
    expect(karte.LINKEDIN).toEqual(LEERES_PROFIL)
    expect(karte.FACEBOOK).toEqual(LEERES_PROFIL)
    expect(karte.YOUTUBE).toEqual(LEERES_PROFIL)
  })

  it('hält die Plattformen auseinander', () => {
    const karte = profilKarte([
      zeile({ plattform: 'INSTAGRAM', follower: 1240 }),
      zeile({ plattform: 'LINKEDIN', follower: 87 }),
    ])

    expect(karte.INSTAGRAM.follower).toBe(1240)
    expect(karte.LINKEDIN.follower).toBe(87)
  })
})

describe('istGepflegt', () => {
  it('gilt schon bei einem Handle allein — jemand hat ihn eingetragen', () => {
    expect(istGepflegt({ ...LEERES_PROFIL, handle: 'beispiel.handwerk' })).toBe(true)
  })

  it('gilt bei einer Null als Zahl', () => {
    // 0 Follower ist eine Angabe, kein fehlender Wert.
    expect(istGepflegt({ ...LEERES_PROFIL, follower: 0 })).toBe(true)
  })

  it('gilt nicht beim leeren Profil', () => {
    expect(istGepflegt(LEERES_PROFIL)).toBe(false)
  })
})

describe('kennzahlenText', () => {
  it('nennt die Zahlen in der Reihenfolge, in der sie am Profil stehen', () => {
    expect(
      kennzahlenText({ ...LEERES_PROFIL, follower: 1240, beitraege: 87, gefolgt: 310 }),
    ).toBe('1.240 Follower · 87 Beiträge · 310 gefolgt')
  })

  it('lässt aus, was fehlt', () => {
    expect(kennzahlenText({ ...LEERES_PROFIL, follower: 1240 })).toBe('1.240 Follower')
  })

  it('gibt ohne Zahlen null zurück statt einer leeren Zeile', () => {
    expect(kennzahlenText(LEERES_PROFIL)).toBeNull()
    expect(kennzahlenText({ ...LEERES_PROFIL, handle: 'nur-handle' })).toBeNull()
  })
})
