'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { aktuellerNutzer } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { ladeMetaZugang, metaSeiten } from '@/lib/plattform-zugang'

async function angemeldetOderRaus() {
  const nutzer = await aktuellerNutzer()
  if (!nutzer) redirect('/anmelden')
}

/**
 * Kanal zuordnen und das Veröffentlichen ein- oder ausschalten.
 *
 * Der Seiten-Token wird hier am Server aus dem Zugang geholt, nicht aus dem
 * Formular gelesen: Ein Token, das durch den Browser läuft, steht im
 * Quelltext der Seite. Aus dem Formular kommt nur die Seiten-Kennung.
 */
export async function metaKanalZuordnen(kundeId: string, slug: string, formular: FormData) {
  await angemeldetOderRaus()

  const postenAktiv = formular.get('postenAktiv') === 'on'
  const seitenId = String(formular.get('fbSeitenId') ?? '').trim()
  const ziel = `/kunden/${slug}/stammdaten`

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
    revalidatePath(ziel)
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

  revalidatePath(ziel)
}
