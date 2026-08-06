import { prisma } from '@/lib/db'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const kunde = await prisma.kunde.findUnique({ where: { slug } })
  return { title: `${kunde?.name ?? 'Kunde'} — Preroll` }
}

/**
 * Der Kunde und seine Bereiche stehen in der Seitenleiste, der Pfad in der
 * Kopfleiste — hier bleibt nur der Inhalt.
 */
export default function KundeLayout({ children }: { children: React.ReactNode }) {
  return children
}
