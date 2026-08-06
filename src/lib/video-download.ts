import 'server-only'
import { spawn } from 'node:child_process'
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { prisma } from './db'
import { merkeAbgelaufen, schreibeCookiedatei } from './instagram'
import { speichereMedium } from './medien'
import { thumbnailAusVideoErgaenzen } from './video'
import { istPlattformLink, ytDlpVerfuegbar } from './video-links'

/**
 * Videos von einem Link im Hintergrund laden.
 *
 * Das Ergebnis hängt als MEDIUM am Post — derselbe Platz, den auch ein
 * Upload füllt. In der Konzeptphase steht dort das Vorbild aus dem Netz,
 * später ersetzt es das fertige Reel; ein eigener Referenzvideo-Platz
 * existiert nicht.
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

/**
 * Aus yt-dlps englischer Fehlerzeile eine Meldung machen, mit der jemand
 * etwas anfangen kann. Der häufigste Fall ist Instagram: Ohne angemeldete
 * Sitzung antwortet es mit einer leeren Medienantwort — unabhängig davon, ob
 * der Beitrag im privaten Browserfenster zu sehen ist.
 */
function verstaendlich(rohtext: string): string {
  const text = rohtext.toLowerCase()

  if (text.includes('empty media response') || text.includes('login required')) {
    return (
      'Instagram gibt das Video ohne angemeldete Sitzung nicht heraus. Unter ' +
      'Einstellungen → Workspace lässt sich eine hinterlegen — ist dort schon eine, ' +
      'ist sie abgelaufen. Der Link bleibt gespeichert.'
    )
  }
  if (text.includes('rate-limit') || text.includes('429')) {
    return 'Die Plattform bremst gerade ab. In ein paar Minuten noch einmal versuchen.'
  }
  if (text.includes('private') || text.includes('not available')) {
    return 'Der Beitrag ist nicht öffentlich abrufbar.'
  }
  if (text.includes('aborted')) return 'Der Download wurde abgebrochen.'

  return `Das Video konnte nicht geladen werden: ${rohtext.slice(0, 240)}`
}

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
        ...(daten.fortschritt === undefined ? {} : { videoDownloadFortschritt: daten.fortschritt }),
        ...(daten.stand === undefined ? {} : { videoDownloadStand: daten.stand }),
        ...(daten.meldung === undefined ? {} : { videoDownloadMeldung: daten.meldung }),
      },
    })
    .catch(() => {})
}

/** Lädt mit yt-dlp und meldet den Fortschritt zurück, während es läuft. */
function ladeMitFortschritt(
  url: string,
  ordner: string,
  keksdatei: string | null,
  aufProzent: (p: number) => void,
  abbruch: AbortSignal,
): Promise<void> {
  return new Promise((fertig, scheitert) => {
    const lauf = spawn(
      'yt-dlp',
      [
        ...(keksdatei ? ['--cookies', keksdatei] : []),
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
  const ordner = await mkdtemp(path.join(tmpdir(), 'preroll-video-'))
  let zuletztGemeldet = -1

  try {
    // Die Sitzung landet nur für die Dauer des Laufs auf der Platte, im
    // Temp-Ordner, der am Ende ohnehin gelöscht wird.
    const keksdatei = await schreibeCookiedatei(ordner)

    await ladeMitFortschritt(
      url,
      ordner,
      keksdatei,
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

    const post = await prisma.post.findUniqueOrThrow({ where: { id: postId } })

    // Während des Downloads kann eine andere Quelle übernommen haben — dann
    // ist dieser Lauf Geschichte und darf weder Video noch Stand schreiben.
    // Erkennbar am Link: Übernahme und Leeren räumen ihn weg, ein neuer Link
    // gehört zu einem neuen Lauf.
    if (post.videoDownloadUrl !== url) return

    const inhalt = await readFile(path.join(ordner, datei))
    const { medium } = await speichereMedium({
      inhalt,
      dateiname: datei,
      mimeTyp: 'video/mp4',
      kundeId: post.kundeId,
    })

    // Derselbe Platz wie beim Upload: bestehendes MEDIUM aushängen, das
    // geladene einsetzen. Die alte Datei bleibt als Medium in der Bibliothek —
    // genau wie bei „Ersetzen" per Upload.
    await prisma.postMedium.deleteMany({ where: { postId, rolle: 'MEDIUM' } })
    await prisma.postMedium.create({
      data: { postId, mediumId: medium.id, rolle: 'MEDIUM', position: 0 },
    })

    await prisma.post.update({
      where: { id: postId },
      data: {
        videoDownloadStand: 'FERTIG',
        videoDownloadFortschritt: 100,
        videoDownloadMeldung: null,
        // Der Download übernimmt den Platz — eine vorher gewählte
        // Klappe-Fassung ist damit gelöst, nicht nur überdeckt.
        klappeVersionId: null,
        klappeVersionNummer: null,
      },
    })

    // Wie beim Upload: Ein Reel ohne Thumbnail bekommt ein Standbild.
    await thumbnailAusVideoErgaenzen(postId)
  } catch (fehler) {
    const text = fehler instanceof Error ? fehler.message : String(fehler)

    // Eine abgelaufene Sitzung soll in den Einstellungen stehen, nicht nur an
    // diesem einen Post.
    if (text.toLowerCase().includes('empty media response')) await merkeAbgelaufen()

    // Wurde der Lauf abgebrochen, weil eine andere Quelle übernommen oder
    // jemand den Link geleert hat, wäre „FEHLER" gelogen — dann bleibt der
    // geräumte Zustand stehen.
    const aktuell = await prisma.post
      .findUnique({ where: { id: postId }, select: { videoDownloadUrl: true } })
      .catch(() => null)
    if (aktuell?.videoDownloadUrl !== url) return

    await merkeStand(postId, { stand: 'FEHLER', fortschritt: 0, meldung: verstaendlich(text) })
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
export async function starteVideoDownload(postId: string): Promise<Anstossergebnis> {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { videoDownloadUrl: true, videoDownloadStand: true },
  })
  if (!post?.videoDownloadUrl) return { ok: false, fehler: 'Kein Link hinterlegt.' }
  if (laufende.has(postId)) return { ok: true }

  // Direkte Videolinks kann yt-dlp auch — ein zweiter Weg wäre nur eine
  // zweite Fehlerquelle. Fehlt yt-dlp, sagt das die Meldung.
  if (!(await ytDlpVerfuegbar())) {
    const fehler = istPlattformLink(post.videoDownloadUrl)
      ? 'Für Instagram-, YouTube- und TikTok-Links wird yt-dlp benötigt, das hier nicht installiert ist. Der Link bleibt gespeichert.'
      : 'yt-dlp ist auf diesem Server nicht installiert.'
    await merkeStand(postId, { stand: 'FEHLER', fortschritt: 0, meldung: fehler })
    return { ok: false, fehler }
  }

  const abbruch = new AbortController()
  laufende.set(postId, abbruch)

  await merkeStand(postId, { stand: 'LAEUFT', fortschritt: 0, meldung: null })

  const zeitwaechter = setTimeout(() => abbruch.abort(), ZEITLIMIT)
  void fuehreAus(postId, post.videoDownloadUrl, abbruch).finally(() =>
    clearTimeout(zeitwaechter),
  )

  return { ok: true }
}

export async function brichVideoDownloadAb(postId: string): Promise<void> {
  laufende.get(postId)?.abort()
  laufende.delete(postId)
}
