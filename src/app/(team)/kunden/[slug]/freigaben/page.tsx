import Link from 'next/link'
import { ladeKunde } from '@/lib/abfragen'
import { prisma } from '@/lib/db'
import { freigabeStand, STUFE_TEXT } from '@/lib/freigabe'
import { Karte, Leerzustand, StatusBadge, TypBadge } from '@/components/ui'

const ZEIT = new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' })
const DATUM = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })

/** Was freigegeben ist und was noch aussteht — je Post, über alle Zeiträume. */
export default async function FreigabenSeite({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const kunde = await ladeKunde(slug)

  const posts = await prisma.post.findMany({
    where: { kundeId: kunde.id },
    orderBy: { postenAm: 'asc' },
    include: { freigaben: { orderBy: { erstelltAm: 'asc' } } },
  })

  const offen = posts.filter((p) => {
    const stand = freigabeStand(p.status, p.freigaben.map((f) => f.stufe))
    return stand.offen !== null && !stand.erledigt
  })

  return (
    <div className="max-w-[880px]">
      <div className="mb-6">
        <h1 className="text-[24px] font-semibold tracking-[-0.02em]">Freigaben</h1>
        <p className="mt-1 text-[13px] text-leiser">
          {offen.length === 0
            ? 'Nichts steht aus.'
            : `${offen.length} von ${posts.length} Beiträgen warten noch auf eine Freigabe.`}
        </p>
      </div>

      {posts.length === 0 ? (
        <Leerzustand
          titel="Noch keine Posts"
          text="Sobald Beiträge angelegt sind, steht hier ihr Freigabestand."
        />
      ) : (
        <Karte className="overflow-hidden">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-rahmen bg-flaeche-leise text-left">
                {['Datum', 'Typ', 'Titel', 'Status', 'Konzept', 'Vorschau'].map((kopf) => (
                  <th
                    key={kopf}
                    className="px-3 py-2.5 text-[10.5px] font-medium uppercase tracking-[0.1em] text-still"
                  >
                    {kopf}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {posts.map((post) => {
                const stand = freigabeStand(post.status, post.freigaben.map((f) => f.stufe))

                const zelle = (stufe: 'KONZEPT' | 'VORSCHAU') => {
                  const freigabe = post.freigaben.find((f) => f.stufe === stufe)
                  if (freigabe) {
                    return (
                      <span className="text-[11.5px] text-final" title={`von ${freigabe.autorName}`}>
                        ✓ {ZEIT.format(freigabe.erstelltAm)}
                      </span>
                    )
                  }
                  if (stand.offen === stufe) {
                    return <span className="text-[11.5px] font-medium text-vorschau">steht aus</span>
                  }
                  return <span className="text-[11.5px] text-stiller">—</span>
                }

                return (
                  <tr key={post.id} className="border-b border-rahmen last:border-b-0 hover:bg-flaeche-leise">
                    <td className="whitespace-nowrap px-3 py-2.5 text-tinte-3">
                      {post.postenAm ? (
                        DATUM.format(post.postenAm)
                      ) : (
                        <span className="text-stiller">ungeplant</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <TypBadge typ={post.typ} />
                    </td>
                    <td className="px-3 py-2.5">
                      <Link
                        href={`/kunden/${slug}/posts/${post.id}`}
                        className="font-medium text-tinte hover:text-akzent"
                      >
                        {post.titel}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusBadge status={post.status} />
                    </td>
                    <td className="px-3 py-2.5">{zelle('KONZEPT')}</td>
                    <td className="px-3 py-2.5">{zelle('VORSCHAU')}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Karte>
      )}

      <p className="mt-4 text-[11.5px] leading-relaxed text-stiller">
        {STUFE_TEXT.KONZEPT} wird vor dem Dreh freigegeben, {STUFE_TEXT.VORSCHAU} danach. Welche
        Stufe ansteht, ergibt sich aus dem Status des Beitrags.
      </p>
    </div>
  )
}
