import { redirect } from 'next/navigation'
import { aktuellerNutzer, beendeTeamSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { ladeEinstellungen } from '@/lib/einstellungen'
import { thumbUrl } from '@/lib/urls'
import { Benutzermenue, Glocke } from '@/components/kopfleiste'
import { Brotkrumen, BrotkrumenSpeicher } from '@/components/brotkrumen'
import { Seitenleiste } from '@/components/seitenleiste'

async function abmelden() {
  'use server'
  await beendeTeamSession()
  redirect('/anmelden')
}

async function allesGelesen() {
  'use server'
  const nutzer = await aktuellerNutzer()
  if (!nutzer) return

  await prisma.benachrichtigung.updateMany({
    where: { nutzerId: nutzer.id, gelesenAm: null },
    data: { gelesenAm: new Date() },
  })
}

/**
 * Navigation nach Mockup 2b: Seitenleiste links, Inhalt rechts. Benutzer und
 * Glocke stehen abweichend davon oben rechts — dort sucht man sie.
 */
export default async function TeamLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const nutzer = await aktuellerNutzer()
  if (!nutzer) redirect('/anmelden')

  const [einstellungen, kunden, meldungen, ungelesen, offeneKommentare] =
    await Promise.all([
      ladeEinstellungen(),
      prisma.kunde.findMany({
        where: { archiviert: false },
        orderBy: { name: 'asc' },
        select: { slug: true, name: true, logoId: true },
      }),
      prisma.benachrichtigung.findMany({
        where: { nutzerId: nutzer.id },
        orderBy: { erstelltAm: 'desc' },
        take: 20,
      }),
      prisma.benachrichtigung.count({
        where: { nutzerId: nutzer.id, gelesenAm: null },
      }),
      prisma.kommentar.groupBy({
        by: ['postId'],
        where: { status: 'OFFEN', postId: { not: null } },
        _count: true,
      }),
    ])

  // Offene Kommentare je Kunde — für die Zahl an der Seitenleiste.
  const postIds = offeneKommentare.map((k) => k.postId!).filter(Boolean)
  const posts = await prisma.post.findMany({
    where: { id: { in: postIds } },
    select: { id: true, kunde: { select: { slug: true } } },
  })
  const jeKunde: Record<string, number> = {}
  for (const eintrag of offeneKommentare) {
    const slug = posts.find((p) => p.id === eintrag.postId)?.kunde.slug
    if (slug) jeKunde[slug] = (jeKunde[slug] ?? 0) + eintrag._count
  }

  return (
    <BrotkrumenSpeicher>
      <div className="flex min-h-screen">
        <Seitenleiste
          kunden={kunden.map((k) => ({
            slug: k.slug,
            name: k.name,
            logo: thumbUrl(k.logoId),
          }))}
          offeneKommentare={jeKunde}
        />

        {/*
          Arbeitsfläche hell wie in den Mockups: Der Inhalt steht auf Weiß,
          die Seitenleiste ist leicht getönt. Umgekehrt — graue Fläche, weiße
          Karten — wirkt schwerer und war nie so gezeichnet.
        */}
        <div className="min-w-0 flex-1 bg-flaeche">
          <header className="sticky top-0 z-40 flex h-[68px] items-center justify-between gap-6 border-b border-rahmen bg-flaeche/95 px-8 backdrop-blur">
            <Brotkrumen
              kunden={kunden.map((k) => ({ slug: k.slug, name: k.name }))}
            />

            <div className="flex items-center gap-2">
              <Glocke
                meldungen={meldungen.map((m) => ({
                  id: m.id,
                  titel: m.titel,
                  text: m.text,
                  url: m.url,
                  am: m.erstelltAm.toISOString(),
                  gelesen: m.gelesenAm !== null,
                }))}
                ungelesen={ungelesen}
                allesGelesen={allesGelesen}
              />
              <Benutzermenue
                name={nutzer.name}
                initialen={nutzer.initialen}
                rolle={nutzer.rolle}
                workspace={einstellungen.workspaceName}
                abmelden={abmelden}
              />
            </div>
          </header>

          <main className="px-8 py-8">{children}</main>
        </div>
      </div>
    </BrotkrumenSpeicher>
  )
}
