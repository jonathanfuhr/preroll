import Link from 'next/link'
import { prisma } from '@/lib/db'
import { thumbUrl } from '@/lib/urls'
import { Karte, KnopfLink, Leerzustand, StatusBadge } from '@/components/ui'

export const metadata = { title: 'Kunden — Preroll' }

const DATUM = new Intl.DateTimeFormat('de-DE', {
  weekday: 'short',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

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

  return (
    <>
      <div className="mb-7 flex items-end justify-between gap-6">
        <div>
          <h1 className="text-[24px] font-semibold tracking-[-0.02em]">Kunden</h1>
          <p className="mt-1 text-[13px] text-leise">
            {kunden.length} {kunden.length === 1 ? 'Kunde' : 'Kunden'} in Betreuung
          </p>
        </div>
        <KnopfLink art="primaer" href="/kunden/neu">
          Kunde anlegen
        </KnopfLink>
      </div>

      {kunden.length === 0 ? (
        <Leerzustand
          titel="Noch kein Kunde angelegt"
          text="Lege den ersten Kunden an, um Posting-Termine zu planen und Freigabe-Links zu verschicken."
          aktion={
            <KnopfLink art="primaer" href="/kunden/neu">
              Kunde anlegen
            </KnopfLink>
          }
        />
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
          {kunden.map((kunde) => {
            const naechster = kunde.posts[0]
            const kommentare = kommentareJeKunde.get(kunde.id) ?? 0
            const logo = thumbUrl(kunde.logoId)

            return (
              <Link key={kunde.id} href={`/kunden/${kunde.slug}`} className="group">
                <Karte className="h-full p-5 transition-colors group-hover:border-rahmen-4">
                  <div className="flex items-center gap-3.5">
                    {logo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={logo} alt="" className="size-11 shrink-0 rounded-full object-cover" />
                    ) : (
                      <span className="schraffur flex size-11 shrink-0 items-center justify-center rounded-full border border-dashed border-rahmen-3 font-mono text-[8px] text-leiser">
                        Logo
                      </span>
                    )}
                    <div className="min-w-0">
                      <div className="truncate text-[14.5px] font-semibold text-tinte">
                        {kunde.name}
                      </div>
                      {kunde.handle && (
                        <div className="truncate text-[11.5px] text-leiser">@{kunde.handle}</div>
                      )}
                    </div>
                  </div>

                  <dl className="mt-5 grid gap-2.5 border-t border-rahmen pt-4 text-[12px]">
                    <div className="flex items-baseline justify-between gap-3">
                      <dt className="text-still">Nächster Termin</dt>
                      <dd className="text-right text-tinte-3">
                        {naechster ? (
                          <span className="flex items-center gap-2">
                            <StatusBadge status={naechster.status} klein />
                            {DATUM.format(naechster.postenAm)}
                          </span>
                        ) : (
                          '—'
                        )}
                      </dd>
                    </div>
                    <div className="flex items-baseline justify-between gap-3">
                      <dt className="text-still">Offene Posts</dt>
                      <dd className="text-tinte-3">{kunde._count.posts}</dd>
                    </div>
                    <div className="flex items-baseline justify-between gap-3">
                      <dt className="text-still">Offene Kommentare</dt>
                      <dd className={kommentare > 0 ? 'font-medium text-akzent' : 'text-tinte-3'}>
                        {kommentare}
                      </dd>
                    </div>
                  </dl>
                </Karte>
              </Link>
            )
          })}
        </div>
      )}
    </>
  )
}
