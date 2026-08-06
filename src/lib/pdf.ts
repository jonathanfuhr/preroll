import 'server-only'
import PDFDocument from 'pdfkit'

type KommentarZeile = {
  autorName: string
  text: string
  status: string
  abschnitt: string
  erstelltAm: Date
  post: { titel: string } | null
}

const ZEIT = new Intl.DateTimeFormat('de-DE', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

/** Kommentarverlauf als PDF fürs ZIP-Archiv. */
export function kommentarPdf(kunde: string, kommentare: KommentarZeile[]): Promise<Buffer> {
  return new Promise((erfuellen, ablehnen) => {
    const dokument = new PDFDocument({ size: 'A4', margin: 56 })
    const teile: Buffer[] = []

    dokument.on('data', (stueck: Buffer) => teile.push(stueck))
    dokument.on('end', () => erfuellen(Buffer.concat(teile)))
    dokument.on('error', ablehnen)

    dokument.fontSize(18).fillColor('#1c1a18').text(`Kommentarverlauf — ${kunde}`)
    dokument
      .moveDown(0.3)
      .fontSize(9)
      .fillColor('#8b8783')
      .text(`${kommentare.length} Kommentare · Stand ${ZEIT.format(new Date())}`)
    dokument.moveDown(1.2)

    let letzterPost = ''
    for (const kommentar of kommentare) {
      const postTitel = kommentar.post?.titel ?? 'Allgemein'

      if (postTitel !== letzterPost) {
        dokument.moveDown(0.6)
        dokument.fontSize(12).fillColor('#1c1a18').text(postTitel)
        dokument.moveDown(0.2)
        letzterPost = postTitel
      }

      dokument
        .fontSize(9)
        .fillColor('#57534f')
        .text(
          `${kommentar.autorName} · ${ZEIT.format(kommentar.erstelltAm)} · ${
            kommentar.status === 'ERLEDIGT' ? 'erledigt' : 'offen'
          }`,
        )
      dokument.fontSize(10).fillColor('#3a3733').text(kommentar.text, { indent: 12 })
      dokument.moveDown(0.5)
    }

    if (kommentare.length === 0) {
      dokument.fontSize(10).fillColor('#8b8783').text('Keine Kommentare vorhanden.')
    }

    dokument.end()
  })
}
