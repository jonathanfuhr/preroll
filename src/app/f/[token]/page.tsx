import { notFound, redirect } from 'next/navigation'
import { POST_MEDIEN, rasterMedium } from '@/lib/abfragen'
import { aktuellerGast, aktuellerNutzer } from '@/lib/auth'
import { erwaehnbarePersonen } from '@/lib/erwaehnbar'
import { darfBearbeiten, type Betrachter } from '@/lib/kommentar-rechte'
import { formatiereTag } from '@/lib/datum'
import { prisma } from '@/lib/db'
import { ladeEinstellungen } from '@/lib/einstellungen'
import { feedVorschau, postsImZeitraum } from '@/lib/export-sicht'
import { kalenderwoche } from '@/lib/format'
import { freigabeFortschritt, freigabeStand } from '@/lib/freigabe'
import { reelVideoQuelle } from '@/lib/reel-video'
import { gewaehlterMonat, monateAusPosts } from '@/lib/monate'
import { profilKarte } from '@/lib/plattform-profil'
import { fassungenFuerAnzeige } from '@/lib/varianten'
import { medienUrl, thumbUrl } from '@/lib/urls'
import type { Plattform } from '@prisma/client'
import {
  angezeigtePlattformen,
  effektivePlattformen,
  PLATTFORM_TEXT,
} from '@/lib/plattformen'
import { ExportHero, ExportTopbar, KalenderKarte, KontaktFuss } from '@/components/export-rahmen'
import { IPhoneFeed } from '@/components/iphone'
import { TikTokFeed } from '@/components/tiktok-rahmen'
import { VorschauWahl } from '@/components/vorschau-wahl'
import { Monatskalender, type Kalendereintrag } from '@/components/kalender'
import { Monatsleiste, MonatsleisteMobil, type Monatseintrag } from '@/components/monatsleiste'
import { PostSektion } from '@/components/post-sektion'
import { Freigabefortschritt, KommentarBereich, PostFreigabe } from './interaktion'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const exp = await prisma.export.findUnique({ where: { token }, include: { kunde: true } })
  return { title: exp ? `${exp.kunde.name} — Content-Plan` : 'Freigabe' }
}

