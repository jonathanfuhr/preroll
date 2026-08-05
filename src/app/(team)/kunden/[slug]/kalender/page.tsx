import { ladeKunde, ladePosts } from '@/lib/abfragen'
import { Monatskalender, monateImZeitraum, type Kalendereintrag } from '@/components/kalender'
import { Leerzustand } from '@/components/ui'

export default async function KalenderSeite({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const kunde = await ladeKunde(slug)
  const posts = await ladePosts(kunde.id)

  if (posts.length === 0) {
    return (
      <Leerzustand
        titel="Noch nichts im Kalender"
        text="Sobald Posts mit Datum angelegt sind, erscheinen sie hier als farbige Punkte je Typ."
      />
    )
  }

  const eintraege: Kalendereintrag[] = posts.map((post) => ({
    id: post.id,
    typ: post.typ,
    titel: post.titel,
    postenAm: post.postenAm,
    href: `/kunden/${slug}/posts/${post.id}`,
  }))

  const von = posts[0].postenAm
  const bis = posts[posts.length - 1].postenAm
  const monate = monateImZeitraum(von, bis)

  return (
    <div className="grid gap-10">
      {monate.map((monat) => (
        <Monatskalender key={monat.toISOString()} monat={monat} eintraege={eintraege} />
      ))}
    </div>
  )
}
