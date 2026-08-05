import Link from 'next/link'
import { prisma } from '@/lib/db'
import { ladeKunde } from '@/lib/abfragen'
import { thumbUrl } from '@/lib/urls'
import { KundenReiter } from './reiter'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const kunde = await prisma.kunde.findUnique({ where: { slug } })
  return { title: `${kunde?.name ?? 'Kunde'} — Preroll` }
}

export default async function KundeLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const kunde = await ladeKunde(slug)

  const offeneKommentare = await prisma.kommentar.count({
    where: { status: 'OFFEN', post: { kundeId: kunde.id } },
  })
  const logo = thumbUrl(kunde.logoId)

  return (
    <>
      <nav className="mb-4 flex items-center gap-1.5 text-[12px] text-leiser">
        <Link href="/kunden" className="hover:text-tinte">
          Kunden
        </Link>
        <span aria-hidden>/</span>
        <span className="text-tinte-3">{kunde.name}</span>
      </nav>

      <div className="mb-6 flex items-center gap-4">
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt="" className="size-12 shrink-0 rounded-full object-cover" />
        ) : (
          <span className="schraffur flex size-12 shrink-0 items-center justify-center rounded-full border border-dashed border-rahmen-3 font-mono text-[8px] text-leiser">
            Logo
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em]">{kunde.name}</h1>
          {kunde.handle && <p className="text-[12.5px] text-leiser">@{kunde.handle}</p>}
        </div>
      </div>

      <KundenReiter slug={slug} offeneKommentare={offeneKommentare} />

      <div className="pt-6">{children}</div>
    </>
  )
}
