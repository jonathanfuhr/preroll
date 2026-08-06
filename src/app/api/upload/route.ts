import type { MediumRolle } from '@prisma/client'
import type { NextRequest } from 'next/server'
import { aktuellerNutzer } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { pruefeFormat, transparenzHinweis } from '@/lib/format'
import { berechneAuftrennung } from '@/lib/karussell'
import { ERLAUBTE_TYPEN, speichereMedium, trenneGesamtbildAuf } from '@/lib/medien'

const MAX_GROESSE = 80 * 1024 * 1024

/**
 * Nimmt Medien entgegen. Der Upload läuft bewusst über einen Route Handler und
 * nicht über eine Server Action — Server Actions haben ein enges Größenlimit.
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

  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: { kunde: true, medien: true },
  })
  if (!post) return Response.json({ fehler: 'Post nicht gefunden.' }, { status: 404 })

  const dateien = formular.getAll('dateien').filter((d): d is File => d instanceof File)
  if (dateien.length === 0) {
    return Response.json({ fehler: 'Keine Datei empfangen.' }, { status: 400 })
  }

  for (const datei of dateien) {
    if (!ERLAUBTE_TYPEN.includes(datei.type as (typeof ERLAUBTE_TYPEN)[number])) {
      return Response.json(
        { fehler: `Dateityp ${datei.type || 'unbekannt'} wird nicht unterstützt.` },
        { status: 415 },
      )
    }
    if (datei.size > MAX_GROESSE) {
      return Response.json(
        { fehler: `${datei.name} ist größer als 80 MB.` },
        { status: 413 },
      )
    }
  }

  // ------------------------------------------------- Ein Gesamtbild auftrennen
  if (modus === 'gesamtbild') {
    const datei = dateien[0]
    const inhalt = Buffer.from(await datei.arrayBuffer())

    const { medium: quelle, hatTransparenz } = await speichereMedium({
      inhalt,
      dateiname: datei.name,
      mimeTyp: datei.type,
      kundeId: post.kundeId,
      hochgeladenVonId: nutzer.id,
    })

    const gewuenscht = formular.get('anzahl') ? Number(formular.get('anzahl')) : undefined
    const ergebnis = berechneAuftrennung(quelle.breite, quelle.hoehe, gewuenscht)

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
    await prisma.postMedium.deleteMany({ where: { postId, rolle: 'SLIDE' } })
    await prisma.postMedium.createMany({
      data: slides.map((slide, position) => ({
        postId,
        mediumId: slide.id,
        rolle: 'SLIDE' as const,
        position,
      })),
    })

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
    (await prisma.postMedium.count({ where: { postId, rolle } })) === 0
      ? 0
      : ((
          await prisma.postMedium.findFirst({
            where: { postId, rolle },
            orderBy: { position: 'desc' },
          })
        )?.position ?? -1) + 1

  // Beitrag, Reel und Thumbnail haben genau ein Medium — vorher aufräumen.
  if (rolle !== 'SLIDE') {
    await prisma.postMedium.deleteMany({ where: { postId, rolle } })
    position = 0
  }

  for (const datei of dateien) {
    const inhalt = Buffer.from(await datei.arrayBuffer())
    const { medium, breite, hoehe, hatTransparenz } = await speichereMedium({
      inhalt,
      dateiname: datei.name,
      mimeTyp: datei.type,
      kundeId: post.kundeId,
      hochgeladenVonId: nutzer.id,
    })

    const hinweis = pruefeFormat(post.typ, rolle, breite, hoehe)
    if (hinweis) hinweise.push(`${datei.name}: ${hinweis.text}`)

    const transparenz = transparenzHinweis(hatTransparenz, datei.name)
    if (transparenz) hinweise.push(transparenz)

    await prisma.postMedium.create({
      data: { postId, mediumId: medium.id, rolle, position: position++ },
    })
  }

  return Response.json({ ok: true, hinweise })
}
