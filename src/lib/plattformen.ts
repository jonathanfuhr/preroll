import type { Plattform } from '@prisma/client'

/**
 * Die Plattformen, auf die Preroll veröffentlicht.
 *
 * `gebaut` trennt, was heute funktioniert, von dem, was im Datenmodell schon
 * einen Platz hat. LinkedIn und YouTube stehen im Enum, damit sie später ohne
 * Migration danebenpassen — in der Oberfläche haben sie bis dahin nichts
 * verloren. Wer eine Auswahl baut, filtert auf `gebaut`; wer einen
 * gespeicherten Wert anzeigt, nimmt `PLATTFORM_TEXT` und trifft damit auch
 * die noch nicht gebauten.
 */
export type PlattformInfo = {
  name: string
  gebaut: boolean
}

export const PLATTFORMEN: Record<Plattform, PlattformInfo> = {
  FACEBOOK: { name: 'Facebook', gebaut: true },
  INSTAGRAM: { name: 'Instagram', gebaut: true },
  LINKEDIN: { name: 'LinkedIn', gebaut: false },
  YOUTUBE: { name: 'YouTube', gebaut: false },
}

export const PLATTFORM_TEXT: Record<Plattform, string> = {
  FACEBOOK: 'Facebook',
  INSTAGRAM: 'Instagram',
  LINKEDIN: 'LinkedIn',
  YOUTUBE: 'YouTube',
}

/** Was heute wirklich bespielt werden kann. */
export const GEBAUTE_PLATTFORMEN = (Object.keys(PLATTFORMEN) as Plattform[]).filter(
  (p) => PLATTFORMEN[p].gebaut,
)

/**
 * Facebook und Instagram teilen sich einen Zugang: Das Instagram-Konto hängt
 * an der Facebook-Seite, und der Seiten-Token bedient beide. Wer später
 * LinkedIn ergänzt, bekommt hier einen eigenen Eintrag — die Zuordnung
 * „welcher Zugang bedient welche Plattform" gehört an eine Stelle.
 */
export function zugangsPlattform(plattform: Plattform): Plattform {
  return plattform === 'INSTAGRAM' ? 'FACEBOOK' : plattform
}
