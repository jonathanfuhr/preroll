import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Plattform } from '@prisma/client'
import { POST_MEDIEN, rasterMedium } from '@/lib/abfragen'
import { aktuellerNutzer } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { erwaehnbarePersonen } from '@/lib/erwaehnbar'
import { feedVorschau, postsImZeitraum } from '@/lib/export-sicht'
import { darfInternFreigeben, freigabeStand } from '@/lib/freigabe'
import { kalenderwoche } from '@/lib/format'
import { darfBearbeiten, type Betrachter } from '@/lib/kommentar-rechte'
import { gewaehlterMonat, monateAusPosts } from '@/lib/monate'
import { sektionsdaten } from '@/lib/plan-anzeige'
import { angezeigtePlattformen, effektivePlattformen, PLATTFORM_TEXT } from '@/lib/plattformen'
import { profilKarte } from '@/lib/plattform-profil'
import { medienUrl, thumbUrl } from '@/lib/urls'
import { ExportHero, ExportTopbar, KalenderKarte } from '@/components/export-rahmen'
import { IPhoneFeed } from '@/components/iphone'
import { Monatskalender, type Kalendereintrag } from '@/components/kalender'
import { KommentarListe } from '@/components/kommentar-liste'
import { Monatsleiste, MonatsleisteMobil, type Monatseintrag } from '@/components/monatsleiste'
import { PostSektion } from '@/components/post-sektion'
import { StatusBadge } from '@/components/ui'
import { TikTokFeed } from '@/components/tiktok-rahmen'
import { VorschauWahl } from '@/components/vorschau-wahl'
import { FreigabeFeld } from '../posts/[postId]/freigabe-feld'

/**
 * Die Review-Seite — der Plan eines Monats am Stück, für die interne
 * Abstimmung.
 *
 * Dieselbe Ansicht wie beim Kunden, nur ohne seine Schonung: Sie zeigt **alle**
 * Phasen (auch Entwurf, Produktion und Korrektur), liest immer **live** statt
 * eingefrorener Stände, und die Freigaben, die hier erteilt werden, sind die
 * internen.
 *
 * Warum überhaupt: Wer zwölf Beiträge durchsehen will, klickte bisher zwölfmal
 * in den Editor und wieder heraus. Der Zusammenhang — passt das als Reihe,
 * wiederholt sich etwas, stimmt der Rhythmus — geht dabei verloren; und genau
 * den sieht man nur, wenn alles untereinander steht.
 *
 * Der **Beitrag selbst** wird mit demselben Bauteil und derselben Rechnung
 * gezeigt wie beim Kunden (`sektionsdaten`, `PostSektion`). Zweimal gebaut
 * liefen die beiden auseinander, und eine Review-Seite, die etwas anderes
 * zeigt als der Kunde sieht, ist schlimmer als keine.
 */
export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const kunde = await prisma.kunde.findUnique({ where: { slug }, select: { name: true } })
  return { title: kunde ? `Review — ${kunde.name}` : 'Review' }
}

