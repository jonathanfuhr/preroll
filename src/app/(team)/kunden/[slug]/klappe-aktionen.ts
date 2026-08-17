'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { Plattform } from '@prisma/client'
import { aktuellerNutzer } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { PLATTFORM_TEXT } from '@/lib/plattformen'
import { brichVideoDownloadAb } from '@/lib/video-download'
import {
  leseVideoPlatz,
  platzAus,
  raeumeVideoMedium,
  schreibeVideoPlatz,
  type VideoPlatz,
} from '@/lib/video-platz'
import {
  klappeFassungen,
  klappeVideoAnlegen,
  klappeVideoBeschreibung,
  klappeVideoName,
  klappeVideoUmbenennen,
  klappeVideos,
  type KlappeVideo,
} from '@/lib/klappe'

async function nutzerOderRaus() {
  const nutzer = await aktuellerNutzer()
  if (!nutzer) redirect('/anmelden')
  return nutzer
}

// ------------------------------------------------------- Kunde ↔ Projekt

export async function klappeProjektZuordnen(kundeId: string, formular: FormData) {
  await nutzerOderRaus()

  const wert = String(formular.get('klappeProjekt') ?? '').trim()
  // Der Wert trägt Kennung und Namen, damit der Name ohne zweite Abfrage steht.
  const [id, ...rest] = wert.split('|')

  const kunde = await prisma.kunde.update({
    where: { id: kundeId },
    data: {
      klappeProjektId: id || null,
      klappeProjektName: rest.join('|') || null,
    },
  })

  revalidatePath(`/kunden/${kunde.slug}`, 'layout')
}

/**
 * Holt die Projektliste frisch bei Klappe. Preroll fragt sie ohnehin bei
 * jedem Aufruf der Stammdaten ab — der Knopf ist für den Fall, dass dort
 * gerade ein Projekt entstanden ist und man nicht erst die Seite suchen will.
 */
export async function klappeProjekteAktualisieren(kundeSlug: string) {
  await nutzerOderRaus()
  revalidatePath(`/kunden/${kundeSlug}/stammdaten`)
}

export async function aworkProjektZuordnen(kundeId: string, formular: FormData) {
  await nutzerOderRaus()

  const wert = String(formular.get('aworkProjekt') ?? '').trim()
  const [id, ...rest] = wert.split('|')

  const kunde = await prisma.kunde.update({
    where: { id: kundeId },
    data: {
      aworkProjektId: id || null,
      aworkProjektName: rest.join('|') || null,
    },
  })

  revalidatePath(`/kunden/${kunde.slug}`, 'layout')
}

// --------------------------------------------------------- Video am Post

/**
 * Legt in Klappe ein Video für diesen Post an. Läuft beim Anlegen eines Reels
 * automatisch mit; hier steht die Nachhol-Variante für Posts, die vor der
 * Kopplung entstanden sind oder bei denen es beim ersten Versuch scheiterte.
 */
export async function klappeVideoErzeugen(postId: string, varianteId: string | null) {
  await nutzerOderRaus()

  const platz = platzAus(postId, varianteId)
  const stand = await leseVideoPlatz(platz)
  if (!stand) return

  const kunde = await prisma.kunde.findUniqueOrThrow({ where: { id: stand.kundeId } })
  if (!kunde.klappeProjektId) {
    redirect(`/kunden/${stand.kundeSlug}/posts/${postId}?klappe=kein-projekt`)
  }
  if (stand.klappeVideoId) {
    redirect(`/kunden/${stand.kundeSlug}/posts/${postId}`)
  }

  /*
    Der Name einer Fassung trägt ihre Plattformen. In Klappe stehen sonst zwei
    Videos gleichen Namens im selben Projekt, und wer dort schneidet, sieht
    nicht, welches der beiden das quadratische für LinkedIn ist.
  */
  const grundname = klappeVideoName(stand.postenAm, stand.postTitel)
  const name =
    stand.plattformen.length > 0
      ? `${grundname} (${stand.plattformen.map((p) => PLATTFORM_TEXT[p as Plattform]).join(', ')})`
      : grundname

  const ergebnis = await klappeVideoAnlegen(
    kunde.klappeProjektId,
    name,
    klappeVideoBeschreibung(stand.postenAm, kunde.name),
  )

  if (!ergebnis.ok) {
    redirect(
      `/kunden/${stand.kundeSlug}/posts/${postId}?klappe=fehler&meldung=${encodeURIComponent(ergebnis.fehler)}`,
    )
  }

  await schreibeVideoPlatz(platz, {
    klappeVideoId: ergebnis.daten.id,
    klappeVideoName: ergebnis.daten.name,
    klappeVideoUrl: ergebnis.daten.webUrl ?? `/videos/${ergebnis.daten.id}`,
    klappeStandAm: new Date(),
  })

  revalidatePath(`/kunden/${stand.kundeSlug}`, 'layout')
}

