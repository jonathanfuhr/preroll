import 'server-only'
import type { PostStatus, PostTyp } from '@prisma/client'
import { notFound } from 'next/navigation'
import { prisma } from './db'

/** Medien eines Posts, nach Rolle und Position sortiert. */
export const POST_MEDIEN = {
  include: { medium: true },
  orderBy: [{ rolle: 'asc' as const }, { position: 'asc' as const }],
}

export async function ladeKunde(slug: string) {
  const kunde = await prisma.kunde.findUnique({
    where: { slug },
    include: {
      logo: true,
      hauptAnsprechpartner: true,
      betreuer: { include: { nutzer: true } },
      customFelder: { orderBy: { position: 'asc' } },
    },
  })
  if (!kunde) notFound()
  return kunde
}

export async function ladePosts(kundeId: string) {
  return prisma.post.findMany({
    where: { kundeId },
    orderBy: { postenAm: 'asc' },
    include: {
      medien: POST_MEDIEN,
      verantwortlich: true,
      _count: { select: { kommentare: true, szenen: true } },
    },
  })
}

export async function ladePost(postId: string) {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: {
      kunde: {
        include: {
          logo: true,
          customFelder: { orderBy: { position: 'asc' } },
          hauptAnsprechpartner: true,
      betreuer: { include: { nutzer: true } },
        },
      },
      medien: POST_MEDIEN,
      szenen: { orderBy: { position: 'asc' } },
      freigaben: { orderBy: { erstelltAm: 'asc' } },
      customWerte: { include: { definition: true } },
      verantwortlich: true,
      kommentare: {
        orderBy: { erstelltAm: 'asc' },
        include: { gast: true, nutzer: true },
      },
    },
  })
  if (!post) notFound()
  return post
}

export type PostMitMedien = Awaited<ReturnType<typeof ladePosts>>[number]

/** Erstes Medium einer Rolle — für Vorschaubilder. */
export function ersteMedien(
  post: { medien: Array<{ rolle: string; position: number; medium: { id: string } }> },
  rolle: string,
): string[] {
  return post.medien
    .filter((m) => m.rolle === rolle)
    .sort((a, b) => a.position - b.position)
    .map((m) => m.medium.id)
}

/**
 * Vorschaubild fürs Raster. Beim Reel zählt das 9:16-Thumbnail; liegt keines
 * vor, greift das Medium selbst.
 */
export function rasterMedium(post: {
  typ: PostTyp
  medien: Array<{ rolle: string; position: number; medium: { id: string; thumbPfad: string | null } }>
}): string | null {
  if (post.typ === 'REEL') {
    const thumb = post.medien.find((m) => m.rolle === 'THUMBNAIL')
    if (thumb) return thumb.medium.id
  }
  const slides = post.medien
    .filter((m) => m.rolle === (post.typ === 'KARUSSELL' ? 'SLIDE' : 'MEDIUM'))
    .sort((a, b) => a.position - b.position)
  return slides[0]?.medium.id ?? null
}

export const STATUS_REIHENFOLGE: PostStatus[] = ['KONZEPT', 'VORSCHAU', 'FINAL']
