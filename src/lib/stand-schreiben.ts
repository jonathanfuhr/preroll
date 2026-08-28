import 'server-only'
import type { Prisma } from '@prisma/client'
import { prisma } from './db'
import { istSichtbarePhase } from './phasen'
import { standAusPost } from './post-stand'

/**
 * Den Stand einer sichtbaren Phase festschreiben — beim **Verlassen**, nicht
 * beim Betreten.
 *
 * Der Plan sagte „beim Eintritt". Das wäre die falsche Sekunde: Zwischen dem
 * Eintritt ins Konzept und dem Weiterschalten in die Produktion liegt die
 * ganze Konzeptrunde, in der noch getippt und ausgetauscht wird. Ein beim
 * Eintritt festgeschriebener Stand wäre in dem Moment, in dem er zum ersten
 * Mal gezeigt wird, längst überholt — der Kunde sähe beim Phasenwechsel einen
 * Sprung **zurück** auf etwas, das er vor Tagen schon anders gesehen hat.
 *
 * Beim Verlassen festgeschrieben hält der Stand genau das, was zuletzt auf
 * seinem Bildschirm stand. Solange die Phase sichtbar ist, liest die
 * Kundenseite ohnehin live — es gibt also nichts fortzuschreiben, und damit
 * auch keine zweite Stelle, an der jemand das Nachziehen vergessen könnte.
 *
 * Eingefroren wird bei **jedem** Wechsel aus einer sichtbaren Phase, nicht nur
 * beim Schritt in eine Arbeitsphase: Sonst gäbe es nach dem Weg
 * Konzept → Vorschau → Produktion keinen Konzept-Stand, und die Produktion
 * hätte nichts zu zeigen.
 */

const INHALT = {
  szenen: { orderBy: { position: 'asc' as const } },
  medien: { include: { medium: true }, orderBy: [{ rolle: 'asc' as const }, { position: 'asc' as const }] },
  varianten: {
    orderBy: { position: 'asc' as const },
    include: {
      medien: {
        include: { medium: true },
        orderBy: [{ rolle: 'asc' as const }, { position: 'asc' as const }],
      },
    },
  },
} satisfies Prisma.PostInclude

/**
 * Friert die Stände der Beiträge ein, die gerade eine sichtbare Phase
 * verlassen. Beiträge, die schon in einer Arbeitsphase stehen oder ihre Phase
 * gar nicht wechseln, bleiben unberührt.
 *
 * Läuft als **eine** Transaktion, aus demselben Grund wie die Sammelaktionen
 * selbst: Ein halb eingefrorener Stapel wäre ein Zustand, den niemand erklären
 * kann.
 */
export async function friereStaendeEin(postIds: string[], neuePhase: string): Promise<number> {
  if (postIds.length === 0) return 0

  const posts = await prisma.post.findMany({
    where: { id: { in: postIds } },
    include: INHALT,
  })

  const einzufrieren = posts.filter(
    (p) => istSichtbarePhase(p.status) && p.status !== neuePhase,
  )
  if (einzufrieren.length === 0) return 0

  await prisma.$transaction(
    einzufrieren.map((post) => {
      const inhalt = standAusPost(post) as unknown as Prisma.InputJsonValue
      return prisma.postStand.upsert({
        where: { postId_phase: { postId: post.id, phase: post.status } },
        create: { postId: post.id, phase: post.status, inhalt },
        /*
          Überschrieben, nicht bewahrt: Wer von der Vorschau in die Korrektur
          und wieder zurück wechselt, hat in der Zwischenzeit gearbeitet — und
          was der Kunde beim nächsten Mal sieht, ist dieser neue Stand. Einen
          Verlauf alter Stände gibt es bewusst nicht.
        */
        update: { inhalt, erstelltAm: new Date() },
      })
    }),
  )

  return einzufrieren.length
}
