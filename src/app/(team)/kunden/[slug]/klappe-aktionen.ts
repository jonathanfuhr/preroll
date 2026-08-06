'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { aktuellerNutzer } from '@/lib/auth'
import { prisma } from '@/lib/db'
import {
  klappeFassungen,
  klappeVideoAnlegen,
  klappeVideoBeschreibung,
  klappeVideoName,
  klappeVideoUmbenennen,
  klappeVideos,
  type KlappeVideo,
} from '@/lib/klappe'

async function nutzerOderRaus() {
  const nutzer = await aktuellerNutzer()
  if (!nutzer) redirect('/anmelden')
  return nutzer
}

// ------------------------------------------------------- Kunde ↔ Projekt

export async function klappeProjektZuordnen(kundeId: string, formular: FormData) {
  await nutzerOderRaus()

  const wert = String(formular.get('klappeProjekt') ?? '').trim()
  // Der Wert trägt Kennung und Namen, damit der Name ohne zweite Abfrage steht.
  const [id, ...rest] = wert.split('|')

  const kunde = await prisma.kunde.update({
    where: { id: kundeId },
    data: {
      klappeProjektId: id || null,
      klappeProjektName: rest.join('|') || null,
    },
  })

  revalidatePath(`/kunden/${kunde.slug}`, 'layout')
}

/**
 * Holt die Projektliste frisch bei Klappe. Preroll fragt sie ohnehin bei
 * jedem Aufruf der Stammdaten ab — der Knopf ist für den Fall, dass dort
 * gerade ein Projekt entstanden ist und man nicht erst die Seite suchen will.
 */
export async function klappeProjekteAktualisieren(kundeSlug: string) {
  await nutzerOderRaus()
  revalidatePath(`/kunden/${kundeSlug}/stammdaten`)
}

export async function aworkProjektZuordnen(kundeId: string, formular: FormData) {
  await nutzerOderRaus()

  const wert = String(formular.get('aworkProjekt') ?? '').trim()
  const [id, ...rest] = wert.split('|')

  const kunde = await prisma.kunde.update({
    where: { id: kundeId },
    data: {
      aworkProjektId: id || null,
      aworkProjektName: rest.join('|') || null,
    },
  })

  revalidatePath(`/kunden/${kunde.slug}`, 'layout')
}

// --------------------------------------------------------- Video am Post

/**
 * Legt in Klappe ein Video für diesen Post an. Läuft beim Anlegen eines Reels
 * automatisch mit; hier steht die Nachhol-Variante für Posts, die vor der
 * Kopplung entstanden sind oder bei denen es beim ersten Versuch scheiterte.
 */
export async function klappeVideoErzeugen(postId: string) {
  await nutzerOderRaus()

  const post = await prisma.post.findUniqueOrThrow({
    where: { id: postId },
    include: { kunde: true },
  })
  if (!post.kunde.klappeProjektId) {
    redirect(`/kunden/${post.kunde.slug}/posts/${postId}?klappe=kein-projekt`)
  }
  if (post.klappeVideoId) {
    redirect(`/kunden/${post.kunde.slug}/posts/${postId}`)
  }

  const name = klappeVideoName(post.postenAm, post.titel)
  const ergebnis = await klappeVideoAnlegen(
    post.kunde.klappeProjektId,
    name,
    klappeVideoBeschreibung(post.postenAm, post.kunde.name),
  )

  if (!ergebnis.ok) {
    redirect(
      `/kunden/${post.kunde.slug}/posts/${postId}?klappe=fehler&meldung=${encodeURIComponent(ergebnis.fehler)}`,
    )
  }

  await prisma.post.update({
    where: { id: postId },
    data: {
      klappeVideoId: ergebnis.daten.id,
      klappeVideoName: ergebnis.daten.name,
      klappeVideoUrl: ergebnis.daten.webUrl ?? `/videos/${ergebnis.daten.id}`,
      klappeStandAm: new Date(),
    },
  })

  revalidatePath(`/kunden/${post.kunde.slug}`, 'layout')
}

