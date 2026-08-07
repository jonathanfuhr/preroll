import { notFound, redirect } from 'next/navigation'
import { POST_MEDIEN, rasterMedium } from '@/lib/abfragen'
import { aktuellerGast, aktuellerNutzer } from '@/lib/auth'
import { erwaehnbarePersonen } from '@/lib/erwaehnbar'
import { darfBearbeiten, type Betrachter } from '@/lib/kommentar-rechte'
import { zeitraumText } from '@/lib/benachrichtigungen'
import { formatiereTag, monatsTitel } from '@/lib/datum'
import { prisma } from '@/lib/db'
import { ladeEinstellungen } from '@/lib/einstellungen'
import { feedVorschau, postsImZeitraum } from '@/lib/export-sicht'
import { kalenderwoche } from '@/lib/format'
import { freigabeFortschritt, freigabeStand } from '@/lib/freigabe'
import { reelVideoQuelle } from '@/lib/reel-video'
import { medienUrl, thumbUrl } from '@/lib/urls'
import { ExportHero, ExportTopbar, KalenderKarte, KontaktFuss } from '@/components/export-rahmen'
import { IPhoneFeed } from '@/components/iphone'
import { Monatskalender, monateImZeitraum, type Kalendereintrag } from '@/components/kalender'
import { Monatsleiste, MonatsleisteMobil, type Monatseintrag } from '@/components/monatsleiste'
import { PostSektion } from '@/components/post-sektion'
import { Freigabefortschritt, KommentarBereich, PostFreigabe } from './interaktion'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const exp = await prisma.export.findUnique({ where: { token }, include: { kunde: true } })
  return { title: exp ? `${exp.kunde.name} — Content-Plan` : 'Freigabe' }
}

export default async function ExportSeite({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

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
        include: { logo: true, hauptAnsprechpartner: { include: { foto: true } } },
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

  const einstellungen = await ladeEinstellungen()

  const erwaehnbar = await erwaehnbarePersonen(exp.kundeId)

  /*
    Alle Monate dieses Kunden — die Leiste, über die der Kunde zwischen
    seinen Freigaben wechselt. Bis hierher war ein Link eine Sackgasse: Wer
    den Plan vom Vormonat noch einmal sehen wollte, musste die alte Mail
    suchen.

    Der Freigabestand je Monat kostet einen zweiten Durchlauf über die Posts;
    bei einer Handvoll Monaten ist das nichts, und die Leiste ohne Stand wäre
    nur eine Liste von Namen.
  */
  const alleFreigaben = await prisma.export.findMany({
    where: { kundeId: exp.kundeId },
    orderBy: { zeitraumVon: 'desc' },
    include: { kunde: { include: { posts: { include: { freigaben: { select: { stufe: true } } } } } } },
  })

  const monate: Monatseintrag[] = alleFreigaben.map((f) => {
    const stand = freigabeFortschritt(
      postsImZeitraum(f.kunde.posts, {
        zeitraumVon: f.zeitraumVon,
        zeitraumBis: f.zeitraumBis,
      }),
    )
    return {
      token: f.token,
      titel: monatsTitel(f.zeitraumVon),
      erledigt: stand.erledigt,
      gesamt: stand.gesamt,
    }
  })

  // Live-Sicht: bei jedem Aufruf frisch aus der Datenbank, kein Schnappschuss.
  const alle = await prisma.post.findMany({
    where: { kundeId: exp.kundeId },
    orderBy: { postenAm: 'asc' },
    include: {
      medien: POST_MEDIEN,
      szenen: { orderBy: { position: 'asc' } },
      freigaben: { orderBy: { erstelltAm: 'asc' } },
    },
  })

  const regeln = { zeitraumVon: exp.zeitraumVon, zeitraumBis: exp.zeitraumBis }
  const sektionen = postsImZeitraum(alle, regeln)
  const kacheln = feedVorschau(alle, regeln)

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

  const zeitraum = zeitraumText(exp.zeitraumVon, exp.zeitraumBis)
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
  const freigabeleiste = mitFreigaben ? (
    <Freigabefortschritt erledigt={fortschritt.erledigt} gesamt={fortschritt.gesamt} />
  ) : null

  return (
    /*
      Wie im Backend: Die Monatsleiste steht am linken Bildschirmrand, über
      die volle Höhe, und bleibt beim Scrollen stehen. Am Telefon gibt es
      dafür keinen Platz — dort wird daraus eine waagerechte Reihe unter der
      Kopfzeile (`MonatsleisteMobil`).
    */
    <div className="flex min-h-screen">
      <Monatsleiste monate={monate} aktiv={token} mitFreigaben={mitFreigaben} />

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

      <MonatsleisteMobil monate={monate} aktiv={token} mitFreigaben={mitFreigaben} />

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
          'Instagram erscheinen. Über den Kalender springen Sie direkt zum Beitrag. ' +
          'Ihre Kommentare schreiben Sie direkt neben dem Beitrag — wir sehen sie sofort.'
        }
        eckdaten={[
          { t: 'Beiträge', w: `${sektionen.length} · ${kwSpanne}` },
          { t: 'Kanal', w: 'Instagram' },
          ...(einstellungen.agenturName ? [{ t: 'Agentur', w: einstellungen.agenturName }] : []),
        ]}
        aktionMobil={freigabeleiste}
      />

      {/* ---------------------------------------- Kalender + Feed-Vorschau */}
      <div className="mx-auto grid max-w-[1440px] items-start gap-8 px-5 pb-12 md:px-[72px] md:pb-16 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="grid gap-8">
          {monateImZeitraum(exp.zeitraumVon, exp.zeitraumBis).map((monat) => (
            <KalenderKarte
              key={monat.toISOString()}
              monat={new Intl.DateTimeFormat('de-DE', { month: 'long' }).format(monat)}
              jahr={String(monat.getFullYear())}
            >
              <Monatskalender monat={monat} eintraege={kalendereintraege} ohneRahmen />
            </KalenderKarte>
          ))}
        </div>

        <aside className="justify-self-center lg:justify-self-end">
          {/*
            Sechs Reihen stehen offen; hat der Monat mehr Beiträge, wächst
            der Schirm mit, damit der Kunde seinen ganzen Monat ohne Rollen
            sieht. Was darunter liegt — die schon veröffentlichten Beiträge —
            wird im Gerät gerollt.
          */}
          <IPhoneFeed
            reihen={Math.max(6, Math.ceil(sektionen.length / 3))}
            kunde={exp.kunde.name}
            handle={exp.kunde.handle}
            logo={thumbUrl(exp.kunde.logoId)}
            beitraege={exp.kunde.beitraege}
            follower={exp.kunde.follower}
            gefolgt={exp.kunde.gefolgt}
            kacheln={kacheln.map((p) => ({
              id: p.id,
              typ: p.typ,
              titel: p.titel,
              bild: thumbUrl(rasterMedium(p)),
            }))}
          />
          <p className="mt-4 max-w-[344px] text-[11.5px] leading-[1.65] text-leiser">
            So sieht das Profil nach dem Zeitraum aus — die geplanten Beiträge oben, darunter die
            bereits veröffentlichten.
          </p>
        </aside>
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

          return (
            <PostSektion
              key={post.id}
              post={post}
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