export default async function ExportSeite({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>
  searchParams: Promise<{ monat?: string }>
}) {
  const { token } = await params
  const { monat: gewuenschterMonat } = await searchParams

  // Ein Freigabe-Link öffnet sich nie ohne Anmeldung. Die Sitzung gilt
  // 40 Tage — danach genügt der Link wieder allein.
  //
  // Ausnahme: Wer am Team angemeldet ist, kommt ohne Gast-Anmeldung durch und
  // sieht genau dieselbe Seite wie der Kunde. Sich für einen Blick auf den
  // eigenen Plan als Gast zu registrieren, wäre ein Umweg — und die Kommentare
  // trügen danach einen zweiten Namen derselben Person.
  //
  // Wer da sitzt, steht vor der Abfrage fest, weil die Kommentare davon
  // abhängen: Interne Abstimmungen werden für einen Gast gar nicht erst
  // geladen.
  const [gast, nutzer] = await Promise.all([aktuellerGast(), aktuellerNutzer()])
  const angemeldeterGast = gast && gast.name.trim() ? gast : null
  if (!angemeldeterGast && !nutzer) redirect(`/f/${token}/anmelden`)

  // Aus Sicht der Seite zählt nur, welcher Name an Kommentar und Freigabe
  // steht. Das Team schreibt unter seinem eigenen.
  const anzeigename = angemeldeterGast?.name ?? nutzer!.name
  const alsTeam = !angemeldeterGast

  const exp = await prisma.export.findUnique({
    where: { token },
    include: {
      kunde: {
        include: {
          logo: true,
          hauptAnsprechpartner: { include: { foto: true } },
          profile: true,
        },
      },
      zusatzAnsprechpartner: { include: { foto: true } },
      /*
        Gefiltert wird in der Abfrage, nicht in der Anzeige — was nie geladen
        wird, kann auch nicht durchrutschen. Das Team sieht die interne
        Abstimmung auch hier, sonst verschwände die eigene Antwort im Moment
        des Abschickens und sähe aus wie ein Fehler; sie trägt dann ihr
        Etikett.
      */
      kommentare: {
        where: alsTeam ? {} : { intern: false },
        orderBy: { erstelltAm: 'asc' },
      },
    },
  })
  if (!exp) notFound()

  // Wer hier sitzt, entscheidet über Bearbeiten und Löschen. Sieht das Team
  // die Seite in der Vorschau, gelten seine eigenen Rechte — inklusive der
  // Ausnahme für die Administration.
  const betrachter: Betrachter | null = angemeldeterGast
    ? { art: 'gast', id: angemeldeterGast.id }
    : nutzer
      ? { art: 'nutzer', id: nutzer.id, rolle: nutzer.rolle }
      : null

  // Die Feed-Vorschau ist ein Instagram-Profil und wird keines von LinkedIn —
  // Handle und Zahlen darüber kommen deshalb ausdrücklich von dort.
  const profile = profilKarte(exp.kunde.profile)
  const igProfil = profile.INSTAGRAM
  // Steht in der LinkedIn-Vorschau unter dem Namen — dort zählen die Follower
  // der Firmenseite, nicht die von Instagram.
  const liProfil = profile.LINKEDIN

  const einstellungen = await ladeEinstellungen()

  const erwaehnbar = await erwaehnbarePersonen(exp.kundeId)

  // Live-Sicht: bei jedem Aufruf frisch aus der Datenbank, kein Schnappschuss.
  const alle = await prisma.post.findMany({
    where: { kundeId: exp.kundeId },
    orderBy: { postenAm: 'asc' },
    include: {
      medien: POST_MEDIEN,
      szenen: { orderBy: { position: 'asc' } },
      freigaben: { orderBy: { erstelltAm: 'asc' } },
      varianten: { orderBy: { position: 'asc' }, include: { medien: POST_MEDIEN } },
    },
  })

  /*
    Welche Monate es gibt, sagen die Beiträge — nicht eine Tabelle. Vorher war
    jeder Monat eine eigene Freigabe mit eigenem Link: Wer den Plan vom
    Vormonat sehen wollte, musste die alte Mail suchen, und ein Monat ohne
    angelegte Freigabe war unerreichbar, obwohl Beiträge darin standen.

    Der Freigabestand je Monat kostet einen zweiten Durchlauf über dieselben
    Posts; bei einer Handvoll Monaten ist das nichts, und die Leiste ohne
    Stand wäre nur eine Liste von Namen.
  */
  const monatsliste = monateAusPosts(alle)
  const monat = gewaehlterMonat(monatsliste, gewuenschterMonat, new Date())

  const monate: Monatseintrag[] = monatsliste.map((m) => {
    const stand = freigabeFortschritt(
      postsImZeitraum(alle, { zeitraumVon: m.von, zeitraumBis: m.bis }),
    )
    return {
      monat: m.monat,
      titel: m.titel,
      erledigt: stand.erledigt,
      gesamt: stand.gesamt,
    }
  })

  const regeln = { zeitraumVon: monat.von, zeitraumBis: monat.bis }
  const sektionen = postsImZeitraum(alle, regeln)
  /*
    Ein Raster ist das Profil **einer** Plattform. Ein Beitrag, der nur auf
    LinkedIn erscheint, gehört in keines von beiden — er würde dem Kunden ein
    Profil zeigen, das es nicht gibt. Gefiltert wird über
    `angezeigtePlattformen`, also über das, was wirklich rausgeht, nicht über
    die rohe Wahl. Der Filter wirkt **vor** der Obergrenze; sonst setzte ein
    weggelassener Beitrag das Ende des Zeitraums.
  */
  const rasterFuer = (plattform: Plattform) =>
    feedVorschau(alle, regeln, (p) => angezeigtePlattformen(p, exp.kunde).includes(plattform))

  // Bespielt der Kunde die Plattform überhaupt? Ein Profilraster für eine
  // abgeschaltete Plattform wäre eine Ansicht auf nichts.
  const bespielt = effektivePlattformen(exp.kunde)
  const kanaeleText = bespielt.map((pl) => PLATTFORM_TEXT[pl]).join(' · ')

  /*
    Ein Profilraster hat nur, wer ein Profil hat: Instagram und TikTok. Für
    Facebook und LinkedIn gibt es keines, in dem sich Kacheln zu einem Bild
    fügen — die Spalte fällt dann weg, statt leer dazustehen.
  */
  const mitRaster = (['INSTAGRAM', 'TIKTOK'] as const).filter((pl) => bespielt.includes(pl))

  // Aufruf zählen, ohne die Antwort zu blockieren — aber nur den des Kunden.
  if (angemeldeterGast) {
    void prisma.export
      .update({
        where: { id: exp.id },
        data: { aufrufe: { increment: 1 }, zuletztGeoeffnet: new Date() },
      })
      .catch(() => {})
  }

  // Nur echte Kundenbesuche zählen — sonst stünde beim Kunden „zuletzt
  // geöffnet", wenn in Wahrheit die Agentur selbst nachgesehen hat.
  if (angemeldeterGast) {
    void prisma.exportGast
      .upsert({
        where: { exportId_gastId: { exportId: exp.id, gastId: angemeldeterGast.id } },
        update: { zuletztGeoeffnetAm: new Date() },
        create: {
          exportId: exp.id,
          gastId: angemeldeterGast.id,
          zuletztGeoeffnetAm: new Date(),
        },
      })
      .catch(() => {})
  }

  const kalendereintraege: Kalendereintrag[] = sektionen.map((p) => ({
    id: p.id,
    typ: p.typ,
    verhaeltnis: p.verhaeltnis,
    titel: p.titel,
    postenAm: p.postenAm,
    href: `#post-${p.id}`,
  }))

  // Wer eine Sektion auf dieser Seite hat — nur diese Kacheln werden anklickbar.
  const imZeitraum = new Set(sektionen.map((p) => p.id))

  const zeitraum = monat.titel
  const kwSpanne = sektionen.length
    ? `KW ${kalenderwoche(sektionen[0].postenAm)}–${kalenderwoche(sektionen.at(-1)!.postenAm)}`
    : '—'

  // Der Hauptansprechpartner steht immer da; ist für diesen Link zusätzlich
  // jemand hinterlegt, kommt er daneben — er ersetzt ihn nicht.
  const kontakte = [exp.kunde.hauptAnsprechpartner, exp.zusatzAnsprechpartner]
    .filter((n) => n !== null)
    .filter((n, i, alle) => alle.findIndex((a) => a!.id === n!.id) === i)
    .map((n) => ({
      name: n!.name,
      position: n!.position,
      telefon: n!.telefon,
      email: n!.email,
      foto: medienUrl(n!.fotoId),
    }))

  // Bei eigenen Kanälen gibt es niemanden, der freigeben müsste — dann steht
  // auf der Seite auch nichts davon.
  const mitFreigaben = exp.kunde.freigabenNoetig
  const fortschritt = freigabeFortschritt(sektionen)

  /*
    Darf der Kunde die Dateien selbst holen, steht der Knopf oben in der Leiste.
    Nur wenn es in den Stammdaten eingeschaltet ist und wenigstens ein Beitrag
    final ist — ein Knopf, der ein leeres Archiv liefert, sieht wie ein Fehler
    aus. In der Team-Vorschau bleibt er weg: Das Team hat den vollständigen
    Export in der Verwaltung, und hier wäre er die falsche Auskunft darüber,
    was der Kunde vor sich hat.
  */
  const download =
    exp.kunde.zipFuerKunden && !alsTeam && sektionen.some((p) => p.status === 'FINAL') ? (
      <a
        href={`/api/export/${exp.id}/zip`}
        className="rounded-[5px] border border-rahmen-3 px-3 py-1.5 text-[12px] font-medium text-tinte hover:border-rahmen-4"
      >
        Finale Beiträge herunterladen
      </a>
    ) : null

  const freigabeleiste =
    mitFreigaben || download ? (
      <>
        {mitFreigaben && (
          <Freigabefortschritt erledigt={fortschritt.erledigt} gesamt={fortschritt.gesamt} />
        )}
        {download}
      </>
    ) : null

  return (
    /*
      Wie im Backend: Die Monatsleiste steht am linken Bildschirmrand, über
      die volle Höhe, und bleibt beim Scrollen stehen. Am Telefon gibt es
      dafür keinen Platz — dort wird daraus eine waagerechte Reihe unter der
      Kopfzeile (`MonatsleisteMobil`).
    */
    <div className="flex min-h-screen">
      <Monatsleiste monate={monate} token={token} aktiv={monat.monat} mitFreigaben={mitFreigaben} />

      <div className="min-w-0 flex-1">
      {alsTeam && (
        <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 bg-tinte px-5 py-2 text-center text-[12px] text-white">
          <strong className="font-medium">Vorschau</strong>
          <span className="text-white/70">
            Sie sehen diese Seite als {anzeigename} — genau so bekommt sie der Kunde. Kommentare
            und Freigaben tragen Ihren Namen.
          </span>
          <a href={`/kunden/${exp.kunde.slug}/freigaben`} className="underline underline-offset-2">
            Zurück zur Verwaltung
          </a>
        </div>
      )}

      <MonatsleisteMobil monate={monate} token={token} aktiv={monat.monat} mitFreigaben={mitFreigaben} />

      <ExportTopbar
        kunde={exp.kunde.name}
        logo={thumbUrl(exp.kunde.logoId)}
        titel={exp.titel ?? `Content-Plan ${zeitraum}`}
        aktion={freigabeleiste}
        ohneMarke={monate.length > 1}
      />

      <ExportHero
        titel="Content-Plan"
        zeitraum={zeitraum}
        einleitung={
          `Hier sehen Sie alle geplanten Beiträge für ${zeitraum} — so, wie sie später auf ` +
          `${kanaeleText || 'Ihren Kanälen'} erscheinen. Über den Kalender springen Sie direkt ` +
          'zum Beitrag. Ihre Kommentare schreiben Sie direkt neben dem Beitrag — wir sehen sie ' +
          'sofort.'
        }
        eckdaten={[
          { t: 'Beiträge', w: `${sektionen.length} · ${kwSpanne}` },
          // Alle Kanäle, die der Kunde bespielt — nicht das eine, das hier
          // früher fest stand. Was in den Stammdaten auf „aus" steht, fehlt.
          { t: bespielt.length === 1 ? 'Kanal' : 'Kanäle', w: kanaeleText || '—' },
          ...(einstellungen.agenturName ? [{ t: 'Agentur', w: einstellungen.agenturName }] : []),
        ]}
        aktionMobil={freigabeleiste}
      />

      {/* ---------------------------------------- Kalender + Feed-Vorschau */}
      <div
        className={`mx-auto grid max-w-[1440px] items-start gap-8 px-5 pb-12 md:px-[72px] md:pb-16 ${
          mitRaster.length > 0 ? 'lg:grid-cols-[minmax(0,1fr)_380px]' : ''
        }`}
      >
        <div className="grid gap-8">
          {/* Genau ein Monat je Ansicht — die Zeitspanne ist der Monat. */}
          <KalenderKarte
            monat={new Intl.DateTimeFormat('de-DE', { month: 'long' }).format(monat.von)}
            jahr={String(monat.von.getFullYear())}
          >
            <Monatskalender monat={monat.von} eintraege={kalendereintraege} ohneRahmen />
          </KalenderKarte>
        </div>

        {mitRaster.length > 0 && (
        <aside className="justify-self-center lg:justify-self-end">
          {/*
            Ein Raster je Plattform, dazwischen wird umgeschaltet — dieselbe
            Wahl wie oben an den Beiträgen. Nebeneinander gestellt bräuchten
            zwei Telefone 700 px, und der Kalender daneben bliebe nichts.
          */}
          <VorschauWahl
            arten={[
              ...(bespielt.includes('INSTAGRAM')
                ? [
                    {
                      plattform: 'INSTAGRAM' as const,
                      inhalt: (
                        <IPhoneFeed
                          kunde={exp.kunde.name}
                          handle={igProfil.handle}
                          logo={thumbUrl(exp.kunde.logoId)}
                          beitraege={igProfil.beitraege}
                          follower={igProfil.follower}
                          gefolgt={igProfil.gefolgt}
                          /*
                            Kacheln des Zeitraums springen zu ihrem Beitrag
                            weiter unten — dieselbe Sprungmarke wie im
                            Kalender. Die älteren, schon veröffentlichten
                            darunter bleiben stumm: Zu ihnen gibt es auf
                            dieser Seite nichts, wohin man springen könnte.
                          */
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
                          kunde={exp.kunde.name}
                          handle={profile.TIKTOK.handle}
                          logo={thumbUrl(exp.kunde.logoId)}
                          follower={profile.TIKTOK.follower}
                          gefolgt={profile.TIKTOK.gefolgt}
                          /*
                            Das Original statt des Rastervorschaubildes: Das
                            ist der mittige 3:4-Ausschnitt für Instagram und
                            würde in einer 9:16-Kachel ein zweites Mal
                            beschnitten.
                          */
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
            So sieht das Profil nach dem Zeitraum aus — die geplanten Beiträge oben, darunter die
            bereits veröffentlichten.
          </p>
        </aside>
        )}
      </div>

      {/* ---------------------------------------------------- Post-Sektionen */}
      <div className="mx-auto max-w-[1440px] px-5 md:px-[72px]">
        {sektionen.map((post) => {
          const slides = post.medien
            .filter((m) => m.rolle === 'SLIDE')
            .sort((a, b) => a.position - b.position)
            .map((m) => medienUrl(m.medium.id)!)
          const medium = post.medien.find((m) => m.rolle === 'MEDIUM')
          const thumb = post.medien.find((m) => m.rolle === 'THUMBNAIL')
          // Der eine Video-Platz des Reels — Upload, Link-Download und
          // Klappe-Fassung landen alle hier, nicht in einer Extra-Anzeige.
          const reelVideo = post.typ === 'REEL' ? reelVideoQuelle(post) : null

          /*
            Die abweichenden Fassungen. Das Hauptformat steht schon oben im
            Geräterahmen — hier bleiben nur die Abweichungen, deshalb `slice(1)`.

            Gerechnet wird gegen `angezeigtePlattformen`: eine Variante für eine
            Plattform ohne Kanal erscheint nicht, sonst versprächen wir dem
            Kunden eine Fassung, die nie irgendwo auftaucht.
          */
          const fassungen = fassungenFuerAnzeige(
            post,
            post.varianten,
            angezeigtePlattformen(post, exp.kunde),
          )
            .slice(1)
            .map((f) => {
              const eigeneSlides = f.medien
                .filter((m) => m.rolle === 'SLIDE')
                .sort((a, b) => a.position - b.position)
                .map((m) => medienUrl(m.mediumId)!)
              const eigenesMedium = f.medien.find((m) => m.rolle === 'MEDIUM')
              const eigenesThumb = f.medien.find((m) => m.rolle === 'THUMBNAIL')
              const video = Boolean(eigenesMedium?.medium.mimeTyp.startsWith('video/'))

              return {
                plattformen: f.plattformen,
                // Der öffentliche Name auf diesen Plattformen — er steht in der
                // Fassung, weil der Kunde daran erkennt, wo sie erscheint.
                handles: f.plattformen
                  .map((pl) => profile[pl].handle)
                  .filter((h): h is string => Boolean(h))
                  .map((h) => (h.startsWith('/') ? h : `@${h}`)),
                caption: f.caption,
                verhaeltnis: f.verhaeltnis,
                medien: eigeneSlides.length > 0
                  ? eigeneSlides
                  : eigenesMedium
                    ? [medienUrl(eigenesMedium.mediumId)!]
                    : post.typ === 'KARUSSELL'
                      ? slides
                      : reelVideo
                        ? [reelVideo.url]
                        : medium
                          ? [medienUrl(medium.medium.id)!]
                          : [],
                istVideo: f.eigeneMedien ? video : post.typ === 'REEL',
                thumbnail: eigenesThumb
                  ? medienUrl(eigenesThumb.mediumId)
                  : thumb
                    ? medienUrl(thumb.medium.id)
                    : null,
                eigeneCaption: f.eigeneCaption,
                eigeneMedien: f.eigeneMedien,
              }
            })

          return (
            <PostSektion
              key={post.id}
              post={post}
              plattformen={angezeigtePlattformen(post, exp.kunde)}
              liFollower={liProfil.follower}
              tiktokHandle={profile.TIKTOK.handle}
              fassungen={fassungen}
              kunde={exp.kunde.name}
              logo={thumbUrl(exp.kunde.logoId)}
              medien={
                post.typ === 'KARUSSELL'
                  ? slides
                  : post.typ === 'REEL'
                    ? reelVideo
                      ? [reelVideo.url]
                      : []
                    : medium
                      ? [medienUrl(medium.medium.id)!]
                      : []
              }
              istVideo={
                post.typ === 'REEL'
                  ? Boolean(reelVideo)
                  : (medium?.medium.mimeTyp.startsWith('video/') ?? false)
              }
              thumbnail={thumb ? medienUrl(thumb.medium.id) : null}
              mitFreigaben={mitFreigaben}
              szenen={post.szenen}
              kommentare={
                <>
                  <PostFreigabe
                    token={token}
                    postId={post.id}
                    erlaubt={mitFreigaben}
                    offen={
                      freigabeStand(
                        post.status,
                        post.freigaben.map((f) => f.stufe),
                      ).offen
                    }
                    erledigt={
                      freigabeStand(
                        post.status,
                        post.freigaben.map((f) => f.stufe),
                      ).erledigt
                    }
                    erteilte={post.freigaben.map((f) => ({
                      stufe: f.stufe,
                      autorName: f.autorName,
                      am: f.erstelltAm.toISOString(),
                      vomTeam: Boolean(f.nutzerId),
                    }))}
                    gastName={anzeigename}
                  />
                  <KommentarBereich
                  token={token}
                  postId={post.id}
                  erlaubt
                  alsTeam={alsTeam}
                  erwaehnbar={erwaehnbar}
                  kommentare={exp.kommentare
                    .filter((k) => k.postId === post.id)
                    .map((k) => ({
                      id: k.id,
                      autorName: k.autorName,
                      text: k.text,
                      am: k.erstelltAm.toISOString(),
                      bearbeitet: Boolean(k.bearbeitetAm),
                      vomTeam: Boolean(k.nutzerId),
                      intern: k.intern,
                      antwortAufId: k.antwortAufId,
                      darfAendern: betrachter ? darfBearbeiten(k, betrachter) : false,
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
              Für diesen Zeitraum ist noch nichts zur Freigabe bereit.
            </p>
            <p className="mt-1.5 text-[12.5px] text-leiser">
              Sobald die Beiträge fertig sind, erscheinen sie automatisch hier.
            </p>
          </div>
        )}
      </div>

      {kontakte.length > 0 && (
        <KontaktFuss
          kontakte={kontakte}
          agenturAdresse={einstellungen.agenturAdresse}
          agenturWebsite={einstellungen.agenturWebsite}
        />
      )}
      </div>
    </div>
  )
}
