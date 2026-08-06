import { redirect } from 'next/navigation'
import { aktuellerGast } from '@/lib/auth'
import { GastAnmeldung, type Anmeldeschritt } from '@/components/gast-anmeldung'

export const metadata = { title: 'Meine Freigaben — Preroll' }
export const dynamic = 'force-dynamic'

export default async function PortalAnmeldenSeite({
  searchParams,
}: {
  searchParams: Promise<{ schritt?: string; email?: string; fehler?: string }>
}) {
  const { schritt, email, fehler } = await searchParams
  const gast = await aktuellerGast()

  if (gast && gast.name.trim()) redirect('/portal')

  const aktiv: Anmeldeschritt =
    schritt === 'name' || (gast && !gast.name.trim())
      ? 'name'
      : schritt === 'code' && email
        ? 'code'
        : 'email'

  return (
    <GastAnmeldung
      token={null}
      schritt={aktiv}
      email={email}
      nameVorschlag={gast?.name}
      fehler={fehler}
      titel={aktiv === 'name' ? 'Fast geschafft' : 'Meine Freigaben'}
      text={
        aktiv === 'name'
          ? 'Wie dürfen wir Sie nennen? Danach sehen Sie alle Pläne, zu denen Sie eingeladen wurden.'
          : 'Melden Sie sich mit der Adresse an, an die Ihre Freigabe-Links geschickt wurden.'
      }
    />
  )
}
