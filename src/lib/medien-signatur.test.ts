import { beforeAll, describe, expect, it } from 'vitest'
import { oeffentlicheKlappeUrl, oeffentlicheMedienUrl, pruefeUnterschrift } from './medien-signatur'

beforeAll(() => {
  process.env.SESSION_SECRET ??= 'test-geheimnis'
})

/** Die Bestandteile einer erzeugten Adresse wieder auseinandernehmen. */
function zerlege(url: string) {
  const adresse = new URL(url)
  return {
    bis: adresse.searchParams.get('bis'),
    format: adresse.searchParams.get('f'),
    sig: adresse.searchParams.get('sig'),
    pfad: adresse.pathname,
  }
}

describe('oeffentlicheMedienUrl', () => {
  it('erzeugt eine Adresse, die ihre eigene Prüfung besteht', () => {
    const jetzt = Date.UTC(2026, 7, 7, 10, 0, 0)
    const { bis, format, sig } = zerlege(oeffentlicheMedienUrl('med1', 'original', jetzt))

    expect(pruefeUnterschrift('medium', 'med1', bis, format, sig, jetzt)).toEqual({
      ok: true,
      format: 'original',
    })
  })

  it('trägt das gewünschte Format im Pfad und in der Unterschrift', () => {
    const jetzt = Date.UTC(2026, 7, 7, 10, 0, 0)
    const { bis, sig } = zerlege(oeffentlicheMedienUrl('med1', 'jpeg', jetzt))

    // Dieselbe Unterschrift mit anderem Format gilt nicht — sonst ließe sich
    // die Umwandlung von außen umschalten.
    expect(pruefeUnterschrift('medium', 'med1', bis, 'original', sig, jetzt)).toEqual({
      ok: false,
      grund: 'ungueltig',
    })
  })
})

describe('pruefeUnterschrift', () => {
  const jetzt = Date.UTC(2026, 7, 7, 10, 0, 0)

  it('lehnt eine abgelaufene Adresse ab', () => {
    const { bis, format, sig } = zerlege(oeffentlicheMedienUrl('med1', 'original', jetzt))
    const spaeter = jetzt + 3 * 3600_000

    expect(pruefeUnterschrift('medium', 'med1', bis, format, sig, spaeter)).toEqual({
      ok: false,
      grund: 'abgelaufen',
    })
  })

  it('lehnt eine Adresse für ein anderes Medium ab', () => {
    const { bis, format, sig } = zerlege(oeffentlicheMedienUrl('med1', 'original', jetzt))

    expect(pruefeUnterschrift('medium', 'med2', bis, format, sig, jetzt)).toEqual({
      ok: false,
      grund: 'ungueltig',
    })
  })

  it('lehnt eine verlängerte Frist ab', () => {
    const { format, sig } = zerlege(oeffentlicheMedienUrl('med1', 'original', jetzt))
    const verlaengert = String(jetzt + 99 * 3600_000)

    expect(pruefeUnterschrift('medium', 'med1', verlaengert, format, sig, jetzt)).toEqual({
      ok: false,
      grund: 'ungueltig',
    })
  })

  it('trennt Medien von Klappe-Fassungen', () => {
    // Beide Adressen tragen dieselbe Kennung. Ohne die Quelle in der
    // Unterschrift öffnete eine Medien-Adresse auch die Klappe-Durchreiche.
    const { bis, format, sig } = zerlege(oeffentlicheMedienUrl('gleich', 'original', jetzt))

    expect(pruefeUnterschrift('klappe', 'gleich', bis, format, sig, jetzt)).toEqual({
      ok: false,
      grund: 'ungueltig',
    })
  })

  it('nimmt eine Klappe-Adresse für die Klappe-Quelle an', () => {
    const { bis, format, sig } = zerlege(oeffentlicheKlappeUrl('fassung1', jetzt))

    expect(pruefeUnterschrift('klappe', 'fassung1', bis, format, sig, jetzt)).toEqual({
      ok: true,
      format: 'original',
    })
  })

  it('lehnt fehlende Angaben ab, statt sie durchzuwinken', () => {
    expect(pruefeUnterschrift('medium', 'med1', null, 'original', null, jetzt)).toEqual({
      ok: false,
      grund: 'ungueltig',
    })
    expect(pruefeUnterschrift('medium', 'med1', 'keine-zahl', 'original', 'x', jetzt)).toEqual({
      ok: false,
      grund: 'ungueltig',
    })
  })
})
