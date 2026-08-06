import Link from 'next/link'
import { ersteMedien, ladeKunde, ladePosts, rasterMedium } from '@/lib/abfragen'
import { kalenderwoche } from '@/lib/format'
import { thumbUrl } from '@/lib/urls'
import { FeedRaster, type FeedKachel } from '@/components/feed'
import { IPhoneFeed } from '@/components/iphone'
import { Monatskalender, monateImZeitraum, type Kalendereintrag } from '@/components/kalender'
import { Hinweis, Karte, Leerzustand, StatusBadge, TypBadge } from '@/components/ui'
import { PostAnlegen } from './post-anlegen'
import { AnsichtsSchalter, type Ansicht } from './ansicht'

const DATUM = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
const UHRZEIT = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' })

/**
 * Posts eines Kunden in drei Ansichten — Liste, Kalender, Feed. Bewusst eine
 * Seite mit Umschalter statt drei Menüpunkte: Es ist derselbe Bestand, nur
 * anders sortiert.
 */
export default async function PostsSeite({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ ansicht?: string }>
}) {
  const { slug } = await params
  const { ansicht: gewaehlt } = await searchParams
  const ansicht: Ansicht =
    gewaehlt === 'kalender' || gewaehlt === 'feed' ? gewaehlt : 'liste'

  const kunde = await ladeKunde(slug)
  const posts = await ladePosts(kunde.id)

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-semibold tracking-[-0.02em]">Posts</h1>
          <p className="mt-1 text-[13px] text-leiser">
            {posts.length} {posts.length === 1 ? 'Beitrag' : 'Beiträge'} geplant
          </p>
        </div>

        <div className="flex items-center gap-3">
          <AnsichtsSchalter slug={slug} aktiv={ansicht} />
          <PostAnlegen kundeId={kunde.id} />
        </div>
      </div>

      {posts.length === 0 ? (
        <Leerzustand
          titel="Noch keine Posts"
          text="Lege den ersten Beitrag an — Reel, Karussell oder Einzelbeitrag."
        />
      ) : ansicht === 'liste' ? (
        <Liste slug={slug} posts={posts} />
      ) : ansicht === 'kalender' ? (
        <Kalender slug={slug} posts={posts} />
      ) : (
        <Feed kunde={kunde} posts={posts} slug={slug} />
      )}
    </>
  )
}

// ------------------------------------------------------------------- Liste

type Posts = Awaited<ReturnType<typeof ladePosts>>

function Liste({ slug, posts }: { slug: string; posts: Posts }) {
  return (
    <Karte className="overflow-hidden">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr className="border-b border-rahmen bg-flaeche-leise text-left">
            {['', 'KW', 'Datum', 'Typ', 'Titel', 'Status', 'Wer', 'Kommentare'].map((kopf, i) => (
              <th
                key={i}
                className="px-3 py-2.5 text-[10.5px] font-medium uppercase tracking-[0.1em] text-still"
              >
                {kopf}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {posts.map((post) => {
            const bild = thumbUrl(rasterMedium(post))
            const slides = ersteMedien(post, 'SLIDE')

            return (
              <tr key={post.id} className="border-b border-rahmen last:border-b-0 hover:bg-flaeche-leise">
                <td className="w-14 px-3 py-2">
                  <Link href={`/kunden/${slug}/posts/${post.id}`} className="block">
                    {bild ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={bild} alt="" className="aspect-[4/5] w-9 rounded-[3px] object-cover" />
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
                <td className="px-3 py-2 text-[12px] text-leise">{post._count.kommentare || '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </Karte>
  )
}

// ---------------------------------------------------------------- Kalender

function Kalender({ slug, posts }: { slug: string; posts: Posts }) {
  const eintraege: Kalendereintrag[] = posts.map((post) => ({
    id: post.id,
    typ: post.typ,
    titel: post.titel,
    postenAm: post.postenAm,
    href: `/kunden/${slug}/posts/${post.id}`,
  }))

  const monate = monateImZeitraum(posts[0].postenAm, posts[posts.length - 1].postenAm)

  return (
    <div className="grid gap-10">
      {monate.map((monat) => (
        <Monatskalender key={monat.toISOString()} monat={monat} eintraege={eintraege} />
      ))}
    </div>
  )
}

// -------------------------------------------------------------------- Feed

function Feed({
  kunde,
  posts,
  slug,
}: {
  kunde: Awaited<ReturnType<typeof ladeKunde>>
  posts: Posts
  slug: string
}) {
  // Intern zeigt das Raster alle Posts — auch die, die der Kunde noch nicht
  // zur Freigabe bekommen hat. Neueste Kachel oben links.
  const kacheln: FeedKachel[] = [...posts]
    .sort((a, b) => b.postenAm.getTime() - a.postenAm.getTime())
    .map((post) => ({
      id: post.id,
      typ: post.typ,
      status: post.status,
      titel: post.titel,
      bild: thumbUrl(rasterMedium(post)),
      href: `/kunden/${slug}/posts/${post.id}`,
    }))

  return (
    <div className="flex flex-wrap items-start gap-10">
      <div className="shrink-0">
        <IPhoneFeed
          kunde={kunde.name}
          handle={kunde.handle}
          logo={thumbUrl(kunde.logoId)}
          beitraege={kunde.beitraege}
          follower={kunde.follower}
          gefolgt={kunde.gefolgt}
          kacheln={kacheln.map((k) => ({ id: k.id, typ: k.typ, titel: k.titel, bild: k.bild }))}
        />
      </div>

      <div className="max-w-[420px] flex-1">
        <Hinweis>
          So sieht das Profil mit <strong>allen</strong> Posts aus — auch mit denen, die noch nicht
          zur Freigabe verschickt wurden. Auf der Export-Seite sieht der Kunde nur, was für seinen
          Zeitraum freigegeben ist.
        </Hinweis>

        <div className="mt-4 rounded-md border border-rahmen bg-flaeche p-4">
          <h3 className="mb-2.5 text-[12.5px] font-medium text-tinte">Mit Status je Kachel</h3>
          <FeedRaster kacheln={kacheln} statusZeigen />
        </div>
      </div>
    </div>
  )
}
