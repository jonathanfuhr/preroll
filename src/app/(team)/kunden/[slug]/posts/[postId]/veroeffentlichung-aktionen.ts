'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { aktuellerNutzer } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { takt } from '@/lib/veroeffentlichung-lauf'

/**
 * Eine gescheiterte Veröffentlichung noch einmal versuchen.
 *
 * Der Zeitplaner holt von sich aus nur `GEPLANT`-Zeilen — ein Fehlschlag
 * bleibt sonst für immer liegen. Es gibt zwei Wege zurück: dem Beitrag einen
 * neuen Termin geben (das erledigt der Abgleich) oder diesen Knopf. Der
 * zweite ist der, den man im Alltag benutzt: Wer die Ursache behoben hat,
 * will denselben Termin behalten und nur noch einmal loslassen.
 *
 * Der Versuchszähler beginnt von vorn, und `gemeldetAm` fällt weg — scheitert
 * es wieder, soll es wieder melden.
 */
export async function veroeffentlichungWiederholen(
  veroeffentlichungId: string,
  slug: string,
  postId: string,
) {
  const nutzer = await aktuellerNutzer()
  if (!nutzer) redirect('/anmelden')

  const zeile = await prisma.veroeffentlichung.findUnique({
    where: { id: veroeffentlichungId },
    select: { stand: true, post: { select: { postenAm: true } } },
  })
  if (!zeile || zeile.stand !== 'FEHLGESCHLAGEN') return

  await prisma.veroeffentlichung.update({
    where: { id: veroeffentlichungId },
    data: {
      stand: 'GEPLANT',
      // Fällig sofort: Der Termin ist ja längst vorbei, und wer hier klickt,
      // will nicht bis zur nächsten Planung warten. Liegt der Termin noch in
      // der Zukunft, bleibt er stehen.
      geplantFuer:
        zeile.post.postenAm && zeile.post.postenAm > new Date() ? zeile.post.postenAm : new Date(),
      versuche: 0,
      meldung: null,
      erledigtAm: null,
      gemeldetAm: null,
    },
  })

  // Nicht bis zum nächsten Takt warten — wer klickt, will ein Ergebnis sehen.
  await takt()
  revalidatePath(`/kunden/${slug}/posts/${postId}`)
}
