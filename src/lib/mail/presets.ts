/**
 * Vorbelegungen für gängige SMTP-Anbieter — spart die Suche in deren Doku.
 *
 * Bewusst ohne Abhängigkeiten: die Einstellungsmaske ist eine Client-Komponente
 * und darf nichts importieren, was Nodemailer und damit `net`/`tls` mitzieht.
 */
export type SmtpPreset = {
  host: string
  port: number
  sicher: boolean
}

export const SMTP_PRESETS: Record<string, SmtpPreset> = {
  Brevo: { host: 'smtp-relay.brevo.com', port: 587, sicher: false },
  Mailgun: { host: 'smtp.mailgun.org', port: 587, sicher: false },
  Postmark: { host: 'smtp.postmarkapp.com', port: 587, sicher: false },
  'Amazon SES': { host: 'email-smtp.eu-central-1.amazonaws.com', port: 587, sicher: false },
  'Microsoft 365': { host: 'smtp.office365.com', port: 587, sicher: false },
  Gmail: { host: 'smtp.gmail.com', port: 465, sicher: true },
}
