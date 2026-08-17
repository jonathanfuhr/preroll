import { prisma } from '@/lib/db'
import { ladeKunde } from '@/lib/abfragen'
import { env } from '@/lib/env'
import { postsImZeitraum } from '@/lib/export-sicht'
import { freigabeFortschritt } from '@/lib/freigabe'
import { monateAusPosts } from '@/lib/monate'
import { darfAnsprechpartnerSein } from '@/lib/rollen'
import { Karte, Leerzustand } from '@/components/ui'
import { freigabelinkErzeugen } from '../aktionen'
import { ZipZeitraum, ZugangKarte } from './verwaltung'

const ZEITSTEMPEL = new Intl.DateTimeFormat('de-DE', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

/** `2026-08-01` — der Wert eines Datumsfeldes, ohne Zeitzonen-Rutsch. */
function alsTag(datum: Date): string {
  return `${datum.getFullYear()}-${String(datum.getMonth() + 1).padStart(2, '0')}-${String(
    datum.getDate(),
  ).padStart(2, '0')}`
}

/**
 * Der Freigabezugang eines Kunden — genau einer.
 *
 * Vorher stand hier eine Karte je Monat mit eigenem Link, eigener Gästeliste
 * und eigener Einladung: dieselbe Arbeit jeden Monat, und ein Gast aus dem
 * August kam im September nicht hinein. Der Monat ist keine Eigenschaft des
 * Zugangs, sondern eine Sicht darin — er steht in der Adresse, und welche
 * Monate es gibt, sagen die Beiträge.
 *
 * Was der Kunde freigegeben hat, hatte einmal eine eigene Seite. Die ist
 * entfallen: Die Post-Liste zeigt es je Zeile, und zweimal dieselbe Auskunft
 * an zwei Stellen läuft irgendwann auseinander. Hier steht nur der Stand je
 * Monat — dieselbe Zahl, die auch der Kunde in seiner Leiste sieht.
 */
export default async function FreigabenSeite({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const kunde = await ladeKunde(slug)

  // Als zusätzlicher Ansprechpartner kommt jedes aktive Konto in Frage,
  // das nicht im Schnitt sitzt.
  const waehlbare = (
    await prisma.nutzer.findMany({ where: { aktiv: true }, orderBy: { name: 'asc' } })
  )
    .filter((n) => darfAnsprechpartnerSein(n.rolle))
    .map((n) => ({ id: n.id, name: n.name, rolle: n.rolle }))

  const [zugang, posts] = await Promise.all([
    prisma.export.findUnique({
      where: { kundeId: kunde.id },
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

  const monatsliste = monateAusPosts(posts)
  const monate = monatsliste.map((m) => {
    const stand = freigabeFortschritt(
      postsImZeitraum(posts, { zeitraumVon: m.von, zeitraumBis: m.bis }),
    )
    return { monat: m.monat, titel: m.titel, erledigt: stand.erledigt, gesamt: stand.gesamt }
  })

  if (!zugang) {
    return (
      <>
        <Kopf name={kunde.name} monate={0} />
        <Karte className="p-5">
          <Leerzustand
            titel="Noch kein Freigabelink"
            text="Ein Link zeigt dem Kunden jeden Monat — Kalender, Feed-Vorschau und jeden Beitrag im iPhone-Rahmen. Als Live-Sicht, nicht als Schnappschuss. Welche Monate er sieht, ergibt sich aus den Beiträgen."
          />
          <form action={freigabelinkErzeugen.bind(null, kunde.id)} className="mt-4 flex justify-center">
            <button
              type="submit"
              className="rounded-[5px] bg-akzent px-3.5 py-2 text-[12px] font-medium text-white hover:opacity-90"
            >
              Freigabelink erzeugen
            </button>
          </form>
        </Karte>
      </>
    )
  }

  // Der Vorschlag für den ZIP-Zeitraum: der älteste bis der neueste Monat, in
  // dem etwas steht. Ohne Beiträge der laufende Monat.
  const heute = new Date()
  const von = monatsliste.at(-1)?.von ?? new Date(heute.getFullYear(), heute.getMonth(), 1)
  const bis = monatsliste[0]?.bis ?? new Date(heute.getFullYear(), heute.getMonth() + 1, 0)

  return (
    <>
      <Kopf name={kunde.name} monate={monate.length} />

      <div className="grid gap-6">
        <ZipZeitraum
          exportId={zugang.id}
          von={alsTag(von)}
          bis={alsTag(bis)}
          plattformen={kunde.plattformen}
        />

        <ZugangKarte
          zugang={{
            id: zugang.id,
            token: zugang.token,
            titel: zugang.titel,
            zusatzAnsprechpartnerId: zugang.zusatzAnsprechpartnerId,
            aufrufe: zugang.aufrufe,
            zuletztGeoeffnet: zugang.zuletztGeoeffnet
              ? ZEITSTEMPEL.format(zugang.zuletztGeoeffnet)
              : null,
            kommentare: zugang._count.kommentare,
          }}
          basisUrl={env.appUrl}
          waehlbare={waehlbare}
          gaeste={zugang.gaeste.map((g) => ({
            id: g.gast.id,
            name: g.gast.name,
            email: g.gast.email,
            geoeffnet: g.zuletztGeoeffnetAm ? ZEITSTEMPEL.format(g.zuletztGeoeffnetAm) : null,
          }))}
          monate={monate}
          mitFreigaben={kunde.freigabenNoetig}
        />
      </div>
    </>
  )
}

function Kopf({ name, monate }: { name: string; monate: number }) {
  return (
    <div className="mb-6">
      <h2 className="text-[15px] font-semibold">Freigaben</h2>
      <p className="mt-0.5 text-[12.5px] text-leiser">
        Ein Link für {name}
        {monate > 0 && ` · ${monate === 1 ? '1 Monat' : `${monate} Monate`}`}
      </p>
    </div>
  )
}