/** Verknüpft den Post mit einem bereits vorhandenen Video aus Klappe. */
export async function klappeVideoVerknuepfen(postId: string, formular: FormData) {
  await nutzerOderRaus()

  const videoId = String(formular.get('videoId') ?? '').trim()
  const post = await prisma.post.findUniqueOrThrow({
    where: { id: postId },
    include: { kunde: true },
  })

  if (!videoId) {
    await prisma.post.update({
      where: { id: postId },
      data: {
        klappeVideoId: null,
        klappeVideoName: null,
        klappeVideoUrl: null,
        klappeVersionId: null,
        klappeVersionNummer: null,
        klappeStandAm: null,
      },
    })
    revalidatePath(`/kunden/${post.kunde.slug}`, 'layout')
    return
  }

  const name = String(formular.get('videoName') ?? '').trim() || null
  await prisma.post.update({
    where: { id: postId },
    data: {
      klappeVideoId: videoId,
      klappeVideoName: name,
      klappeVideoUrl: `/videos/${videoId}`,
      klappeStandAm: new Date(),
    },
  })

  await holeFassung(postId, videoId)
  revalidatePath(`/kunden/${post.kunde.slug}`, 'layout')
}

/**
 * Holt die aktuell freigegebene Endfassung. Interne Fassungen bleiben außen
 * vor — was der Kunde sieht, soll auch in Klappe freigegeben sein.
 */
async function holeFassung(postId: string, videoId: string): Promise<string | null> {
  const fassungen = await klappeFassungen(videoId)
  if (!fassungen.ok) return fassungen.fehler

  const brauchbar = fassungen.daten.filter((f) => !f.internal && f.status === 'READY')
  const gewaehlt = brauchbar.find((f) => f.isFinal) ?? brauchbar[0]

  await prisma.post.update({
    where: { id: postId },
    data: {
      klappeVersionId: gewaehlt?.id ?? null,
      klappeVersionNummer: gewaehlt?.versionNumber ?? null,
      klappeStandAm: new Date(),
    },
  })

  return gewaehlt ? null : 'Für dieses Video liegt noch keine freigegebene Fassung vor.'
}

export async function klappeFassungAktualisieren(postId: string) {
  await nutzerOderRaus()

  const post = await prisma.post.findUniqueOrThrow({
    where: { id: postId },
    include: { kunde: true },
  })
  if (!post.klappeVideoId) return

  const fehler = await holeFassung(postId, post.klappeVideoId)
  revalidatePath(`/kunden/${post.kunde.slug}`, 'layout')

  if (fehler) {
    redirect(
      `/kunden/${post.kunde.slug}/posts/${postId}?klappe=hinweis&meldung=${encodeURIComponent(fehler)}`,
    )
  }
}

/** Benennt das Video in Klappe um, wenn sich Titel oder Termin geändert haben. */
export async function klappeVideoNachziehen(postId: string): Promise<void> {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: { kunde: true },
  })
  if (!post?.klappeVideoId) return

  const name = klappeVideoName(post.postenAm, post.titel)
  if (name === post.klappeVideoName) return

  const ergebnis = await klappeVideoUmbenennen(
    post.klappeVideoId,
    name,
    klappeVideoBeschreibung(post.postenAm, post.kunde.name),
  )
  if (!ergebnis.ok) {
    console.warn('[klappe] Umbenennen fehlgeschlagen:', ergebnis.fehler)
    return
  }

  await prisma.post.update({ where: { id: postId }, data: { klappeVideoName: name } })
}

/** Videos des Kundenprojekts — Grundlage der Auswahl im Editor. */
export async function ladeKlappeVideos(kundeId: string): Promise<{
  videos: KlappeVideo[]
  fehler: string | null
}> {
  const kunde = await prisma.kunde.findUnique({ where: { id: kundeId } })
  if (!kunde?.klappeProjektId) return { videos: [], fehler: null }

  const ergebnis = await klappeVideos(kunde.klappeProjektId)
  return ergebnis.ok
    ? { videos: ergebnis.daten, fehler: null }
    : { videos: [], fehler: ergebnis.fehler }
}
