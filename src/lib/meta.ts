import 'server-only'

/**
 * Anbindung an die Meta Graph API — Facebook-Seiten und Instagram-Konten.
 *
 * Ein Zugang bedient beides: Das Instagram-Konto hängt an der Facebook-Seite,
 * und der Seiten-Token, den `me/accounts` mitliefert, reicht für beide Wege.
 * Der Token stammt aus einem **Systemnutzer** im Business Manager und läuft
 * nicht ab (siehe Entscheidungen in Notion).
 *
 * Was hier bewusst **nicht** passiert: Der Termin wird Facebook nicht per
 * `scheduled_publish_time` übergeben, obwohl es das könnte. Begründung steht
 * in `veroeffentlichung.ts` — kurz: Solange Facebook und Instagram denselben
 * Inhalt tragen sollen, dürfen sie nicht zu verschiedenen Zeitpunkten
 * eingefroren werden.
 */

/**
 * Die Fassung wird bewusst festgeschrieben und nicht weggelassen: Ohne Angabe
 * wandert Meta mit jeder neuen Fassung weiter, und Verhalten ändert sich, ohne
 * dass jemand etwas angefasst hat. Hochziehen ist eine Entscheidung.
 */
const FASSUNG = 'v26.0'
const BASIS = `https://graph.facebook.com/${FASSUNG}`

/** Ein Aufruf dauert normalerweise Sekunden; Videouploads holen sich mehr. */
const ZEITLIMIT = 120_000

export type MetaFehler = {
  text: string
  /**
   * Der Zugang ist hin, nicht der Beitrag. Der Unterschied entscheidet, ob im
   * Backend „Post fehlgeschlagen" oder „Meta-Verbindung erneuern" steht.
   */
  zugangHin: boolean
}

export type MetaAntwort<T> = { ok: true; daten: T } | { ok: false; fehler: MetaFehler }

export type MetaSeite = {
  id: string
  name: string
  token: string
  igKontoId: string | null
  igName: string | null
}

/** Ein Medium, wie es die Graph API haben will: als Adresse, nicht als Datei. */
export type Medienstueck = {
  url: string
  istVideo: boolean
}

// --------------------------------------------------------------- Grundgerüst

type GraphFehler = {
  message?: string
  code?: number
  error_subcode?: number
  error_user_msg?: string
}

/**
 * Aus Metas englischer Fehlerantwort eine Meldung machen, mit der jemand etwas
 * anfangen kann — und dabei feststellen, ob der Zugang das Problem ist.
 *
 * Code 190 ist das abgelaufene oder zurückgezogene Token, 102 die beendete
 * Sitzung. Beides heißt: Nicht noch einmal versuchen, sondern jemanden holen.
 * Fehlende Berechtigungen (10, 200) sind dagegen ein Einrichtungsfehler — der
 * Zugang lebt, ihm fehlt nur ein Recht.
 */
function deute(roh: GraphFehler | undefined, status: number): MetaFehler {
  const code = roh?.code
  const text = roh?.error_user_msg?.trim() || roh?.message?.trim() || `HTTP ${status}`

  if (code === 190 || code === 102) {
    return {
      text: `Der Meta-Zugang wird abgelehnt: ${text}`,
      zugangHin: true,
    }
  }
  if (code === 10 || code === 200) {
    return {
      text: `Meta verweigert die Berechtigung: ${text} — vermutlich fehlt dem Systemnutzer ein Recht oder ein Asset.`,
      zugangHin: false,
    }
  }
  if (code === 4 || code === 17 || code === 32 || code === 613) {
    return { text: `Meta drosselt gerade: ${text}`, zugangHin: false }
  }
  return { text, zugangHin: false }
}

async function anfrage<T>(
  pfad: string,
  opts: {
    token: string
    methode?: 'GET' | 'POST'
    felder?: Record<string, string | undefined>
  },
): Promise<MetaAntwort<T>> {
  const { token, methode = 'GET', felder = {} } = opts

  const adresse = new URL(`${BASIS}/${pfad.replace(/^\//, '')}`)
  const koerper = new URLSearchParams()

  for (const [name, wert] of Object.entries(felder)) {
    if (wert === undefined) continue
    if (methode === 'GET') adresse.searchParams.set(name, wert)
    else koerper.set(name, wert)
  }

  // Der Token gehört auch bei POST nicht in die Adresse: Adressen landen in
  // Protokollen, Formularkörper nicht.
  if (methode === 'GET') adresse.searchParams.set('access_token', token)
  else koerper.set('access_token', token)

  try {
    const antwort = await fetch(adresse, {
      method: methode,
      body: methode === 'POST' ? koerper : undefined,
      headers: methode === 'POST' ? { 'content-type': 'application/x-www-form-urlencoded' } : {},
      cache: 'no-store',
      signal: AbortSignal.timeout(ZEITLIMIT),
    })

    const inhalt = (await antwort.json().catch(() => null)) as
      | (T & { error?: GraphFehler })
      | null

    if (!antwort.ok || inhalt?.error) {
      return { ok: false, fehler: deute(inhalt?.error, antwort.status) }
    }
    if (inhalt === null) {
      return { ok: false, fehler: { text: 'Meta antwortete unlesbar.', zugangHin: false } }
    }
    return { ok: true, daten: inhalt }
  } catch (fehler) {
    const text =
      fehler instanceof Error && fehler.name === 'TimeoutError'
        ? 'Meta hat nicht rechtzeitig geantwortet.'
        : `Meta war nicht erreichbar: ${fehler instanceof Error ? fehler.message : String(fehler)}`
    return { ok: false, fehler: { text, zugangHin: false } }
  }
}

