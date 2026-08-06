import { notFound, redirect } from 'next/navigation'
import { POST_MEDIEN, rasterMedium } from '@/lib/abfragen'
import { aktuellerGast } from '@/lib/auth'
import { zeitraumText } from '@/lib/benachrichtigungen'
import { formatiereTag } from '@/lib/datum'
import { prisma } from '@/lib/db'
import { ladeEinstellungen } from '@/lib/einstellungen'
import { feedVorschau, istAbgelaufen, postsImZeitraum } from '@/lib/export-sicht'
import { kalenderwoche } from '@/lib/format'
import { freigabeFortschritt, freigabeStand } from '@/lib/freigabe'
import { medienUrl, thumbUrl } from '@/lib/urls'
import { ExportHero, ExportTopbar, KalenderKarte, KontaktFuss } from '@/components/export-rahmen'
import { IPhoneFeed } from '@/components/iphone'
import { Monatskalender, monateImZeitraum, type Kalendereintrag } from '@/components/kalender'
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

  const exp = await prisma.export.findUnique({
    where: { token },
    include: {
      kunde: {
        include: { logo: true, hauptAnsprechpartner: { include: { foto: true } } },
      },
      zusatzAnsprechpartner: { include: { foto: true } },
      kommentare: { orderBy: { erstelltAm: 'asc' } },
    },
  })
  if (!exp) notFound()

  if (istAbgelaufen(exp.gueltigBis)) {
    return (
      <main className="mx-auto max-w-[520px] px-6 py-24 text-center">
        <div className="text-[11px] uppercase tracking-[0.22em] text-leiser">preroll</div>
        <h1 className="mt-4 text-[22px] font-semibold">Dieser Link ist abgelaufen</h1>
        <p className="mt-2 text-[13.5px] leading-relaxed text-leise">
          Der Freigabe-Zeitraum für {exp.kunde.name} ist beendet. Bitte wenden Sie sich an Ihre
          Ansprechpartnerin oder Ihren Ansprechpartner für einen aktuellen Link.
        </p>
      </main>
    )
  }

  // Ein Freigabe-Link öffnet sich nie ohne Anmeldung. Die Sitzung gilt
  // 40 Tage — danach genügt der Link wieder allein.
  const gast = await aktuellerGast()
  if (!gast || !gast.name.trim()) redirect(`/f/${token}/anmelden`)

  const einstellungen = await ladeEinstellungen()

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

  const regeln = {
    zeitraumVon: exp.zeitraumVon,
    zeitraumBis: exp.zeitraumBis,
    konzepteMitzeigen: exp.konzepteMitzeigen,
  }
  const sektionen = postsImZeitraum(alle, regeln)
  const kacheln = feedVorschau(alle, regeln)

  // Aufruf zählen, ohne die Antwort zu blockieren.
  void prisma.export
    .update({
      where: { id: exp.id },
      data: { aufrufe: { increment: 1 }, zuletztGeoeffnet: new Date() },
    })
    .catch(() => {})

  void prisma.exportGast
    .upsert({
      where: { exportId_gastId: { exportId: exp.id, gastId: gast.id } },
      update: { zuletztGeoeffnetAm: new Date() },
      create: { exportId: exp.id, gastId: gast.id, zuletztGeoeffnetAm: new Date() },
    })
    .catch(() => {})

  const kalendereintraege: Kalendereintrag[] = sektionen.map((p) => ({
    id: p.id,
    typ: p.typ,
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

  const fortschritt = freigabeFortschritt(sektionen)
  const freigabeleiste = (
    <Freigabefortschritt erledigt={fortschritt.erledigt} gesamt={fortschritt.gesamt} />
  )

  return (
    <div className="min-h-screen">
      <ExportTopbar
        kunde={exp.kunde.name}
        logo={thumbUrl(exp.kunde.logoId)}
        titel={exp.titel ?? `Content-Plan ${zeitraum}`}
        aktion={freigabeleiste}
      />

      <ExportHero
        titel="Content-Plan"
        zeitraum={zeitraum}
        einleitung={
          `Hier sehen Sie alle geplanten Beiträge für ${zeitraum} — so, wie sie später auf ` +
          'Instagram erscheinen. Über den Kalender springen Sie direkt zum Beitrag. Ihre ' +
          'Ihre Kommentare schreiben Sie direkt neben dem Beitrag — wir sehen sie sofort.'
        }
        eckdaten={[
          { t: 'Beiträge', w: `${sektionen.length} · ${kwSpanne}` },
          { t: 'Kanal', w: 'Instagram' },
          ...(einstellungen.agenturName ? [{ t: 'Agentur', w: einstellungen.agenturName }] : []),
          ...(exp.gueltigBis ? [{ t: 'Rückmeldung bis', w: formatiereTag(exp.gueltigBis) }] : []),
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
          <IPhoneFeed
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

          return (
            <PostSektion
              key={post.id}
              post={post}
              kunde={exp.kunde.name}
              logo={thumbUrl(exp.kunde.logoId)}
              medien={
                post.typ === 'KARUSSELL' ? slides : medium ? [medienUrl(medium.medium.id)!] : []
              }
              istVideo={medium?.medium.mimeTyp.startsWith('video/') ?? false}
              szenen={post.szenen}
              referenzVideoUrl={
                post.referenzVideoMediumId
                  ? medienUrl(post.referenzVideoMediumId)
                  : post.referenzVideoUrl
              }
              referenzVideoTitel={post.referenzVideoTitel}
              klappeVideoUrl={post.klappeVersionId ? `/api/klappe/${post.klappeVersionId}` : null}
              kommentare={
                <>
                  <PostFreigabe
                    token={token}
                    postId={post.id}
                    erlaubt={exp.freigabenErlaubt}
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
                    gastName={gast.name}
                  />
                  <KommentarBereich
                  token={token}
                  postId={post.id}
                  erlaubt={exp.kommentareErlaubt}
                  gastName={gast.name}
                  kommentare={exp.kommentare
                    .filter((k) => k.postId === post.id)
                    .map((k) => ({
                      id: k.id,
                      autorName: k.autorName,
                      text: k.text,
                      am: k.erstelltAm.toISOString(),
                      vomTeam: Boolean(k.nutzerId),
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
  )
}
