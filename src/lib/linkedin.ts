import 'server-only'
import {
  autorisierungsUrl,
  deuteTokenAntwort,
  type LinkedInAntwort,
  type LinkedInFehler,
  type LinkedInOrganisation,
  type TokenSatz,
} from './linkedin-token'
import type { Medienstueck } from './meta'

export {
  autorisierungsUrl,
  brauchtErneuerung,
  deuteTokenAntwort,
  SCOPES,
  type LinkedInAntwort,
  type LinkedInFehler,
  type LinkedInOrganisation,
  type TokenSatz,
} from './linkedin-token'

/**
 * LinkedIn — Firmenseiten auflisten und Beiträge veröffentlichen.
 *
 * **Stand: gebaut, nicht gegen einen echten Zugang erprobt.** Zum Posten auf
 * einer Firmenseite verlangt LinkedIn die *Community Management API*, und die
 * gibt es nur nach einer Freigabe. Bis die durch ist, bleiben die App-Daten in
 * den Einstellungen leer, `linkedInEingerichtet()` ist falsch, und kein Beitrag
 * bekommt eine LinkedIn-Zeile. Genau wie bei den Instagram-Kennzahlen, die auf
 * das Meta App Review warten.
 *
 * Zwei Unterschiede zu Meta, die die Bauweise erklären:
 *
 * · **Der Token läuft ab.** Meta liefert einen Systemnutzer-Token, der bleibt.
 *   LinkedIn gibt ein Mitgliedstoken für 60 Tage plus ein Auffrischungstoken
 *   für ein Jahr. Erneuert wird deshalb vor dem Posten, nicht nach dem ersten
 *   401 — ein abgelaufener Token mitten in einem Upload hinterlässt Halbfertiges.
 * · **Gepostet wird als Organisation, nicht als Person.** Der Autor ist
 *   `urn:li:organization:<id>`; die Person dahinter braucht dafür die Rolle
 *   ADMINISTRATOR an der Seite. Gespeichert wird nur die Zahl — ändert LinkedIn
 *   das URN-Format, kostet das keine Migration.
 */

const API = 'https://api.linkedin.com/rest'
const TOKEN_ENDPUNKT = 'https://www.linkedin.com/oauth/v2/accessToken'

/**
 * Die Fassung der REST-API. LinkedIn verlangt sie bei jedem Aufruf und
 * verwirft Aufrufe ohne sie — anders als Graph, wo die Fassung im Pfad steht.
 */
const FASSUNG = '202506'

async function tokenTausch(
  koerper: Record<string, string>,
  jetzt = new Date(),
): Promise<LinkedInAntwort<TokenSatz>> {
  try {
    const antwort = await fetch(TOKEN_ENDPUNKT, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(koerper).toString(),
      cache: 'no-store',
    })
    return deuteTokenAntwort(await antwort.json().catch(() => ({})), jetzt)
  } catch (fehler) {
    return {
      ok: false,
      fehler: { text: `LinkedIn ist nicht erreichbar: ${(fehler as Error).message}`, zugangHin: true },
    }
  }
}

export async function holeToken(opts: {
  code: string
  clientId: string
  clientSecret: string
  redirectUri: string
}): Promise<LinkedInAntwort<TokenSatz>> {
  return tokenTausch({
    grant_type: 'authorization_code',
    code: opts.code,
    client_id: opts.clientId,
    client_secret: opts.clientSecret,
    redirect_uri: opts.redirectUri,
  })
}

export async function frischeToken(opts: {
  auffrischToken: string
  clientId: string
  clientSecret: string
}): Promise<LinkedInAntwort<TokenSatz>> {
  return tokenTausch({
    grant_type: 'refresh_token',
    refresh_token: opts.auffrischToken,
    client_id: opts.clientId,
    client_secret: opts.clientSecret,
  })
}

// ------------------------------------------------------------------ Aufrufe

function deute(status: number, roh: { message?: string } | undefined): LinkedInFehler {
  const text = roh?.message ?? `LinkedIn antwortete ${status}.`

  // 401 und 403 zeigen auf den Zugang, alles andere auf den Beitrag. Dieselbe
  // Unterscheidung wie bei Meta: Nur beim Zugang wird die Administration
  // benachrichtigt, denn nur sie kann ihn erneuern.
  if (status === 401) {
    return { text: 'LinkedIn hat das Token abgelehnt — der Zugang muss neu verbunden werden.', zugangHin: true }
  }
  if (status === 403) {
    return {
      text:
        'LinkedIn verweigert den Zugriff. Fehlt der App die Community Management API, ' +
        'oder ist das Konto nicht Administrator dieser Seite?',
      zugangHin: true,
    }
  }
  if (status === 429) {
    return { text: 'LinkedIn drosselt gerade — der nächste Lauf versucht es erneut.', zugangHin: false }
  }
  return { text, zugangHin: false }
}

