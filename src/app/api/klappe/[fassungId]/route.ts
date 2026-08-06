import type { NextRequest } from 'next/server'
import { aktuellerGast, aktuellerNutzer } from '@/lib/auth'
import { klappeMedium } from '@/lib/klappe'

/**
 * Reicht eine Fassung aus Klappe durch. Der Klappe-Token bleibt dabei auf dem
 * Server — der Browser sieht nur diese Adresse. Kunden bekommen die
 * Abspielfassung, das Team auf Wunsch auch das Original.
 */
export async function GET(
  anfrage: NextRequest,
  { params }: { params: Promise<{ fassungId: string }> },
) {
  const nutzer = await aktuellerNutzer()
  const gast = nutzer ? null : await aktuellerGast()
  if (!nutzer && !gast) return new Response('Nicht angemeldet.', { status: 401 })

  const { fassungId } = await params
  const gewuenscht = anfrage.nextUrl.searchParams.get('art')

  // Das Original gibt es nur fürs Team.
  const art =
    gewuenscht === 'poster' ? 'poster' : gewuenscht === 'original' && nutzer ? 'original' : 'proxy'

  const antwort = await klappeMedium(fassungId, art, anfrage.headers.get('range'))
  if (!antwort) return new Response('Klappe ist nicht eingerichtet.', { status: 503 })
  if (!antwort.ok && antwort.status !== 206) {
    return new Response('Die Fassung ist in Klappe nicht abrufbar.', { status: antwort.status })
  }

  const kopfzeilen = new Headers()
  for (const feld of ['content-type', 'content-length', 'content-range', 'accept-ranges']) {
    const wert = antwort.headers.get(feld)
    if (wert) kopfzeilen.set(feld, wert)
  }
  kopfzeilen.set('cache-control', 'private, max-age=300')

  return new Response(antwort.body, { status: antwort.status, headers: kopfzeilen })
}