/**
 * Verknüpft den Video-Platz mit einem vorhandenen Video aus Klappe.
 *
 * Der Platz ist der Beitrag oder eine seiner Fassungen — eine Fassung, die ein
 * anderes Video zeigen soll, braucht auch einen anderen Schnitt. Über den
 * Beitrag geführt setzte die Wahl für LinkedIn das Instagram-Video mit um.
 */
export async function klappeVideoVerknuepfen(
  postId: string,
  varianteId: string | null,
  formular: FormData,
) {
  await nutzerOderRaus()

  const platz = platzAus(postId, varianteId)
  const videoId = String(formular.get('videoId') ?? '').trim()
  const stand = await leseVideoPlatz(platz)
  if (!stand) return

  if (!videoId) {
    await schreibeVideoPlatz(platz, {
      klappeVideoId: null,
      klappeVideoName: null,
      klappeVideoUrl: null,
      klappeVersionId: null,
      klappeVersionNummer: null,
      klappeStandAm: null,
    })
    revalidatePath(`/kunden/${stand.kundeSlug}`, 'layout')
    return
  }

  const name = String(formular.get('videoName') ?? '').trim() || null
  await schreibeVideoPlatz(platz, {
    klappeVideoId: videoId,
    klappeVideoName: name,
    klappeVideoUrl: `/videos/${videoId}`,
    klappeStandAm: new Date(),
  })

  await holeFassung(platz, videoId)
  revalidatePath(`/kunden/${stand.kundeSlug}`, 'layout')
}

/**
 * Holt die aktuell freigegebene Endfassung. Interne Fassungen bleiben außen
 * vor — was der Kunde sieht, soll auch in Klappe freigegeben sein.
 */
async function holeFassung(platz: VideoPlatz, videoId: string): Promise<string | null> {
  const fassungen = await klappeFassungen(videoId)
  if (!fassungen.ok) return fassungen.fehler

  const brauchbar = fassungen.daten.filter((f) => !f.internal && f.status === 'READY')
  const gewaehlt = brauchbar.find((f) => f.isFinal) ?? brauchbar[0]

  // Die Fassung übernimmt den Video-Platz — wie jede der drei Quellen
  // ersetzt sie, was vorher dort stand: Das MEDIUM wird ausgehängt (die
  // Datei bleibt in der Bibliothek), ein laufender Download abgebrochen und
  // der Link geräumt. Ohne das hätte ein hochgeladenes Video weiter Vorrang
  // (`reelVideoQuelle`), und die Wahl liefe ins Leere.
  if (gewaehlt) {
    await brichVideoDownloadAb(platz)
    await raeumeVideoMedium(platz)
  }

  await schreibeVideoPlatz(platz, {
    klappeVersionId: gewaehlt?.id ?? null,
    klappeVersionNummer: gewaehlt?.versionNumber ?? null,
    klappeStandAm: new Date(),
    ...(gewaehlt
      ? {
          videoDownloadUrl: null,
          videoDownloadStand: null,
          videoDownloadFortschritt: 0,
          videoDownloadMeldung: null,
        }
      : {}),
  })

  return gewaehlt ? null : 'Für dieses Video liegt noch keine freigegebene Fassung vor.'
}

export async function klappeFassungAktualisieren(postId: string, varianteId: string | null) {
  await nutzerOderRaus()

  const platz = platzAus(postId, varianteId)
  const stand = await leseVideoPlatz(platz)
  if (!stand?.klappeVideoId) return

  const fehler = await holeFassung(platz, stand.klappeVideoId)
  revalidatePath(`/kunden/${stand.kundeSlug}`, 'layout')

  if (fehler) {
    redirect(
      `/kunden/${stand.kundeSlug}/posts/${postId}?klappe=hinweis&meldung=${encodeURIComponent(fehler)}`,
    )
  }
}

/** Benennt das Video in Klappe um, wenn sich Titel oder Termin geändert haben. */
export async function klappeVideoNachziehen(postId: string): Promise<void> {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: { kunde: true },
  })
  if (!post?.klappeVideoId) return

  const name = klappeVideoName(post.postenAm, post.titel)
  if (name === post.klappeVideoName) return

  const ergebnis = await klappeVideoUmbenennen(
    post.klappeVideoId,
    name,
    klappeVideoBeschreibung(post.postenAm, post.kunde.name),
  )
  if (!ergebnis.ok) {
    console.warn('[klappe] Umbenennen fehlgeschlagen:', ergebnis.fehler)
    return
  }

  await prisma.post.update({ where: { id: postId }, data: { klappeVideoName: name } })
}

/** Videos des Kundenprojekts — Grundlage der Auswahl im Editor. */
export async function ladeKlappeVideos(kundeId: string): Promise<{
  videos: KlappeVideo[]
  fehler: string | null
}> {
  const kunde = await prisma.kunde.findUnique({ where: { id: kundeId } })
  if (!kunde?.klappeProjektId) return { videos: [], fehler: null }

  const ergebnis = await klappeVideos(kunde.klappeProjektId)
  return ergebnis.ok
    ? { videos: ergebnis.daten, fehler: null }
    : { videos: [], fehler: ergebnis.fehler }
}
