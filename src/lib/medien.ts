import 'server-only'
import { randomBytes } from 'node:crypto'
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { Medium } from '@prisma/client'
import sharp from 'sharp'
import { prisma } from './db'
import { env } from './env'
import { VERHAELTNIS } from './format'
import { mittigerAusschnitt, schnittfenster } from './karussell'

const THUMB_BREITE = 640

export const ERLAUBTE_TYPEN = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'video/mp4',
  'video/quicktime',
] as const

export function istVideo(mimeTyp: string): boolean {
  return mimeTyp.startsWith('video/')
}

function endung(mimeTyp: string): string {
  const karte: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'video/mp4': 'mp4',
    'video/quicktime': 'mov',
  }
  return karte[mimeTyp] ?? 'bin'
}

/** Pfade sind zufällig — die Datei ist nur über die Datenbank auffindbar. */
function neuerPfad(mimeTyp: string): string {
  const jetzt = new Date()
  const ordner = `${jetzt.getFullYear()}/${String(jetzt.getMonth() + 1).padStart(2, '0')}`
  return `${ordner}/${randomBytes(16).toString('hex')}.${endung(mimeTyp)}`
}

export function absoluterPfad(relativ: string): string {
  const wurzel = path.resolve(env.uploadVerzeichnis)
  const ziel = path.resolve(wurzel, relativ)
  // Kein Ausbrechen aus dem Upload-Verzeichnis über ../
  if (!ziel.startsWith(wurzel + path.sep)) {
    throw new Error('Ungültiger Medienpfad.')
  }
  return ziel
}

async function schreibe(relativ: string, inhalt: Buffer): Promise<void> {
  const ziel = absoluterPfad(relativ)
  await mkdir(path.dirname(ziel), { recursive: true })
  await writeFile(ziel, inhalt)
}

/**
 * Vorschaubild fürs Raster. Bei 9:16-Medien wird der mittige 3:4-Ausschnitt
 * genommen — genau wie Instagram Reels im Profilraster zeigt.
 */
async function erzeugeThumbnail(
  inhalt: Buffer,
  breite: number,
  hoehe: number,
): Promise<string | null> {
  try {
    const ausschnitt = mittigerAusschnitt(breite, hoehe, VERHAELTNIS.hochkant)
    const relativ = neuerPfad('image/jpeg')
    const daten = await sharp(inhalt)
      .extract(ausschnitt)
      .resize(THUMB_BREITE, Math.round(THUMB_BREITE / VERHAELTNIS.hochkant), { fit: 'cover' })
      .jpeg({ quality: 82 })
      .toBuffer()
    await schreibe(relativ, daten)
    return relativ
  } catch {
    return null
  }
}

/**
 * Vorschaubild eines bestehenden Mediums neu erzeugen.
 *
 * Nötig, wenn sich der Rasterausschnitt ändert — wie beim Wechsel von 4:5
 * auf 3:4. Vorschaubilder entstehen sonst nur beim Upload; ohne diesen Weg
 * bliebe alles Ältere im alten Zuschnitt liegen.
 *
 * Gibt den neuen Pfad zurück, ohne den alten anzufassen: Das Umhängen und
 * Löschen macht der Aufrufer, in dieser Reihenfolge. Bricht es dazwischen
 * ab, ist nichts verloren — nur eine verwaiste Datei zu viel.
 */
export async function erneuereVorschaubild(medium: {
  pfad: string
  breite: number
  hoehe: number
  mimeTyp: string
}): Promise<string | null> {
  if (istVideo(medium.mimeTyp) || !medium.breite || !medium.hoehe) return null

  try {
    const inhalt = await readFile(absoluterPfad(medium.pfad))
    return await erzeugeThumbnail(inhalt, medium.breite, medium.hoehe)
  } catch {
    return null
  }
}

