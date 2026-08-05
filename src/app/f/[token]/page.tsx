import { notFound, redirect } from 'next/navigation'
import { POST_MEDIEN, rasterMedium } from '@/lib/abfragen'
import { aktuellerGast } from '@/lib/auth'
import { zeitraumText } from '@/lib/benachrichtigungen'
import { prisma } from '@/lib/db'
import { formatiereTag } from '@/lib/datum'
import { feedVorschau, istAbgelaufen, postsImZeitraum } from '@/lib/export-sicht'
import { kalenderwoche } from '@/lib/format'
import { medienUrl, thumbUrl } from '@/lib/urls'
import { FeedRaster, ProfilKopf, type FeedKachel } from '@/components/feed'
import { IPhoneVorschau } from '@/components/iphone'
import { Monatskalender, monateImZeitraum, type Kalendereintrag } from '@/components/kalender'
import { Freigabeleiste, KommentarBereich } from './interaktion'

export const dynamic = 'force-dynamic'

const DATUM_LANG = new Intl.DateTimeFormat('de-DE', {
  weekday: 'long',
  day: '2-digit',
  month: 'long',
  year: 'numeric',
})
const UHRZEIT = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' })

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
      kunde: { include: { logo: true } },
      ansprechpartner: { include: { foto: true } },
      freigaben: { orderBy: { erstelltAm: 'desc' } },
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

  const gast = await aktuellerGast()
  if (exp.loginPflicht && !gast) redirect(`/f/${token}/anmelden`)

  // Live-Sicht: bei jedem Aufruf frisch aus der Datenbank, kein Schnappschuss.
  const alle = await prisma.post.findMany({
    where: { kundeId: exp.kundeId },
    orderBy: { postenAm: 'asc' },
    include: { medien: POST_MEDIEN, szenen: { orderBy: { position: 'asc' } } },
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

  if (gast) {
    void prisma.exportGast
      .updateMany({
        where: { exportId: exp.id, gastId: gast.id },
        data: { zuletztGeoeffnetAm: new Date() },
      })
      .catch(() => {})
  }

  const kalendereintraege: Kalendereintrag[] = sektionen.map((p) => ({
    id: p.id,
    typ: p.typ,
    titel: p.titel,
    postenAm: p.postenAm,
    href: `#post-${p.id}`,
  }))

  const feedKacheln: FeedKachel[] = kacheln.map((p) => ({
    id: p.id,
    typ: p.typ,
    status: p.status,
    titel: p.titel,
    bild: thumbUrl(rasterMedium(p)),
  }))

  const zeitraum = zeitraumText(exp.zeitraumVon, exp.zeitraumBis)
  const kontakt = exp.ansprechpartner
  const freigabe = exp.freigaben[0] ?? null

  return (
    <div className="min-h-screen">
      {/* ------------------------------------------------------------- Kopf */}
      <header className="border-b border-rahmen bg-flaeche">
        <div className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-4 px-6 py-4 md:px-10">
          <div className="flex items-center gap-3.5">
            {exp.kunde.logoId ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={thumbUrl(exp.kunde.logoId)!}
                alt=""
                className="size-10 rounded-full object-cover"
              />
            ) : (
              <span className="schraffur size-10 rounded-full border border-dashed border-rahmen-3" />
            )}
            <div>
              <div className="text-[15px] font-semibold leading-tight">{exp.kunde.name}</div>
              <div className="text-[11.5px] text-leiser">{exp.titel ?? `Content-Plan ${zeitraum}`}</div>
            </div>
          </div>

          <Freigabeleiste
            token={token}
            zeigen={exp.freigabeButtonZeigen}
            freigegeben={
              freigabe ? { autorName: freigabe.autorName, am: freigabe.erstelltAm.toISOString() } : null
            }
            gastName={gast?.name ?? null}
          />
        </div>
      </header>

      <main className="mx-auto max-w-[1180px] px-6 py-10 md:px-10">
        {/* ------------------------------------------------------ Eckdaten */}
        <div className="mb-10">
          <p className="text-[11px] uppercase tracking-[0.22em] text-leiser">
            Content-Plan zur Freigabe
          </p>
          <h1 className="mt-3 text-[30px] font-semibold tracking-[-0.02em] md:text-[34px]">
            {exp.titel ?? zeitraum}
          </h1>

          <dl className="mt-6 flex flex-wrap gap-x-10 gap-y-4">
            {[
              {
                t: 'Beiträge',
                w: `${sektionen.length} · KW ${
                  sektionen.length
                    ? `${kalenderwoche(sektionen[0].postenAm)}–${kalenderwoche(sektionen.at(-1)!.postenAm)}`
                    : '—'
                }`,
              },
              { t: 'Kanal', w: 'Instagram' },
              { t: 'Zeitraum', w: zeitraum },
              ...(exp.gueltigBis
                ? [
                    {
                      t: 'Rückmeldung bis',
                      w: formatiereTag(exp.gueltigBis),
                    },
                  ]
                : []),
            ].map((eintrag) => (
              <div key={eintrag.t}>
                <dt className="text-[10.5px] uppercase tracking-[0.1em] text-still">{eintrag.t}</dt>
                <dd className="mt-1 text-[13.5px] text-tinte-3">{eintrag.w}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* ------------------------------------ Kalender + Feed nebeneinander */}
        <div className="mb-14 flex flex-col gap-8 lg:flex-row lg:items-start">
          <div className="min-w-0 flex-1">
            <div className="grid gap-8">
              {monateImZeitraum(exp.zeitraumVon, exp.zeitraumBis).map((monat) => (
                <Monatskalender
                  key={monat.toISOString()}
                  monat={monat}
                  eintraege={kalendereintraege}
                />
              ))}
            </div>
          </div>

          <aside className="w-full shrink-0 lg:w-[340px]">
            <h3 className="mb-3 text-[15px] font-semibold">So wird Ihr Profil aussehen</h3>
            <div className="rounded-md border border-rahmen bg-flaeche p-4">
              <ProfilKopf
                name={exp.kunde.name}
                handle={exp.kunde.handle}
                logo={thumbUrl(exp.kunde.logoId)}
                beitraege={exp.kunde.beitraege}
                follower={exp.kunde.follower}
                gefolgt={exp.kunde.gefolgt}
                bio={exp.kunde.bio}
              />
              <div className="border-t border-rahmen pt-3">
                <FeedRaster kacheln={feedKacheln} />
              </div>
            </div>
            <p className="mt-2.5 text-[11.5px] leading-relaxed text-stiller">
              Die Vorschau enthält bereits veröffentlichte Beiträge und die geplanten dieses
              Zeitraums.
            </p>
          </aside>
        </div>

        {/* ----------------------------------------------------- Post-Sektionen */}
        <div className="grid gap-16">
          {sektionen.map((post) => {
            const slides = post.medien
              .filter((m) => m.rolle === 'SLIDE')
              .sort((a, b) => a.position - b.position)
              .map((m) => medienUrl(m.medium.id)!)
            const medium = post.medien.find((m) => m.rolle === 'MEDIUM')

            const medien =
              post.typ === 'KARUSSELL' ? slides : medium ? [medienUrl(medium.medium.id)!] : []

            return (
              <section key={post.id} id={`post-${post.id}`} className="scroll-mt-24">
                <div className="mb-5 border-b border-rahmen pb-3">
                  <div className="flex flex-wrap items-baseline gap-3">
                    <span className="font-mono text-[11.5px] text-still">
                      KW {kalenderwoche(post.postenAm)}
                    </span>
                    <h2 className="text-[19px] font-semibold tracking-[-0.01em]">{post.titel}</h2>
                  </div>
                  <p className="mt-1 text-[12.5px] capitalize text-leiser">
                    {DATUM_LANG.format(post.postenAm)} · {UHRZEIT.format(post.postenAm)} Uhr
                  </p>
                </div>

                <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
                  <div className="shrink-0">
                    <IPhoneVorschau
                      typ={post.typ}
                      kunde={exp.kunde.name}
                      logo={thumbUrl(exp.kunde.logoId)}
                      medien={medien}
                      caption={post.caption}
                      istVideo={medium?.medium.mimeTyp.startsWith('video/')}
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    {post.kurzbeschreibung && (
                      <p className="mb-5 text-[14px] leading-relaxed text-tinte-3">
                        {post.kurzbeschreibung}
                      </p>
                    )}

                    {/* Reel: Szenenplan oder freies Inhalte-Feld */}
                    {post.typ === 'REEL' &&
                      (post.szenenplanAktiv && post.szenen.length > 0 ? (
                        <div className="mb-6 overflow-hidden rounded-md border border-rahmen bg-flaeche">
                          <div className="grid grid-cols-[92px_1fr_1fr_1fr] gap-3 border-b border-rahmen bg-flaeche-leise px-4 py-2 text-[10px] font-medium uppercase tracking-[0.08em] text-still">
                            <span>Abschnitt</span>
                            <span>Bild / Szene</span>
                            <span>Sprechertext</span>
                            <span>Texteinblendung</span>
                          </div>
                          {post.szenen.map((szene) => (
                            <div
                              key={szene.id}
                              className="grid grid-cols-[92px_1fr_1fr_1fr] gap-3 border-b border-rahmen px-4 py-3 text-[12px] leading-relaxed last:border-b-0"
                            >
                              <span className="font-medium text-tinte-3">{szene.abschnitt}</span>
                              <span className="text-leise">{szene.bildSzene ?? '—'}</span>
                              <span className="text-leise">{szene.sprechertext ?? '—'}</span>
                              <span className="text-leise">{szene.texteinblendung ?? '—'}</span>
                            </div>
                          ))}
                        </div>
                      ) : post.inhalte ? (
                        <div className="mb-6 rounded-md border border-rahmen bg-flaeche p-4">
                          <h4 className="mb-1.5 text-[10.5px] uppercase tracking-[0.1em] text-still">
                            Inhalte
                          </h4>
                          <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-leise">
                            {post.inhalte}
                          </p>
                        </div>
                      ) : null)}

                    <div className="mb-6 rounded-md border border-rahmen bg-flaeche p-4">
                      <h4 className="mb-1.5 text-[10.5px] uppercase tracking-[0.1em] text-still">
                        Caption
                      </h4>
                      <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-leise">
                        {post.caption || '—'}
                      </p>
                    </div>

                    <KommentarBereich
                      token={token}
                      postId={post.id}
                      erlaubt={exp.kommentareErlaubt}
                      gastName={gast?.name ?? null}
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
                  </div>
                </div>
              </section>
            )
          })}
        </div>

        {sektionen.length === 0 && (
          <div className="rounded-md border border-dashed border-rahmen-3 bg-flaeche-leise px-6 py-14 text-center">
            <p className="text-[13.5px] font-medium text-tinte-3">
              Für diesen Zeitraum ist noch nichts zur Freigabe bereit.
            </p>
            <p className="mt-1.5 text-[12.5px] text-leiser">
              Sobald die Beiträge fertig sind, erscheinen sie automatisch hier.
            </p>
          </div>
        )}
      </main>

      {/* ------------------------------------------------------------- Fuß */}
      {kontakt && (
        <footer className="mt-16 border-t border-rahmen bg-flaeche">
          <div className="mx-auto max-w-[1180px] px-6 py-10 md:px-10">
            <h3 className="mb-5 text-[10.5px] uppercase tracking-[0.1em] text-still">
              Ihre Ansprechpartnerin
            </h3>
            <div className="flex flex-wrap items-start gap-6">
              {kontakt.fotoId ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={thumbUrl(kontakt.fotoId)!}
                  alt=""
                  className="size-20 rounded-full object-cover"
                />
              ) : (
                <span className="schraffur size-20 rounded-full border border-dashed border-rahmen-3" />
              )}

              <div className="min-w-[180px]">
                <div className="text-[15px] font-semibold">{kontakt.name}</div>
                {kontakt.rolle && <div className="text-[12.5px] text-leiser">{kontakt.rolle}</div>}
              </div>

              <dl className="flex flex-wrap gap-x-10 gap-y-4">
                {[
                  { t: 'Telefon', w: kontakt.telefon },
                  { t: 'E-Mail', w: kontakt.email },
                  { t: 'Adresse', w: kontakt.adresse },
                  { t: 'Web', w: kontakt.website },
                ]
                  .filter((e) => e.w)
                  .map((eintrag) => (
                    <div key={eintrag.t}>
                      <dt className="text-[10.5px] uppercase tracking-[0.1em] text-still">
                        {eintrag.t}
                      </dt>
                      <dd className="mt-1 text-[13px] text-tinte-3">{eintrag.w}</dd>
                    </div>
                  ))}
              </dl>
            </div>
          </div>
        </footer>
      )}
    </div>
  )
}
