import type { Plattform, PostStatus, PostTyp, Verhaeltnis } from '@prisma/client'
import type { ReactNode } from 'react'
import { kalenderwoche } from '@/lib/format'
import { postBeschriftung, postBezeichnung } from '@/lib/verhaeltnis'
import { abgeleiteteStufe } from '@/lib/status'
import { IPhoneVorschau } from './iphone'
import { PlattformMarken } from './plattform-marken'
import { StatusLeiste } from './status-leiste'

/**
 * Eine Post-Sektion auf der Export-Seite — nachgebaut aus Mockup 1a
 * (Desktop) und 1b (Mobil).
 *
 * Desktop: Gerät links, Text in der Mitte, Kommentare rechts.
 * Mobil: alles untereinander, Szenen gestapelt statt zweispaltig.
 */

const DATUM = new Intl.DateTimeFormat('de-DE', {
  weekday: 'short',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})
const UHRZEIT = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' })

const TYP_TEXT: Record<PostTyp, string> = {
  REEL: 'Reel',
  KARUSSELL: 'Karussell',
  BEITRAG: 'Beitrag',
}

const STATUS_TEXT: Record<PostStatus, string> = {
  ENTWURF: 'Entwurf',
  KONZEPT: 'Konzept',
  VORSCHAU: 'Vorschau',
  FINAL: 'Final',
}

const STATUS_STIL: Record<PostStatus, { flaeche: string; farbe: string }> = {
  // Ein Entwurf erreicht den Kunden nie — der Eintrag ist reine Formsache.
  ENTWURF: { flaeche: 'var(--color-flaeche-tief)', farbe: 'var(--color-still)' },
  KONZEPT: { flaeche: 'var(--color-konzept-flaeche)', farbe: 'var(--color-konzept)' },
  VORSCHAU: { flaeche: 'var(--color-vorschau-flaeche)', farbe: 'var(--color-vorschau)' },
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
  kunde,
  logo,
  medien,
  thumbnail,
  mitFreigaben = true,
  istVideo,
  szenen,
  kommentare,
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
    /**
     * Wohin der Beitrag geht. Einfarbig neben der Typbezeichnung — die Seite
     * trägt die Marke des Kunden, nicht die von Meta.
     */
    plattformen: Plattform[]
  }
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
          <span className="flex items-center gap-2 pb-1 text-[13px] text-[#77746f] sm:text-[14px]">
            {postBezeichnung(post.typ, post.verhaeltnis)}
            <PlattformMarken plattformen={post.plattformen} groesse={14} klasse="text-[#9a9691]" />
          </span>
        </div>

        {/* Mobil nimmt die Zeile die volle Breite, damit die Statusleiste
            darunter mittig stehen kann — im Umbruch säße sie sonst links
            neben ihrem eigenen Leerraum. */}
        <div className="flex w-full flex-wrap items-end gap-x-6 gap-y-4 sm:w-auto">
          <span className="text-[12.5px] text-[#77746f] sm:text-[13px]">
            {DATUM.format(post.postenAm)} · {UHRZEIT.format(post.postenAm)}
          </span>

          {/* Ein Etikett sagt nur, wo etwas steht — nicht, was noch kommt. */}
          <StatusLeiste
            stufe={abgeleiteteStufe(post.status, post.postenAm)}
            mitFreigaben={mitFreigaben}
          />
        </div>
      </div>

      {/* ------------------------------------------------------------ Inhalt */}
      <div className="grid items-start gap-8 lg:grid-cols-[344px_minmax(0,1fr)] lg:gap-12 xl:grid-cols-[344px_minmax(0,1fr)_320px]">
        <div className="mx-auto lg:mx-0">
          <IPhoneVorschau
            typ={post.typ}
            kunde={kunde}
            logo={logo}
            medien={medien}
            caption={post.caption}
            verhaeltnis={post.verhaeltnis}
            istVideo={istVideo}
            thumbnail={thumbnail}
          />
        </div>

        <div className="min-w-0">
          <div className="mb-3 text-[10.5px] uppercase tracking-[0.14em] text-still sm:mb-3.5 sm:text-[11px]">
            Caption
          </div>
          <p className="max-w-[600px] whitespace-pre-line text-[13.5px] leading-[1.7] text-[#2e2b28] sm:text-[14.5px] sm:leading-[1.75]">
            {text || '—'}
          </p>
          {hashtags && (
            <p className="mt-3.5 max-w-[600px] text-[12.5px] leading-[1.65] text-leise sm:mt-[18px] sm:text-[13.5px] sm:leading-[1.7]">
              {hashtags}
            </p>
          )}

          <Eckdaten eintraege={eckdaten} />

          {/*
            Alle Slides in Reihe. Im Geräterahmen sieht man immer nur einen —
            hier fällt auf, ob der Beitrag als Ganzes zusammenpasst. Die
            1-px-Fugen lassen die Kanten der einzelnen Slides erkennbar.
          */}
          {post.typ === 'KARUSSELL' && medien.length > 1 && (
            <div className="mt-6 sm:mt-[34px]">
              <div className="mb-3 text-[10.5px] uppercase tracking-[0.14em] text-still sm:text-[11px]">
                Alle Slides
              </div>
              <div className="flex max-w-[600px] gap-px overflow-hidden rounded-[3px] bg-rahmen-3">
                {medien.map((bild, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={bild}
                    src={bild}
                    alt={`Slide ${i + 1}`}
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
                    <span className="text-[11px] text-[#928e89] sm:text-[11.5px]">{post.laenge}</span>
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

        </div>

        <div className="min-w-0">{kommentare}</div>
      </div>
    </section>
  )
}
