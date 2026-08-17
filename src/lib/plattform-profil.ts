import type { KennzahlenQuelle, Plattform } from '@prisma/client'

/**
 * Die Profile eines Kunden je Plattform — Handle, Bio, Website und die drei
 * Zahlen.
 *
 * Vorher lagen diese Felder flach am Kunden und meinten stillschweigend
 * Instagram. Sobald Facebook und LinkedIn dieselben Angaben brauchen, trägt das
 * nicht mehr: Es hätte `fbFollower`, `liFollower` und so weiter gegeben —
 * dieselbe Sache in drei Sätzen Spalten — oder die Zahlen eines Kanals hätten
 * für alle gegolten.
 *
 * Zugegriffen wird über eine Karte statt über `find`: An den Anzeigestellen
 * steht sonst überall dieselbe Suche, und eine davon vergisst irgendwann den
 * Plattform-Vergleich.
 */

export type Profilwerte = {
  handle: string | null
  bio: string | null
  website: string | null
  follower: number | null
  gefolgt: number | null
  beitraege: number | null
  standAm: Date | null
  quelle: KennzahlenQuelle
}

export type ProfilZeile = Profilwerte & { plattform: Plattform }

export const LEERES_PROFIL: Profilwerte = {
  handle: null,
  bio: null,
  website: null,
  follower: null,
  gefolgt: null,
  beitraege: null,
  standAm: null,
  quelle: 'MANUELL',
}

export type ProfilKarte = Record<Plattform, Profilwerte>

/**
 * Aus den geladenen Zeilen eine vollständige Karte bauen — jede Plattform
 * kommt darin vor, auch die ohne Zeile. Das erspart den Anzeigestellen die
 * Frage, ob es das Profil schon gibt: Ein Kunde, für den noch niemand
 * LinkedIn gepflegt hat, hat dort eben leere Werte.
 */
export function profilKarte(zeilen: ProfilZeile[]): ProfilKarte {
  const karte = {
    FACEBOOK: LEERES_PROFIL,
    INSTAGRAM: LEERES_PROFIL,
    LINKEDIN: LEERES_PROFIL,
    YOUTUBE: LEERES_PROFIL,
  } as ProfilKarte

  for (const zeile of zeilen) {
    const { plattform, ...werte } = zeile
    karte[plattform] = werte
  }

  return karte
}

/**
 * Trägt dieses Profil überhaupt etwas?
 *
 * Entscheidet, ob ein Abschnitt in den Stammdaten seine Zahlen zeigt oder den
 * Leerzustand. Ein Profil, das nur aus einem Handle besteht, gilt als gepflegt
 * — jemand hat es eingetragen.
 */
export function istGepflegt(werte: Profilwerte): boolean {
  return Boolean(
    werte.handle ||
      werte.bio ||
      werte.website ||
      werte.follower !== null ||
      werte.gefolgt !== null ||
      werte.beitraege !== null,
  )
}

/** Kurzform für die Zahlenzeile: „1.240 Follower · 87 Beiträge". */
export function kennzahlenText(werte: Profilwerte): string | null {
  const teile: string[] = []
  const zahl = new Intl.NumberFormat('de-DE')

  if (werte.follower !== null) teile.push(`${zahl.format(werte.follower)} Follower`)
  if (werte.beitraege !== null) teile.push(`${zahl.format(werte.beitraege)} Beiträge`)
  if (werte.gefolgt !== null) teile.push(`${zahl.format(werte.gefolgt)} gefolgt`)

  return teile.length > 0 ? teile.join(' · ') : null
}
