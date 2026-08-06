import 'server-only'
import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { prisma } from './db'
import { absoluterPfad, speichereMedium } from './medien'

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
 * Legt für ein Reel ein Thumbnail an, falls keines hochgeladen wurde. Wirft
 * nie — ein fehlendes Thumbnail ist ein Schönheitsfehler, kein Grund, einen
 * Upload scheitern zu lassen.
 */
export async function thumbnailAusVideoErgaenzen(postId: string): Promise<boolean> {
  try {
    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: { medien: { include: { medium: true } } },
    })
    if (!post || post.typ !== 'REEL') return false
    if (post.medien.some((m) => m.rolle === 'THUMBNAIL')) return false

    const video = post.medien.find(
      (m) => m.rolle === 'MEDIUM' && m.medium.mimeTyp.startsWith('video/'),
    )
    if (!video) return false

    const bild = await standbild(video.medium.pfad)
    if (!bild?.length) return false

    const { medium } = await speichereMedium({
      inhalt: bild,
      dateiname: `${post.titel.slice(0, 40)}-thumbnail.jpg`,
      mimeTyp: 'image/jpeg',
      kundeId: post.kundeId,
      quelleId: video.mediumId,
    })

    await prisma.postMedium.create({
      data: { postId, mediumId: medium.id, rolle: 'THUMBNAIL', position: 0 },
    })
    return true
  } catch (fehler) {
    console.warn('[video] Thumbnail konnte nicht erzeugt werden:', fehler)
    return false
  }
}
