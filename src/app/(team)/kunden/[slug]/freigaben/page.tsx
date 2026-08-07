import { prisma } from '@/lib/db'
import { ladeKunde } from '@/lib/abfragen'
import { alsMonat, monatsTitel } from '@/lib/datum'
import { env } from '@/lib/env'
import { postsImZeitraum } from '@/lib/export-sicht'
import { freigabeFortschritt } from '@/lib/freigabe'
import { darfAnsprechpartnerSein } from '@/lib/rollen'
import { Leerzustand } from '@/components/ui'
import { ExportAnlegen, ExportKarte } from './verwaltung'

const ZEITSTEMPEL = new Intl.DateTimeFormat('de-DE', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

/**
 * Die Freigaben eines Kunden — eine je Monat.
 *
 * Was der Kunde daraufhin freigegeben hat, hatte einmal eine eigene Seite.
 * Die ist entfallen: Die Post-Liste zeigt es je Zeile, und zweimal dieselbe
 * Auskunft an zwei Stellen läuft irgendwann auseinander.
 *
 * Ein Zeitraum von Hand war eine Freiheit, die niemand brauchte: Geplant
 * wird ohnehin monatsweise, und ein Link über anderthalb Monate hätte auf
 * der Kundenseite eine Überschrift ohne Namen. Jetzt trägt jede Freigabe
 * den Monat als Titel, und der Kunde blättert zwischen ihnen.
 */
export default async function FreigabenSeite({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const kunde = await ladeKunde(slug)

  // Als zusätzlicher Ansprechpartner kommt jedes aktive Konto in Frage,
  // das nicht im Schnitt sitzt.
  const waehlbare = (
    await prisma.nutzer.findMany({ where: { aktiv: true }, orderBy: { name: 'asc' } })
  )
    .filter((n) => darfAnsprechpartnerSein(n.rolle))
    .map((n) => ({ id: n.id, name: n.name, rolle: n.rolle }))

  const [freigaben, posts] = await Promise.all([
    prisma.export.findMany({
      where: { kundeId: kunde.id },
      orderBy: { zeitraumVon: 'desc' },
      include: {
        zusatzAnsprechpartner: true,
        gaeste: { include: { gast: true } },
        _count: { select: { kommentare: true } },
      },
    }),
    prisma.post.findMany({
      where: { kundeId: kunde.id },
      orderBy: { postenAm: 'asc' },
      include: { freigaben: { select: { stufe: true } } },
    }),
  ])

  const standVon = (exp: (typeof freigaben)[number]) =>
    freigabeFortschritt(
      postsImZeitraum(posts, { zeitraumVon: exp.zeitraumVon, zeitraumBis: exp.zeitraumBis }),
    )

  return (
    <>
      <div className="mb-6 flex items-end justify-between gap-6">
        <div>
          <h2 className="text-[15px] font-semibold">Freigaben</h2>
          <p className="mt-0.5 text-[12.5px] text-leiser">
            Ein Link je Monat für {kunde.name} ·{' '}
            {freigaben.length === 1 ? '1 Monat' : `${freigaben.length} Monate`}
          </p>
        </div>
        <ExportAnlegen kundeId={kunde.id} waehlbare={waehlbare} />
      </div>

      <div className="grid gap-10">
        {freigaben.length === 0 ? (
          <Leerzustand
            titel="Noch keine Freigabe"
            text="Eine Freigabe zeigt dem Kunden einen ganzen Monat — Kalender, Feed-Vorschau und jeden Beitrag im iPhone-Rahmen. Als Live-Sicht, nicht als Schnappschuss."
          />
        ) : (
          <div className="grid gap-4">
            {freigaben.map((exp) => (
              <ExportKarte
                key={exp.id}
                exp={{
                  id: exp.id,
                  token: exp.token,
                  titel: exp.titel,
                  monat: alsMonat(exp.zeitraumVon),
                  monatTitel: monatsTitel(exp.zeitraumVon),
                  zusatzAnsprechpartnerId: exp.zusatzAnsprechpartnerId,
                  aufrufe: exp.aufrufe,
                  zuletztGeoeffnet: exp.zuletztGeoeffnet
                    ? ZEITSTEMPEL.format(exp.zuletztGeoeffnet)
                    : null,
                  stand: standVon(exp),
                  kommentare: exp._count.kommentare,
                }}
                basisUrl={env.appUrl}
                waehlbare={waehlbare}
                gaeste={exp.gaeste.map((g) => ({
                  id: g.gast.id,
                  name: g.gast.name,
                  email: g.gast.email,
                  geoeffnet: g.zuletztGeoeffnetAm ? ZEITSTEMPEL.format(g.zuletztGeoeffnetAm) : null,
                }))}
              />
            ))}
          </div>
        )}
      </div>
    </>
  )
}