export type UploadErgebnis = {
  medium: Medium
  breite: number
  hoehe: number
  /** true, wenn das Bild tatsächlich durchsichtige Stellen hat. */
  hatTransparenz: boolean
}

/**
 * Ein Alphakanal allein sagt nichts — viele PNGs tragen einen, der komplett
 * deckend ist. Erst `stats().isOpaque` verrät, ob wirklich Pixel durchscheinen.
 */
async function pruefeTransparenz(inhalt: Buffer, hatAlpha: boolean): Promise<boolean> {
  if (!hatAlpha) return false
  try {
    const { isOpaque } = await sharp(inhalt).stats()
    return !isOpaque
  } catch {
    return false
  }
}

export async function speichereMedium(opts: {
  inhalt: Buffer
  dateiname: string
  mimeTyp: string
  kundeId?: string | null
  hochgeladenVonId?: string | null
  quelleId?: string | null
}): Promise<UploadErgebnis> {
  let breite = 0
  let hoehe = 0
  let hatTransparenz = false

  if (!istVideo(opts.mimeTyp)) {
    const daten = await sharp(opts.inhalt).metadata()
    breite = daten.width ?? 0
    hoehe = daten.height ?? 0
    hatTransparenz = await pruefeTransparenz(opts.inhalt, daten.hasAlpha ?? false)
  }

  const relativ = neuerPfad(opts.mimeTyp)
  await schreibe(relativ, opts.inhalt)

  const thumbPfad =
    !istVideo(opts.mimeTyp) && breite && hoehe
      ? await erzeugeThumbnail(opts.inhalt, breite, hoehe)
      : null

  const medium = await prisma.medium.create({
    data: {
      kundeId: opts.kundeId ?? null,
      dateiname: opts.dateiname,
      pfad: relativ,
      mimeTyp: opts.mimeTyp,
      groesse: opts.inhalt.byteLength,
      breite,
      hoehe,
      thumbPfad,
      quelleId: opts.quelleId ?? null,
      hochgeladenVonId: opts.hochgeladenVonId ?? null,
    },
  })

  return { medium, breite, hoehe, hatTransparenz }
}

/**
 * Trennt ein durchgehendes Gesamtbild in einzelne Slides. Intern und im Export
 * liegen danach immer die aufgetrennten Einzelbilder vor; das Original bleibt
 * als Quelle in der Bibliothek erhalten.
 */
export async function trenneGesamtbildAuf(opts: {
  quelle: Medium
  anzahl: number
  kundeId: string
  hochgeladenVonId?: string | null
}): Promise<Medium[]> {
  const original = sharp(absoluterPfad(opts.quelle.pfad))
  const fenster = schnittfenster(opts.quelle.breite, opts.quelle.hoehe, opts.anzahl)
  const slides: Medium[] = []

  for (const [index, bereich] of fenster.entries()) {
    const inhalt = await original.clone().extract(bereich).jpeg({ quality: 92 }).toBuffer()
    const { medium } = await speichereMedium({
      inhalt,
      dateiname: `${opts.quelle.dateiname.replace(/\.[^.]+$/, '')}_Slide${index + 1}.jpg`,
      mimeTyp: 'image/jpeg',
      kundeId: opts.kundeId,
      hochgeladenVonId: opts.hochgeladenVonId,
      quelleId: opts.quelle.id,
    })
    slides.push(medium)
  }

  return slides
}

/** Eine abgelegte Datei entfernen. Fehlt sie schon, ist das kein Fehler. */
export async function loescheDatei(relativ: string): Promise<void> {
  await unlink(absoluterPfad(relativ)).catch(() => {})
}

export async function loescheMedium(medium: Medium): Promise<void> {
  for (const pfad of [medium.pfad, medium.thumbPfad]) {
    if (!pfad) continue
    try {
      await unlink(absoluterPfad(pfad))
    } catch {
      // Datei war schon weg — die Datenbankzeile zählt.
    }
  }
  await prisma.medium.delete({ where: { id: medium.id } })
}