// ------------------------------------------------------------------- Zugänge

type SeitenAntwort = {
  data: Array<{
    id: string
    name: string
    access_token?: string
    instagram_business_account?: { id: string; username?: string }
  }>
}

/**
 * Alle Seiten, an die dieser Zugang herankommt — samt Seiten-Token und
 * verknüpftem Instagram-Konto.
 *
 * Das ist zugleich der Verbindungstest: Kommt eine Liste zurück, lebt der
 * Zugang. Eine **leere** Liste ist kein Fehler, sondern die Auskunft, dass dem
 * Systemnutzer noch keine Seite zugewiesen ist — genau der Fall, der beim
 * Einrichten am häufigsten auftritt.
 */
export async function holeSeiten(token: string): Promise<MetaAntwort<MetaSeite[]>> {
  const antwort = await anfrage<SeitenAntwort>('me/accounts', {
    token,
    felder: {
      fields: 'id,name,access_token,instagram_business_account{id,username}',
      limit: '100',
    },
  })
  if (!antwort.ok) return antwort

  const seiten = (antwort.daten.data ?? [])
    .filter((s) => Boolean(s.access_token))
    .map((s) => ({
      id: s.id,
      name: s.name,
      token: s.access_token!,
      igKontoId: s.instagram_business_account?.id ?? null,
      igName: s.instagram_business_account?.username ?? null,
    }))

  return { ok: true, daten: seiten }
}

// ------------------------------------------------------------------ Facebook

/**
 * Auf einer Facebook-Seite veröffentlichen.
 *
 * Drei Wege je nach Material — ein Bild, mehrere Bilder, ein Video. Videos
 * gehen über `/videos` und damit als gewöhnlicher Seitenbeitrag; ob Facebook
 * daraus ein Reel macht, entscheidet es selbst. Der eigene Reels-Endpunkt
 * (`/video_reels`) verlangt einen dreiphasigen Upload der Bytes und damit
 * einen ganz anderen Weg — dafür ist hier der falsche Ort, solange derselbe
 * Inhalt ohnehin auf Instagram als Reel erscheint.
 */
export async function posteAufFacebook(opts: {
  seitenId: string
  seitenToken: string
  text: string
  medien: Medienstueck[]
}): Promise<MetaAntwort<{ externeId: string }>> {
  const { seitenId, seitenToken, text, medien } = opts

  if (medien.length === 0) {
    return {
      ok: false,
      fehler: { text: 'Der Beitrag hat keine Datei zum Veröffentlichen.', zugangHin: false },
    }
  }

  const video = medien.find((m) => m.istVideo)
  if (video) {
    const antwort = await anfrage<{ id: string; post_id?: string }>(`${seitenId}/videos`, {
      token: seitenToken,
      methode: 'POST',
      felder: { file_url: video.url, description: text },
    })
    if (!antwort.ok) return antwort
    return { ok: true, daten: { externeId: antwort.daten.post_id ?? antwort.daten.id } }
  }

  if (medien.length === 1) {
    const antwort = await anfrage<{ id: string; post_id?: string }>(`${seitenId}/photos`, {
      token: seitenToken,
      methode: 'POST',
      felder: { url: medien[0].url, caption: text, published: 'true' },
    })
    if (!antwort.ok) return antwort
    return { ok: true, daten: { externeId: antwort.daten.post_id ?? antwort.daten.id } }
  }

  // Mehrbild: erst jedes Bild unveröffentlicht hochladen, dann als ein
  // Beitrag zusammenfassen. Facebook kennt kein Durchwischen — daraus wird
  // eine Kachel-Collage, und das ist die nächstliegende Entsprechung.
  const kennungen: string[] = []
  for (const stueck of medien) {
    const hoch = await anfrage<{ id: string }>(`${seitenId}/photos`, {
      token: seitenToken,
      methode: 'POST',
      felder: { url: stueck.url, published: 'false' },
    })
    if (!hoch.ok) return hoch
    kennungen.push(hoch.daten.id)
  }

  const beitrag = await anfrage<{ id: string }>(`${seitenId}/feed`, {
    token: seitenToken,
    methode: 'POST',
    felder: {
      message: text,
      attached_media: JSON.stringify(kennungen.map((id) => ({ media_fbid: id }))),
    },
  })
  if (!beitrag.ok) return beitrag
  return { ok: true, daten: { externeId: beitrag.daten.id } }
}

