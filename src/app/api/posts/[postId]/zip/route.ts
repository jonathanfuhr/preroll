import type { NextRequest } from 'next/server'
import { POST_MEDIEN } from '@/lib/abfragen'
import { aktuellerGast, aktuellerNutzer } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { zipStempel } from '@/lib/format'
import { angezeigtePlattformen, GEBAUTE_PLATTFORMEN } from '@/lib/plattformen'
import { fuerKundensicht } from '@/lib/stand-anwenden'
import { nichtFinalZusatz, zipEintraege, type ZipMedium } from '@/lib/zip'
import { archivAntwort, schreibeArchiv } from '@/lib/zip-schreiben'

/**
 * Ein einzelner Post als ZIP — Slides, Reel, Thumbnail und die Caption als
 * Textdatei.
 *
 * Neben dem Zeitraum-Export, der einen ganzen Monat auf einmal ausgibt: Wer
 * nur einen Beitrag einplanen will, soll nicht alles herunterladen und darin
 * suchen müssen. Gerechnet wird mit **denselben** Einträgen wie dort
 * (`zipEintraege`) — nur ohne Ordner je Beitrag, denn bei einem Beitrag wäre
 * das eine Ebene ohne Aussage.
 *
 * Ungeplante Posts haben keinen Zeitstempel für die Dateinamen — dann tritt
 * der Titel an seine Stelle.
 */
export async function GET(
  anfrage: NextRequest,
  { params }: { params: Promise<{ postId: string }> },
) {
  // Das Team kommt immer heran; ein Gast nur, wenn der Post in einem Link
  // steht, zu dem er eingeladen ist.
  const [nutzer, gast] = await Promise.all([aktuellerNutzer(), aktuellerGast()])
  if (!nutzer && !gast) return new Response('Nicht angemeldet.', { status: 401 })

  const { postId } = await params
  const roh = await prisma.post.findUnique({
    where: { id: postId },
    include: {
      kunde: true,
      medien: POST_MEDIEN,
      szenen: { orderBy: { position: 'asc' } },
      staende: true,
      varianten: { orderBy: { position: 'asc' }, include: { medien: POST_MEDIEN } },
    },
  })
  if (!roh) return new Response('Post nicht gefunden.', { status: 404 })

  const alsGast = !nutzer && gast
  if (alsGast) {
    if (!roh.kunde.zipFuerKunden) {
      return new Response('Für diesen Kunden ist der Download nicht freigegeben.', { status: 403 })
    }
    // Ein Entwurf verlässt das Haus nie — er steht auf keiner Kundenseite,
    // also gibt es ihn hier auch nicht. Alles andere darf der Kunde holen;
    // was noch nicht final ist, trägt es im Namen.
    if (roh.status === 'ENTWURF') return new Response('Kein Zugriff.', { status: 403 })

    const erlaubt = await prisma.exportGast.findFirst({
      where: { gastId: gast.id, export: { kundeId: roh.kundeId } },
    })
    if (!erlaubt) return new Response('Kein Zugriff.', { status: 403 })
  }

  // Dieselbe Sicht wie auf seiner Seite: In einer Arbeitsphase bekommt der
  // Kunde den eingefrorenen Stand, nicht den halbfertigen.
  const post = alsGast ? fuerKundensicht(roh, roh.staende) : roh

  /*
    Pfad und Dateiname kommen aus der Medientabelle, nicht aus dem geladenen
    Beitrag: Ein eingefrorener Stand hält nur Kennungen. Ein zweiter Weg für
    den Livefall liefe beim nächsten Umbau auseinander.
  */
  const kennungen = [
    ...post.medien.map((m) => m.mediumId),
    ...post.varianten.flatMap((v) => v.medien.map((m) => m.mediumId)),
  ]
  const dateien = new Map(
    (
      await prisma.medium.findMany({
        where: { id: { in: kennungen } },
        select: { id: true, pfad: true, dateiname: true },
      })
    ).map((m) => [m.id, m]),
  )

  const alsZipMedien = (
    medien: Array<{ rolle: ZipMedium['rolle']; position: number; mediumId: string }>,
  ): ZipMedium[] =>
    medien.flatMap((m) => {
      const datei = dateien.get(m.mediumId)
      return datei
        ? [{ rolle: m.rolle, position: m.position, medium: { pfad: datei.pfad, dateiname: datei.dateiname } }]
        : []
    })

  const gewaehlt = GEBAUTE_PLATTFORMEN.filter((p) =>
    anfrage.nextUrl.searchParams.getAll('plattform').includes(p),
  )

  const eintraege = zipEintraege(
    [
      {
        ...post,
        plattformen: angezeigtePlattformen(post, roh.kunde),
        medien: alsZipMedien(post.medien),
        varianten: post.varianten.map((v) => ({ ...v, medien: alsZipMedien(v.medien) })),
      },
    ],
    {
      mitCaptions: true,
      ohnePostOrdner: true,
      plattformen: gewaehlt,
      // Kunden bekommen aus Klappe die Abspielfassung, das Team das Original.
      klappeFassung: alsGast ? 'proxy' : 'original',
      alsKundensicht: Boolean(alsGast),
    },
  )

  // Ohne Termin gibt es keinen Zeitstempel — dann trägt der Titel den Namen.
  // Der Ordner des Archivs **ist** hier der Ordner des Beitrags und trägt
  // deshalb auch dessen `_nichtFinal`.
  const stempel = post.postenAm
    ? zipStempel(post.postenAm)
    : post.titel.replace(/[^\w-]+/g, '_').slice(0, 40) || 'Beitrag'
  const wurzel = `${roh.kunde.slug}_${stempel}${nichtFinalZusatz(post.status)}`

  return archivAntwort(schreibeArchiv(eintraege, { wurzel }), `${wurzel}.zip`)
}
