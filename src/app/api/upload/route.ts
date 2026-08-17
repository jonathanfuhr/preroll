import type { MediumRolle, Verhaeltnis } from '@prisma/client'
import type { NextRequest } from 'next/server'
import { aktuellerNutzer } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { thumbnailAusVideoErgaenzen } from '@/lib/video'
import { brichVideoDownloadAb } from '@/lib/video-download'
import { platzAus, schreibeVideoPlatz } from '@/lib/video-platz'
import { pruefeFormat, transparenzHinweis } from '@/lib/format'
import { berechneAuftrennung } from '@/lib/karussell'
import { ERLAUBTE_TYPEN, speichereMedium, trenneGesamtbildAuf } from '@/lib/medien'
import { ladeSitzung, loescheSitzung } from '@/lib/upload-sitzung'

const MAX_GROESSE = 500 * 1024 * 1024

/** Eine fertig übertragene Datei — zusammengesetzt aus ihren Blöcken. */
type Eingang = { inhalt: Buffer; name: string; typ: string }

/**
 * Setzt die Blöcke zusammen und schließt die Sitzungen. Die Datei kommt hier
 * nie am Stück über die Leitung — siehe `upload-sitzung.ts`.
 */
async function sammleDateien(formular: FormData): Promise<Eingang[]> {
  const sitzungen = formular.getAll('sitzungen').map(String)
  const namen = formular.getAll('namen').map(String)
  const typen = formular.getAll('typen').map(String)

  const eingaenge: Eingang[] = []
  for (const [i, sitzung] of sitzungen.entries()) {
    eingaenge.push({
      inhalt: await ladeSitzung(sitzung),
      name: namen[i] ?? 'datei',
      typ: typen[i] ?? 'application/octet-stream',
    })
  }
  return eingaenge
}

/**
 * Schließt den Upload ab: Blöcke zusammensetzen, prüfen, ablegen.
 *
 * Modi:
 *  - `einzeln`  → jede Datei wird ein Medium (Beitrag, Slides, Thumbnail)
 *  - `gesamtbild` → ein breites Motiv wird in Slides aufgetrennt
 */
export async function POST(anfrage: NextRequest) {
  const nutzer = await aktuellerNutzer()
  if (!nutzer) return Response.json({ fehler: 'Nicht angemeldet.' }, { status: 401 })

  const formular = await anfrage.formData()
  const postId = String(formular.get('postId') ?? '')
  const rolle = (String(formular.get('rolle') ?? 'MEDIUM') as MediumRolle) || 'MEDIUM'
  const modus = String(formular.get('modus') ?? 'einzeln')
  /*
    Gilt der Upload einer abweichenden Fassung statt dem Beitrag selbst?

    Bewusst **dieselbe** Route und nicht eine zweite daneben: Hier hängen
    Formatprüfung, Transparenzwarnung, Karussell-Auftrennung und die
    Größengrenzen. Ein zweiter Weg wäre eine zweite Stelle, an der das alles
    auseinanderläuft — dieselbe Begründung wie beim einen Video-Platz.
  */
  const varianteId = String(formular.get('varianteId') ?? '') || null

  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: { kunde: true, medien: true },
  })
  if (!post) return Response.json({ fehler: 'Post nicht gefunden.' }, { status: 404 })

  // Die Fassung muss zu diesem Beitrag gehören — sonst ließe sich über eine
  // fremde Kennung an einem anderen Post herumladen.
  const variante = varianteId
    ? await prisma.postVariante.findFirst({ where: { id: varianteId, postId } })
    : null
  if (varianteId && !variante) {
    return Response.json({ fehler: 'Diese Fassung gibt es nicht mehr.' }, { status: 404 })
  }

  const sitzungen = formular.getAll('sitzungen').map(String)
  let dateien: Eingang[]
  try {
    dateien = await sammleDateien(formular)
  } catch {
    return Response.json({ fehler: 'Der Upload ist unvollständig angekommen.' }, { status: 400 })
  }

  if (dateien.length === 0) {
    return Response.json({ fehler: 'Keine Datei empfangen.' }, { status: 400 })
  }

  try {
    for (const datei of dateien) {
      if (!ERLAUBTE_TYPEN.includes(datei.typ as (typeof ERLAUBTE_TYPEN)[number])) {
        return Response.json(
          { fehler: `Dateityp ${datei.typ || 'unbekannt'} wird nicht unterstützt.` },
          { status: 415 },
        )
      }
      if (datei.inhalt.byteLength > MAX_GROESSE) {
        return Response.json(
          { fehler: `${datei.name} ist größer als ${MAX_GROESSE / 1024 / 1024} MB.` },
          { status: 413 },
        )
      }
    }
    return await verarbeite({ post, variante, nutzer, dateien, rolle, modus, formular, postId })
  } finally {
    // Die Blöcke haben ihren Zweck erfüllt — egal, wie es ausgegangen ist.
    for (const sitzung of sitzungen) await loescheSitzung(sitzung)
  }
}

