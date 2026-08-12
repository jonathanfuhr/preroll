import Link from 'next/link'
import { redirect } from 'next/navigation'
import { aktuellerNutzer, beendeTeamSession } from '@/lib/auth'
import { darfVerwalten } from '@/lib/rollen'
import { wacheUeberSitzung } from '@/lib/instagram'
import { wacheUeberKennzahlen } from '@/lib/kennzahlen-auftrag'
import { favoritUmschalten } from './favoriten-aktionen'
import { prisma } from '@/lib/db'
import { ladeEinstellungen } from '@/lib/einstellungen'
import { thumbUrl } from '@/lib/urls'
import { Benutzermenue, Glocke } from '@/components/kopfleiste'
import { Brotkrumen, BrotkrumenSpeicher } from '@/components/brotkrumen'
import { Navigationsknopf, Seitenleiste } from '@/components/seitenleiste'

/*
  Unter `(team)` steht nichts ohne Anmeldung — statisch kann hier also nichts
  sein. Ohne diese Zeile versucht Next es beim Bauen trotzdem: Seiten, die ihre
  Daten holen, **bevor** sie `cookies()` oder `searchParams` anfassen, laufen
  dabei ein Stück weit an, setzen ihre Datenbankabfrage ab und brechen erst
  danach als dynamisch ab. Das Ergebnis waren zwei `prisma:error`-Zeilen im
  Build — harmlos, aber irreführend, und die Reihenfolge in jeder neuen Seite
  zu bewachen ist die schlechtere Regel.
*/
export const dynamic = 'force-dynamic'

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

  // Höchstens einmal am Tag, im Hintergrund — blockiert die Seite nicht.
  void wacheUeberSitzung().catch(() => {})
  // Ein Profil je Lauf, Läufe im Abstand von 20 Minuten. Preroll hat keinen
  // Zeitplaner; die Arbeit im Backend ist der Takt.
  void wacheUeberKennzahlen()

  const [
    einstellungen,
    kunden,
    favoriten,
    meldungen,
    ungelesen,
    offeneKommentare,
    metaZugaenge,
    fehlgeschlagen,
  ] = await Promise.all([
      ladeEinstellungen(),
      prisma.kunde.findMany({
        where: { archiviert: false },
        orderBy: { name: 'asc' },
        select: { id: true, slug: true, name: true, logoId: true },
      }),
      prisma.kundeFavorit.findMany({
        where: { nutzerId: nutzer.id, kunde: { archiviert: false } },
        orderBy: { kunde: { name: 'asc' } },
        include: { kunde: { select: { id: true, slug: true, name: true, logoId: true } } },
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
      // Ein abgelehnter Meta-Zugang fällt sonst erst auf, wenn ein Termin
      // verstrichen ist — und dann ist der Beitrag nicht draußen.
      // Alle abgelehnten Zugänge, nicht nur der erste: Bei mehreren Portfolios
      // sagt „Meta-Zugang abgelehnt" sonst nicht, welcher gemeint ist.
      prisma.plattformZugang.findMany({
        where: { plattform: 'FACEBOOK', fehler: { not: null } },
        orderBy: { erstelltAm: 'asc' },
        select: {
          id: true,
          bezeichnung: true,
          fehler: true,
          kunden: {
            where: { archiviert: false, postenAktiv: true },
            orderBy: { name: 'asc' },
            select: { name: true },
          },
        },
      }),
      /*
        Nur die der letzten Woche: Ein Fehlschlag von vor drei Monaten, den
        niemand mehr nachholen wird, gehört nicht als rotes Band über jede
        Seite. In den Einstellungen steht er weiter.
      */
      prisma.veroeffentlichung.count({
        where: {
          stand: 'FEHLGESCHLAGEN',
          geplantFuer: { gte: new Date(Date.now() - 7 * 24 * 3600_000) },
        },
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

  const navigation = {
    kunden: kunden.map((k) => ({
      id: k.id,
      slug: k.slug,
      name: k.name,
      logo: thumbUrl(k.logoId),
    })),
    favoriten: favoriten.map((f) => ({
      id: f.kunde.id,
      slug: f.kunde.slug,
      name: f.kunde.name,
      logo: thumbUrl(f.kunde.logoId),
    })),
    offeneKommentare: jeKunde,
    umschalten: favoritUmschalten,
  }

  return (
    <BrotkrumenSpeicher>
      <div className="flex min-h-screen">
        <Seitenleiste {...navigation} />

        {/*
          Arbeitsfläche hell wie in den Mockups: Der Inhalt steht auf Weiß,
          die Seitenleiste ist leicht getönt. Umgekehrt — graue Fläche, weiße
          Karten — wirkt schwerer und war nie so gezeichnet.
        */}
        <div className="min-w-0 flex-1 bg-flaeche">
          <header className="sticky top-0 z-40 flex h-[68px] items-center justify-between gap-3 border-b border-rahmen bg-flaeche/95 px-4 backdrop-blur md:gap-6 md:px-8">
            <div className="flex min-w-0 items-center gap-2">
              <Navigationsknopf {...navigation} />
              <Brotkrumen
                kunden={kunden.map((k) => ({ slug: k.slug, name: k.name }))}
              />
            </div>

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
                foto={thumbUrl(nutzer.fotoId)}
                rolle={nutzer.rolle}
                workspace={einstellungen.workspaceName}
                abmelden={abmelden}
              />
            </div>
          </header>

          {/*
            Eine abgelaufene Instagram-Sitzung fällt sonst erst auf, wenn
            jemand ein Video von Instagram braucht — und dann steht die Arbeit.
            Deshalb im ganzen Backend, nicht nur in den Einstellungen.
          */}
          {einstellungen.instagramFehler && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-[#eec9c6] bg-akzent-zart px-4 py-2.5 text-[12.5px] text-akzent-dunkel md:px-8">
              <strong className="font-semibold">Instagram-Sitzung abgelaufen</strong>
              <span className="text-akzent-dunkel/80">
                Videos von Instagram lassen sich bis zur Erneuerung nicht laden.
              </span>
              {darfVerwalten(nutzer.rolle) && (
                <Link href="/einstellungen" className="font-medium underline underline-offset-2">
                  Jetzt erneuern
                </Link>
              )}
            </div>
          )}

          {/*
            Ein toter Zugang ist kein fehlgeschlagener Beitrag: Betroffen sind
            alle Kunden, die daran hängen, und bis jemand ihn erneuert, geht
            für sie nichts raus. Deshalb stehen sie hier namentlich — „Meta
            geht nicht" wäre eine Auskunft, mit der niemand etwas anfangen kann.
          */}
          {metaZugaenge.map((zugang) => (
            <div
              key={zugang.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-[#eec9c6] bg-akzent-zart px-4 py-2.5 text-[12.5px] text-akzent-dunkel md:px-8"
            >
              <strong className="font-semibold">
                Meta-Zugang abgelehnt
                {metaZugaenge.length > 1 ? `: ${zugang.bezeichnung}` : ''}
              </strong>
              <span className="text-akzent-dunkel/80">
                {zugang.kunden.length === 0
                  ? 'Zurzeit veröffentlicht Preroll für keinen Kunden daran — es geht also nichts verloren.'
                  : `Für ${zugang.kunden.map((k) => k.name).join(', ')} geht bis zur Erneuerung nichts raus.`}
              </span>
              {darfVerwalten(nutzer.rolle) && (
                <Link
                  href="/einstellungen/veroeffentlichen"
                  className="font-medium underline underline-offset-2"
                >
                  Jetzt nachsehen
                </Link>
              )}
            </div>
          ))}

          {/*
            Ein Beitrag, der nicht rausging, fällt sonst erst auf, wenn ihn
            jemand zufällig öffnet. Anders als der tote Zugang betrifft das
            einzelne Beiträge — deshalb führt der Weg in die Liste, nicht in
            die Einstellungen des Zugangs.
          */}
          {fehlgeschlagen > 0 && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-[#eec9c6] bg-akzent-zart px-4 py-2.5 text-[12.5px] text-akzent-dunkel md:px-8">
              <strong className="font-semibold">
                {fehlgeschlagen === 1
                  ? 'Ein Beitrag ist nicht rausgegangen'
                  : `${fehlgeschlagen} Beiträge sind nicht rausgegangen`}
              </strong>
              <span className="text-akzent-dunkel/80">
                Aus den letzten sieben Tagen. Sie gehen von allein nicht mehr raus.
              </span>
              <Link
                href="/einstellungen/veroeffentlichen"
                className="font-medium underline underline-offset-2"
              >
                Ansehen
              </Link>
            </div>
          )}

          <main className="px-4 py-6 md:px-8 md:py-8">{children}</main>
        </div>
      </div>
    </BrotkrumenSpeicher>
  )
}
