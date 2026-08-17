import type { MediumRolle } from '@prisma/client'
import Link from 'next/link'
import { ersteMedien, ladePost } from '@/lib/abfragen'
import { aktuellerNutzer } from '@/lib/auth'
import { erwaehnbarePersonen } from '@/lib/erwaehnbar'
import { darfBearbeiten } from '@/lib/kommentar-rechte'
import { prisma } from '@/lib/db'
import { ladeEinstellungen } from '@/lib/einstellungen'
import { freigabeStand } from '@/lib/freigabe'
import { anzeigePhase } from '@/lib/status'
import { effektivePlattformen } from '@/lib/plattformen'
import { freiePlattformen } from '@/lib/varianten'
import { klappeEingerichtet } from '@/lib/klappe'
import {
  varianteAnlegen,
  varianteLoeschen,
  varianteMedienVerwerfen,
  varianteSpeichern,
} from '../../aktionen'
import { ladeKlappeVideos } from '../../klappe-aktionen'
import { reelVideoQuelle } from '@/lib/reel-video'
import { medienUrl, thumbUrl } from '@/lib/urls'
import { BrotkrumeSetzen } from '@/components/brotkrumen'
import { PostEditor } from './editor'
import { VeroeffentlichungStandLeiste } from './veroeffentlichung-stand'

/**
 * Ein Medium so, wie die Fassungs-Vorschau es braucht. Die Rolle kommt mit:
 * Beim Reel steht in der Kachel das Thumbnail, nicht das Video — ein Video als
 * Vorschaubild wäre schwarz, bis jemand es abspielt.
 */
function alsAnzeigemedium(m: {
  id: string
  mediumId: string
  rolle: MediumRolle
  medium: { mimeTyp: string }
}) {
  return {
    id: m.id,
    url: medienUrl(m.mediumId)!,
    istVideo: m.medium.mimeTyp.startsWith('video/'),
    rolle: m.rolle as 'MEDIUM' | 'SLIDE' | 'THUMBNAIL',
  }
}

/**
 * Steht als Thumbnail ein aus dem Video gezogenes Standbild? Erkennbar daran,
 * dass es das Video als Quelle trägt — dafür braucht es kein eigenes Feld.
 */
