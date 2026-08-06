import type { NextRequest } from 'next/server'
import { aktuellerNutzer } from '@/lib/auth'
import { haengeAn, neueSitzung, raeumeAuf } from '@/lib/upload-sitzung'

/**
 * Nimmt einen einzelnen Block entgegen. Der Rumpf ist die rohe Bytefolge —
 * kein FormData: Das spart die Base64-artige Aufblähung durch die
 * Multipart-Grenzen und hält jeden Block sicher unter dem, was der
 * Cloudflare-Tunnel durchlässt.
 */
export async function POST(anfrage: NextRequest) {
  if (!(await aktuellerNutzer())) {
    return Response.json({ fehler: 'Nicht angemeldet.' }, { status: 401 })
  }

  const suche = anfrage.nextUrl.searchParams
  const sitzung = suche.get('sitzung')

  // Ohne Kennung: neue Sitzung eröffnen.
  if (!sitzung) {
    void raeumeAuf()
    return Response.json({ sitzung: await neueSitzung() })
  }

  const versatz = Number(suche.get('versatz') ?? '')
  if (!Number.isInteger(versatz) || versatz < 0) {
    return Response.json({ fehler: 'Versatz fehlt.' }, { status: 400 })
  }

  try {
    const block = Buffer.from(await anfrage.arrayBuffer())
    const stand = await haengeAn(sitzung, versatz, block)
    return Response.json({ stand })
  } catch (fehler) {
    return Response.json(
      { fehler: fehler instanceof Error ? fehler.message : 'Block abgelehnt.' },
      { status: 400 },
    )
  }
}