async function anfrage<T>(
  token: string,
  pfad: string,
  optionen: { methode?: string; koerper?: unknown; kopfzeilen?: Record<string, string> } = {},
): Promise<LinkedInAntwort<T>> {
  try {
    const antwort = await fetch(`${API}${pfad}`, {
      method: optionen.methode ?? 'GET',
      headers: {
        authorization: `Bearer ${token}`,
        'LinkedIn-Version': FASSUNG,
        // Ohne diese Kopfzeile antwortet LinkedIn im alten Format, in dem die
        // Kennungen anders heißen.
        'X-Restli-Protocol-Version': '2.0.0',
        ...(optionen.koerper ? { 'content-type': 'application/json' } : {}),
        ...optionen.kopfzeilen,
      },
      body: optionen.koerper ? JSON.stringify(optionen.koerper) : undefined,
      cache: 'no-store',
    })

    if (!antwort.ok) {
      const roh = (await antwort.json().catch(() => undefined)) as { message?: string } | undefined
      return { ok: false, fehler: deute(antwort.status, roh) }
    }

    // Beim Anlegen steht die Kennung in der Kopfzeile, nicht im Körper — der
    // ist bei 201 leer.
    const kennung = antwort.headers.get('x-restli-id')
    if (antwort.status === 201 && kennung) return { ok: true, daten: { id: kennung } as T }
    if (antwort.status === 204) return { ok: true, daten: undefined as T }

    return { ok: true, daten: (await antwort.json()) as T }
  } catch (fehler) {
    return {
      ok: false,
      fehler: { text: `LinkedIn ist nicht erreichbar: ${(fehler as Error).message}`, zugangHin: true },
    }
  }
}

type AclAntwort = {
  elements?: Array<{ organization?: string; role?: string; state?: string }>
}

type OrgAntwort = {
  results?: Record<string, { localizedName?: string; vanityName?: string }>
}

/**
 * Die Firmenseiten, an denen das verbundene Konto Administrator ist.
 *
 * Zwei Aufrufe, weil `organizationAcls` nur die URNs liefert und keine Namen:
 * erst die Rollen, dann die Namen in einem Sammelaufruf. Eine Seite ohne
 * Namen fällt trotzdem nicht heraus — sie steht dann mit ihrer Kennung da,
 * denn sonst wäre sie unzuordenbar statt nur unschön.
 */
export async function holeOrganisationen(
  token: string,
): Promise<LinkedInAntwort<LinkedInOrganisation[]>> {
  const acls = await anfrage<AclAntwort>(
    token,
    '/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED&count=100',
  )
  if (!acls.ok) return acls

  const ids = (acls.daten.elements ?? [])
    .map((e) => e.organization?.split(':').pop())
    .filter((id): id is string => Boolean(id))

  if (ids.length === 0) return { ok: true, daten: [] }

  const namen = await anfrage<OrgAntwort>(
    token,
    `/organizationsLookup?ids=List(${ids.join(',')})`,
  )

  return {
    ok: true,
    daten: ids.map((id) => {
      const treffer = namen.ok ? namen.daten.results?.[id] : undefined
      return {
        id,
        name: treffer?.localizedName ?? `Organisation ${id}`,
        handle: treffer?.vanityName ?? null,
      }
    }),
  }
}

// --------------------------------------------------------------- Veröffentlichen

type UploadAntwort = {
  value?: { uploadUrl?: string; image?: string; video?: string; uploadInstructions?: Array<{ uploadUrl: string }> }
}

/**
 * Ein Bild oder Video hochladen und den fertigen URN zurückgeben.
 *
 * Drei Schritte: `initializeUpload` liefert eine Adresse, dorthin gehen die
 * Bytes, danach gilt der URN.
 *
 * Die Bytes kommen über **dieselbe signierte Adresse, die Meta bekommt**
 * (`medienFuerPost`), nicht direkt aus der Ablage. Das ist bewusst der Umweg
 * über den eigenen Server: Dort steckt die Umwandlung nach JPEG und die
 * Durchreiche einer Klappe-Fassung. Ein zweiter Weg an den Dateien vorbei
 * würde beides umgehen, und irgendwann ginge auf einer Plattform ein PNG raus,
 * das die andere ablehnt.
 *
 * Der Upload läuft **nicht** über `anfrage` — die Ziel-Adresse liegt außerhalb
 * der API und verträgt die LinkedIn-Kopfzeilen nicht.
 */
