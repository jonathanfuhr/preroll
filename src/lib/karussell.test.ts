import { describe, expect, it } from 'vitest'
import {
  berechneAuftrennung,
  brauchtZuschnitt,
  erkenneSlideAnzahl,
  maximaleSlideAnzahl,
  mittigerAusschnitt,
  schnittfenster,
} from './karussell'

describe('erkenneSlideAnzahl', () => {
  it('erkennt ein Vielfaches des 3:4-Rasters', () => {
    expect(erkenneSlideAnzahl(1080, 1440)).toBe(1)
    expect(erkenneSlideAnzahl(2160, 1440)).toBe(2)
    expect(erkenneSlideAnzahl(5400, 1440)).toBe(5)
  })

  it('erkennt das Beispiel aus dem Upload-Dialog', () => {
    // 2400 × 1600 → 2 Slides à 1200 × 1600
    expect(erkenneSlideAnzahl(2400, 1600)).toBe(2)
  })

  it('gibt null zurück, wenn die Rechnung nicht aufgeht', () => {
    expect(erkenneSlideAnzahl(2000, 1440)).toBeNull()
    expect(erkenneSlideAnzahl(1920, 1080)).toBeNull()
  })

  it('verträgt Rundungsfehler aus Canva', () => {
    expect(erkenneSlideAnzahl(2159, 1440)).toBe(2)
  })
})

describe('berechneAuftrennung', () => {
  it('trennt gleichmäßig auf', () => {
    const e = berechneAuftrennung(3240, 1440)
    expect(e).toMatchObject({ ok: true, anzahl: 3, slideBreite: 1080, slideHoehe: 1440, exakt: true })
  })

  it('meldet einen Fehler statt manueller Schnittkanten', () => {
    const e = berechneAuftrennung(2000, 1440)
    expect(e.ok).toBe(false)
    if (!e.ok) expect(e.fehler).toContain('3:4-Raster')
  })

  it('lässt eine kleinere Anzahl zu, wenn sie glatt aufgeht', () => {
    // 4320 × 1440 wären exakt 4 Slides; 2 Slides à 2160 px sind breiter als 3:4 — erlaubt.
    const e = berechneAuftrennung(4320, 1440, 2)
    expect(e).toMatchObject({ ok: true, anzahl: 2, slideBreite: 2160, exakt: false })
  })

  it('lehnt Slides schmaler als 3:4 ab', () => {
    const e = berechneAuftrennung(2160, 1440, 3)
    expect(e.ok).toBe(false)
    if (!e.ok) expect(e.fehler).toContain('schmaler als 3:4')
  })

  it('lehnt eine Anzahl ab, die die Breite nicht glatt teilt', () => {
    const e = berechneAuftrennung(3241, 1440, 3)
    expect(e.ok).toBe(false)
  })

  it('lehnt unlesbare Maße ab', () => {
    expect(berechneAuftrennung(0, 0).ok).toBe(false)
  })
})

describe('maximaleSlideAnzahl', () => {
  it('entspricht der exakten Anzahl im 3:4-Raster', () => {
    expect(maximaleSlideAnzahl(4320, 1440)).toBe(4)
  })
})

describe('schnittfenster', () => {
  it('deckt die volle Breite lückenlos ab', () => {
    const fenster = schnittfenster(3240, 1440, 3)
    expect(fenster).toHaveLength(3)
    expect(fenster[0]).toEqual({ left: 0, top: 0, width: 1080, height: 1440 })
    expect(fenster[2].left + fenster[2].width).toBe(3240)
  })
})

describe('mittigerAusschnitt', () => {
  it('schneidet ein 9:16-Thumbnail mittig auf 3:4', () => {
    const a = mittigerAusschnitt(1080, 1920)
    expect(a.width).toBe(1080)
    expect(a.height).toBe(1440)
    // Gleich viel oben wie unten weg.
    expect(a.top).toBe(Math.round((1920 - 1440) / 2))
  })

  it('lässt ein bereits passendes 3:4-Bild unangetastet', () => {
    const a = mittigerAusschnitt(1080, 1440)
    expect(a).toEqual({ left: 0, top: 0, width: 1080, height: 1440 })
  })

  it('beschneidet ein zu breites Bild seitlich', () => {
    const a = mittigerAusschnitt(1920, 1080)
    expect(a.height).toBe(1080)
    expect(a.width).toBe(810)
    expect(a.left).toBe(555)
  })
})

describe('brauchtZuschnitt', () => {
  it('beschneidet ein 9:16-Reel-Thumbnail — sonst passt es nirgends hin', () => {
    expect(brauchtZuschnitt(1080, 1920)).toBe(true)
  })

  it('lässt einen 4:5-Beitrag in Ruhe — er ist breiter als das Raster', () => {
    // Beschneiden hieße hier, seitlich etwas wegzunehmen, was jemand
    // bewusst gestaltet hat. Das entscheidet die Anzeige, nicht die Datei.
    expect(brauchtZuschnitt(1080, 1350)).toBe(false)
  })

  it('lässt 3:4 unangetastet — das ist bereits das Zielformat', () => {
    expect(brauchtZuschnitt(1080, 1440)).toBe(false)
  })

  it('lässt Quadrate und Querformate in Ruhe — Logos und Profilbilder', () => {
    expect(brauchtZuschnitt(800, 800)).toBe(false)
    expect(brauchtZuschnitt(1920, 1080)).toBe(false)
  })

  it('schneidet nicht wegen eines krummen Exports um zwei Pixel', () => {
    expect(brauchtZuschnitt(1078, 1440)).toBe(false)
  })

  it('gibt bei fehlenden Maßen false zurück', () => {
    expect(brauchtZuschnitt(0, 0)).toBe(false)
  })
})
