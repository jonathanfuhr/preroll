import { notFound, redirect } from 'next/navigation'
import { aktuellerGast } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { GastAnmeldung, type Anmeldeschritt } from '@/components/gast-anmeldung'

export const metadata = { title: 'Anmelden — Preroll' }
export const dynamic = 'force-dynamic'

export default async function GastAnmeldenSeite({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>
  searchParams: Promise<{ schritt?: string; email?: string; fehler?: string }>
}) {
  const { token } = await params
  const { schritt, email, fehler } = await searchParams

  const exp = await prisma.export.findUnique({ where: { token }, include: { kunde: true } })
  if (!exp) notFound()

  const gast = await aktuellerGast()

  // Angemeldet und Name vorhanden — der Link genügt.
  if (gast && gast.name.trim()) redirect(`/f/${token}`)

  const aktiv: Anmeldeschritt =
    schritt === 'name' || (gast && !gast.name.trim())
      ? 'name'
      : schritt === 'code' && email
        ? 'code'
        : 'email'

  return (
    <GastAnmeldung
      token={token}
      schritt={aktiv}
      email={email}
      nameVorschlag={gast?.name}
      fehler={fehler}
      titel={aktiv === 'name' ? 'Fast geschafft' : 'Zugang bestätigen'}
      text={
        aktiv === 'name'
          ? `Wie dürfen wir Sie nennen? Danach sehen Sie den Content-Plan für ${exp.kunde.name}.`
          : `Der Content-Plan für ${exp.kunde.name} ist persönlich für Sie. Bitte bestätigen Sie kurz Ihre E-Mail-Adresse.`
      }
    />
  )
}
