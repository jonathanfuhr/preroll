import { describe, expect, it } from 'vitest'
import {
  berechneAuftrennung,
  erkenneSlideAnzahl,
  maximaleSlideAnzahl,
  mittigerAusschnitt,
  schnittfenster,
} from './karussell'

describe('erkenneSlideAnzahl', () => {
  it('erkennt ein Vielfaches des 4:5-Rasters', () => {
    expect(erkenneSlideAnzahl(1080, 1350)).toBe(1)
    expect(erkenneSlideAnzahl(2160, 1350)).toBe(2)
    expect(erkenneSlideAnzahl(5400, 1350)).toBe(5)
  })

  it('erkennt das Beispiel aus dem Upload-Dialog', () => {
    // 2560 × 1600 → 2 Slides à 1280 × 1600
    expect(erkenneSlideAnzahl(2560, 1600)).toBe(2)
  })

  it('gibt null zurück, wenn die Rechnung nicht aufgeht', () => {
    expect(erkenneSlideAnzahl(2000, 1350)).toBeNull()
    expect(erkenneSlideAnzahl(1920, 1080)).toBeNull()
  })

  it('verträgt Rundungsfehler aus Canva', () => {
    expect(erkenneSlideAnzahl(2159, 1350)).toBe(2)
  })
})

describe('berechneAuftrennung', () => {
  it('trennt gleichmäßig auf', () => {
    const e = berechneAuftrennung(3240, 1350)
    expect(e).toMatchObject({ ok: true, anzahl: 3, slideBreite: 1080, slideHoehe: 1350, exakt: true })
  })

  it('meldet einen Fehler statt manueller Schnittkanten', () => {
    const e = berechneAuftrennung(2000, 1350)
    expect(e.ok).toBe(false)
    if (!e.ok) expect(e.fehler).toContain('4:5-Raster')
  })

  it('lässt eine kleinere Anzahl zu, wenn sie glatt aufgeht', () => {
    // 4320 × 1350 wären exakt 4 Slides; 2 Slides à 2160 px sind breiter als 4:5 — erlaubt.
    const e = berechneAuftrennung(4320, 1350, 2)
    expect(e).toMatchObject({ ok: true, anzahl: 2, slideBreite: 2160, exakt: false })
  })

  it('lehnt Slides schmaler als 4:5 ab', () => {
    const e = berechneAuftrennung(2160, 1350, 3)
    expect(e.ok).toBe(false)
    if (!e.ok) expect(e.fehler).toContain('schmaler als 4:5')
  })

  it('lehnt eine Anzahl ab, die die Breite nicht glatt teilt', () => {
    const e = berechneAuftrennung(3241, 1350, 3)
    expect(e.ok).toBe(false)
  })

  it('lehnt unlesbare Maße ab', () => {
    expect(berechneAuftrennung(0, 0).ok).toBe(false)
  })
})

describe('maximaleSlideAnzahl', () => {
  it('entspricht der exakten Anzahl im 4:5-Raster', () => {
    expect(maximaleSlideAnzahl(4320, 1350)).toBe(4)
  })
})

describe('schnittfenster', () => {
  it('deckt die volle Breite lückenlos ab', () => {
    const fenster = schnittfenster(3240, 1350, 3)
    expect(fenster).toHaveLength(3)
    expect(fenster[0]).toEqual({ left: 0, top: 0, width: 1080, height: 1350 })
    expect(fenster[2].left + fenster[2].width).toBe(3240)
  })
})

describe('mittigerAusschnitt', () => {
  it('schneidet ein 9:16-Thumbnail mittig auf 4:5', () => {
    const a = mittigerAusschnitt(1080, 1920)
    expect(a.width).toBe(1080)
    expect(a.height).toBe(1350)
    // Gleich viel oben wie unten weg.
    expect(a.top).toBe(Math.round((1920 - 1350) / 2))
  })

  it('lässt ein bereits passendes 4:5-Bild unangetastet', () => {
    const a = mittigerAusschnitt(1080, 1350)
    expect(a).toEqual({ left: 0, top: 0, width: 1080, height: 1350 })
  })

  it('beschneidet ein zu breites Bild seitlich', () => {
    const a = mittigerAusschnitt(1920, 1080)
    expect(a.height).toBe(1080)
    expect(a.width).toBe(864)
    expect(a.left).toBe(528)
  })
})