function standbildAusVideo(
  medien: Array<{ rolle: MediumRolle; mediumId: string; medium: { quelleId: string | null } }>,
): boolean {
  const thumb = medien.find((m) => m.rolle === 'THUMBNAIL')
  const video = medien.find((m) => m.rolle === 'MEDIUM')
  return Boolean(thumb && video && thumb.medium.quelleId === video.mediumId)
}

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

  const [einstellungen, angebunden, veroeffentlichungen] = await Promise.all([
    ladeEinstellungen(),
    klappeEingerichtet(),
    prisma.veroeffentlichung.findMany({
      where: { postId },
      orderBy: { plattform: 'asc' },
      select: {
        id: true,
        plattform: true,
        stand: true,
        geplantFuer: true,
        erledigtAm: true,
        meldung: true,
        versuche: true,
      },
    }),
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

  /*
    Klappe-Angaben, die für jede Fassung gleich sind: Die Videoliste hängt am
    Projekt des Kunden, nicht am einzelnen Beitrag. Nur die Verknüpfung
    unterscheidet sich — die trägt jede Fassung selbst.
  */
  const klappeAngaben = {
    eingerichtet: angebunden,
    projektName: post.kunde.klappeProjektName,
    ladefehler: klappeListe.fehler,
    videos: klappeListe.videos.map((v) => ({
      id: v.id,
      name: v.name,
      versionCount: v.versionCount,
      hatFreigegebeneFassung: Boolean(v.latestVersion && !v.latestVersion.internal),
    })),
  }

  // Der eine Video-Platz — Upload, Link-Download und Klappe füllen ihn alle
  // drei. Was gerade dort steht, entscheidet `reelVideoQuelle`.
  const videoQuelle = post.typ === 'REEL' ? reelVideoQuelle(post) : null

  /*
    Wie viele andere Beiträge zur selben Minute rausgehen sollen. Preroll
    postet sie nacheinander; gezählt wird nur, wo es überhaupt selbst
    veröffentlicht — bei Kunden, die von Hand posten, ist die Zahl belanglos.
  */
  const gleichzeitig =
    post.postenAm && post.kunde.postenAktiv
      ? await prisma.post.count({
          where: {
            id: { not: post.id },
            status: 'FINAL',
            postenAm: post.postenAm,
            kunde: { postenAktiv: true, archiviert: false },
          },
        })
      : 0

  return (
    <>
      <BrotkrumeSetzen stufen={[{ text: post.titel }]} />

      <div className="mb-5 flex justify-end">
        <Link href={`/kunden/${slug}`} className="text-[12.5px] text-leise hover:text-tinte">
          ← Zur Übersicht
        </Link>
      </div>

      <VeroeffentlichungStandLeiste zeilen={veroeffentlichungen} slug={slug} postId={postId} />

      <PostEditor
        phase={anzeigePhase(post.status, post.postenAm, veroeffentlichungen)}
        gleichzeitig={gleichzeitig}
        plattformen={{ gewaehlt: post.plattformen, moeglich: effektivePlattformen(post.kunde) }}
        varianten={{
          zeilen: post.varianten.map((v) => ({
            id: v.id,
            plattformen: v.plattformen,
            caption: v.caption,
            verhaeltnis: v.verhaeltnis,
            medien: v.medien.map(alsAnzeigemedium),
            /*
              Der Video-Platz dieser Fassung. Nur beim Reel — bei Standbildern
              ergeben Klappe und Downloadlink keinen Sinn, dieselbe Grenze wie
              am Beitrag.

              Die Videoliste aus Klappe ist für alle Fassungen dieselbe: Sie
              hängt am Projekt des Kunden, nicht am Beitrag.
            */
            video:
              post.typ === 'REEL'
                ? {
                    quelle: reelVideoQuelle({
                      medien: v.medien,
                      klappeVersionId: v.klappeVersionId,
                    }),
                    thumbnailUrl: medienUrl(
                      v.medien.find((m) => m.rolle === 'THUMBNAIL')?.mediumId,
                    ),
                    // Ein selbst gezogenes Standbild trägt das Video als
                    // Quelle — dieselbe Erkennung wie am Beitrag.
                    thumbnailAutomatisch: standbildAusVideo(v.medien),
                    videoDownloadUrl: v.videoDownloadUrl,
                    downloadstand: {
                      stand: v.videoDownloadStand,
                      fortschritt: v.videoDownloadFortschritt,
                      meldung: v.videoDownloadMeldung,
                    },
                    klappe: {
                      ...klappeAngaben,
                      verknuepft: v.klappeVideoId
                        ? {
                            videoId: v.klappeVideoId,
                            videoName: v.klappeVideoName,
                            videoUrl: v.klappeVideoUrl,
                            versionNummer: v.klappeVersionNummer,
                            standAm: v.klappeStandAm?.toISOString() ?? null,
                            basisUrl: einstellungen.klappeBasisUrl,
                            fassungId: v.klappeVersionId,
                          }
                        : null,
                    },
                  }
                : null,
          })),
          // Was eine Fassung ohne eigene Medien zeigt.
          geerbteMedien: post.medien.map(alsAnzeigemedium),
          /*
            Wählbar ist nur, was der Beitrag überhaupt bespielt **und** was in
            keiner anderen Fassung steht. Zwei Fassungen für dieselbe Plattform
            wären nicht entscheidbar; die Sperre hier ist Bequemlichkeit, die
            Regel steht am Server.
          */
          frei: freiePlattformen(post.plattformen, post.varianten as never),
          // Was der Kunde bespielt, dieser Beitrag aber nicht — gesperrt
          // gezeigt, damit niemand sucht, wo nichts fehlt.
          ausserhalb: effektivePlattformen(post.kunde).filter(
            (p) => !post.plattformen.includes(p),
          ),
          anlegen: varianteAnlegen.bind(null, post.id, slug),
          speichern: varianteSpeichern.bind(null, post.id, slug),
          loeschen: varianteLoeschen.bind(null, post.id, slug),
          medienVerwerfen: varianteMedienVerwerfen.bind(null, post.id, slug),
        }}
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
          ...klappeAngaben,
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
