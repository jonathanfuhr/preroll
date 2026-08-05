import { redirect } from 'next/navigation'
import { aktuellerGast } from '@/lib/auth'
import { GastAnmeldung } from '@/components/gast-anmeldung'

export const metadata = { title: 'Meine Freigaben — Preroll' }

export default async function PortalAnmeldenSeite({
  searchParams,
}: {
  searchParams: Promise<{ schritt?: string; email?: string; fehler?: string }>
}) {
  const { schritt, email, fehler } = await searchParams
  if (await aktuellerGast()) redirect('/portal')

  return (
    <GastAnmeldung
      token={null}
      schritt={schritt}
      email={email}
      fehler={fehler}
      titel="Meine Freigaben"
      text="Melden Sie sich mit der Adresse an, an die Ihre Freigabe-Links geschickt wurden. Sie sehen dann alle Pläne auf einen Blick."
    />
  )
}