async function ladeMediumHoch(
  token: string,
  organisationId: string,
  stueck: Medienstueck,
): Promise<LinkedInAntwort<string>> {
  let inhalt: Buffer
  let mimeTyp: string
  try {
    const geholt = await fetch(stueck.url, { cache: 'no-store' })
    if (!geholt.ok) {
      return {
        ok: false,
        fehler: { text: `Die Datei war nicht abrufbar (${geholt.status}).`, zugangHin: false },
      }
    }
    inhalt = Buffer.from(await geholt.arrayBuffer())
    mimeTyp =
      geholt.headers.get('content-type')?.split(';')[0] ??
      (stueck.istVideo ? 'video/mp4' : 'image/jpeg')
  } catch (fehler) {
    return {
      ok: false,
      fehler: { text: `Die Datei war nicht abrufbar: ${(fehler as Error).message}`, zugangHin: false },
    }
  }

  const art = stueck.istVideo ? 'videos' : 'images'

  const start = await anfrage<UploadAntwort>(token, `/${art}?action=initializeUpload`, {
    methode: 'POST',
    koerper: {
      initializeUploadRequest: {
        owner: `urn:li:organization:${organisationId}`,
        // Videos verlangen die Größe vorab; LinkedIn teilt danach mit, in wie
        // vielen Stücken hochgeladen werden soll.
        ...(stueck.istVideo ? { fileSizeBytes: inhalt.byteLength, uploadCaptions: false } : {}),
      },
    },
  })
  if (!start.ok) return start

  const wert = start.daten.value
  const urn = stueck.istVideo ? wert?.video : wert?.image
  // Bei Videos steht die Adresse in den Anweisungen. Mehr als ein Stück gibt es
  // erst jenseits von 4 MB je Teil — dann müsste hier stückweise geladen
  // werden; so weit ist es noch nicht, deshalb nur der erste Eintrag.
  const adresse = wert?.uploadUrl ?? wert?.uploadInstructions?.[0]?.uploadUrl

  if (!urn || !adresse) {
    return {
      ok: false,
      fehler: { text: 'LinkedIn hat keine Upload-Adresse geliefert.', zugangHin: false },
    }
  }

  try {
    const hoch = await fetch(adresse, {
      method: 'PUT',
      headers: { authorization: `Bearer ${token}`, 'content-type': mimeTyp },
      body: new Uint8Array(inhalt),
    })
    if (!hoch.ok) {
      return {
        ok: false,
        fehler: { text: `Der Upload zu LinkedIn scheiterte (${hoch.status}).`, zugangHin: false },
      }
    }
  } catch (fehler) {
    return {
      ok: false,
      fehler: {
        text: `Der Upload zu LinkedIn scheiterte: ${(fehler as Error).message}`,
        zugangHin: false,
      },
    }
  }

  return { ok: true, daten: urn }
}

/**
 * Einen Beitrag auf einer Firmenseite veröffentlichen.
 *
 * Mehrere Bilder ergeben bei LinkedIn keinen Karussell-Beitrag wie bei
 * Instagram, sondern einen Beitrag mit mehreren Bildern (`multiImage`) — das
 * ist dieselbe Absicht in anderer Form, und der Kunde sieht sie in seiner
 * Ansicht so, wie sie dort erscheint.
 */
export async function posteAufLinkedIn(opts: {
  token: string
  organisationId: string
  text: string
  medien: Medienstueck[]
}): Promise<LinkedInAntwort<{ externeId: string }>> {
  const autor = `urn:li:organization:${opts.organisationId}`

  const urns: string[] = []
  for (const stueck of opts.medien) {
    const geladen = await ladeMediumHoch(opts.token, opts.organisationId, stueck)
    if (!geladen.ok) return geladen
    urns.push(geladen.daten)
  }

  const inhalt =
    urns.length === 0
      ? undefined
      : urns.length === 1
        ? { media: { id: urns[0] } }
        : { multiImage: { images: urns.map((id) => ({ id })) } }

  const angelegt = await anfrage<{ id: string }>(opts.token, '/posts', {
    methode: 'POST',
    koerper: {
      author: autor,
      commentary: opts.text,
      visibility: 'PUBLIC',
      distribution: { feedDistribution: 'MAIN_FEED' },
      lifecycleState: 'PUBLISHED',
      // Ohne dieses Feld lehnt LinkedIn den Beitrag ab; „NO_RESTRICT" heißt
      // schlicht: Kommentare sind erlaubt.
      isReshareDisabledByAuthor: false,
      ...(inhalt ? { content: inhalt } : {}),
    },
  })
  if (!angelegt.ok) return angelegt

  return { ok: true, daten: { externeId: angelegt.daten.id } }
}