export default async function ReviewSeite({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ monat?: string }>
}) {
  const { slug } = await params
  const { monat: gewuenschterMonat } = await searchParams

  const nutzer = await aktuellerNutzer()
  if (!nutzer) notFound()

  const kunde = await prisma.kunde.findUnique({
    where: { slug },
    include: { logo: true, profile: true },
  })
  if (!kunde) notFound()

  const profile = profilKarte(kunde.profile)
  const erwaehnbar = await erwaehnbarePersonen(kunde.id)

  /*
    Immer live, nie ein eingefrorener Stand: Hier wird an den Beiträgen
    gearbeitet, und wer nachsieht, will den Arbeitsstand sehen — nicht das,
    was der Kunde gerade vor sich hat. Was **er** sieht, steht einen Klick
    entfernt in der Kundenvorschau.
  */
  const alle = await prisma.post.findMany({
    where: { kundeId: kunde.id },
    orderBy: { postenAm: 'asc' },
    include: {
      medien: POST_MEDIEN,
      szenen: { orderBy: { position: 'asc' } },
      freigaben: { orderBy: { erstelltAm: 'asc' } },
      varianten: { orderBy: { position: 'asc' }, include: { medien: POST_MEDIEN } },
      veroeffentlichungen: { select: { stand: true } },
      kommentare: { orderBy: { erstelltAm: 'asc' } },
    },
  })

  // Entwürfe zählen hier mit — sie sind der halbe Grund, warum es die Seite gibt.
  const monatsliste = monateAusPosts(alle, true)
  const monat = gewaehlterMonat(monatsliste, gewuenschterMonat, new Date())
  const monate: Monatseintrag[] = monatsliste.map((m) => ({
    monat: m.monat,
    titel: m.titel,
    erledigt: 0,
    gesamt: 0,
  }))

  const regeln = { zeitraumVon: monat.von, zeitraumBis: monat.bis, mitEntwuerfen: true }
  const sektionen = postsImZeitraum(alle, regeln)
  const rasterFuer = (plattform: Plattform) =>
    feedVorschau(alle, regeln, (p) => angezeigtePlattformen(p, kunde).includes(plattform))

  const bespielt = effektivePlattformen(kunde)
  const kanaeleText = bespielt.map((pl) => PLATTFORM_TEXT[pl]).join(' · ')
  const mitRaster = (['INSTAGRAM', 'TIKTOK'] as const).filter((pl) => bespielt.includes(pl))

  const kalendereintraege: Kalendereintrag[] = sektionen.map((p) => ({
    id: p.id,
    typ: p.typ,
    verhaeltnis: p.verhaeltnis,
    titel: p.titel,
    postenAm: p.postenAm,
    href: `#post-${p.id}`,
  }))
  const imZeitraum = new Set(sektionen.map((p) => p.id))

  const zeitraum = monat.titel
  const kwSpanne = sektionen.length
    ? `KW ${kalenderwoche(sektionen[0].postenAm)}–${kalenderwoche(sektionen.at(-1)!.postenAm)}`
    : '—'

  const betrachter: Betrachter = { art: 'nutzer', id: nutzer.id, rolle: nutzer.rolle }
  const darfIntern = darfInternFreigeben(nutzer.rolle)
  const freigabenNoetig = kunde.freigabenNoetig

  const zurueck = (
    <Link
      href={`/kunden/${slug}`}
      className="rounded-[5px] border border-rahmen-3 px-3 py-1.5 text-[12px] font-medium text-tinte hover:border-rahmen-4"
    >
      Zur Verwaltung
    </Link>
  )

  return (
    <div className="-m-6 flex min-h-screen sm:-m-8">
      <Monatsleiste
        monate={monate}
        basis={`/kunden/${slug}/review`}
        aktiv={monat.monat}
        mitFreigaben={false}
      />

      <div className="min-w-0 flex-1">
        {/*
          Das Band sagt, worin sich diese Seite von der Kundenseite
          unterscheidet — sonst verwechselt man die beiden, und das ist die
          teuerste Verwechslung, die hier möglich ist.
        */}
        <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 bg-arbeit px-5 py-2 text-center text-[12px] text-white">
          <strong className="font-medium">Review</strong>
          <span className="text-white/75">
            Interne Sicht: alle Phasen, immer der aktuelle Stand. Kommentare beginnen mit
            #intern und bleiben im Haus.
          </span>
        </div>

        <MonatsleisteMobil
          monate={monate}
          basis={`/kunden/${slug}/review`}
          aktiv={monat.monat}
          mitFreigaben={false}
        />

        <ExportTopbar
          kunde={kunde.name}
          logo={thumbUrl(kunde.logoId)}
          titel={`Review ${zeitraum}`}
          aktion={zurueck}
          ohneMarke={monate.length > 1}
        />

        <ExportHero
          titel="Review"
          zeitraum={zeitraum}
          einleitung={
            'Alle Beiträge des Monats untereinander — so, wie der Kunde sie sehen wird, aber ' +
            'mit den internen Phasen und dem aktuellen Stand. Hier wird intern freigegeben und ' +
            'abgestimmt; jeder Beitrag lässt sich direkt bearbeiten.'
          }
          eckdaten={[
            { t: 'Beiträge', w: `${sektionen.length} · ${kwSpanne}` },
            { t: bespielt.length === 1 ? 'Kanal' : 'Kanäle', w: kanaeleText || '—' },
          ]}
          aktionMobil={zurueck}
        />

        <div
          className={`mx-auto grid max-w-[1440px] items-start gap-8 px-5 pb-12 md:px-[72px] md:pb-16 ${
            mitRaster.length > 0 ? 'lg:grid-cols-[minmax(0,1fr)_380px]' : ''
          }`}
        >
          <div className="grid gap-8">
            <KalenderKarte
              monat={new Intl.DateTimeFormat('de-DE', { month: 'long' }).format(monat.von)}
              jahr={String(monat.von.getFullYear())}
            >
              <Monatskalender monat={monat.von} eintraege={kalendereintraege} ohneRahmen />
            </KalenderKarte>
          </div>

          {mitRaster.length > 0 && (
            <aside className="justify-self-center lg:justify-self-end">
              <VorschauWahl
                arten={[
                  ...(bespielt.includes('INSTAGRAM')
                    ? [
                        {
                          plattform: 'INSTAGRAM' as const,
                          inhalt: (
                            <IPhoneFeed
                              kunde={kunde.name}
                              handle={profile.INSTAGRAM.handle}
                              logo={thumbUrl(kunde.logoId)}
                              beitraege={profile.INSTAGRAM.beitraege}
                              follower={profile.INSTAGRAM.follower}
                              gefolgt={profile.INSTAGRAM.gefolgt}
                              kacheln={rasterFuer('INSTAGRAM').map((p) => ({
                                id: p.id,
                                typ: p.typ,
                                titel: p.titel,
                                bild: thumbUrl(rasterMedium(p)),
                                href: imZeitraum.has(p.id) ? `#post-${p.id}` : undefined,
                              }))}
                            />
                          ),
                        },
                      ]
                    : []),
                  ...(bespielt.includes('TIKTOK')
                    ? [
                        {
                          plattform: 'TIKTOK' as const,
                          inhalt: (
                            <TikTokFeed
                              kunde={kunde.name}
                              handle={profile.TIKTOK.handle}
                              logo={thumbUrl(kunde.logoId)}
                              follower={profile.TIKTOK.follower}
                              gefolgt={profile.TIKTOK.gefolgt}
                              likes={profile.TIKTOK.likes}
                              kacheln={rasterFuer('TIKTOK').map((p) => ({
                                id: p.id,
                                typ: p.typ,
                                titel: p.titel,
                                bild: medienUrl(rasterMedium(p)),
                                href: imZeitraum.has(p.id) ? `#post-${p.id}` : undefined,
                              }))}
                            />
                          ),
                        },
                      ]
                    : []),
                ]}
              />
              <p className="mt-4 max-w-[344px] text-[11.5px] leading-[1.65] text-leiser">
                Das Raster zeigt hier auch, was der Kunde noch nicht sieht — Entwürfe
                eingeschlossen.
              </p>
            </aside>
          )}
        </div>

        <div className="mx-auto max-w-[1440px] px-5 md:px-[72px]">
          {sektionen.map((post) => {
            const plattformen = angezeigtePlattformen(post, kunde)
            const daten = sektionsdaten(post, plattformen, profile)
            const stand = freigabeStand(
              post.status,
              post.freigaben.map((f) => f.stufe),
            )

            return (
              <PostSektion
                key={post.id}
                post={post}
                plattformen={plattformen}
                liFollower={profile.LINKEDIN.follower}
                tiktokHandle={profile.TIKTOK.handle}
                fassungen={daten.fassungen}
                kunde={kunde.name}
                logo={thumbUrl(kunde.logoId)}
                medien={daten.medien}
                istVideo={daten.istVideo}
                thumbnail={daten.thumbnail}
                mitFreigaben={freigabenNoetig}
                szenen={post.szenen}
                stand={
                  <StatusBadge
                    status={post.status}
                    postenAm={post.postenAm}
                    veroeffentlichungen={post.veroeffentlichungen}
                  />
                }
                kopfAktion={
                  <Link
                    href={`/kunden/${slug}/posts/${post.id}`}
                    className="ml-1 rounded-[5px] border border-rahmen-3 bg-flaeche px-2.5 py-1 text-[12px] font-medium text-tinte transition-colors hover:border-rahmen-4"
                  >
                    Bearbeiten
                  </Link>
                }
                kommentare={
                  <>
                    {/*
                      Die Freigaben mit **allen** Stufen — hier steht die
                      interne an, nicht die des Kunden. Dasselbe Bauteil wie im
                      Editor: Zwei Wege, eine Freigabe zu erteilen, wären zwei
                      Stellen, an denen die Rechteprüfung stimmen muss.
                    */}
                    <FreigabeFeld
                      postId={post.id}
                      offen={stand.offen}
                      erledigt={stand.erledigt}
                      gepostet={false}
                      freigaben={post.freigaben.map((f) => ({
                        id: f.id,
                        stufe: f.stufe,
                        autorName: f.autorName,
                        notiz: f.notiz,
                        am: f.erstelltAm.toISOString(),
                        vomTeam: Boolean(f.nutzerId),
                      }))}
                      vorschlagName={nutzer.name}
                      darfIntern={darfIntern}
                    />
                    <KommentarListe
                      postId={post.id}
                      erwaehnbar={erwaehnbar}
                      standardwert="#intern "
                      kommentare={post.kommentare.map((k) => ({
                        id: k.id,
                        autorName: k.autorName,
                        text: k.text,
                        am: k.erstelltAm,
                        bearbeitetAm: k.bearbeitetAm,
                        status: k.status,
                        vomTeam: Boolean(k.nutzerId),
                        intern: k.intern,
                        exportId: k.exportId,
                        antwortAufId: k.antwortAufId,
                        darfAendern: darfBearbeiten(k, betrachter),
                      }))}
                    />
                  </>
                }
              />
            )
          })}

          {sektionen.length === 0 && (
            <div className="mb-16 rounded-md border border-dashed border-rahmen-3 bg-flaeche-leise px-6 py-14 text-center">
              <p className="text-[13.5px] font-medium text-tinte-3">
                In diesem Monat steht noch nichts.
              </p>
              <p className="mt-1.5 text-[12.5px] text-leiser">
                Sobald Beiträge mit Termin angelegt sind, erscheinen sie hier.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
