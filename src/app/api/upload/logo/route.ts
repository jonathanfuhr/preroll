import type { NextRequest } from 'next/server'
import { aktuellerNutzer } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { ERLAUBTE_TYPEN, istVideo, loescheMedium, speichereMedium } from '@/lib/medien'

const MAX_GROESSE = 8 * 1024 * 1024

/**
 * Profilbild eines Kunden oder eines Nutzerkontos. Getrennt vom
 * Medien-Upload, weil hier kein Post dranhängt und die Regeln andere sind:
 * kleine Bilder, kein Video, kein Formathinweis.
 */
export async function POST(anfrage: NextRequest) {
  const nutzer = await aktuellerNutzer()
  if (!nutzer) return Response.json({ fehler: 'Nicht angemeldet.' }, { status: 401 })

  const formular = await anfrage.formData()
  const datei = formular.get('datei')
  const kundeId = String(formular.get('kundeId') ?? '')
  const nutzerId = String(formular.get('nutzerId') ?? '')

  if (!(datei instanceof File)) {
    return Response.json({ fehler: 'Keine Datei empfangen.' }, { status: 400 })
  }
  if (!ERLAUBTE_TYPEN.includes(datei.type as (typeof ERLAUBTE_TYPEN)[number]) || istVideo(datei.type)) {
    return Response.json({ fehler: 'Bitte ein Bild hochladen (JPEG, PNG oder WebP).' }, { status: 415 })
  }
  if (datei.size > MAX_GROESSE) {
    return Response.json({ fehler: 'Das Bild ist größer als 8 MB.' }, { status: 413 })
  }
  // Ein Konto darf nur das eigene Bild wechseln, außer die Administration hilft.
  if (nutzerId && nutzerId !== nutzer.id && nutzer.rolle !== 'ADMIN') {
    return Response.json({ fehler: 'Dafür fehlen die Rechte.' }, { status: 403 })
  }

  const { medium } = await speichereMedium({
    inhalt: Buffer.from(await datei.arrayBuffer()),
    dateiname: datei.name,
    mimeTyp: datei.type,
    kundeId: kundeId || null,
    hochgeladenVonId: nutzer.id,
  })

  // Das bisherige Bild ersetzen, damit die Bibliothek nicht zuwächst.
  if (kundeId) {
    const vorher = await prisma.kunde.findUnique({
      where: { id: kundeId },
      include: { logo: true },
    })
    await prisma.kunde.update({ where: { id: kundeId }, data: { logoId: medium.id } })
    if (vorher?.logo) await loescheMedium(vorher.logo).catch(() => {})
  } else {
    const ziel = nutzerId || nutzer.id
    const vorher = await prisma.nutzer.findUnique({ where: { id: ziel }, include: { foto: true } })
    await prisma.nutzer.update({ where: { id: ziel }, data: { fotoId: medium.id } })
    if (vorher?.foto) await loescheMedium(vorher.foto).catch(() => {})
  }

  return Response.json({ ok: true, mediumId: medium.id })
}
