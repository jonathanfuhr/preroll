import 'server-only'
import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { prisma } from './db'
import { absoluterPfad, speichereMedium } from './medien'
import { leseVideoPlatz, type VideoPlatz } from './video-platz'
import { formatiereDauer } from './videolaenge'

const ausfuehren = promisify(execFile)

/**
 * Standbilder aus Videos — für Reels, bei denen niemand ein Thumbnail
 * hochgeladen hat. Ohne Thumbnail zeigt das Profilraster nur eine Schraffur,
 * und genau dort entscheidet sich, ob der Feed stimmig aussieht.
 */

/** Ist ffmpeg vorhanden? Ohne bleibt es beim leeren Thumbnail. */
export async function ffmpegVerfuegbar(): Promise<boolean> {
  try {
    await ausfuehren('ffmpeg', ['-version'], { timeout: 10_000 })
    return true
  } catch {
    return false
  }
}

/**
 * Ein Einzelbild aus dem Video. Gegriffen wird bei einer Sekunde statt beim
 * ersten Bild: Reels beginnen oft mit einem Schwarzbild oder einem
 * Bewegungsunschärfe-Frame.
 */
export async function standbild(videoPfad: string): Promise<Buffer | null> {
  const ordner = await mkdtemp(path.join(tmpdir(), 'preroll-standbild-'))
  const ziel = path.join(ordner, 'bild.jpg')

  try {
    await ausfuehren(
      'ffmpeg',
      ['-ss', '1', '-i', absoluterPfad(videoPfad), '-frames:v', '1', '-q:v', '3', '-y', ziel],
      { timeout: 60_000 },
    )
    return await readFile(ziel)
  } catch {
    // Video kürzer als eine Sekunde? Dann eben das allererste Bild.
    try {
      await ausfuehren(
        'ffmpeg',
        ['-i', absoluterPfad(videoPfad), '-frames:v', '1', '-q:v', '3', '-y', ziel],
        { timeout: 60_000 },
      )
      return await readFile(ziel)
    } catch {
      return null
    }
  } finally {
    await rm(ordner, { recursive: true, force: true }).catch(() => {})
  }
}

/**
 * Wie lang das Video ist, in Sekunden — oder null, wenn es sich nicht sagen
 * lässt.
 *
 * `ffprobe` liegt neben `ffmpeg` im Abbild. Gefragt wird nach dem
 * **Container**, nicht nach dem Videostrom: Bei manchen Dateien hat der Strom
 * keine eigene Dauer, der Container fast immer.
 */
export async function videodauer(videoPfad: string): Promise<number | null> {
  try {
    const { stdout } = await ausfuehren(
      'ffprobe',
      [
        '-v', 'error',
        '-show_entries', 'format=duration',
        '-of', 'default=noprint_wrappers=1:nokey=1',
        absoluterPfad(videoPfad),
      ],
      { timeout: 30_000 },
    )
    const sekunden = Number.parseFloat(stdout.trim())
    return Number.isFinite(sekunden) && sekunden > 0 ? sekunden : null
  } catch {
    return null
  }
}

/**
 * Trägt die gemessene Länge in das Freifeld des Beitrags ein.
 *
 * Nur beim **Reel** und nur am **Beitrag**: Bei Standbildern ergibt eine
 * Länge keinen Sinn, und eine Fassung hat gar kein solches Feld — sie teilt
 * sich die Eckdaten mit dem Beitrag. Ein Fassungsvideo überschriebe sonst die
 * Länge des Hauptvideos, und das wäre die falsche Zahl an der falschen Stelle.
 *
 * **Überschrieben wird**, was dort steht. Wer ein Video austauscht, hat eine
 * neue Länge — die alte stehen zu lassen wäre die schlechtere Lüge. Wirft nie:
 * Eine fehlende Zahl ist ein Schönheitsfehler, kein Grund, einen Upload
 * scheitern zu lassen.
 */
export async function laengeAusVideoUebernehmen(platz: VideoPlatz): Promise<string | null> {
  try {
    if (platz.art !== 'POST') return null

    const stand = await leseVideoPlatz(platz)
    if (!stand || stand.postTyp !== 'REEL') return null

    const video = await prisma.postMedium.findFirst({
      where: { postId: platz.id, rolle: 'MEDIUM' },
      include: { medium: true },
    })
    if (!video?.medium.mimeTyp.startsWith('video/')) return null

    const sekunden = await videodauer(video.medium.pfad)
    if (sekunden === null) return null

    const laenge = formatiereDauer(sekunden)
    await prisma.post.update({ where: { id: platz.id }, data: { laenge } })
    return laenge
  } catch (fehler) {
    console.warn('[video] Länge konnte nicht ermittelt werden:', fehler)
    return null
  }
}

/**
 * Legt für ein Reel ein Thumbnail an, falls keines hochgeladen wurde. Wirft
 * nie — ein fehlendes Thumbnail ist ein Schönheitsfehler, kein Grund, einen
 * Upload scheitern zu lassen.
 */
export async function thumbnailAusVideoErgaenzen(platz: VideoPlatz): Promise<boolean> {
  try {
    const stand = await leseVideoPlatz(platz)
    if (!stand || stand.postTyp !== 'REEL') return false

    // Die Medien des Platzes, nicht die des Beitrags: Eine Fassung mit eigenem
    // Video braucht ein Standbild aus **ihrem** Video. Das des Beitrags zu
    // nehmen hieße, ein fremdes Bild vor einen anderen Schnitt zu setzen.
    const medien =
      platz.art === 'POST'
        ? await prisma.postMedium.findMany({
            where: { postId: platz.id },
            include: { medium: true },
          })
        : await prisma.postVarianteMedium.findMany({
            where: { varianteId: platz.id },
            include: { medium: true },
          })

    if (medien.some((m) => m.rolle === 'THUMBNAIL')) return false

    const video = medien.find(
      (m) => m.rolle === 'MEDIUM' && m.medium.mimeTyp.startsWith('video/'),
    )
    if (!video) return false

    const bild = await standbild(video.medium.pfad)
    if (!bild?.length) return false

    const { medium } = await speichereMedium({
      inhalt: bild,
      dateiname: `${stand.postTitel.slice(0, 40)}-thumbnail.jpg`,
      mimeTyp: 'image/jpeg',
      kundeId: stand.kundeId,
      quelleId: video.mediumId,
    })

    if (platz.art === 'POST') {
      await prisma.postMedium.create({
        data: { postId: platz.id, mediumId: medium.id, rolle: 'THUMBNAIL', position: 0 },
      })
    } else {
      await prisma.postVarianteMedium.create({
        data: { varianteId: platz.id, mediumId: medium.id, rolle: 'THUMBNAIL', position: 0 },
      })
    }
    return true
  } catch (fehler) {
    console.warn('[video] Thumbnail konnte nicht erzeugt werden:', fehler)
    return false
  }
}
