/**
 * Dateien in Blöcken hochladen.
 *
 * Gebaut gegen den Cloudflare-Tunnel, der keine Anfrage über 100 MB
 * durchließ; seit dem 17.08.2026 läuft Preroll direkt über Klappes Reverse
 * Proxy und der Anlass ist weg. Geblieben ist der Nutzen: Es gibt einen
 * echten Fortschritt zu zeigen, und ein verlorener Block kostet vier
 * Megabyte statt der ganzen Datei.
 *
 * Läuft im Browser — deshalb ohne `server-only` und ohne Node-Bausteine.
 */

export const BLOCKGROESSE = 4 * 1024 * 1024

/** Grundzeit plus das, was der Block bei sehr langsamen 20 kB/s bräuchte. */
function zeitlimit(bytes: number): number {
  return 60_000 + Math.ceil(bytes / (20 * 1024)) * 1000
}

export type Fortschritt = {
  /** 0 bis 1 über alle Dateien hinweg. */
  anteil: number
  dateiNummer: number
  dateiAnzahl: number
  dateiname: string
}

async function ladeEineDatei(
  datei: File,
  melde: (gesendet: number) => void,
): Promise<string> {
  // Ohne Kennung eröffnet der Server eine Sitzung.
  const start = await fetch('/api/upload/teil', { method: 'POST' })
  if (!start.ok) throw new Error('Der Upload konnte nicht begonnen werden.')
  const { sitzung } = (await start.json()) as { sitzung: string }

  let versatz = 0
  while (versatz < datei.size) {
    const ende = Math.min(versatz + BLOCKGROESSE, datei.size)
    const block = datei.slice(versatz, ende)

    const antwort = await fetch(
      `/api/upload/teil?sitzung=${sitzung}&versatz=${versatz}`,
      {
        method: 'POST',
        body: block,
        signal: AbortSignal.timeout(zeitlimit(block.size)),
      },
    )

    if (!antwort.ok) {
      const daten = (await antwort.json().catch(() => ({}))) as { fehler?: string }
      throw new Error(daten.fehler ?? `Ein Block wurde abgelehnt (${antwort.status}).`)
    }

    versatz = ende
    melde(versatz)
  }

  return sitzung
}

/**
 * Lädt eine oder mehrere Dateien hoch und schließt mit `/api/upload` ab —
 * dort passiert alles Fachliche: Formatprüfung, Auftrennen, Ablage.
 */
export async function ladeHoch(opts: {
  dateien: File[]
  felder: Record<string, string>
  aufFortschritt?: (stand: Fortschritt) => void
}): Promise<{ ok: boolean; daten: Record<string, unknown> }> {
  const gesamt = opts.dateien.reduce((summe, d) => summe + d.size, 0) || 1
  let fertigeBytes = 0

  const sitzungen: string[] = []

  for (const [i, datei] of opts.dateien.entries()) {
    const sitzung = await ladeEineDatei(datei, (gesendet) => {
      opts.aufFortschritt?.({
        anteil: Math.min(0.99, (fertigeBytes + gesendet) / gesamt),
        dateiNummer: i + 1,
        dateiAnzahl: opts.dateien.length,
        dateiname: datei.name,
      })
    })
    sitzungen.push(sitzung)
    fertigeBytes += datei.size
  }

  // Der Abschluss verarbeitet die Datei — bei einem Karussell kann das ein
  // paar Sekunden dauern. Deshalb steht der Balken hier bei 99 %, nicht 100.
  const formular = new FormData()
  for (const [name, wert] of Object.entries(opts.felder)) formular.set(name, wert)
  for (const [i, sitzung] of sitzungen.entries()) {
    formular.append('sitzungen', sitzung)
    formular.append('namen', opts.dateien[i].name)
    formular.append('typen', opts.dateien[i].type)
  }

  const antwort = await fetch('/api/upload', { method: 'POST', body: formular })
  opts.aufFortschritt?.({
    anteil: 1,
    dateiNummer: opts.dateien.length,
    dateiAnzahl: opts.dateien.length,
    dateiname: opts.dateien.at(-1)?.name ?? '',
  })

  return { ok: antwort.ok, daten: (await antwort.json()) as Record<string, unknown> }
}
