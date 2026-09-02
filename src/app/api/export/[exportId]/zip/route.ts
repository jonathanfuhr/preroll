import type { NextRequest } from 'next/server'
import { POST_MEDIEN } from '@/lib/abfragen'
import { aktuellerGast, aktuellerNutzer } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { postsImZeitraum } from '@/lib/export-sicht'
import { gewaehlterMonat, monateAusPosts } from '@/lib/monate'
import { kommentarPdf } from '@/lib/pdf'
import { fuerKundensicht } from '@/lib/stand-anwenden'
import { zipEintraege, type ZipMedium } from '@/lib/zip'
import { archivAntwort, schreibeArchiv } from '@/lib/zip-schreiben'
import { angezeigtePlattformen, GEBAUTE_PLATTFORMEN } from '@/lib/plattformen'

/**
 * Alle Medien eines Zeitraums als ZIP — der Weg für alles, was Preroll nicht
 * selbst postet.
 *
 * Ein Ordner je Beitrag, darin die Dateien mit ihrem Zeitstempel. Nach
 * Kalenderwoche gegliedert lagen mehrere Beiträge nebeneinander, und wer sie in
 * einen Zeitplaner zog, musste sie am Namen auseinanderhalten.
 *
 * Zwei Zugänge: Das Team lädt den ganzen Stand, wahlweise über einen frei
 * gewählten Zeitraum. Der Kunde lädt seinen Monat — und zwar **alles, was er
 * auf der Seite sieht**, nicht nur das Finale: Wer die Konzeptrunde
 * durchgeht, will die Entwürfe auch weiterreichen können. Damit daraus
 * niemand versehentlich einen Zwischenstand einplant, tragen Ordner und
 * Dateien bis zur Freigabe ein `_nichtFinal` im Namen.
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
  // Dem Kunden werden die beiden Haken gar nicht erst angeboten: Captions
  // gehören dazu, der Kommentarverlauf ist eine Hausangelegenheit. Was nicht
  // wählbar ist, soll auch über die Adresse nicht wählbar sein.
  const mitCaptions = Boolean(alsGast) || suche.get('captions') !== '0'
  const mitKommentaren = suche.get('kommentare') === '1' && !alsGast

  const roh = await prisma.post.findMany({
    where: { kundeId: exp.kundeId },
    orderBy: { postenAm: 'asc' },
    include: {
      medien: POST_MEDIEN,
      // Für den eingefrorenen Stand — er trägt auch die Szenen, und ohne sie
      // passt der Beitrag nicht in `fuerKundensicht`.
      szenen: { orderBy: { position: 'asc' } },
      staende: true,
      // Die Fassungen kommen mit, weil das ZIP je Plattform die ihre nimmt —
      // dieselbe Regel, nach der die Kundenseite anzeigt.
      varianten: { orderBy: { position: 'asc' }, include: { medien: POST_MEDIEN } },
    },
  })

  /*
    Dieselbe Sicht wie auf der Seite: Solange die Phase sichtbar ist, gilt der
    aktuelle Inhalt; wird gerade gearbeitet, der eingefrorene Stand davor. Ein
    Archiv, das etwas anderes enthält als die Seite zeigt, wäre die schlimmste
    Art von Abweichung — sie fällt erst auf, wenn der Beitrag schon draußen
    ist. Das Team liest weiterhin live: Es exportiert seinen Arbeitsstand.
  */
  const alle = alsGast ? roh.map((p) => fuerKundensicht(p, p.staende)) : roh

  /*
    Der Zeitraum steht nicht mehr am Zugang — ein Zugang umfasst alle Monate.
    Das Team wählt ihn frei über `von`/`bis`; der Kunde bekommt einen Monat,
    entweder den aus `monat` oder den neuesten. Ihm einen freien Zeitraum zu
    erlauben hieße, ihm über die Adresse den ganzen Bestand zu geben.
  */
  const monate = monateAusPosts(alle)
  const monat = gewaehlterMonat(monate, suche.get('monat') ?? undefined, new Date())

  const zeitraumVon = (!alsGast && datumOder(suche.get('von'))) || monat.von
  const zeitraumBis = (!alsGast && datumOder(suche.get('bis'))) || monat.bis
  if (zeitraumVon > zeitraumBis) {
    return new Response('Der Zeitraum endet vor seinem Beginn.', { status: 400 })
  }

  // `postsImZeitraum` siebt Entwürfe aus — auch für den Kunden bleibt es
  // dabei, dass ein Entwurf das Haus nicht verlässt.
  const posts = postsImZeitraum(alle, { zeitraumVon, zeitraumBis })

  /*
    Pfad und Dateiname kommen aus **einer** Nachschlagetabelle, nicht aus dem
    geladenen Beitrag: Ein eingefrorener Stand hält nur Kennungen, seine
    Medien tragen keinen Pfad. Zwei Wege — live aus dem Beitrag, eingefroren
    aus der Tabelle — liefen beim nächsten Umbau auseinander.
  */
  const kennungen = new Set<string>()
  for (const post of posts) {
    for (const m of post.medien) kennungen.add(m.mediumId)
    for (const v of post.varianten) for (const m of v.medien) kennungen.add(m.mediumId)
  }
  const dateien = new Map(
    (
      await prisma.medium.findMany({
        where: { id: { in: [...kennungen] } },
        select: { id: true, pfad: true, dateiname: true },
      })
    ).map((m) => [m.id, m]),
  )

  const alsZipMedien = (
    medien: Array<{ rolle: ZipMedium['rolle']; position: number; mediumId: string }>,
  ): ZipMedium[] =>
    medien.flatMap((m) => {
      const datei = dateien.get(m.mediumId)
      // Eine gelöschte Datei bleibt hier still — `schreibeArchiv` nimmt
      // fehlende Einträge ohnehin in seine `Hinweise.txt` auf.
      return datei
        ? [{ rolle: m.rolle, position: m.position, medium: { pfad: datei.pfad, dateiname: datei.dateiname } }]
        : []
    })

  const zipPosts = posts.map((post) => ({
    ...post,
    // Nicht die rohe Wahl, sondern das, was wirklich rausgeht — dieselbe
    // Rechnung wie auf der Seite. Eine abgeschaltete Plattform hat auch im
    // Archiv keinen Ordner.
    plattformen: angezeigtePlattformen(post, exp.kunde),
    medien: alsZipMedien(post.medien),
    varianten: post.varianten.map((v) => ({ ...v, medien: alsZipMedien(v.medien) })),
  }))

  /*
    Für welche Plattformen. Ohne Angabe bleibt es beim Hauptformat und einem
    Ordner je Beitrag — so wie bisher, damit ein alter Link dasselbe liefert.
    Der Gast darf ebenfalls wählen: Er sieht die Fassungen ohnehin auf seiner
    Seite; ihm den Download danach zu verweigern wäre eine Hürde ohne Zweck.
  */
  const gewaehlt = GEBAUTE_PLATTFORMEN.filter((p) =>
    suche.getAll('plattform').includes(p),
  )

  const eintraege = zipEintraege(zipPosts, {
    mitCaptions,
    plattformen: gewaehlt,
    // Das Team bekommt aus Klappe das Original, der Kunde die Abspielfassung.
    klappeFassung: alsGast ? 'proxy' : 'original',
    alsKundensicht: Boolean(alsGast),
  })

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
