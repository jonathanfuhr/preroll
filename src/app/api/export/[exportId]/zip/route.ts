import type { NextRequest } from 'next/server'
import { POST_MEDIEN } from '@/lib/abfragen'
import { aktuellerGast, aktuellerNutzer } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { postsImZeitraum } from '@/lib/export-sicht'
import { kommentarPdf } from '@/lib/pdf'
import { zipEintraege } from '@/lib/zip'
import { archivAntwort, schreibeArchiv } from '@/lib/zip-schreiben'

/**
 * Alle Medien eines Zeitraums als ZIP — der Weg für alles, was Preroll nicht
 * selbst postet.
 *
 * Ein Ordner je Beitrag, darin die Dateien mit ihrem Zeitstempel. Nach
 * Kalenderwoche gegliedert lagen mehrere Beiträge nebeneinander, und wer sie in
 * einen Zeitplaner zog, musste sie am Namen auseinanderhalten.
 *
 * Zwei Zugänge: Das Team lädt den ganzen Stand, wahlweise über einen frei
 * gewählten Zeitraum. Der Kunde lädt nur die **finalen** Beiträge seines
 * Monats, und nur wenn es in den Stammdaten eingeschaltet ist.
 */
export async function GET(
  anfrage: NextRequest,
  { params }: { params: Promise<{ exportId: string }> },
) {
  const { exportId } = await params
  const [nutzer, gast] = await Promise.all([aktuellerNutzer(), aktuellerGast()])

  const exp = await prisma.export.findUnique({
    where: { id: exportId },
    include: { kunde: true },
  })
  if (!exp) return new Response('Freigabe nicht gefunden.', { status: 404 })

  // Ein Gast darf nur an diesen einen Link — geprüft an der Einladung, nicht am
  // Besitz der Kennung. Sonst käme jeder angemeldete Gast an jedes Archiv.
  const alsGast = !nutzer && gast
  if (alsGast) {
    if (!exp.kunde.zipFuerKunden) {
      return new Response('Für diesen Kunden ist der Download nicht freigegeben.', { status: 403 })
    }
    const eingeladen = await prisma.exportGast.findFirst({
      where: { exportId: exp.id, gastId: gast.id },
      select: { id: true },
    })
    if (!eingeladen) return new Response('Kein Zugriff auf diese Freigabe.', { status: 403 })
  } else if (!nutzer) {
    return new Response('Nicht angemeldet.', { status: 401 })
  }

  const suche = anfrage.nextUrl.searchParams
  const mitCaptions = suche.get('captions') !== '0'
  const mitKommentaren = suche.get('kommentare') === '1' && !alsGast

  // Das Team darf den Zeitraum frei wählen; für den Kunden gilt sein Monat.
  const zeitraumVon = (!alsGast && datumOder(suche.get('von'))) || exp.zeitraumVon
  const zeitraumBis = (!alsGast && datumOder(suche.get('bis'))) || exp.zeitraumBis
  if (zeitraumVon > zeitraumBis) {
    return new Response('Der Zeitraum endet vor seinem Beginn.', { status: 400 })
  }

  const alle = await prisma.post.findMany({
    where: {
      kundeId: exp.kundeId,
      // Der Kunde bekommt ausschließlich Finales. Beim Team zählt der Zeitraum
      // und nicht der Freigabestand — es exportiert auch, was der Kunde noch
      // nicht gesehen hat.
      ...(alsGast ? { status: 'FINAL' as const } : {}),
    },
    orderBy: { postenAm: 'asc' },
    include: { medien: POST_MEDIEN },
  })

  const posts = postsImZeitraum(alle, { zeitraumVon, zeitraumBis })

  const eintraege = zipEintraege(posts, { mitCaptions })

  if (mitKommentaren) {
    const kommentare = await prisma.kommentar.findMany({
      where: { exportId: exp.id },
      orderBy: { erstelltAm: 'asc' },
      include: { post: true },
    })
    if (kommentare.length > 0) {
      eintraege.push({
        pfad: 'Kommentarverlauf.pdf',
        art: 'puffer',
        inhalt: await kommentarPdf(exp.kunde.name, kommentare),
      })
    }
  }

  const wurzel = `${exp.kunde.slug}_${stempel(zeitraumVon)}${
    stempel(zeitraumVon) === stempel(zeitraumBis) ? '' : `_bis_${stempel(zeitraumBis)}`
  }`

  return archivAntwort(schreibeArchiv(eintraege, { wurzel }), `${wurzel}.zip`)
}

/** `2026-08-01` aus der Adresse; alles andere gilt als nicht angegeben. */
function datumOder(wert: string | null): Date | null {
  if (!wert || !/^\d{4}-\d{2}-\d{2}$/.test(wert)) return null
  const datum = new Date(`${wert}T00:00:00`)
  return Number.isNaN(datum.getTime()) ? null : datum
}

function stempel(datum: Date): string {
  return `${datum.getFullYear()}-${String(datum.getMonth() + 1).padStart(2, '0')}`
}
