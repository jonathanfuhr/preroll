export type Mail = {
  an: string
  betreff: string
  text: string
  html?: string
  /**
   * Wohin eine Antwort gehen soll — bei Benachrichtigungen die
   * Projektverantwortliche des Kunden.
   *
   * Gesendet wird aus einem reinen **Ausgangspostfach**; wer darauf antwortet,
   * schriebe sonst an eine Adresse, die niemand liest. Ohne `Reply-To` landete
   * die Antwort außerdem im selben Postfach wie alle anderen — und genau das
   * war der Grund für den Wechsel: Die Meldungen lagen im Postausgang der
   * allgemeinen Adresse und gingen dort unter.
   */
  antwortAn?: string | null
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
