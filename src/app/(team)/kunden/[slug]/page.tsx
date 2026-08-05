import Link from 'next/link'
import { ersteMedien, ladeKunde, ladePosts, rasterMedium } from '@/lib/abfragen'
import { kalenderwoche } from '@/lib/format'
import { thumbUrl } from '@/lib/urls'
import { Karte, Leerzustand, StatusBadge, TypBadge } from '@/components/ui'
import { PostAnlegen } from './post-anlegen'

const DATUM = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
const UHRZEIT = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' })

export default async function PostListeSeite({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const kunde = await ladeKunde(slug)
  const posts = await ladePosts(kunde.id)

  return (
    <>
      <div className="mb-5 flex items-end justify-between gap-6">
        <div>
          <h2 className="text-[15px] font-semibold">Posts</h2>
          <p className="mt-0.5 text-[12.5px] text-leiser">
            {posts.length} {posts.length === 1 ? 'Beitrag' : 'Beiträge'} geplant
          </p>
        </div>
        <PostAnlegen kundeId={kunde.id} />
      </div>

      {posts.length === 0 ? (
        <Leerzustand
          titel="Noch keine Posts"
          text="Lege den ersten Beitrag an — Reel, Karussell oder Einzelbeitrag."
        />
      ) : (
        <Karte className="overflow-hidden">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-rahmen bg-flaeche-leise text-left">
                {['', 'KW', 'Datum', 'Typ', 'Titel', 'Status', 'Verantwortlich', 'Kommentare'].map(
                  (kopf, i) => (
                    <th
                      key={i}
                      className="px-3 py-2.5 text-[10.5px] font-medium uppercase tracking-[0.1em] text-still"
                    >
                      {kopf}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {posts.map((post) => {
                const bild = thumbUrl(rasterMedium(post))
                const slides = ersteMedien(post, 'SLIDE')

                return (
                  <tr
                    key={post.id}
                    className="border-b border-rahmen last:border-b-0 hover:bg-flaeche-leise"
                  >
                    <td className="w-14 px-3 py-2">
                      <Link href={`/kunden/${slug}/posts/${post.id}`} className="block">
                        {bild ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={bild}
                            alt=""
                            className="aspect-[4/5] w-9 rounded-[3px] object-cover"
                          />
                        ) : (
                          <span className="schraffur block aspect-[4/5] w-9 rounded-[3px] border border-dashed border-rahmen-3" />
                        )}
                      </Link>
                    </td>
                    <td className="px-3 py-2 font-mono text-[11.5px] text-still">
                      {kalenderwoche(post.postenAm)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-tinte-3">
                      {DATUM.format(post.postenAm)}
                      <span className="ml-1.5 text-still">{UHRZEIT.format(post.postenAm)}</span>
                    </td>
                    <td className="px-3 py-2">
                      <TypBadge typ={post.typ} />
                      {post.typ === 'KARUSSELL' && slides.length > 0 && (
                        <span className="ml-1.5 text-[11px] text-still">{slides.length} Slides</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <Link
                        href={`/kunden/${slug}/posts/${post.id}`}
                        className="font-medium text-tinte hover:text-akzent"
                      >
                        {post.titel}
                      </Link>
                      {post.kurzbeschreibung && (
                        <p className="mt-0.5 line-clamp-1 text-[11.5px] text-leiser">
                          {post.kurzbeschreibung}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge status={post.status} />
                    </td>
                    <td className="px-3 py-2 text-[12px] text-leise">
                      {post.verantwortlich?.initialen ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-[12px] text-leise">
                      {post._count.kommentare || '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Karte>
      )}
    </>
  )
}
