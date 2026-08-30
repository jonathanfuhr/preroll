import type { MediumRolle, Plattform, PostTyp, Verhaeltnis } from '@prisma/client'
import type { ProfilKarte } from './plattform-profil'
import { reelVideoQuelle } from './reel-video'
import { medienUrl } from './urls'
import { fassungenFuerAnzeige } from './varianten'

/**
 * Was ein Beitrag in der Vorschau zeigt — Medien, Video-Platz und die
 * abweichenden Fassungen.
 *
 * Steht hier und nicht in den Seiten, weil es **zwei** Seiten gibt, die
 * denselben Beitrag zeigen: die Kundenseite und die interne Review-Seite. Die
 * Rechnung ist die kniffligste Stelle der Anzeige — welches Medium für welche
 * Plattform gilt, was eine Fassung erbt und was sie selbst mitbringt —, und
 * zweimal geschrieben liefen die beiden Seiten früher oder später
 * auseinander. Dann zeigte die Review-Seite etwas anderes als der Kunde, und
 * genau dafür ist sie nicht da.
 *
 * Die Seiten unterscheiden sich in ihrem Rahmen — Kopfzeile, Einleitung, was
 * daneben steht —, nicht im Beitrag selbst.
 */

type AnzeigeMedium = {
  rolle: MediumRolle
  position: number
  mediumId: string
  medium: { id: string; mimeTyp: string }
}

export type AnzeigePost = {
  id: string
  typ: PostTyp
  caption: string
  verhaeltnis: Verhaeltnis
  klappeVersionId: string | null
  medien: AnzeigeMedium[]
  varianten: Array<{
    id: string
    plattformen: Plattform[]
    caption: string | null
    verhaeltnis: Verhaeltnis | null
    position: number
    klappeVersionId: string | null
    medien: AnzeigeMedium[]
  }>
}

/** Eine abweichende Fassung, fertig für `PostSektion`. */
export type Anzeigefassung = {
  plattformen: Plattform[]
  handles: string[]
  caption: string
  verhaeltnis: Verhaeltnis
  medien: string[]
  istVideo: boolean
  thumbnail: string | null
  eigeneCaption: boolean
  eigeneMedien: boolean
}

export type Sektionsdaten = {
  /** Was im Hauptrahmen steht — Slides, Video oder das eine Bild. */
  medien: string[]
  istVideo: boolean
  thumbnail: string | null
  /** Nur die Abweichungen; das Hauptformat steht schon im Rahmen. */
  fassungen: Anzeigefassung[]
}

export function sektionsdaten(
  post: AnzeigePost,
  plattformen: Plattform[],
  profile: ProfilKarte,
): Sektionsdaten {
  const slides = post.medien
    .filter((m) => m.rolle === 'SLIDE')
    .sort((a, b) => a.position - b.position)
    .map((m) => medienUrl(m.medium.id)!)
  const medium = post.medien.find((m) => m.rolle === 'MEDIUM')
  const thumb = post.medien.find((m) => m.rolle === 'THUMBNAIL')
  // Der eine Video-Platz des Reels — Upload, Link-Download und Klappe-Fassung
  // landen alle hier, nicht in einer Extra-Anzeige.
  const reelVideo = post.typ === 'REEL' ? reelVideoQuelle(post) : null

  const hauptmedien =
    post.typ === 'KARUSSELL'
      ? slides
      : post.typ === 'REEL'
        ? reelVideo
          ? [reelVideo.url]
          : []
        : medium
          ? [medienUrl(medium.medium.id)!]
          : []

  /*
    Das Hauptformat steht schon im Rahmen — hier bleiben nur die Abweichungen,
    deshalb `slice(1)`. Gerechnet wird gegen die Plattformen, die wirklich
    bespielt werden: Eine Fassung für eine Plattform ohne Kanal erscheint
    nicht, sonst verspräche die Seite eine Fassung, die nirgends auftaucht.
  */
  const fassungen = fassungenFuerAnzeige(post, post.varianten, plattformen)
    .slice(1)
    .map((f): Anzeigefassung => {
      const eigeneSlides = f.medien
        .filter((m) => m.rolle === 'SLIDE')
        .sort((a, b) => a.position - b.position)
        .map((m) => medienUrl(m.mediumId)!)
      const eigenesMedium = f.medien.find((m) => m.rolle === 'MEDIUM')
      const eigenesThumb = f.medien.find((m) => m.rolle === 'THUMBNAIL')
      const video = Boolean(eigenesMedium?.medium.mimeTyp.startsWith('video/'))

      return {
        plattformen: f.plattformen,
        // Der öffentliche Name auf diesen Plattformen — daran erkennt man,
        // wo die Fassung erscheint.
        handles: f.plattformen
          .map((pl) => profile[pl].handle)
          .filter((h): h is string => Boolean(h))
          .map((h) => (h.startsWith('/') ? h : `@${h}`)),
        caption: f.caption,
        verhaeltnis: f.verhaeltnis,
        medien:
          eigeneSlides.length > 0
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

  return {
    medien: hauptmedien,
    istVideo:
      post.typ === 'REEL'
        ? Boolean(reelVideo)
        : (medium?.medium.mimeTyp.startsWith('video/') ?? false),
    thumbnail: thumb ? medienUrl(thumb.medium.id) : null,
    fassungen,
  }
}
