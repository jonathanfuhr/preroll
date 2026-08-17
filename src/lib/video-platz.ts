import 'server-only'
import type { Ladestand, PostTyp } from '@prisma/client'
import { prisma } from './db'

/**
 * Der eine Video-Platz — am Beitrag oder an einer seiner Fassungen.
 *
 * Drei Quellen füllen ihn: Upload, Klappe und der Link-Download. Bis eine
 * Fassung eigene Medien haben konnte, gab es nur einen Platz und alles hing an
 * `postId`. Mit Fassungen sind es mehrere, und sie müssen auseinandergehalten
 * werden: Ein Download für die LinkedIn-Fassung darf nicht das Instagram-Video
 * überschreiben.
 *
 * Statt jede Funktion zu verdoppeln, bekommen sie eine **Adresse**. Dahinter
 * stehen zwei Tabellen mit denselben Spaltennamen — deshalb reicht hier ein
 * Umschalter statt zweier Wege durch dieselbe Fachlogik. Dieselbe Überlegung
 * wie beim `ziel` in der Upload-Route: Es sind zu viele Schreibstellen, um sie
 * einzeln richtig zu halten.
 */
export type VideoPlatz = { art: 'POST' | 'VARIANTE'; id: string }

export function platzAus(postId: string, varianteId?: string | null): VideoPlatz {
  return varianteId ? { art: 'VARIANTE', id: varianteId } : { art: 'POST', id: postId }
}

/** Eindeutig über beide Tabellen — Downloads laufen je Platz, nicht je Post. */
export function platzSchluessel(platz: VideoPlatz): string {
  return `${platz.art}:${platz.id}`
}

/** Die Spalten des Video-Platzes. In beiden Tabellen gleich benannt. */
export type VideoPlatzDaten = {
  videoDownloadUrl?: string | null
  videoDownloadStand?: Ladestand | null
  videoDownloadFortschritt?: number
  videoDownloadMeldung?: string | null
  klappeVideoId?: string | null
  klappeVideoName?: string | null
  klappeVideoUrl?: string | null
  klappeVersionId?: string | null
  klappeVersionNummer?: number | null
  klappeStandAm?: Date | null
}

export type VideoPlatzStand = VideoPlatzDaten & {
  /** Der Beitrag, zu dem der Platz gehört — auch bei einer Fassung. */
  postId: string
  kundeId: string
  kundeSlug: string
  postTyp: PostTyp
  postTitel: string
  postenAm: Date | null
  /** Nur bei einer Fassung gesetzt — für Beschriftungen und Klappe-Namen. */
  plattformen: string[]
}

/**
 * Was am Platz steht, samt dem Beitrag darum herum.
 *
 * Auch für eine Fassung kommt der Kunde vom Beitrag: Eine Fassung hängt an
 * ihrem Beitrag, und der an seinem Kunden — eine eigene Zuordnung wäre eine
 * zweite Wahrheit, die auseinanderlaufen kann.
 */
export async function leseVideoPlatz(platz: VideoPlatz): Promise<VideoPlatzStand | null> {
  if (platz.art === 'POST') {
    const post = await prisma.post.findUnique({
      where: { id: platz.id },
      include: { kunde: { select: { slug: true } } },
    })
    if (!post) return null
    return {
      postId: post.id,
      kundeId: post.kundeId,
      kundeSlug: post.kunde.slug,
      postTyp: post.typ,
      postTitel: post.titel,
      postenAm: post.postenAm,
      plattformen: [],
      videoDownloadUrl: post.videoDownloadUrl,
      videoDownloadStand: post.videoDownloadStand,
      videoDownloadFortschritt: post.videoDownloadFortschritt,
      videoDownloadMeldung: post.videoDownloadMeldung,
      klappeVideoId: post.klappeVideoId,
      klappeVideoName: post.klappeVideoName,
      klappeVideoUrl: post.klappeVideoUrl,
      klappeVersionId: post.klappeVersionId,
      klappeVersionNummer: post.klappeVersionNummer,
      klappeStandAm: post.klappeStandAm,
    }
  }

  const variante = await prisma.postVariante.findUnique({
    where: { id: platz.id },
    include: { post: { include: { kunde: { select: { slug: true } } } } },
  })
  if (!variante) return null
  return {
    postId: variante.postId,
    kundeId: variante.post.kundeId,
    kundeSlug: variante.post.kunde.slug,
    postTyp: variante.post.typ,
    postTitel: variante.post.titel,
    postenAm: variante.post.postenAm,
    plattformen: variante.plattformen,
    videoDownloadUrl: variante.videoDownloadUrl,
    videoDownloadStand: variante.videoDownloadStand,
    videoDownloadFortschritt: variante.videoDownloadFortschritt,
    videoDownloadMeldung: variante.videoDownloadMeldung,
    klappeVideoId: variante.klappeVideoId,
    klappeVideoName: variante.klappeVideoName,
    klappeVideoUrl: variante.klappeVideoUrl,
    klappeVersionId: variante.klappeVersionId,
    klappeVersionNummer: variante.klappeVersionNummer,
    klappeStandAm: variante.klappeStandAm,
  }
}

export async function schreibeVideoPlatz(
  platz: VideoPlatz,
  daten: VideoPlatzDaten,
): Promise<void> {
  if (platz.art === 'POST') {
    await prisma.post.update({ where: { id: platz.id }, data: daten })
    return
  }
  await prisma.postVariante.update({ where: { id: platz.id }, data: daten })
}

/** Wie `schreibeVideoPlatz`, aber ein verschwundener Platz ist kein Fehler. */
export async function versucheZuSchreiben(
  platz: VideoPlatz,
  daten: VideoPlatzDaten,
): Promise<void> {
  await schreibeVideoPlatz(platz, daten).catch(() => {})
}

/**
 * Das hochgeladene Video aushängen — die Datei bleibt in der Bibliothek.
 *
 * Jede der drei Quellen räumt beim Übernehmen die anderen weg. Sie nur zu
 * überdecken hieße, dass die Rangfolge in `reelVideoQuelle` entscheidet statt
 * der zuletzt getroffenen Wahl.
 */
export async function raeumeVideoMedium(platz: VideoPlatz): Promise<void> {
  if (platz.art === 'POST') {
    await prisma.postMedium.deleteMany({ where: { postId: platz.id, rolle: 'MEDIUM' } })
    return
  }
  await prisma.postVarianteMedium.deleteMany({
    where: { varianteId: platz.id, rolle: 'MEDIUM' },
  })
}

export async function legeVideoMedium(platz: VideoPlatz, mediumId: string): Promise<void> {
  if (platz.art === 'POST') {
    await prisma.postMedium.create({
      data: { postId: platz.id, mediumId, rolle: 'MEDIUM', position: 0 },
    })
    return
  }
  await prisma.postVarianteMedium.create({
    data: { varianteId: platz.id, mediumId, rolle: 'MEDIUM', position: 0 },
  })
}
