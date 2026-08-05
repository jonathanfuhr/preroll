import { notFound, redirect } from 'next/navigation'
import { aktuellerGast } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { GastAnmeldung } from '@/components/gast-anmeldung'

export const metadata = { title: 'Anmelden — Preroll' }

export default async function GastAnmeldenSeite({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>
  searchParams: Promise<{ schritt?: string; email?: string; fehler?: string }>
}) {
  const { token } = await params
  const { schritt, email, fehler } = await searchParams

  const exp = await prisma.export.findUnique({
    where: { token },
    include: { kunde: true },
  })
  if (!exp) notFound()

  if (await aktuellerGast()) redirect(`/f/${token}`)

  return (
    <GastAnmeldung
      token={token}
      schritt={schritt}
      email={email}
      fehler={fehler}
      titel="Zugang bestätigen"
      text={`Der Content-Plan für ${exp.kunde.name} ist geschützt. Bitte bestätigen Sie kurz Ihre E-Mail-Adresse.`}
    />
  )
}
