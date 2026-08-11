'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { aktuellerNutzer } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { uebernehmePlattformen } from '@/lib/kunde-plattformen'
import { ladeMetaZugang, metaSeiten } from '@/lib/plattform-zugang'
import { plattformenAusFormular } from '@/lib/plattformen'

async function angemeldetOderRaus() {
  const nutzer = await aktuellerNutzer()
  if (!nutzer) redirect('/anmelden')
}

/**
 * Plattformwahl, Kanalzuordnung und der Schalter fürs Selbst-Posten — ein
 * Formular, weil es eine Sache ist: wohin dieser Kunde bespielt wird.
 *
 * Der Seiten-Token wird hier am Server aus dem Zugang geholt, nicht aus dem
 * Formular gelesen: Ein Token, das durch den Browser läuft, steht im
 * Quelltext der Seite. Aus dem Formular kommt nur die Seiten-Kennung.
 *
 * Beide Blöcke tragen ein verstecktes Merkerfeld. Ohne das würde ein
 * Speichern ohne Meta-Zugang — dann fehlt der ganze Kanalblock im Formular —
 * die Zuordnung löschen, obwohl niemand sie angefasst hat.
 */
export async function veroeffentlichenSpeichern(
  kundeId: string,
  slug: string,
  formular: FormData,
) {
  await angemeldetOderRaus()

  const ziel = `/kunden/${slug}/stammdaten`
  const plattformen = plattformenAusFormular(formular)
  const plattformenDa = formular.get('plattformenGesetzt') === '1'
  const kanalDa = formular.get('kanalGesetzt') === '1'

  if (plattformenDa) {
    await prisma.kunde.update({ where: { id: kundeId }, data: { plattformen } })
    if (formular.get('plattformenUebernehmen') === 'on') {
      await uebernehmePlattformen(kundeId, plattformen)
    }
  }

  if (!kanalDa) {
    revalidatePath(ziel, 'layout')
    return
  }

  const postenAktiv = formular.get('postenAktiv') === 'on'
  const seitenId = String(formular.get('fbSeitenId') ?? '').trim()

  if (!seitenId) {
    await prisma.kunde.update({
      where: { id: kundeId },
      data: {
        postenAktiv: false,
        metaZugangId: null,
        fbSeitenId: null,
        fbSeitenName: null,
        fbSeitenToken: null,
        igKontoId: null,
        igName: null,
      },
    })
    revalidatePath(ziel, 'layout')
    return
  }

  const [seiten, zugang] = await Promise.all([metaSeiten(), ladeMetaZugang()])
  const seite = seiten.find((s) => s.id === seitenId)

  if (!seite || !zugang) {
    redirect(
      `${ziel}?meta=fehler&meldung=${encodeURIComponent(
        'Diese Seite ist über den hinterlegten Zugang gerade nicht erreichbar.',
      )}`,
    )
  }

  await prisma.kunde.update({
    where: { id: kundeId },
    data: {
      postenAktiv,
      metaZugangId: zugang.id,
      fbSeitenId: seite.id,
      fbSeitenName: seite.name,
      fbSeitenToken: seite.token,
      igKontoId: seite.igKontoId,
      igName: seite.igName,
    },
  })

  revalidatePath(ziel, 'layout')
}
