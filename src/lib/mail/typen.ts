export type Mail = {
  an: string
  betreff: string
  text: string
  html?: string
}

export type Versandergebnis =
  | { ok: true; transport: string }
  | { ok: false; transport: string; fehler: string }

export type Absender = {
  name?: string | null
  adresse: string
}

export function absenderKopf(absender: Absender): string {
  return absender.name ? `${absender.name} <${absender.adresse}>` : absender.adresse
}
