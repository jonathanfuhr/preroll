import type { Plattform, PostStatus, PostTyp, Verhaeltnis } from '@prisma/client'
import { Fragment, type ReactNode } from 'react'
import { kalenderwoche } from '@/lib/format'
import { formatiereTermin } from '@/lib/datum'
import { postBeschriftung, postBezeichnung } from '@/lib/verhaeltnis'
import { abgeleiteteStufe } from '@/lib/status'
import { IPhoneVorschau } from './iphone'
import { LinkedInRahmen } from './linkedin-rahmen'
import { TikTokRahmen } from './tiktok-rahmen'
import type { AnzeigeFassung } from './weitere-fassung'
import { PlattformMarken } from './plattform-marken'
import { StatusLeiste } from './status-leiste'
import { VorschauWahl, type Vorschauart } from './vorschau-wahl'

/**
 * Eine Post-Sektion auf der Export-Seite — nachgebaut aus Mockup 1a
 * (Desktop) und 1b (Mobil).
 *
 * Desktop: Gerät links, Text in der Mitte, Kommentare rechts.
 * Mobil: alles untereinander, Szenen gestapelt statt zweispaltig.
 */

// Zone ausdrücklich — siehe `datum.ts`. Der Kunde soll die Uhrzeit der
// Agentur lesen, nicht die seines Laptops.
const DATUM: Intl.DateTimeFormatOptions = {
  weekday: 'short',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
}
const UHRZEIT: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' }

const TYP_TEXT: Record<PostTyp, string> = {
  REEL: 'Reel',
  KARUSSELL: 'Karussell',
  BEITRAG: 'Beitrag',
}

const STATUS_TEXT: Record<PostStatus, string> = {
  ENTWURF: 'Entwurf',
  KONZEPT: 'Konzept',
  PRODUKTION: 'Produktion',
  VORSCHAU: 'Vorschau',
  KORREKTUR: 'Korrektur',
  FINAL: 'Final',
}

const STATUS_STIL: Record<PostStatus, { flaeche: string; farbe: string }> = {
  // Ein Entwurf erreicht den Kunden nie — der Eintrag ist reine Formsache.
  ENTWURF: { flaeche: 'var(--color-flaeche-tief)', farbe: 'var(--color-still)' },
  KONZEPT: { flaeche: 'var(--color-konzept-flaeche)', farbe: 'var(--color-konzept)' },
  PRODUKTION: { flaeche: 'var(--color-arbeit-flaeche)', farbe: 'var(--color-arbeit)' },
  VORSCHAU: { flaeche: 'var(--color-vorschau-flaeche)', farbe: 'var(--color-vorschau)' },
  KORREKTUR: { flaeche: 'var(--color-arbeit-flaeche)', farbe: 'var(--color-arbeit)' },
  FINAL: { flaeche: 'var(--color-final-flaeche)', farbe: 'var(--color-final)' },
}

/**
 * Trennt die Hashtags vom Fließtext — im Mockup stehen sie als eigener,
 * leiserer Absatz unter der Caption.
 */
export function teileCaption(caption: string): { text: string; hashtags: string } {
  const zeilen = caption.split('\n')

  // Von hinten alle Zeilen einsammeln, die nur aus Hashtags bestehen.
  let grenze = zeilen.length
  for (let i = zeilen.length - 1; i >= 0; i--) {
    const zeile = zeilen[i].trim()
    if (zeile === '') continue
    if (/^#[^\s#]+(\s+#[^\s#]+)*$/.test(zeile)) {
      grenze = i
      continue
    }
    break
  }

  return {
    text: zeilen.slice(0, grenze).join('\n').trim(),
    hashtags: zeilen.slice(grenze).join(' ').trim(),
  }
}

export type SzenenZeile = {
  id: string
  abschnitt: string
  bildSzene: string | null
  sprechertext: string | null
  texteinblendung: string | null
}

function Eckdaten({ eintraege }: { eintraege: Array<{ t: string; w: string }> }) {
  if (eintraege.length === 0) return null
  return (
    <div className="mt-8 grid grid-cols-2 gap-5 border-t border-rahmen pt-6 sm:grid-cols-3 sm:gap-[22px]">
      {eintraege.map((e) => (
        <div key={e.t}>
          <div className="mb-1.5 text-[11px] uppercase tracking-[0.1em] text-still">{e.t}</div>
          <div className="text-[13.5px] text-tinte-2">{e.w}</div>
        </div>
      ))}
    </div>
  )
}

