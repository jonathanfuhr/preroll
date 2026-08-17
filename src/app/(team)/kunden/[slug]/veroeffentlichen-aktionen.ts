'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { aktuellerNutzer } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { uebernehmePlattformen } from '@/lib/kunde-plattformen'
import { ladeLinkedInZugang, linkedInOrganisationen } from '@/lib/linkedin-zugang'
import { metaSeiten } from '@/lib/plattform-zugang'
import { moeglichePlattformen, wahlAusFormular } from '@/lib/plattformen'

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
    const seitenId = String(formular.get('fbSeitenId') ?? '').trim()

    if (!seitenId) {
      await prisma.kunde.update({
        where: { id: kundeId },
        data: {
          /*
            Ohne Seite kann Preroll für Meta nicht mehr posten — die beiden
            fliegen deshalb aus `postenPlattformen`. **Aus `plattformen`
            nicht:** Geplant bleibt geplant, nur eben von Hand. Genau dafür
            gibt es den mittleren Modus.
          */
          postenPlattformen: { set: [] },
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
        // Nichts zu tun: Die Zuordnung steht, Meta antwortet nur gerade nicht.
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
      select: { fbSeitenId: true, igKontoId: true, liOrganisationId: true },
    })
    const { plattformen, postenPlattformen } = wahlAusFormular(formular, kanaele)

    await prisma.kunde.update({
      where: { id: kundeId },
      data: {
        plattformen,
        postenPlattformen,
        // Abgeleitet, nicht zweitgepflegt: Der Hauptschalter je Kunde ist
        // wahr, sobald irgendeine Plattform auf „planen und posten" steht.
        // Er bleibt als Spalte, weil Zeitplaner und Einstellungen darauf
        // filtern — zwei Wahrheiten wären es nur, wenn beide von Hand
        // gesetzt würden.
        postenAktiv: postenPlattformen.length > 0,
      },
    })
    if (formular.get('plattformenUebernehmen') === 'on') {
      await uebernehmePlattformen(kundeId, plattformen)
    }
  }

  /*
    Fällt ein Kanal weg, muss auch der Hauptschalter nachziehen — sonst stünde
    er auf „an", während `postenPlattformen` leer ist. Steht hier am Ende,
    weil beide Blöcke daran drehen können.
  */
  const stand = await prisma.kunde.findUniqueOrThrow({
    where: { id: kundeId },
    select: { postenPlattformen: true, postenAktiv: true },
  })
  if (stand.postenAktiv !== stand.postenPlattformen.length > 0) {
    await prisma.kunde.update({
      where: { id: kundeId },
      data: { postenAktiv: stand.postenPlattformen.length > 0 },
    })
  }

  revalidatePath(ziel, 'layout')
}

/**
 * Die LinkedIn-Zuordnung eines Kunden.
 *
 * Eigene Aktion, nicht im Meta-Formular mit: Die beiden Anbieter haben nichts
 * miteinander zu tun, und ein gemeinsames Speichern hätte bei jedem Anfassen
 * der Facebook-Seite die LinkedIn-Zuordnung mitgeschickt — mit demselben
 * Löschrisiko, das die Merkerfelder bei Meta gerade abwenden.
 *
 * Der Name der Organisation wird **mitgespeichert** und nicht bei jeder Anzeige
 * nachgeholt: Steht der Zugang gerade nicht, soll in den Stammdaten trotzdem
 * lesbar sein, welche Seite zugeordnet ist. Sonst stünde dort eine nackte Zahl.
 */
export async function linkedInKanalSpeichern(
  kundeId: string,
  slug: string,
  formular: FormData,
) {
  await angemeldetOderRaus()

  const orgId = String(formular.get('liOrganisationId') ?? '').trim()

  if (!orgId) {
    await prisma.kunde.update({
      where: { id: kundeId },
      data: { liZugangId: null, liOrganisationId: null, liOrganisation: null },
    })
    revalidatePath(`/kunden/${slug}/stammdaten`, 'layout')
    return
  }

  const [zugang, geholt] = await Promise.all([ladeLinkedInZugang(), linkedInOrganisationen()])
  if (!zugang) {
    redirect(
      `/kunden/${slug}/stammdaten?linkedin=fehler&meldung=${encodeURIComponent(
        'Es ist kein LinkedIn-Zugang verbunden.',
      )}`,
    )
  }

  const treffer = geholt.ok ? geholt.organisationen.find((o) => o.id === orgId) : undefined

  /*
    Unverändert und gerade nicht abrufbar: nichts tun statt scheitern. Dieselbe
    Regel wie bei Meta — wer nur etwas anderes speichern wollte, soll seine
    Zuordnung nicht verlieren, weil LinkedIn kurz zickt.
  */
  const vorher = await prisma.kunde.findUniqueOrThrow({
    where: { id: kundeId },
    select: { liOrganisationId: true },
  })
  if (!treffer && vorher.liOrganisationId === orgId) {
    revalidatePath(`/kunden/${slug}/stammdaten`, 'layout')
    return
  }
  if (!treffer) {
    redirect(
      `/kunden/${slug}/stammdaten?linkedin=fehler&meldung=${encodeURIComponent(
        geholt.ok
          ? 'Diese Seite ist über den verbundenen Zugang gerade nicht erreichbar.'
          : geholt.fehler,
      )}`,
    )
  }

  await prisma.kunde.update({
    where: { id: kundeId },
    data: {
      liZugangId: zugang.id,
      liOrganisationId: treffer.id,
      liOrganisation: treffer.name,
    },
  })

  revalidatePath(`/kunden/${slug}/stammdaten`, 'layout')
}
