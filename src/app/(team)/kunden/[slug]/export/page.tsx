import { prisma } from '@/lib/db'
import { ladeKunde } from '@/lib/abfragen'
import { alsEingabe, formatiereTag } from '@/lib/datum'
import { env } from '@/lib/env'
import { istAbgelaufen, postsImZeitraum } from '@/lib/export-sicht'
import { freigabeFortschritt } from '@/lib/freigabe'
import { darfAnsprechpartnerSein } from '@/lib/rollen'
import { zeitraumText } from '@/lib/benachrichtigungen'
import { Abschnitt, Karte, Leerzustand } from '@/components/ui'
import { ExportAnlegen, ExportKarte } from './verwaltung'


const ZEITSTEMPEL = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })

export default async function ExportSeite({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const kunde = await ladeKunde(slug)

  // Als zusätzlicher Ansprechpartner kommt jedes aktive Konto in Frage,
  // das nicht im Schnitt sitzt.
  const waehlbare = (
    await prisma.nutzer.findMany({ where: { aktiv: true }, orderBy: { name: 'asc' } })
  )
    .filter((n) => darfAnsprechpartnerSein(n.rolle))
    .map((n) => ({ id: n.id, name: n.name, rolle: n.rolle }))

  const [exporte, posts] = await Promise.all([
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

  // Der Freigabestand ergibt sich aus den Posts im Zeitraum des jeweiligen Links.
  const standVon = (exp: (typeof exporte)[number]) =>
    freigabeFortschritt(
      postsImZeitraum(posts, {
        zeitraumVon: exp.zeitraumVon,
        zeitraumBis: exp.zeitraumBis,
        konzepteMitzeigen: exp.konzepteMitzeigen,
      }),
    )

  // Dieselbe Regel wie auf der Kundenseite: der Link gilt bis Tagesende.
  const aktive = exporte.filter((e) => !istAbgelaufen(e.gueltigBis))
  const abgelaufene = exporte.filter((e) => istAbgelaufen(e.gueltigBis))

  return (
    <>
      <div className="mb-6 flex items-end justify-between gap-6">
        <div>
          <h2 className="text-[15px] font-semibold">Export</h2>
          <p className="mt-0.5 text-[12.5px] text-leiser">
            Freigabe-Links und Dateiausgabe für {kunde.name} ·{' '}
            {aktive.length} aktiv, {abgelaufene.length} abgelaufen
          </p>
        </div>
        <ExportAnlegen kundeId={kunde.id} waehlbare={waehlbare} />
      </div>

      {exporte.length === 0 ? (
        <Leerzustand
          titel="Noch kein Freigabe-Link"
          text="Ein Export-Link zeigt dem Kunden den Kalender, die Feed-Vorschau und jeden Post im iPhone-Rahmen — als Live-Sicht, nicht als Schnappschuss."
        />
      ) : (
        <div className="grid gap-8">
          <Abschnitt titel="Aktive Links">
            {aktive.length === 0 ? (
              <Karte className="px-5 py-6 text-[12.5px] text-leiser">
                Kein aktiver Link — alle Zeiträume sind abgelaufen.
              </Karte>
            ) : (
              <div className="grid gap-4">
                {aktive.map((exp) => (
                  <ExportKarte
                    key={exp.id}
                    exp={{
                      id: exp.id,
                      token: exp.token,
                      titel: exp.titel,
                      zeitraum: zeitraumText(exp.zeitraumVon, exp.zeitraumBis),
                      zeitraumVon: alsEingabe(exp.zeitraumVon),
                      zeitraumBis: alsEingabe(exp.zeitraumBis),
                      gueltigBis: exp.gueltigBis ? alsEingabe(exp.gueltigBis) : '',
                      zusatzAnsprechpartnerId: exp.zusatzAnsprechpartnerId,
                      kommentareErlaubt: exp.kommentareErlaubt,
                      freigabenErlaubt: exp.freigabenErlaubt,
                      konzepteMitzeigen: exp.konzepteMitzeigen,
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
          </Abschnitt>

          {abgelaufene.length > 0 && (
            <Abschnitt titel="Abgelaufen">
              <Karte className="overflow-hidden">
                <table className="w-full text-[12.5px]">
                  <tbody>
                    {abgelaufene.map((exp) => (
                      <tr key={exp.id} className="border-b border-rahmen last:border-b-0">
                        <td className="px-4 py-2.5 text-tinte-3">
                          {zeitraumText(exp.zeitraumVon, exp.zeitraumBis)}
                        </td>
                        <td className="px-4 py-2.5 text-leiser">
                          {exp.zusatzAnsprechpartner?.name ?? '—'}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-[11.5px] text-stiller">
                          /f/{exp.token}
                        </td>
                        <td className="px-4 py-2.5 text-right text-leiser">
                          {exp.aufrufe} Aufrufe
                        </td>
                        <td className="px-4 py-2.5 text-right text-stiller">
                          bis {exp.gueltigBis ? formatiereTag(exp.gueltigBis) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Karte>
            </Abschnitt>
          )}
        </div>
      )}
    </>
  )
}
