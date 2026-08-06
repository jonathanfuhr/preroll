import 'server-only'
import { spawn } from 'node:child_process'
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { prisma } from './db'
import { speichereMedium, loescheMedium } from './medien'
import { istPlattformLink, ytDlpVerfuegbar } from './referenzvideo'

/**
 * Referenzvideos im Hintergrund laden.
 *
 * Ein Download dauert je nach Plattform eine halbe bis mehrere Minuten. Ihn
 * in der Server-Aktion abzuwarten hieße: Der Dialog steht offen, bis es
 * fertig ist. Deshalb läuft er außerhalb der Anfrage weiter, und sein Stand
 * liegt am Post — nur so überlebt er das Schließen des Dialogs und einen
 * Seitenwechsel.
 *
 * Bewusst **kein** Worker-Dienst: Preroll hat keinen, und für eine Handvoll
 * Downloads am Tag wäre eine Warteschlange samt zweitem Container mehr
 * Gerüst als Nutzen. Der Preis steht im Kommentar bei `laufende`.
 */

const MAX_GROESSE = 200 * 1024 * 1024
const ZEITLIMIT = 15 * 60_000

/**
 * Was gerade läuft, je Post. Nur dazu da, denselben Download nicht zweimal
 * anzustoßen — der belastbare Stand steht in der Datenbank. Bei einem
 * Neustart des Containers geht ein laufender Download verloren; er steht dann
 * auf LAEUFT und lässt sich neu anstoßen.
 */
const laufende = new Map<string, AbortController>()

function prozentAus(zeile: string): number | null {
  // yt-dlp mit --newline: „[download]   4.2% of  12.34MiB at …"
  const treffer = /\[download\]\s+(\d{1,3}(?:\.\d+)?)%/.exec(zeile)
  if (!treffer) return null
  return Math.min(99, Math.round(Number(treffer[1])))
}

async function merkeStand(
  postId: string,
  daten: { fortschritt?: number; stand?: 'LAEUFT' | 'FERTIG' | 'FEHLER'; meldung?: string | null },
) {
  await prisma.post
    .update({
      where: { id: postId },
      data: {
        ...(daten.fortschritt === undefined ? {} : { referenzVideoFortschritt: daten.fortschritt }),
        ...(daten.stand === undefined ? {} : { referenzVideoStand: daten.stand }),
        ...(daten.meldung === undefined ? {} : { referenzVideoMeldung: daten.meldung }),
      },
    })
    .catch(() => {})
}

/** Lädt mit yt-dlp und meldet den Fortschritt zurück, während es läuft. */
function ladeMitFortschritt(
  url: string,
  ordner: string,
  aufProzent: (p: number) => void,
  abbruch: AbortSignal,
): Promise<void> {
  return new Promise((fertig, scheitert) => {
    const lauf = spawn(
      'yt-dlp',
      [
        '--newline',
        '--no-playlist',
        '--no-warnings',
        '--max-filesize',
        String(MAX_GROESSE),
        '-f',
        'mp4/bestvideo[ext=mp4]+bestaudio[ext=m4a]/best',
        '--merge-output-format',
        'mp4',
        '-o',
        path.join(ordner, '%(title).80s.%(ext)s'),
        url,
      ],
      { signal: abbruch },
    )

    let fehlertext = ''
    lauf.stdout.on('data', (stueck: Buffer) => {
      for (const zeile of stueck.toString().split('\n')) {
        const p = prozentAus(zeile)
        if (p !== null) aufProzent(p)
      }
    })
    lauf.stderr.on('data', (stueck: Buffer) => {
      fehlertext += stueck.toString()
    })

    lauf.on('error', scheitert)
    lauf.on('close', (code) => {
      if (code === 0) fertig()
      else scheitert(new Error(fehlertext.trim().split('\n').at(-1) ?? `yt-dlp endete mit ${code}`))
    })
  })
}

