import Link from 'next/link'
import { prisma } from '@/lib/db'
import { Karte, Leerzustand, TypBadge } from '@/components/ui'
import { KommentarZeile } from './zeile'

export const metadata = { title: 'Kommentare — Preroll' }
export const dynamic = 'force-dynamic'

export default async function KommentareSeite({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const { status } = await searchParams
  const nurOffene = status !== 'alle'

  const kommentare = await prisma.kommentar.findMany({
    where: nurOffene ? { status: 'OFFEN' } : {},
    orderBy: { erstelltAm: 'desc' },
    take: 200,
    include: { post: { include: { kunde: true } }, nutzer: true, gast: true },
  })

  return (
    <div className="max-w-[880px]">
      <div className="mb-6 flex items-end justify-between gap-6">
        <div>
          <h1 className="text-[24px] font-semibold tracking-[-0.02em]">Kommentare</h1>
          <p className="mt-1 text-[13px] text-leise">
            Rückmeldungen aus allen Freigabe-Links, neueste zuerst.
          </p>
        </div>
        <div className="flex overflow-hidden rounded-[5px] border border-rahmen-3">
          {[
            { href: '/kommentare', text: 'Offen', aktiv: nurOffene },
            { href: '/kommentare?status=alle', text: 'Alle', aktiv: !nurOffene },
          ].map((reiter) => (
            <Link
              key={reiter.href}
              href={reiter.href}
              className={`px-3.5 py-1.5 text-[12px] ${
                reiter.aktiv ? 'bg-tinte font-medium text-white' : 'bg-flaeche text-leise hover:bg-flaeche-tief'
              }`}
            >
              {reiter.text}
            </Link>
          ))}
        </div>
      </div>

      {kommentare.length === 0 ? (
        <Leerzustand
          titel={nurOffene ? 'Keine offenen Kommentare' : 'Noch keine Kommentare'}
          text="Sobald ein Kunde etwas anmerkt, erscheint es hier — und Sie bekommen eine Benachrichtigung."
        />
      ) : (
        <div className="grid gap-3">
          {kommentare.map((kommentar) => (
            <Karte key={kommentar.id} className="p-4">
              <div className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="text-[13px] font-semibold text-tinte">{kommentar.autorName}</span>
                {kommentar.nutzerId && (
                  <span className="text-[10px] uppercase tracking-[0.08em] text-still">Agentur</span>
                )}
                {kommentar.post && (
                  <>
                    <TypBadge typ={kommentar.post.typ} />
                    <Link
                      href={`/kunden/${kommentar.post.kunde.slug}/posts/${kommentar.postId}`}
                      className="text-[12.5px] text-leise hover:text-akzent"
                    >
                      {kommentar.post.kunde.name} · {kommentar.post.titel}
                    </Link>
                  </>
                )}
                <span className="ml-auto text-[11px] text-stiller">
                  {new Intl.DateTimeFormat('de-DE', {
                    dateStyle: 'short',
                    timeStyle: 'short',
                  }).format(kommentar.erstelltAm)}
                </span>
              </div>

              <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-tinte-3">
                {kommentar.text}
              </p>

              <KommentarZeile
                kommentarId={kommentar.id}
                status={kommentar.status}
                postId={kommentar.postId}
                exportId={kommentar.exportId}
              />
            </Karte>
          ))}
        </div>
      )}
    </div>
  )
}
