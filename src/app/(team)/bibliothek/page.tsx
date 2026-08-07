import Link from 'next/link'
import { prisma } from '@/lib/db'
import { verhaeltnisText } from '@/lib/format'
import { medienUrl, thumbUrl } from '@/lib/urls'
import { Karte, Leerzustand } from '@/components/ui'

export const metadata = { title: 'Bibliothek — Preroll' }
export const dynamic = 'force-dynamic'

const ZEIT = new Intl.DateTimeFormat('de-DE', { dateStyle: 'short' })

function lesbareGroesse(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export default async function BibliothekSeite({
  searchParams,
}: {
  searchParams: Promise<{ kunde?: string }>
}) {
  const { kunde: kundeSlug } = await searchParams

  const kunden = await prisma.kunde.findMany({
    where: { archiviert: false },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, slug: true },
  })
  const gewaehlt = kunden.find((k) => k.slug === kundeSlug)

  const medien = await prisma.medium.findMany({
    where: gewaehlt ? { kundeId: gewaehlt.id } : {},
    orderBy: { erstelltAm: 'desc' },
    take: 120,
    include: {
      kunde: true,
      postMedien: { include: { post: { include: { kunde: true } } } },
    },
  })

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-semibold tracking-[-0.02em]">Bibliothek</h1>
          <p className="mt-1 text-[13px] text-leise">
            Alle hochgeladenen Medien. Aufgetrennte Karussells behalten ihr Gesamtbild als Quelle.
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <Link
            href="/bibliothek"
            className={`rounded-[5px] border px-3 py-1.5 text-[12px] ${
              gewaehlt ? 'border-rahmen-3 text-leise hover:border-rahmen-4' : 'border-tinte bg-tinte text-white'
            }`}
          >
            Alle
          </Link>
          {kunden.map((k) => (
            <Link
              key={k.id}
              href={`/bibliothek?kunde=${k.slug}`}
              className={`rounded-[5px] border px-3 py-1.5 text-[12px] ${
                gewaehlt?.id === k.id
                  ? 'border-tinte bg-tinte text-white'
                  : 'border-rahmen-3 text-leise hover:border-rahmen-4'
              }`}
            >
              {k.name}
            </Link>
          ))}
        </div>
      </div>

      {medien.length === 0 ? (
        <Leerzustand
          titel="Noch keine Medien"
          text="Sobald im Post-Editor Grafiken hochgeladen werden, sammeln sie sich hier."
        />
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-4">
          {medien.map((medium) => {
            const vorschau = thumbUrl(medium.id) ?? medienUrl(medium.id)
            const verwendung = medium.postMedien[0]?.post

            return (
              <Karte key={medium.id} className="overflow-hidden">
                <div className="aspect-[3/4] bg-flaeche-tief">
                  {medium.mimeTyp.startsWith('video/') ? (
                    <div className="schraffur flex h-full w-full items-center justify-center font-mono text-[10px] text-leiser">
                      Video
                    </div>
                  ) : vorschau ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={vorschau} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="schraffur h-full w-full" />
                  )}
                </div>

                <div className="p-3">
                  <p className="truncate text-[12px] font-medium text-tinte" title={medium.dateiname}>
                    {medium.dateiname}
                  </p>
                  <p className="mt-1 font-mono text-[10.5px] text-still">
                    {medium.breite > 0
                      ? `${medium.breite} × ${medium.hoehe} · ${verhaeltnisText(medium.breite, medium.hoehe)}`
                      : medium.mimeTyp}
                  </p>
                  <p className="mt-0.5 text-[10.5px] text-stiller">
                    {lesbareGroesse(medium.groesse)} · {ZEIT.format(medium.erstelltAm)}
                    {medium.quelleId && ' · aufgetrennt'}
                  </p>
                  {verwendung && (
                    <Link
                      href={`/kunden/${verwendung.kunde.slug}/posts/${verwendung.id}`}
                      className="mt-1.5 block truncate text-[11px] text-akzent hover:text-akzent-dunkel"
                    >
                      {verwendung.titel}
                    </Link>
                  )}
                </div>
              </Karte>
            )
          })}
        </div>
      )}
    </div>
  )
}
