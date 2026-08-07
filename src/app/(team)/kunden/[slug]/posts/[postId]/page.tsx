import Link from 'next/link'
import { ersteMedien, ladePost } from '@/lib/abfragen'
import { aktuellerNutzer } from '@/lib/auth'
import { erwaehnbarePersonen } from '@/lib/erwaehnbar'
import { darfBearbeiten } from '@/lib/kommentar-rechte'
import { prisma } from '@/lib/db'
import { ladeEinstellungen } from '@/lib/einstellungen'
import { freigabeStand } from '@/lib/freigabe'
import { klappeEingerichtet } from '@/lib/klappe'
import { ladeKlappeVideos } from '../../klappe-aktionen'
import { reelVideoQuelle } from '@/lib/reel-video'
import { medienUrl, thumbUrl } from '@/lib/urls'
import { BrotkrumeSetzen } from '@/components/brotkrumen'
import { PostEditor } from './editor'

export default async function PostSeite({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; postId: string }>
  searchParams: Promise<{ klappe?: string; meldung?: string }>
}) {
  const { slug, postId } = await params
  const { klappe: klappeZustand, meldung } = await searchParams
  const post = await ladePost(postId)

  // Ändern und Löschen entscheidet der Server; die Oberfläche zeigt nur an,
  // was er ohnehin zulassen würde.
  const ich = await aktuellerNutzer()
  const betrachter = { art: 'nutzer' as const, id: ich?.id ?? '', rolle: ich?.rolle ?? 'EDITOR' }
  const erwaehnbar = await erwaehnbarePersonen(post.kundeId)

  const [einstellungen, angebunden] = await Promise.all([
    ladeEinstellungen(),
    klappeEingerichtet(),
  ])

  // Videoauswahl nur laden, wenn sie auch gebraucht wird.
  const klappeListe =
    post.typ === 'REEL' && angebunden && post.kunde.klappeProjektId
      ? await ladeKlappeVideos(post.kundeId)
      : { videos: [], fehler: null }

  // Ziele fürs Übertragen des Ablaufs. Nur Reels desselben Kunden — ein
  // Szenenplan gehört zu seinem Zusammenhang.
  const andereReels =
    post.typ === 'REEL'
      ? await prisma.post.findMany({
          where: { kundeId: post.kundeId, typ: 'REEL', id: { not: post.id } },
          orderBy: { erstelltAm: 'desc' },
          include: { szenen: { orderBy: { position: 'asc' } } },
        })
      : []

  const slides = ersteMedien(post, 'SLIDE')
  const medium = ersteMedien(post, 'MEDIUM')
  const thumbnail = ersteMedien(post, 'THUMBNAIL')

  // Ein selbst gezogenes Standbild trägt das Video als Quelle — daran ist es
  // zu erkennen, ohne dass es dafür ein eigenes Feld bräuchte.
  const thumbEintrag = post.medien.find((m) => m.rolle === 'THUMBNAIL')
  const videoEintrag = post.medien.find((m) => m.rolle === 'MEDIUM')
  const thumbnailAutomatisch = Boolean(
    thumbEintrag && videoEintrag && thumbEintrag.medium.quelleId === videoEintrag.mediumId,
  )

  // Das Original, nicht das Vorschaubild: Letzteres ist der mittige
  // 3:4-Ausschnitt fürs Raster. In der 9:16-Fläche würde es ein zweites Mal
  // beschnitten — vom Bild bliebe die Mitte der Mitte.
  const thumbnailUrl = medienUrl(thumbnail[0])

  const mediumEintrag = post.medien.find((m) => m.rolle === 'MEDIUM')
  const istVideo = mediumEintrag?.medium.mimeTyp.startsWith('video/') ?? false

  // Der eine Video-Platz — Upload, Link-Download und Klappe füllen ihn alle
  // drei. Was gerade dort steht, entscheidet `reelVideoQuelle`.
  const videoQuelle = post.typ === 'REEL' ? reelVideoQuelle(post) : null

  return (
    <>
      <BrotkrumeSetzen stufen={[{ text: post.titel }]} />

      <div className="mb-5 flex justify-end">
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
          verhaeltnis: post.verhaeltnis,
          videoDownloadUrl: post.videoDownloadUrl,
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
        thumbnailUrl={thumbnailUrl}
        videoQuelle={videoQuelle}
        thumbnailAutomatisch={thumbnailAutomatisch}
        istVideo={istVideo}
        vorschau={{ kunde: post.kunde.name, logo: thumbUrl(post.kunde.logoId) }}
        standardUhrzeit={post.kunde.standardUhrzeit}
        freigabenNoetig={post.kunde.freigabenNoetig}
        andereReels={andereReels.map((r) => ({
          id: r.id,
          titel: r.titel,
          postenAm: r.postenAm?.toISOString() ?? null,
          szenen: r.szenen.map((sz) => ({
            id: sz.id,
            position: sz.position,
            abschnitt: sz.abschnitt,
            bildSzene: sz.bildSzene,
            sprechertext: sz.sprechertext,
            texteinblendung: sz.texteinblendung,
          })),
        }))}
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
        erwaehnbar={erwaehnbar}
        kundeSlug={slug}
        downloadStand={{
          stand: post.videoDownloadStand,
          fortschritt: post.videoDownloadFortschritt,
          meldung: post.videoDownloadMeldung,
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
        }}
      />
    </>
  )
}
