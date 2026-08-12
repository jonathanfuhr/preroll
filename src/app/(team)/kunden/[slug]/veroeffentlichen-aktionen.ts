'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { aktuellerNutzer } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { uebernehmePlattformen } from '@/lib/kunde-plattformen'
import { metaSeiten } from '@/lib/plattform-zugang'
import { moeglichePlattformen, plattformenAusFormular } from '@/lib/plattformen'

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
 *
 * **Reihenfolge ist hier keine Geschmacksfrage:** Erst der Kanal, dann die
 * Plattformen. Wer in einem Zug die Seite entfernt, hat im Browser noch die
 * alten, freien Kästchen vor sich — gegen den *neuen* Stand geschnitten
 * bleibt davon nichts übrig, und genau das ist richtig. Andersherum entstünde
 * die eine Lage, die es nicht geben soll: eine gewählte Plattform ohne Kanal.
 */
export async function veroeffentlichenSpeichern(
  kundeId: string,
  slug: string,
  formular: FormData,
) {
  await angemeldetOderRaus()

  const ziel = `/kunden/${slug}/stammdaten`
  const kanalDa = formular.get('kanalGesetzt') === '1'

  if (kanalDa) {
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
    } else {
      const [vorher, seiten] = await Promise.all([
        prisma.kunde.findUniqueOrThrow({ where: { id: kundeId }, select: { fbSeitenId: true } }),
        metaSeiten(),
      ])

      /*
        Unverändert und gerade nicht abrufbar: nichts tun statt scheitern.
        Meta antwortet nicht immer; wer nur die Plattformen umgestellt hat,
        soll deshalb nicht in einer Fehlermeldung landen — und seinen Kanal
        erst recht nicht verlieren.
      */
      const unveraendert = vorher.fbSeitenId === seitenId
      const seite = seiten.find((s) => s.id === seitenId)

      if (!seite && unveraendert) {
        await prisma.kunde.update({ where: { id: kundeId }, data: { postenAktiv } })
      } else if (!seite) {
        redirect(
          `${ziel}?meta=fehler&meldung=${encodeURIComponent(
            'Diese Seite ist über den hinterlegten Zugang gerade nicht erreichbar.',
          )}`,
        )
      } else {
        await prisma.kunde.update({
          where: { id: kundeId },
          data: {
            postenAktiv,
            // Der Zugang kommt von der Seite, nicht „der eine": Bei mehreren
            // Portfolios hängt jede Seite an ihrem eigenen Systemnutzer.
            metaZugangId: seite.zugangId,
            fbSeitenId: seite.id,
            fbSeitenName: seite.name,
            fbSeitenToken: seite.token,
            igKontoId: seite.igKontoId,
            igName: seite.igName,
          },
        })
      }
    }
  }

  if (formular.get('plattformenGesetzt') === '1') {
    // Gegen den Stand **nach** der Kanalzuordnung schneiden. Die Sperre im
    // Formular ist Bequemlichkeit; verlassen wird sich der Server auf sie nie.
    const kanaele = await prisma.kunde.findUniqueOrThrow({
      where: { id: kundeId },
      select: { fbSeitenId: true, igKontoId: true },
    })
    const moeglich = moeglichePlattformen(kanaele)
    const plattformen = plattformenAusFormular(formular).filter((p) => moeglich.includes(p))

    await prisma.kunde.update({ where: { id: kundeId }, data: { plattformen } })
    if (formular.get('plattformenUebernehmen') === 'on') {
      await uebernehmePlattformen(kundeId, plattformen)
    }
  }

  revalidatePath(ziel, 'layout')
}
