/**
 * Was TikToks öffentliche Profilseite hergibt — und wie man es liest.
 *
 * Bewusst ohne `server-only`: reine Textarbeit, und genau hier bricht es
 * zuerst, wenn TikTok die Seite umbaut. Also testbar halten — dieselbe Linie
 * wie bei `instagram-profil.ts`.
 *
 * **Woher die Zahlen kommen.** TikTok legt den Zustand der Seite als JSON in
 * ein `<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__">`. Darin steht unter
 * `__DEFAULT_SCOPE__ → webapp.user-detail → userInfo` das Profil samt Zahlen.
 * Vorgänger hießen `SIGI_STATE` und `__NEXT_DATA__`; sie werden mitgelesen,
 * weil TikTok schon mehrfach umgestellt hat und ein Rückfall billiger ist als
 * ein Ausfall.
 *
 * **`statsV2` vor `stats`.** Nachgemessen: `stats` rundet (95300000),
 * `statsV2` liefert denselben Wert exakt und als Zeichenkette (95315669).
 * Gerundete Followerzahlen wären in einer Verlaufskurve wertlos — sie
 * änderten sich erst nach Hunderttausenden.
 */

export type TikTokWerte = {
  handle: string | null
  name: string | null
  bio: string | null
  follower: number | null
  gefolgt: number | null
  beitraege: number | null
  /** Die Summe der Herzen über alle Videos — TikToks dritte Profilzahl. */
  likes: number | null
  profilbildUrl: string | null
  privat: boolean
}

/**
 * `@name`, ganze Profil-Adressen und Anhängsel fallen weg. Das Protokoll ist
 * dabei freiwillig — kopiert wird oft nur `tiktok.com/@name`.
 */
export function normalisiereHandle(eingabe: string): string {
  return eingabe
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/^(www\.)?tiktok\.com\//i, '')
    .replace(/^@/, '')
    .replace(/[/?#].*$/, '')
    .trim()
}

/**
 * TikTok schreibt Zahlen mal als Zahl, mal als Zeichenkette (`statsV2`).
 * Beides ist gültig; alles andere ist keine Zahl.
 */
function zahl(wert: unknown): number | null {
  if (typeof wert === 'number' && Number.isFinite(wert)) return wert
  if (typeof wert === 'string' && /^\d+$/.test(wert.trim())) {
    const n = Number(wert.trim())
    return Number.isFinite(n) ? n : null
  }
  return null
}

function text(wert: unknown): string | null {
  return typeof wert === 'string' && wert.trim() ? wert.trim() : null
}

/** Der JSON-Block aus der Seite — ohne ihn gibt es nichts zu lesen. */
export function datenblockAus(html: string): unknown | null {
  const kandidaten = [
    /<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/,
    /<script id="SIGI_STATE"[^>]*>([\s\S]*?)<\/script>/,
    /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/,
  ]

  for (const muster of kandidaten) {
    const treffer = muster.exec(html)
    if (!treffer) continue
    try {
      return JSON.parse(treffer[1])
    } catch {
      // Ein kaputter Block ist kein Grund aufzuhören — vielleicht steht der
      // nächste noch daneben.
    }
  }
  return null
}

function alsObjekt(wert: unknown): Record<string, unknown> | null {
  return typeof wert === 'object' && wert !== null ? (wert as Record<string, unknown>) : null
}

/**
 * Das Nutzerprofil im Datenblock finden.
 *
 * Drei Fassungen, weil TikTok drei hatte: der heutige Scope, das alte
 * `SIGI_STATE` mit `UserModule`, und `__NEXT_DATA__` mit `props.pageProps`.
 */
function findeNutzerinfo(daten: unknown): Record<string, unknown> | null {
  const wurzel = alsObjekt(daten)
  if (!wurzel) return null

  const scope = alsObjekt(wurzel['__DEFAULT_SCOPE__'])
  const detail = alsObjekt(scope?.['webapp.user-detail'])
  const heute = alsObjekt(detail?.['userInfo'])
  if (heute) return heute

  // SIGI_STATE: `UserModule.users[handle]` und `UserModule.stats[handle]`.
  const userModule = alsObjekt(wurzel['UserModule'])
  if (userModule) {
    const users = alsObjekt(userModule['users'])
    const stats = alsObjekt(userModule['stats'])
    const ersterName = users ? Object.keys(users)[0] : undefined
    if (ersterName) {
      return { user: users?.[ersterName], stats: stats?.[ersterName] }
    }
  }

  const props = alsObjekt(alsObjekt(wurzel['props'])?.['pageProps'])
  const alt = alsObjekt(props?.['userInfo'])
  if (alt) return alt

  return null
}

/**
 * Warum kein Profil kam, wenn TikTok es sagt.
 *
 * Bei einem Konto, das es nicht gibt, antwortet TikTok mit **200** und einer
 * Seite ohne `userInfo` — dafür mit `statusCode`/`statusMsg` im selben Block
 * (nachgemessen: `10221 · user banned`, auch für einen frei erfundenen Namen).
 * Ohne diese Unterscheidung hieße jeder Fehlschlag „Sperrseite", und wer sich
 * im Handle vertippt hat, suchte den Fehler bei TikTok statt bei sich.
 */
export function statusAus(html: string): { code: number; text: string | null } | null {
  const wurzel = alsObjekt(datenblockAus(html))
  const scope = alsObjekt(wurzel?.['__DEFAULT_SCOPE__'])
  const detail = alsObjekt(scope?.['webapp.user-detail'])
  const code = zahl(detail?.['statusCode'])
  if (code === null || code === 0) return null
  return { code, text: text(detail?.['statusMsg']) }
}

/**
 * Aus der Seite die Profilwerte lesen. `null` heißt: Diese Seite trägt kein
 * Profil — meist eine Sperrseite oder ein Konto, das es nicht gibt.
 */
export function werteAusSeite(html: string): TikTokWerte | null {
  const info = findeNutzerinfo(datenblockAus(html))
  if (!info) return null

  const user = alsObjekt(info['user'])
  if (!user) return null

  // `statsV2` ist genauer und gewinnt; fehlt es, tut es das gerundete `stats`.
  const genau = alsObjekt(info['statsV2'])
  const grob = alsObjekt(info['stats'])
  const von = (feld: string) => zahl(genau?.[feld]) ?? zahl(grob?.[feld])

  return {
    handle: text(user['uniqueId']),
    name: text(user['nickname']),
    bio: text(user['signature']),
    follower: von('followerCount'),
    gefolgt: von('followingCount'),
    beitraege: von('videoCount'),
    likes: von('heartCount') ?? von('heart'),
    profilbildUrl: text(user['avatarLarger']) ?? text(user['avatarMedium']),
    privat: user['privateAccount'] === true,
  }
}