async function fuehreAus(postId: string, url: string, abbruch: AbortController): Promise<void> {
  const ordner = await mkdtemp(path.join(tmpdir(), 'preroll-referenz-'))
  let zuletztGemeldet = -1

  try {
    await ladeMitFortschritt(
      url,
      ordner,
      (p) => {
        // Nur bei ganzen Prozentschritten schreiben — yt-dlp meldet mehrmals
        // je Sekunde, und die Datenbank ist kein Fortschrittsbalken.
        if (p === zuletztGemeldet) return
        zuletztGemeldet = p
        void merkeStand(postId, { fortschritt: p })
      },
      abbruch.signal,
    )

    const dateien = await readdir(ordner)
    const datei = dateien.find((d) => /\.(mp4|mkv|webm|mov)$/i.test(d))
    if (!datei) throw new Error('yt-dlp hat keine Videodatei erzeugt.')

    const inhalt = await readFile(path.join(ordner, datei))
    const post = await prisma.post.findUniqueOrThrow({
      where: { id: postId },
      include: { referenzVideoMedium: true },
    })

    const { medium } = await speichereMedium({
      inhalt,
      dateiname: datei,
      mimeTyp: 'video/mp4',
      kundeId: post.kundeId,
    })

    const alt = post.referenzVideoMedium
    await prisma.post.update({
      where: { id: postId },
      data: {
        referenzVideoMediumId: medium.id,
        referenzVideoPfad: medium.pfad,
        referenzVideoTitel: post.referenzVideoTitel ?? datei.replace(/\.[^.]+$/, ''),
        referenzVideoStand: 'FERTIG',
        referenzVideoFortschritt: 100,
        referenzVideoMeldung: null,
      },
    })
    if (alt) await loescheMedium(alt).catch(() => {})
  } catch (fehler) {
    const text = fehler instanceof Error ? fehler.message : String(fehler)
    await merkeStand(postId, {
      stand: 'FEHLER',
      fortschritt: 0,
      meldung: text.includes('aborted')
        ? 'Der Download wurde abgebrochen.'
        : `Das Video konnte nicht geladen werden: ${text.slice(0, 240)}`,
    })
  } finally {
    laufende.delete(postId)
    await rm(ordner, { recursive: true, force: true }).catch(() => {})
  }
}

export type Anstossergebnis = { ok: true } | { ok: false; fehler: string }

/**
 * Stößt den Download an und kehrt sofort zurück. Die eigentliche Arbeit läuft
 * danach weiter — Preroll ist ein dauerhaft laufender Node-Prozess, kein
 * Funktionsaufruf, der nach der Antwort abgeräumt wird.
 */
export async function starteReferenzDownload(postId: string): Promise<Anstossergebnis> {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { referenzVideoUrl: true, referenzVideoStand: true },
  })
  if (!post?.referenzVideoUrl) return { ok: false, fehler: 'Kein Link hinterlegt.' }
  if (laufende.has(postId)) return { ok: true }

  // Direkte Videolinks kann yt-dlp auch — ein zweiter Weg wäre nur eine
  // zweite Fehlerquelle. Fehlt yt-dlp, sagt das die Meldung.
  if (!(await ytDlpVerfuegbar())) {
    const fehler = istPlattformLink(post.referenzVideoUrl)
      ? 'Für Instagram-, YouTube- und TikTok-Links wird yt-dlp benötigt, das hier nicht installiert ist. Der Link bleibt gespeichert und wird in der Kundenvorschau verlinkt.'
      : 'yt-dlp ist auf diesem Server nicht installiert.'
    await merkeStand(postId, { stand: 'FEHLER', fortschritt: 0, meldung: fehler })
    return { ok: false, fehler }
  }

  const abbruch = new AbortController()
  laufende.set(postId, abbruch)

  await merkeStand(postId, { stand: 'LAEUFT', fortschritt: 0, meldung: null })

  const zeitwaechter = setTimeout(() => abbruch.abort(), ZEITLIMIT)
  void fuehreAus(postId, post.referenzVideoUrl, abbruch).finally(() =>
    clearTimeout(zeitwaechter),
  )

  return { ok: true }
}

export async function brichReferenzDownloadAb(postId: string): Promise<void> {
  laufende.get(postId)?.abort()
  laufende.delete(postId)
}
