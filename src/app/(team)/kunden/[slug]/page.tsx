import { ersteMedien, ladeKunde, ladePosts, rasterMedium } from '@/lib/abfragen'
import { prisma } from '@/lib/db'
import { offeneStufe } from '@/lib/freigabe'
import { kalenderwoche } from '@/lib/format'
import { thumbUrl } from '@/lib/urls'
import { KalenderPlanung } from '@/components/kalender-planung'
import type { Kalendereintrag } from '@/components/kalender'
import { Leerzustand, StatusBadge, TypBadge } from '@/components/ui'
import { postTerminieren } from './aktionen'
import { PostAnlegen } from './post-anlegen'
import { AnsichtsSchalter, type Ansicht } from './ansicht'
import { FeedPlanung } from './feed-planung'
import { Postliste, type Filter } from './postliste'

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
  searchParams: Promise<{ ansicht?: string; suche?: string; filter?: string }>
}) {
  const { slug } = await params
  const { ansicht: gewaehlt, suche, filter: gewaehlterFilter } = await searchParams
  const ansicht: Ansicht =
    gewaehlt === 'kalender' || gewaehlt === 'feed' ? gewaehlt : 'liste'
  const filter: Filter =
    gewaehlterFilter === 'freigabe' || gewaehlterFilter === 'kommentare'
      ? gewaehlterFilter
      : 'alle'

  const kunde = await ladeKunde(slug)
  const [posts, letzterExport] = await Promise.all([
    ladePosts(kunde.id),
    // Der Link, den das Team gerade herumreicht — der zuletzt angelegte.
    prisma.export.findFirst({
      where: { kundeId: kunde.id },
      orderBy: { erstelltAm: 'desc' },
      select: { token: true, titel: true },
    }),
  ])

  const ungeplant = posts.filter((p) => !p.postenAm).length

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-semibold tracking-[-0.02em]">Posts</h1>
          <p className="mt-1 text-[13px] text-leiser">
            {posts.length} {posts.length === 1 ? 'Beitrag' : 'Beiträge'}
            {ungeplant > 0 && ` · ${ungeplant} ohne Termin`}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <AnsichtsSchalter slug={slug} aktiv={ansicht} />
          <PostAnlegen kundeId={kunde.id} plattformen={kunde.plattformen} />
        </div>
      </div>

      {posts.length === 0 ? (
        <Leerzustand
          titel="Noch keine Posts"
          text="Lege den ersten Beitrag an — Reel, Karussell oder Einzelbeitrag."
        />
      ) : ansicht === 'liste' ? (
        <Postliste
          slug={slug}
          suche={suche ?? ''}
          filter={filter}
          freigabeLink={letzterExport}
          zeilen={posts.map((post) => ({
            id: post.id,
            typ: post.typ,
            verhaeltnis: post.verhaeltnis,
            status: post.status,
            titel: post.titel,
            kurzbeschreibung: post.kurzbeschreibung,
            postenAm: post.postenAm,
            veroeffentlichungen: post.veroeffentlichungen,
            plattformen: post.plattformen,
            bild: thumbUrl(rasterMedium(post)),
            slides: ersteMedien(post, 'SLIDE').length,
            wer: post.verantwortlich?.initialen ?? null,
            kommentare: post._count.kommentare,
            freigabeOffen:
              offeneStufe(post.status) !== null &&
              !post.freigaben.some((f) => f.stufe === offeneStufe(post.status)),
          }))}
        />
      ) : ansicht === 'kalender' ? (
        <Kalender slug={slug} posts={posts} />
      ) : (
        <FeedPlanung
          kunde={{
            name: kunde.name,
            handle: kunde.handle,
            logo: thumbUrl(kunde.logoId),
            beitraege: kunde.beitraege,
            follower: kunde.follower,
            gefolgt: kunde.gefolgt,
          }}
          kacheln={[...posts]
            .sort((a, b) => (b.postenAm?.getTime() ?? 0) - (a.postenAm?.getTime() ?? 0))
            .map((post) => ({
              id: post.id,
              typ: post.typ,
            verhaeltnis: post.verhaeltnis,
              status: post.status,
              postenAm: post.postenAm,
              veroeffentlichungen: post.veroeffentlichungen,
              titel: post.titel,
              bild: thumbUrl(rasterMedium(post)),
              href: `/kunden/${slug}/posts/${post.id}`,
            }))}
        />
      )}
    </>
  )
}

// ---------------------------------------------------------------- Kalender

type Posts = Awaited<ReturnType<typeof ladePosts>>

function Kalender({ slug, posts }: { slug: string; posts: Posts }) {
  const eintraege: Kalendereintrag[] = posts.map((post) => ({
    id: post.id,
    typ: post.typ,
    verhaeltnis: post.verhaeltnis,
    titel: post.titel,
    postenAm: post.postenAm,
    plattformen: post.plattformen,
    href: `/kunden/${slug}/posts/${post.id}`,
  }))

  // Aufgehen soll der Kalender dort, wo etwas steht — sonst im laufenden Monat.
  const erster = posts.find((p) => p.postenAm)?.postenAm ?? new Date()

  return (
    <KalenderPlanung
      eintraege={eintraege}
      startMonat={erster}
      terminieren={postTerminieren}
    />
  )
}
