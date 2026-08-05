import 'server-only'
import nodemailer from 'nodemailer'
import { absenderKopf, type Absender, type Mail, type Versandergebnis } from './typen'

export type SmtpKonfiguration = {
  host: string
  port: number
  sicher: boolean
  benutzer?: string | null
  passwort?: string | null
}

/**
 * Generisches SMTP — funktioniert mit jedem Anbieter. Die Presets in der
 * Oberfläche füllen lediglich diese Felder vor.
 */
export async function sendeUeberSmtp(
  konfiguration: SmtpKonfiguration,
  absender: Absender,
  mail: Mail,
): Promise<Versandergebnis> {
  try {
    const transport = nodemailer.createTransport({
      host: konfiguration.host,
      port: konfiguration.port,
      secure: konfiguration.sicher,
      auth: konfiguration.benutzer
        ? { user: konfiguration.benutzer, pass: konfiguration.passwort ?? '' }
        : undefined,
    })

    await transport.sendMail({
      from: absenderKopf(absender),
      to: mail.an,
      subject: mail.betreff,
      text: mail.text,
      html: mail.html,
    })

    return { ok: true, transport: 'SMTP' }
  } catch (fehler) {
    return { ok: false, transport: 'SMTP', fehler: (fehler as Error).message }
  }
}