async function verarbeite({
  post,
  variante,
  nutzer,
  dateien,
  rolle,
  modus,
  formular,
  postId,
}: {
  post: NonNullable<Awaited<ReturnType<typeof prisma.post.findUnique>>>
  /** Gesetzt, wenn der Upload einer abweichenden Fassung gilt. */
  variante: { id: string; verhaeltnis: Verhaeltnis | null } | null
  nutzer: { id: string }
  dateien: Eingang[]
  rolle: MediumRolle
  modus: string
  formular: FormData
  postId: string
}): Promise<Response> {
  /*
    Wohin geschrieben wird — Beitrag oder Fassung. An einer Stelle gebündelt,
    weil es fünf Schreibwege sind: Wer davon einen vergisst, legt still am
    falschen Ort ab, und auffallen würde das erst beim Kunden.

    Das Verhältnis kommt von der Fassung, sonst vom Beitrag: Danach richtet
    sich die Formatwarnung und die Auftrennung eines Gesamtbildes — eine
    Fassung in 1:1 soll nicht gegen die 4:5 des Beitrags gemessen werden.
  */
  const ziel = variante
    ? {
        verhaeltnis: variante.verhaeltnis ?? post.verhaeltnis,
        zaehle: (r: MediumRolle) =>
          prisma.postVarianteMedium.count({ where: { varianteId: variante.id, rolle: r } }),
        hoechste: (r: MediumRolle) =>
          prisma.postVarianteMedium.findFirst({
            where: { varianteId: variante.id, rolle: r },
            orderBy: { position: 'desc' },
          }),
        raeume: (r: MediumRolle) =>
          prisma.postVarianteMedium.deleteMany({ where: { varianteId: variante.id, rolle: r } }),
        lege: (mediumId: string, r: MediumRolle, position: number) =>
          prisma.postVarianteMedium.create({
            data: { varianteId: variante.id, mediumId, rolle: r, position },
          }),
        legeSlides: (ids: string[]) =>
          prisma.postVarianteMedium.createMany({
            data: ids.map((mediumId, position) => ({
              varianteId: variante.id,
              mediumId,
              rolle: 'SLIDE' as const,
              position,
            })),
          }),
      }
    : {
        verhaeltnis: post.verhaeltnis,
        zaehle: (r: MediumRolle) => prisma.postMedium.count({ where: { postId, rolle: r } }),
        hoechste: (r: MediumRolle) =>
          prisma.postMedium.findFirst({ where: { postId, rolle: r }, orderBy: { position: 'desc' } }),
        raeume: (r: MediumRolle) => prisma.postMedium.deleteMany({ where: { postId, rolle: r } }),
        lege: (mediumId: string, r: MediumRolle, position: number) =>
          prisma.postMedium.create({ data: { postId, mediumId, rolle: r, position } }),
        legeSlides: (ids: string[]) =>
          prisma.postMedium.createMany({
            data: ids.map((mediumId, position) => ({
              postId,
              mediumId,
              rolle: 'SLIDE' as const,
              position,
            })),
          }),
      }

  // ------------------------------------------------- Ein Gesamtbild auftrennen
  if (modus === 'gesamtbild') {
    const datei = dateien[0]

    const { medium: quelle, hatTransparenz } = await speichereMedium({
      inhalt: datei.inhalt,
      dateiname: datei.name,
      mimeTyp: datei.typ,
      kundeId: post.kundeId,
      hochgeladenVonId: nutzer.id,
    })

    const gewuenscht = formular.get('anzahl') ? Number(formular.get('anzahl')) : undefined
    const ergebnis = berechneAuftrennung(quelle.breite, quelle.hoehe, gewuenscht, ziel.verhaeltnis)

    if (!ergebnis.ok) {
      return Response.json(
        { fehler: ergebnis.fehler, quelleId: quelle.id, breite: quelle.breite, hoehe: quelle.hoehe },
        { status: 422 },
      )
    }

    const slides = await trenneGesamtbildAuf({
      quelle,
      anzahl: ergebnis.anzahl,
      kundeId: post.kundeId,
      hochgeladenVonId: nutzer.id,
    })

    // Vorhandene Slides ersetzen, damit die Reihenfolge eindeutig bleibt.
    await ziel.raeume('SLIDE')
    await ziel.legeSlides(slides.map((slide) => slide.id))

    const transparenz = transparenzHinweis(hatTransparenz, datei.name)

    return Response.json({
      ok: true,
      anzahl: ergebnis.anzahl,
      slideBreite: ergebnis.slideBreite,
      slideHoehe: ergebnis.slideHoehe,
      exakt: ergebnis.exakt,
      hinweise: transparenz ? [transparenz] : [],
    })
  }

  // -------------------------------------------------------- Einzelne Dateien
  const hinweise: string[] = []
  let position =
    (await ziel.zaehle(rolle)) === 0 ? 0 : ((await ziel.hoechste(rolle))?.position ?? -1) + 1

  // Beitrag, Reel und Thumbnail haben genau ein Medium — vorher aufräumen.
  if (rolle !== 'SLIDE') {
    await ziel.raeume(rolle)
    position = 0
  }

  for (const datei of dateien) {
    const { medium, breite, hoehe, hatTransparenz } = await speichereMedium({
      inhalt: datei.inhalt,
      dateiname: datei.name,
      mimeTyp: datei.typ,
      kundeId: post.kundeId,
      hochgeladenVonId: nutzer.id,
    })

    const hinweis = pruefeFormat(ziel.verhaeltnis, rolle, breite, hoehe)
    if (hinweis) hinweise.push(`${datei.name}: ${hinweis.text}`)

    const transparenz = transparenzHinweis(hatTransparenz, datei.name)
    if (transparenz) hinweise.push(transparenz)

    await ziel.lege(medium.id, rolle, position++)
  }

  /*
    Der Video-Platz — am Beitrag oder an der Fassung. Beide haben ihre drei
    Quellen, und in beiden Fällen räumt der Upload die anderen zwei weg.
  */
  if (rolle === 'MEDIUM' && post.typ === 'REEL') {
    const platz = platzAus(postId, variante?.id)

    // Der Upload übernimmt den Video-Platz — die anderen beiden Quellen
    // werden gelöst, nicht nur überdeckt: ein laufender Download würde das
    // frische Video sonst später überschreiben, ein stehen gebliebener Link
    // sähe aus, als gehöre er zu diesem Video.
    await brichVideoDownloadAb(platz)
    await schreibeVideoPlatz(platz, {
      videoDownloadUrl: null,
      videoDownloadStand: null,
      videoDownloadFortschritt: 0,
      videoDownloadMeldung: null,
      klappeVersionId: null,
      klappeVersionNummer: null,
    })

    // Ein Reel ohne Thumbnail zeigt im Profilraster nur Schraffur. Statt das
    // anzumahnen, wird eins aus dem Video gezogen — ein Standbild ist besser
    // als nichts und lässt sich jederzeit ersetzen.
    const erzeugt = await thumbnailAusVideoErgaenzen(platz)
    if (erzeugt) {
      hinweise.push('Kein Thumbnail hinterlegt — Preroll hat ein Standbild aus dem Video gezogen.')
    }
  }

  return Response.json({ ok: true, hinweise })
}
