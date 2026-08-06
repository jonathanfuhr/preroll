import { prisma } from '@/lib/db'
import { offeneStufe } from '@/lib/freigabe'
import { thumbUrl } from '@/lib/urls'
import { Kundenuebersicht, type Kundenkachel } from './uebersicht'

export const metadata = { title: 'Kunden — Preroll' }

export default async function KundenSeite() {
  const kunden = await prisma.kunde.findMany({
    where: { archiviert: false },
    orderBy: { name: 'asc' },
    include: {
      logo: true,
      posts: {
        where: { postenAm: { gte: new Date() } },
        orderBy: { postenAm: 'asc' },
        take: 1,
      },
      _count: {
        select: {
          posts: { where: { status: { not: 'FINAL' } } },
          exporte: true,
        },
      },
    },
  })

  // Für den Filter „Freigabe offen": Posts, deren anstehende Stufe noch keine
  // Zusage hat. Das lässt sich nicht als Zählung in der Abfrage ausdrücken —
  // welche Stufe ansteht, ergibt sich aus dem Status.
  const wartende = await prisma.post.findMany({
    where: { status: { not: 'FINAL' }, kunde: { archiviert: false, freigabenNoetig: true } },
    select: { kundeId: true, status: true, freigaben: { select: { stufe: true } } },
  })
  const freigabeJeKunde = new Map<string, number>()
  for (const post of wartende) {
    const stufe = offeneStufe(post.status)
    if (!stufe || post.freigaben.some((f) => f.stufe === stufe)) continue
    freigabeJeKunde.set(post.kundeId, (freigabeJeKunde.get(post.kundeId) ?? 0) + 1)
  }

  const offeneKommentare = await prisma.kommentar.groupBy({
    by: ['postId'],
    where: { status: 'OFFEN', postId: { not: null } },
    _count: true,
  })
  const postIds = offeneKommentare.map((k) => k.postId!).filter(Boolean)
  const postsZuKunde = await prisma.post.findMany({
    where: { id: { in: postIds } },
    select: { id: true, kundeId: true },
  })
  const kommentareJeKunde = new Map<string, number>()
  for (const eintrag of offeneKommentare) {
    const kundeId = postsZuKunde.find((p) => p.id === eintrag.postId)?.kundeId
    if (!kundeId) continue
    kommentareJeKunde.set(kundeId, (kommentareJeKunde.get(kundeId) ?? 0) + eintrag._count)
  }

  const kacheln: Kundenkachel[] = kunden.map((kunde) => ({
    id: kunde.id,
    slug: kunde.slug,
    name: kunde.name,
    handle: kunde.handle,
    logo: thumbUrl(kunde.logoId),
    naechsterTermin: kunde.posts[0]?.postenAm ?? null,
    naechsterStatus: kunde.posts[0]?.status ?? null,
    offenePosts: kunde._count.posts,
    offeneKommentare: kommentareJeKunde.get(kunde.id) ?? 0,
    freigabeOffen: freigabeJeKunde.get(kunde.id) ?? 0,
  }))

  return <Kundenuebersicht kunden={kacheln} />
}