// ----------------------------------------------------------------- Instagram

/** Instagram nimmt über die API höchstens zehn Slides — in der App sind es 20. */
export const IG_MAX_SLIDES = 10

const CONTAINER_TAKT = 5_000
const CONTAINER_GEDULD = 5 * 60_000

/**
 * Warten, bis Instagram einen Container verarbeitet hat.
 *
 * Bei Bildern ist er sofort fertig, bei Videos dauert es. Wer zu früh
 * veröffentlicht, bekommt einen Fehler, der so klingt, als stimme etwas mit
 * dem Beitrag nicht — deshalb wird hier gewartet statt geraten.
 */
async function warteAufContainer(
  containerId: string,
  token: string,
  schlaf: (ms: number) => Promise<void>,
): Promise<MetaAntwort<void>> {
  const bis = Date.now() + CONTAINER_GEDULD

  while (Date.now() < bis) {
    const stand = await anfrage<{ status_code?: string; status?: string }>(containerId, {
      token,
      felder: { fields: 'status_code,status' },
    })
    if (!stand.ok) return stand

    switch (stand.daten.status_code) {
      case 'FINISHED':
        return { ok: true, daten: undefined }
      case 'ERROR':
        return {
          ok: false,
          fehler: {
            text: `Instagram konnte die Datei nicht verarbeiten: ${stand.daten.status ?? 'ohne Angabe'}`,
            zugangHin: false,
          },
        }
      case 'EXPIRED':
        return {
          ok: false,
          fehler: { text: 'Der Instagram-Container ist verfallen.', zugangHin: false },
        }
      default:
        await schlaf(CONTAINER_TAKT)
    }
  }

  return {
    ok: false,
    fehler: {
      text: 'Instagram hat die Datei nicht innerhalb von fünf Minuten verarbeitet.',
      zugangHin: false,
    },
  }
}

/**
 * Auf einem Instagram-Konto veröffentlichen — immer zwei Schritte: Container
 * anlegen, dann veröffentlichen. Container verfallen nach 24 Stunden, sie
 * lassen sich also nicht vorab anlegen; beides gehört in denselben Lauf.
 */
export async function posteAufInstagram(opts: {
  igKontoId: string
  seitenToken: string
  text: string
  medien: Medienstueck[]
  schlaf?: (ms: number) => Promise<void>
}): Promise<MetaAntwort<{ externeId: string }>> {
  const { igKontoId, seitenToken, text, medien } = opts
  const schlaf = opts.schlaf ?? ((ms: number) => new Promise((f) => setTimeout(f, ms)))

  if (medien.length === 0) {
    return {
      ok: false,
      fehler: { text: 'Der Beitrag hat keine Datei zum Veröffentlichen.', zugangHin: false },
    }
  }
  if (medien.length > IG_MAX_SLIDES) {
    return {
      ok: false,
      fehler: {
        text: `Instagram nimmt über die API höchstens ${IG_MAX_SLIDES} Slides, dieser Beitrag hat ${medien.length}. Er muss von Hand gepostet werden.`,
        zugangHin: false,
      },
    }
  }

  let containerId: string

  if (medien.length === 1) {
    const stueck = medien[0]
    const container = await anfrage<{ id: string }>(`${igKontoId}/media`, {
      token: seitenToken,
      methode: 'POST',
      felder: stueck.istVideo
        ? { media_type: 'REELS', video_url: stueck.url, caption: text }
        : { image_url: stueck.url, caption: text },
    })
    if (!container.ok) return container
    containerId = container.daten.id
  } else {
    // Karussell: erst je Slide ein Kind, dann die Klammer darüber. Videos
    // wären als Kind erlaubt, kommen bei uns aber nicht vor — ein Karussell
    // besteht aus Bildern.
    const kinder: string[] = []
    for (const stueck of medien) {
      const kind = await anfrage<{ id: string }>(`${igKontoId}/media`, {
        token: seitenToken,
        methode: 'POST',
        felder: { image_url: stueck.url, is_carousel_item: 'true' },
      })
      if (!kind.ok) return kind
      kinder.push(kind.daten.id)
    }

    const klammer = await anfrage<{ id: string }>(`${igKontoId}/media`, {
      token: seitenToken,
      methode: 'POST',
      felder: { media_type: 'CAROUSEL', children: kinder.join(','), caption: text },
    })
    if (!klammer.ok) return klammer
    containerId = klammer.daten.id
  }

  const fertig = await warteAufContainer(containerId, seitenToken, schlaf)
  if (!fertig.ok) return fertig

  const veroeffentlicht = await anfrage<{ id: string }>(`${igKontoId}/media_publish`, {
    token: seitenToken,
    methode: 'POST',
    felder: { creation_id: containerId },
  })
  if (!veroeffentlicht.ok) return veroeffentlicht

  return { ok: true, daten: { externeId: veroeffentlicht.daten.id } }
}
