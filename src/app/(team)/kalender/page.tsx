import { redirect } from 'next/navigation'
import { aktuellerNutzer } from '@/lib/auth'
import { beginnLokal, endeLokal } from '@/lib/datum'
import { prisma } from '@/lib/db'
import {
  alsMonatsschluessel,
  ausMonatsschluessel,
  versetzterMonat,
} from '@/lib/kalender-monat'
import { kundenFarbe } from '@/lib/kunde-farbe'
import { anzeigePhase } from '@/lib/status'
import { postPfad } from '@/lib/urls'
import { wochenDesMonats } from '@/components/kalender'
import { GesamtKalender, type GesamtEintrag } from '@/components/kalender-gesamt'
import { BrotkrumeSetzen } from '@/components/brotkrumen'

export const metadata = { title: 'Kalender — Preroll' }

/**
 * Alle Beiträge aller Kunden in einem Monat.
 *
 * Der Monat steht in der Adresse, nicht im Browser-Zustand: Für einen anderen
 * Monat müssen andere Zeilen geladen werden, und so lässt sich ein bestimmter
 * Monat auch verschicken. Der Kundenfilter dagegen arbeitet im Browser auf den
 * geladenen Zeilen — dieselbe Linie wie bei der Post-Liste.
 *
 * Gezeigt wird **alles mit Termin**, auch Entwürfe: Das hier ist die interne
 * Übersicht, und was im Kalender fehlt, wird bei der Planung übersehen.
 * Ungeplante Posts stehen bewusst nicht dabei — sie haben keinen Tag, an dem
 * sie hingehören, und die Spalte dafür sitzt beim einzelnen Kunden, wo man
 * sie auch auf einen Tag ziehen kann.
 */
export default async function KalenderSeite({
  searchParams,
}: {
  searchParams: Promise<{ monat?: string }>
}) {
  const nutzer = await aktuellerNutzer()
  if (!nutzer) redirect('/anmelden')

  const { monat: gewuenscht } = await searchParams
  const heute = new Date()
  const monat = ausMonatsschluessel(gewuenscht) ?? new Date(heute.getFullYear(), heute.getMonth(), 1)

  // Der Kalender zeigt die angebrochenen Wochen am Rand mit. Geladen wird
  // deshalb nicht der Monat, sondern genau das, was auf dem Bild steht —
  // sonst fehlen die Beiträge in den ersten und letzten Tagen.
  const wochen = wochenDesMonats(monat)
  const von = beginnLokal(wochen[0][0])
  const bis = endeLokal(wochen[wochen.length - 1][6])

  const [kunden, posts] = await Promise.all([
    prisma.kunde.findMany({
      where: { archiviert: false },
      orderBy: { name: 'asc' },
      select: { slug: true, name: true },
    }),
    prisma.post.findMany({
      where: {
        postenAm: { gte: von, lte: bis },
        kunde: { archiviert: false },
      },
      orderBy: { postenAm: 'asc' },
      select: {
        id: true,
        typ: true,
        verhaeltnis: true,
        titel: true,
        status: true,
        postenAm: true,
        plattformen: true,
        veroeffentlichungen: { select: { stand: true } },
        kunde: { select: { slug: true, name: true } },
      },
    }),
  ])

  const eintraege: GesamtEintrag[] = posts.map((p) => ({
    id: p.id,
    typ: p.typ,
    verhaeltnis: p.verhaeltnis,
    phase: anzeigePhase(p.status, p.postenAm, p.veroeffentlichungen, heute),
    // Anders als in den Kundenkalendern steht der Punkt hier für den Kunden.
    farbe: kundenFarbe(p.kunde.slug),
    // Der Kundenname steht vorn: In einer Ansicht über alle Kunden ist die
    // erste Frage, wessen Beitrag da liegt — der Titel sagt das nicht.
    titel: `${p.kunde.name} · ${p.titel}`,
    postenAm: p.postenAm,
    plattformen: p.plattformen,
    href: postPfad(p.kunde.slug, p.id),
    kundeSlug: p.kunde.slug,
    kundeName: p.kunde.name,
  }))

  return (
    <>
      <BrotkrumeSetzen stufen={[{ text: 'Kalender' }]} />

      <div className="mb-6">
        <h1 className="text-[24px] font-semibold tracking-[-0.02em]">Kalender</h1>
        {/*
          Kein „links": Am Telefon steht der Filter über dem Kalender, und ein
          Hinweis, der in die falsche Richtung zeigt, ist schlechter als keiner.
        */}
        <p className="mt-1 text-[12.5px] text-leise">
          Alle terminierten Beiträge aller Kunden. Voreingestellt stehen die freigegebenen da —
          Final und Gepostet; die früheren Phasen lassen sich über die Kästchen dazunehmen, und die
          Auswahl bleibt für den nächsten Besuch stehen. Die Punkte tragen hier die Farbe des
          Kunden, nicht die des Typs.
        </p>
      </div>

      <GesamtKalender
        monat={monat}
        eintraege={eintraege}
        kunden={kunden.map((k) => ({ ...k, farbe: kundenFarbe(k.slug) }))}
        vorher={`/kalender?monat=${alsMonatsschluessel(versetzterMonat(monat, -1))}`}
        naechster={`/kalender?monat=${alsMonatsschluessel(versetzterMonat(monat, 1))}`}
        heute={`/kalender?monat=${alsMonatsschluessel(new Date(heute.getFullYear(), heute.getMonth(), 1))}`}
      />
    </>
  )
}
