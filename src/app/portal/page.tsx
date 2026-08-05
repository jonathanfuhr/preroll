import Link from 'next/link'
import { redirect } from 'next/navigation'
import { aktuellerGast } from '@/lib/auth'
import { zeitraumText } from '@/lib/benachrichtigungen'
import { prisma } from '@/lib/db'
import { istAbgelaufen } from '@/lib/export-sicht'
import { formatiereTag } from '@/lib/datum'
import { thumbUrl } from '@/lib/urls'
import { Karte, Leerzustand } from '@/components/ui'
import { gastAbmelden } from '../f/[token]/aktionen'

export const metadata = { title: 'Meine Freigaben — Preroll' }
export const dynamic = 'force-dynamic'

const ZEITSTEMPEL = new Intl.DateTimeFormat('de-DE', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

async function abmelden() {
  'use server'
  await gastAbmelden()
}

export default async function PortalSeite() {
  const gast = await aktuellerGast()
  if (!gast) redirect('/portal/anmelden')

  const beteiligungen = await prisma.exportGast.findMany({
    where: { gastId: gast.id },
    orderBy: { export: { zeitraumVon: 'desc' } },
    include: {
      export: {
        include: {
          kunde: { include: { logo: true } },
          freigaben: { orderBy: { erstelltAm: 'desc' }, take: 1 },
          _count: { select: { kommentare: true } },
        },
      },
    },
  })

  const offen = beteiligungen.filter(
    (b) => !b.export.freigegebenAm && !istAbgelaufen(b.export.gueltigBis),
  )
  const erledigt = beteiligungen.filter(
    (b) => b.export.freigegebenAm || istAbgelaufen(b.export.gueltigBis),
  )

  return (
    <div className="min-h-screen">
      <header className="border-b border-rahmen bg-flaeche">
        <div className="mx-auto flex max-w-[880px] items-center justify-between gap-4 px-6 py-4">
          <div className="text-[11px] uppercase tracking-[0.22em] text-leiser">preroll</div>
          <div className="flex items-center gap-3">
            <span className="text-[12.5px] text-leise">{gast.name}</span>
            <form action={abmelden}>
              <button type="submit" className="text-[11.5px] text-leiser hover:text-akzent">
                Abmelden
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[880px] px-6 py-10">
        <h1 className="text-[26px] font-semibold tracking-[-0.02em]">Meine Freigaben</h1>
        <p className="mt-1.5 text-[13px] leading-relaxed text-leise">
          Alle Content-Pläne, zu denen Sie eingeladen wurden.
        </p>

        {beteiligungen.length === 0 ? (
          <div className="mt-8">
            <Leerzustand
              titel="Noch keine Freigabe-Links"
              text={`Für ${gast.email} liegt aktuell kein Plan vor. Sobald Sie eingeladen werden, erscheint der Link hier — und Sie bekommen eine E-Mail.`}
            />
          </div>
        ) : (
          <div className="mt-8 grid gap-10">
            {[
              { titel: 'Wartet auf Ihre Freigabe', liste: offen },
              { titel: 'Abgeschlossen', liste: erledigt },
            ]
              .filter((gruppe) => gruppe.liste.length > 0)
              .map((gruppe) => (
                <section key={gruppe.titel}>
                  <h2 className="mb-3 text-[10.5px] uppercase tracking-[0.1em] text-still">
                    {gruppe.titel}
                  </h2>
                  <div className="grid gap-3">
                    {gruppe.liste.map(({ export: exp }) => {
                      const abgelaufen = istAbgelaufen(exp.gueltigBis)
                      const freigabe = exp.freigaben[0]

                      return (
                        <Karte key={exp.id} className="p-5">
                          <div className="flex flex-wrap items-start justify-between gap-4">
                            <div className="flex items-start gap-3.5">
                              {exp.kunde.logoId ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={thumbUrl(exp.kunde.logoId)!}
                                  alt=""
                                  className="size-10 shrink-0 rounded-full object-cover"
                                />
                              ) : (
                                <span className="schraffur size-10 shrink-0 rounded-full border border-dashed border-rahmen-3" />
                              )}
                              <div>
                                <div className="text-[14.5px] font-semibold">
                                  {exp.titel ?? zeitraumText(exp.zeitraumVon, exp.zeitraumBis)}
                                </div>
                                <div className="mt-0.5 text-[12px] text-leiser">
                                  {exp.kunde.name} · {zeitraumText(exp.zeitraumVon, exp.zeitraumBis)}
                                  {exp._count.kommentare > 0 &&
                                    ` · ${exp._count.kommentare} Anmerkungen`}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-3">
                              {exp.freigegebenAm ? (
                                <span className="rounded-[3px] bg-final-flaeche px-2.5 py-1 text-[11.5px] font-medium text-final">
                                  freigegeben
                                </span>
                              ) : abgelaufen ? (
                                <span className="rounded-[3px] bg-konzept-flaeche px-2.5 py-1 text-[11.5px] font-medium text-konzept">
                                  abgelaufen
                                </span>
                              ) : (
                                <span className="rounded-[3px] bg-vorschau-flaeche px-2.5 py-1 text-[11.5px] font-medium text-vorschau">
                                  im Review
                                </span>
                              )}

                              {!abgelaufen && (
                                <Link
                                  href={`/f/${exp.token}`}
                                  className="rounded-[5px] border border-rahmen-3 px-3.5 py-1.5 text-[12.5px] font-medium text-tinte hover:border-rahmen-4"
                                >
                                  Öffnen
                                </Link>
                              )}
                            </div>
                          </div>

                          <p className="mt-3 text-[11.5px] text-stiller">
                            {freigabe
                              ? `Freigegeben von ${freigabe.autorName} am ${ZEITSTEMPEL.format(freigabe.erstelltAm)}`
                              : exp.gueltigBis
                                ? `Rückmeldung erbeten bis ${formatiereTag(exp.gueltigBis)}`
                                : 'Ohne Frist'}
                          </p>
                        </Karte>
                      )
                    })}
                  </div>
                </section>
              ))}
          </div>
        )}
      </main>
    </div>
  )
}
