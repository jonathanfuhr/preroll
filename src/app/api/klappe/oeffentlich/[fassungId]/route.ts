import type { NextRequest } from 'next/server'
import { klappeMedium } from '@/lib/klappe'
import { pruefeUnterschrift } from '@/lib/medien-signatur'

/**
 * Dieselbe Durchreiche wie `/api/klappe/<fassungId>`, aber signiert und
 * befristet statt angemeldet.
 *
 * Gebraucht wird das, wenn ein Reel sein Video aus Klappe bezieht und Preroll
 * es veröffentlichen soll: Meta lädt die Datei selbst und bringt dafür keine
 * Anmeldung mit. Ausgeliefert wird die **Abspielfassung** — sie ist das, was
 * auch der Kunde zu sehen bekommt, und Instagram rechnet ohnehin neu.
 *
 * Der Klappe-Token bleibt dabei auf dem Server; nach außen geht nur diese
 * Adresse, und die läuft nach zwei Stunden ab.
 */
export async function GET(
  anfrage: NextRequest,
  { params }: { params: Promise<{ fassungId: string }> },
) {
  const { fassungId } = await params
  const suche = anfrage.nextUrl.searchParams

  const geprueft = pruefeUnterschrift(
    'klappe',
    fassungId,
    suche.get('bis'),
    suche.get('f'),
    suche.get('sig'),
  )
  if (!geprueft.ok) {
    return new Response(geprueft.grund === 'abgelaufen' ? 'Abgelaufen' : 'Ungültig', {
      status: 403,
    })
  }

  const antwort = await klappeMedium(fassungId, 'proxy', anfrage.headers.get('range'))
  if (!antwort) return new Response('Klappe ist nicht eingerichtet.', { status: 503 })
  if (!antwort.ok && antwort.status !== 206) {
    return new Response('Die Fassung ist in Klappe nicht abrufbar.', { status: antwort.status })
  }

  const kopfzeilen = new Headers()
  for (const feld of ['content-type', 'content-length', 'content-range', 'accept-ranges']) {
    const wert = antwort.headers.get(feld)
    if (wert) kopfzeilen.set(feld, wert)
  }
  kopfzeilen.set('cache-control', 'no-store')

  return new Response(antwort.body, { status: antwort.status, headers: kopfzeilen })
}
