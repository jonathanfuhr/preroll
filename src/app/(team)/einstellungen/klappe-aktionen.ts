'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { aktuellerNutzer } from '@/lib/auth'
import { speichereEinstellungen } from '@/lib/einstellungen'
import { klappeKonto, kopplungAbholen, kopplungStarten } from '@/lib/klappe'

async function adminOderRaus() {
  const nutzer = await aktuellerNutzer()
  if (!nutzer) redirect('/anmelden')
  if (nutzer.rolle !== 'ADMIN') redirect('/kunden')
}

/**
 * Schritt 1 der Gerätekopplung: Preroll meldet sich als Gerät an und bekommt
 * einen Code, den ein Mensch in Klappe bestätigt.
 */
export async function kopplungAnstossen(formular: FormData) {
  await adminOderRaus()

  const basisUrl = String(formular.get('klappeBasisUrl') ?? '').trim().replace(/\/$/, '')
  if (!basisUrl) redirect('/einstellungen?klappe=url-fehlt')

  await speichereEinstellungen({ klappeBasisUrl: basisUrl })

  const ergebnis = await kopplungStarten(basisUrl, 'Preroll')
  if (!ergebnis.ok) {
    redirect(`/einstellungen?klappe=fehler&meldung=${encodeURIComponent(ergebnis.fehler)}`)
  }

  const { deviceCode, userCode, verificationUrlComplete } = ergebnis.daten
  redirect(
    `/einstellungen?klappe=bestaetigen&code=${encodeURIComponent(userCode)}` +
      `&geraet=${encodeURIComponent(deviceCode)}` +
      `&url=${encodeURIComponent(verificationUrlComplete)}`,
  )
}

/** Schritt 3: Token abholen, sobald in Klappe bestätigt wurde. */
export async function kopplungFertigstellen(formular: FormData) {
  await adminOderRaus()

  const basisUrl = String(formular.get('basisUrl') ?? '').trim()
  const deviceCode = String(formular.get('geraet') ?? '').trim()
  if (!basisUrl || !deviceCode) redirect('/einstellungen?klappe=fehler')

  const ergebnis = await kopplungAbholen(basisUrl, deviceCode)
  if (!ergebnis.ok) {
    // Häufigster Fall: in Klappe wurde noch nicht bestätigt.
    redirect(`/einstellungen?klappe=wartet&meldung=${encodeURIComponent(ergebnis.fehler)}`)
  }

  const konto = await klappeKonto(basisUrl, ergebnis.daten.token)

  await speichereEinstellungen({
    klappeApiKey: ergebnis.daten.token,
    klappeGekoppeltAm: new Date(),
    klappeKonto: konto.ok ? `${konto.daten.name} · ${konto.daten.email}` : null,
  })

  revalidatePath('/einstellungen')
  redirect('/einstellungen?klappe=fertig')
}

export async function kopplungLoesen() {
  await adminOderRaus()
  await speichereEinstellungen({
    klappeApiKey: null,
    klappeGekoppeltAm: null,
    klappeKonto: null,
  })
  revalidatePath('/einstellungen')
}