function Ablauf({ szenen, laenge }: { szenen: SzenenZeile[]; laenge: string | null }) {
  return (
    <div className="mt-6 overflow-hidden rounded-lg border border-rahmen sm:mt-[34px]">
      <div className="flex items-center justify-between gap-3 border-b border-rahmen bg-flaeche-leise px-4 py-3 sm:px-5 sm:py-[15px]">
        <span className="text-[10.5px] uppercase tracking-[0.14em] text-leiser sm:text-[11px]">
          Ablauf des Reels
        </span>
        <span className="text-[11px] text-[#928e89] sm:text-[11.5px]">
          {szenen.length} {szenen.length === 1 ? 'Abschnitt' : 'Abschnitte'}
          {laenge && <span className="hidden sm:inline"> · {laenge}</span>}
        </span>
      </div>

      <div className="px-4 py-4 sm:px-5 sm:pb-[18px] sm:pt-5">
        {szenen.map((szene, index) => (
          <div
            key={szene.id}
            className="border-b border-flaeche-tief pb-4 last:mb-0 last:border-b-0 last:pb-0 sm:grid sm:grid-cols-[110px_minmax(0,1fr)] sm:gap-[18px] sm:pb-[18px] [&:not(:last-child)]:mb-4 sm:[&:not(:last-child)]:mb-[18px]"
          >
            <div className="mb-2 flex items-center gap-[9px] sm:mb-0 sm:items-start">
              <span
                className="flex size-[21px] shrink-0 items-center justify-center rounded-full text-[10.5px] font-semibold"
                style={
                  index === 0
                    ? { background: 'var(--color-akzent)', color: '#fff' }
                    : { background: '#f0eeeb', color: 'var(--color-tinte-3)' }
                }
              >
                {index + 1}
              </span>
              <span className="text-[12px] font-medium sm:pt-[3px]">{szene.abschnitt}</span>
            </div>

            <div>
              {szene.bildSzene && (
                <div className="text-[13px] leading-relaxed text-[#2e2b28]">{szene.bildSzene}</div>
              )}
              {szene.sprechertext && (
                <div className="mt-1.5 text-[12.5px] leading-relaxed text-leise">
                  {szene.sprechertext}
                </div>
              )}
              {szene.texteinblendung && (
                <span className="mt-2.5 inline-block rounded-[3px] bg-[#f4f3f1] px-2.5 py-1 text-[11px] text-tinte-3">
                  Einblendung: {szene.texteinblendung}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function PostSektion({
  post,
  plattformen,
  kunde,
  logo,
  medien,
  thumbnail,
  mitFreigaben = true,
  istVideo,
  szenen,
  kommentare,
  liFollower = null,
  tiktokHandle = null,
  fassungen = [],
}: {
  post: {
    id: string
    typ: PostTyp
    status: PostStatus
    titel: string
    postenAm: Date
    kurzbeschreibung: string | null
    caption: string
    laenge: string | null
    ziel: string | null
    stil: string | null
    inhalte: string | null
    szenenplanAktiv: boolean
    verhaeltnis: Verhaeltnis
  }
  /**
   * Wohin der Beitrag geht. Einfarbig neben der Typbezeichnung — die Seite
   * trägt die Marke des Kunden, nicht die von Meta.
   *
   * Steht **neben** dem Beitrag und nicht in ihm, weil es nicht allein an
   * ihm hängt: Ohne zugeordneten Kanal beim Kunden erscheint keine Marke.
   * Die Rechnung macht `angezeigtePlattformen`, nicht diese Anzeige.
   */
  plattformen: Plattform[]
  kunde: string
  logo: string | null
  medien: string[]
  /** Aus bei eigenen Kanälen — dann fehlt in den Erklärungen der Satz zur Freigabe. */
  mitFreigaben?: boolean
  /** Reel-Thumbnail — steht vor dem Video, solange nichts läuft. */
  thumbnail?: string | null
  istVideo: boolean
  szenen: SzenenZeile[]
  kommentare: ReactNode
  /**
   * Follower der LinkedIn-Firmenseite — steht in deren Vorschau unter dem
   * Namen. Nur nötig, wenn der Beitrag dorthin geht.
   */
  liFollower?: number | null
  /** Das TikTok-Handle — steht in dessen Rahmen über der Caption. */
  tiktokHandle?: string | null
  /**
   * Abweichende Fassungen — Caption oder Medien je Plattform. Das Hauptformat
   * steht darüber; hier stehen nur die Abweichungen davon.
   */
  fassungen?: AnzeigeFassung[]
}) {
  const { text, hashtags } = teileCaption(post.caption)
  const status = STATUS_STIL[post.status]

  const eckdaten = [
    {
      t: 'Format',
      w: postBeschriftung(post.typ, post.verhaeltnis),
    },
    ...(post.laenge ? [{ t: 'Länge', w: post.laenge }] : []),
    ...(post.ziel ? [{ t: 'Ziel', w: post.ziel }] : []),
    ...(post.stil ? [{ t: 'Stil', w: post.stil }] : []),
  ]

  const mitSzenen = post.typ === 'REEL' && post.szenenplanAktiv && szenen.length > 0

  /*
    Was auf LinkedIn steht — die Fassung dafür, sonst der Beitrag selbst.

    Eine Fassung, die LinkedIn abdeckt, taucht **nur** neben ihrem Rahmen auf
    und nicht noch einmal darunter: Ihr Kopf nennt ohnehin alle Plattformen,
    für die sie gilt, und derselbe Text zweimal liest sich wie ein
    Unterschied, wo keiner ist.
  */
  const liFassung = fassungen.find((f) => f.plattformen.includes('LINKEDIN')) ?? null
  const ohneRahmen = fassungen.filter((f) => f !== liFassung)

  const linkedIn = plattformen.includes('LINKEDIN')
    ? {
        caption: liFassung?.caption ?? post.caption,
        medien: liFassung?.medien ?? medien,
        istVideo: liFassung?.istVideo ?? istVideo,
        thumbnail: liFassung?.thumbnail ?? thumbnail ?? null,
        verhaeltnis: liFassung?.verhaeltnis ?? post.verhaeltnis,
        fassung: liFassung,
      }
    : null

  /*
    Ein Beitrag, aber unter Umständen mehrere Inhalte: das Hauptformat und je
    Fassung einer. Jeder bekommt eine eigene Zeile — links die Vorschau, rechts
    daneben sein Text. Zusammengelegt stünde die abweichende Caption unter
    einem Bild, das sie gar nicht meint.

    Der **erste** Block trägt zusätzlich, was für den ganzen Beitrag gilt:
    Eckdaten, alle Slides, Ablauf oder Inhalte.
  */
  const belegt = new Set(fassungen.flatMap((f) => f.plattformen))
  const bloecke = [
    {
      schluessel: 'haupt',
      plattformen: plattformen.filter((p) => !belegt.has(p)),
      caption: post.caption,
      verhaeltnis: post.verhaeltnis,
      medien,
      istVideo,
      thumbnail: thumbnail ?? null,
      fassung: null as AnzeigeFassung | null,
    },
    ...fassungen.map((f) => ({
      schluessel: f.plattformen.join('-'),
      plattformen: f.plattformen,
      caption: f.caption,
      verhaeltnis: f.verhaeltnis,
      medien: f.medien,
      istVideo: f.istVideo,
      thumbnail: f.thumbnail,
      fassung: f,
    })),
    // Ein Hauptformat ohne eigene Plattform ist keine Zeile wert: Dann nimmt
    // jede Plattform eine Fassung, und der Beitrag selbst erscheint nirgends.
  ].filter((b) => b.plattformen.length > 0)

  return (
    <section id={`post-${post.id}`} className="scroll-mt-20 border-t border-rahmen px-0 py-10 sm:py-14">
      {/* ---------------------------------------------------------- Kopfzeile */}
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4 sm:mb-8">
        <div className="flex items-baseline gap-3 sm:gap-3.5">
          <span className="text-[22px] font-bold tracking-[-0.02em] sm:text-[30px]">KW</span>
          <span
            className="font-serif text-[32px] leading-none text-akzent sm:text-[42px]"
            style={{ fontFamily: 'var(--font-serif)' }}
          >
            {kalenderwoche(post.postenAm)}
          </span>
          <span className="pb-1 text-[13px] text-[#77746f] sm:text-[14px]">
            {postBezeichnung(post.typ, post.verhaeltnis)}
          </span>
        </div>

        {/*
          Termin und Stand stehen hier nur, solange es keine dritte Spalte
          gibt. Ab `xl` laufen sie im rechten Block mit — dort gehören sie
          hin, weil sie mit Freigabe und Kommentaren eine Sache sind. Sie
          unten anzuhängen wäre am Telefon die schlechtere Wahl: Wer wissen
          will, wann etwas rausgeht, soll dafür nicht an zwei Vorschauen
          vorbeirollen.
        */}
        <div className="flex w-full flex-wrap items-end gap-x-6 gap-y-4 sm:w-auto xl:hidden">
          <span className="text-[12.5px] text-[#77746f] sm:text-[13px]">
            {formatiereTermin(post.postenAm, DATUM)} · {formatiereTermin(post.postenAm, UHRZEIT)}
          </span>
          <StatusLeiste
            stufe={abgeleiteteStufe(post.status, post.postenAm)}
            mitFreigaben={mitFreigaben}
          />
        </div>
      </div>

      {/* ------------------------------------------------------------ Inhalt */}
      {/*
        Zwei Raster ineinander, nicht eines mit drei Spalten: Der rechte Block
        soll über **alle** Zeilen kleben, und `grid-row: 1/-1` spannt nur über
        explizite Zeilen — die entstehen hier aber erst mit den Fassungen.
      */}
      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_300px] xl:gap-12">
        <div className="grid items-start gap-8 lg:grid-cols-[344px_minmax(0,1fr)] lg:gap-12">
          {bloecke.map((block, i) => (
            <Fragment key={block.schluessel}>
              <div className="lg:col-start-1">
                <VorschauWahl
                  arten={vorschauarten({
                    plattformen: block.plattformen,
                    kunde,
                    logo,
                    liFollower,
                    tiktokHandle,
                    typ: post.typ,
                    caption: block.caption,
                    verhaeltnis: block.verhaeltnis,
                    medien: block.medien,
                    istVideo: block.istVideo,
                    thumbnail: block.thumbnail,
                  })}
                />
              </div>

              <div className="min-w-0 lg:col-start-2">
                {/* Die Marken sagen, wovon dieser Block handelt. Steht nur
                    eine Plattform da, ist das die Auskunft — bei mehreren
                    kommt der Umschalter links dazu. */}
                <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <PlattformMarken
                    plattformen={block.plattformen}
                    groesse={16}
                    klasse="text-[#9a9691]"
                  />
                  {block.fassung && block.fassung.handles.length > 0 && (
                    <span className="text-[12px] text-leiser">
                      {block.fassung.handles.join(' · ')}
                    </span>
                  )}
                </div>

                <div className="mb-3 text-[10.5px] uppercase tracking-[0.14em] text-still sm:mb-3.5 sm:text-[11px]">
                  Caption
                </div>
                <Captiontext text={block.caption} />

                <Eckdaten
                  eintraege={
                    i === 0
                      ? eckdaten
                      : [{ t: 'Format', w: postBeschriftung(post.typ, block.verhaeltnis) }]
                  }
                />

                {i === 0 && (
                  <>
                    {/*
                      Alle Slides in Reihe. Im Geräterahmen sieht man immer nur
                      einen — hier fällt auf, ob der Beitrag als Ganzes
                      zusammenpasst. Die 1-px-Fugen lassen die Kanten erkennbar.
                    */}
                    {post.typ === 'KARUSSELL' && medien.length > 1 && (
                      <div className="mt-6 sm:mt-[34px]">
                        <div className="mb-3 text-[10.5px] uppercase tracking-[0.14em] text-still sm:text-[11px]">
                          Alle Slides
                        </div>
                        <div className="flex max-w-[600px] gap-px overflow-hidden rounded-[3px] bg-rahmen-3">
                          {medien.map((bild, n) => (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              key={bild}
                              src={bild}
                              alt={`Slide ${n + 1}`}
                              className="min-w-0 flex-1 object-cover"
                              style={{ aspectRatio: '3 / 4' }}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {mitSzenen ? (
                      <Ablauf szenen={szenen} laenge={post.laenge} />
                    ) : (
                      (post.inhalte || post.kurzbeschreibung) && (
                        <div className="mt-6 overflow-hidden rounded-lg border border-rahmen sm:mt-[34px]">
                          <div className="flex items-center justify-between gap-3 border-b border-rahmen bg-flaeche-leise px-4 py-3 sm:px-5 sm:py-[15px]">
                            <span className="text-[10.5px] uppercase tracking-[0.14em] text-leiser sm:text-[11px]">
                              {post.typ === 'REEL' ? 'Inhalte des Reels' : 'Zum Beitrag'}
                            </span>
                            {post.laenge && (
                              <span className="text-[11px] text-[#928e89] sm:text-[11.5px]">
                                {post.laenge}
                              </span>
                            )}
                          </div>
                          <div className="px-4 py-4 sm:px-5 sm:py-5">
                            <p className="whitespace-pre-line text-[13px] leading-relaxed text-[#2e2b28]">
                              {post.inhalte ?? post.kurzbeschreibung}
                            </p>
                          </div>
                        </div>
                      )
                    )}
                  </>
                )}
              </div>
            </Fragment>
          ))}
        </div>

        {/*
          Termin, Stand, Freigabe und Kommentare in einem Block — und der klebt
          oben, solange man in diesem Beitrag ist. Mit mehreren Fassungen wird
          ein Beitrag zwei Bildschirme hoch; wer unten etwas sieht, will es dort
          freigeben und kommentieren, nicht nach oben zurückrollen. Beim
          nächsten Beitrag hört er auf — er gehört zu diesem.
        */}
        <div className="min-w-0">
          <div className="grid gap-5 xl:sticky xl:top-24">
            <div className="hidden gap-4 xl:grid">
              <span className="text-[13px] text-[#77746f]">
                {formatiereTermin(post.postenAm, DATUM)} · {formatiereTermin(post.postenAm, UHRZEIT)}
              </span>
              {/* Ein Etikett sagt nur, wo etwas steht — nicht, was noch kommt. */}
              <StatusLeiste
                stufe={abgeleiteteStufe(post.status, post.postenAm)}
                mitFreigaben={mitFreigaben}
              />
            </div>
            {kommentare}
          </div>
        </div>
      </div>
    </section>
  )
}

/** Caption und Hashtags — zweimal gebraucht, einmal geschrieben. */
function Captiontext({ text: roh }: { text: string }) {
  const { text, hashtags } = teileCaption(roh)
  return (
    <>
      <p className="max-w-[600px] whitespace-pre-line text-[13.5px] leading-[1.7] text-[#2e2b28] sm:text-[14.5px] sm:leading-[1.75]">
        {text || '—'}
      </p>
      {hashtags && (
        <p className="mt-3.5 max-w-[600px] text-[12.5px] leading-[1.65] text-leise sm:mt-[18px] sm:text-[13.5px] sm:leading-[1.7]">
          {hashtags}
        </p>
      )}
    </>
  )
}

/**
 * Welche Vorschauen ein Block anbietet.
 *
 * Instagram und Facebook teilen sich den Geräterahmen — für Facebook ist kein
 * eigenes Fenster gezeichnet, und zwei gleich aussehende Ansichten wären eine
 * Wahl ohne Unterschied. LinkedIn hat sein eigenes.
 */
function vorschauarten({
  plattformen,
  kunde,
  logo,
  liFollower,
  tiktokHandle,
  typ,
  caption,
  verhaeltnis,
  medien,
  istVideo,
  thumbnail,
}: {
  plattformen: Plattform[]
  kunde: string
  logo: string | null
  liFollower: number | null
  tiktokHandle: string | null
  typ: PostTyp
  caption: string
  verhaeltnis: Verhaeltnis
  medien: string[]
  istVideo: boolean
  thumbnail: string | null
}): Vorschauart[] {
  const arten: Vorschauart[] = []
  const imGeraet = plattformen.filter((p) => p === 'INSTAGRAM' || p === 'FACEBOOK')

  if (imGeraet.length > 0) {
    arten.push({
      plattform: imGeraet.includes('INSTAGRAM') ? 'INSTAGRAM' : 'FACEBOOK',
      inhalt: (
        <IPhoneVorschau
          typ={typ}
          kunde={kunde}
          logo={logo}
          medien={medien}
          caption={caption}
          verhaeltnis={verhaeltnis}
          istVideo={istVideo}
          thumbnail={thumbnail}
        />
      ),
    })
  }

  if (plattformen.includes('TIKTOK')) {
    arten.push({
      plattform: 'TIKTOK',
      inhalt: (
        <TikTokRahmen
          kunde={kunde}
          handle={tiktokHandle}
          logo={logo}
          text={caption}
          medien={medien}
          istVideo={istVideo}
          thumbnail={thumbnail}
          verhaeltnis={verhaeltnis}
          typ={typ}
        />
      ),
    })
  }

  if (plattformen.includes('LINKEDIN')) {
    arten.push({
      plattform: 'LINKEDIN',
      inhalt: (
        <LinkedInRahmen
          kunde={kunde}
          logo={logo}
          follower={liFollower}
          text={caption}
          medien={medien}
          istVideo={istVideo}
          thumbnail={thumbnail}
          verhaeltnis={verhaeltnis}
          typ={typ}
        />
      ),
    })
  }

  return arten
}
