import Link from 'next/link'
import { ersteMedien, ladePost } from '@/lib/abfragen'
import { ladeEinstellungen } from '@/lib/einstellungen'
import { freigabeStand } from '@/lib/freigabe'
import { klappeEingerichtet } from '@/lib/klappe'
import { ladeKlappeVideos } from '../../klappe-aktionen'
import { kalenderwoche } from '@/lib/format'
import { medienUrl, thumbUrl } from '@/lib/urls'
import { StatusBadge, TypBadge } from '@/components/ui'
import { BrotkrumeSetzen } from '@/components/brotkrumen'
import { PostEditor } from './editor'

const DATUM_LANG = new Intl.DateTimeFormat('de-DE', {
  weekday: 'short',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})
const UHRZEIT = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' })

export default async function PostSeite({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; postId: string }>
  searchParams: Promise<{ klappe?: string; referenz?: string; meldung?: string }>
}) {
  const { slug, postId } = await params
  const { klappe: klappeZustand, referenz: referenzZustand, meldung } = await searchParams
  const post = await ladePost(postId)

  const [einstellungen, angebunden] = await Promise.all([
    ladeEinstellungen(),
    klappeEingerichtet(),
  ])

  // Videoauswahl nur laden, wenn sie auch gebraucht wird.
  const klappeListe =
    post.typ === 'REEL' && angebunden && post.kunde.klappeProjektId
      ? await ladeKlappeVideos(post.kundeId)
      : { videos: [], fehler: null }

  const slides = ersteMedien(post, 'SLIDE')
  const medium = ersteMedien(post, 'MEDIUM')
  const thumbnail = ersteMedien(post, 'THUMBNAIL')

  const mediumEintrag = post.medien.find((m) => m.rolle === 'MEDIUM')
  const istVideo = mediumEintrag?.medium.mimeTyp.startsWith('video/') ?? false

  return (
    <>
      <BrotkrumeSetzen stufen={[{ text: post.titel }]} />

      <div className="mb-6 flex flex-wrap items-start justify-between gap-6">
        <div>
          <div className="mb-1.5 flex items-center gap-3">
            <TypBadge typ={post.typ} />
            {post.postenAm && (
              <span className="font-mono text-[11.5px] text-still">
                KW {kalenderwoche(post.postenAm)}
              </span>
            )}
            <StatusBadge status={post.status} />
          </div>
          <h2 className="text-[19px] font-semibold tracking-[-0.01em]">{post.titel}</h2>
          <p className="mt-1 text-[12.5px] text-leiser">
            {post.postenAm
              ? `${DATUM_LANG.format(post.postenAm)} · ${UHRZEIT.format(post.postenAm)} Uhr`
              : 'Noch kein Termin — im Kalender aus der Spalte „Ungeplant" auf einen Tag ziehen.'}
          </p>
        </div>
        <Link href={`/kunden/${slug}`} className="text-[12.5px] text-leise hover:text-tinte">
          ← Zur Übersicht
        </Link>
      </div>

      <PostEditor
        post={{
          id: post.id,
          typ: post.typ,
          status: post.status,
          titel: post.titel,
          kurzbeschreibung: post.kurzbeschreibung,
          caption: post.caption,
          postenAm: post.postenAm?.toISOString() ?? null,
          laenge: post.laenge,
          ziel: post.ziel,
          stil: post.stil,
          inhalte: post.inhalte,
          szenenplanAktiv: post.szenenplanAktiv,
          referenzVideoUrl: post.referenzVideoUrl,
          referenzVideoTitel: post.referenzVideoTitel,
        }}
        szenen={post.szenen.map((s) => ({
          id: s.id,
          position: s.position,
          abschnitt: s.abschnitt,
          bildSzene: s.bildSzene,
          sprechertext: s.sprechertext,
          texteinblendung: s.texteinblendung,
        }))}
        customFelder={post.kunde.customFelder.map((definition) => ({
          id: definition.id,
          name: definition.name,
          typ: definition.typ,
          wert: post.customWerte.find((w) => w.definitionId === definition.id)?.wert ?? null,
        }))}
        slides={slides.map((id) => ({ id, url: thumbUrl(id)! }))}
        slideUrls={slides.map((id) => medienUrl(id)!).filter(Boolean)}
        mediumUrl={medienUrl(medium[0])}
        thumbnailUrl={thumbUrl(thumbnail[0])}
        istVideo={istVideo}
        vorschau={{ kunde: post.kunde.name, logo: thumbUrl(post.kunde.logoId) }}
        standardUhrzeit={post.kunde.standardUhrzeit}
        kommentare={post.kommentare.map((k) => ({
          id: k.id,
          autorName: k.autorName,
          text: k.text,
          am: k.erstelltAm,
          status: k.status,
          vomTeam: Boolean(k.nutzerId),
          exportId: k.exportId,
        }))}
        kundeSlug={slug}
        referenz={{
          mediumUrl: medienUrl(post.referenzVideoMediumId),
          geladen: Boolean(post.referenzVideoMediumId),
        }}
        klappe={{
          eingerichtet: angebunden,
          projektName: post.kunde.klappeProjektName,
          ladefehler: klappeListe.fehler,
          videos: klappeListe.videos.map((v) => ({
            id: v.id,
            name: v.name,
            versionCount: v.versionCount,
            hatFreigegebeneFassung: Boolean(v.latestVersion && !v.latestVersion.internal),
          })),
          verknuepft: post.klappeVideoId
            ? {
                videoId: post.klappeVideoId,
                videoName: post.klappeVideoName,
                videoUrl: post.klappeVideoUrl,
                versionNummer: post.klappeVersionNummer,
                standAm: post.klappeStandAm?.toISOString() ?? null,
                basisUrl: einstellungen.klappeBasisUrl,
                fassungId: post.klappeVersionId,
              }
            : null,
        }}
        freigabe={{
          ...freigabeStand(
            post.status,
            post.freigaben.map((f) => f.stufe),
          ),
          zeilen: post.freigaben.map((f) => ({
            id: f.id,
            stufe: f.stufe,
            autorName: f.autorName,
            notiz: f.notiz,
            am: f.erstelltAm.toISOString(),
            vomTeam: Boolean(f.nutzerId),
          })),
          vorschlagName: post.kunde.hauptAnsprechpartner?.name ?? null,
        }}
        meldungen={{
          klappe:
            klappeZustand === 'kein-projekt'
              ? 'Diesem Kunden ist noch kein Klappe-Projekt zugeordnet.'
              : klappeZustand === 'fehler' || klappeZustand === 'hinweis'
                ? meldung
                : undefined,
          referenz:
            referenzZustand === 'fehler'
              ? meldung
              : referenzZustand === 'kein-link'
                ? 'Bitte zuerst einen Link hinterlegen und speichern.'
                : undefined,
        }}
      />
    </>
  )
}
