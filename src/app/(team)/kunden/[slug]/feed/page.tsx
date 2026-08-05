import { ladeKunde, ladePosts, rasterMedium } from '@/lib/abfragen'
import { thumbUrl } from '@/lib/urls'
import { FeedRaster, ProfilKopf, type FeedKachel } from '@/components/feed'
import { Hinweis } from '@/components/ui'

export default async function FeedSeite({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const kunde = await ladeKunde(slug)
  const posts = await ladePosts(kunde.id)

  // Intern zeigt das Raster alle Posts — auch die, die der Kunde noch nicht
  // zur Freigabe bekommen hat. Neueste Kachel oben links.
  const kacheln: FeedKachel[] = [...posts]
    .sort((a, b) => b.postenAm.getTime() - a.postenAm.getTime())
    .map((post) => ({
      id: post.id,
      typ: post.typ,
      status: post.status,
      titel: post.titel,
      bild: thumbUrl(rasterMedium(post)),
      href: `/kunden/${slug}/posts/${post.id}`,
    }))

  return (
    <div className="flex flex-wrap items-start gap-10">
      <div className="w-[380px] shrink-0">
        <div className="rounded-md border border-rahmen bg-flaeche p-5">
          <ProfilKopf
            name={kunde.name}
            handle={kunde.handle}
            logo={thumbUrl(kunde.logoId)}
            beitraege={kunde.beitraege}
            follower={kunde.follower}
            gefolgt={kunde.gefolgt}
            bio={kunde.bio}
          />
          <div className="border-t border-rahmen pt-3">
            <FeedRaster kacheln={kacheln} statusZeigen />
          </div>
        </div>
      </div>

      <div className="max-w-[380px] flex-1">
        <Hinweis>
          Diese Vorschau zeigt <strong>alle</strong> Posts — auch die, die noch nicht zur Freigabe
          verschickt wurden. Der Status steht auf jeder Kachel. Auf der Export-Seite sieht der Kunde
          nur, was für seinen Zeitraum freigegeben ist.
        </Hinweis>

        <div className="mt-4 rounded-md border border-rahmen bg-flaeche p-4">
          <h3 className="mb-2 text-[12.5px] font-medium text-tinte">Wie das Raster gefüllt wird</h3>
          <ul className="grid gap-1.5 text-[12px] leading-relaxed text-leise">
            <li>Drei Kacheln je Reihe im Verhältnis 4:5, neueste oben links.</li>
            <li>
              Reel-Thumbnails liegen im 9:16-Format vor — gezeigt wird der mittige 4:5-Ausschnitt,
              wie bei Instagram selbst.
            </li>
            <li>Reels und Karussells tragen einen Marker in der Ecke.</li>
          </ul>
        </div>

        {kunde.kennzahlenAm && (
          <p className="mt-4 text-[11.5px] leading-relaxed text-stiller">
            Profil-Kennzahlen zuletzt gepflegt am{' '}
            {new Intl.DateTimeFormat('de-DE', { dateStyle: 'long' }).format(kunde.kennzahlenAm)} (
            {kunde.kennzahlenTyp === 'MANUELL' ? 'manuell' : 'Graph API'}). Zu ändern unter
            Stammdaten.
          </p>
        )}
      </div>
    </div>
  )
}
