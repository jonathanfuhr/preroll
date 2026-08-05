import 'server-only'
import { ladeEinstellungen } from '../einstellungen'
import { sendeUeberGoogle } from './google'
import { sendeUeberMicrosoft } from './microsoft'
import { sendeUeberSmtp } from './smtp'
import type { Mail, Versandergebnis } from './typen'

export type { Mail, Versandergebnis } from './typen'
export { SMTP_PRESETS } from './presets'

/**
 * Verschickt eine Mail über den in den Einstellungen gewählten Transport.
 * Wirft nie — Benachrichtigungen dürfen keinen Speichervorgang scheitern lassen.
 */
export async function sendeMail(mail: Mail): Promise<Versandergebnis> {
  const e = await ladeEinstellungen()

  const absender = {
    name: e.mailVonName,
    adresse: e.mailVonAdresse ?? '',
  }

  switch (e.mailTransport) {
    case 'SMTP': {
      if (!e.smtpHost || !e.smtpPort || !absender.adresse) {
        return { ok: false, transport: 'SMTP', fehler: 'SMTP ist nicht vollständig eingerichtet.' }
      }
      return sendeUeberSmtp(
        {
          host: e.smtpHost,
          port: e.smtpPort,
          sicher: e.smtpSicher,
          benutzer: e.smtpBenutzer,
          passwort: e.smtpPasswort,
        },
        absender,
        mail,
      )
    }

    case 'MICROSOFT365': {
      if (!e.msTenantId || !e.msClientId || !e.msClientSecret || !e.msPostfach) {
        return {
          ok: false,
          transport: 'Microsoft 365',
          fehler: 'Microsoft 365 ist nicht vollständig eingerichtet.',
        }
      }
      return sendeUeberMicrosoft(
        {
          tenantId: e.msTenantId,
          clientId: e.msClientId,
          clientSecret: e.msClientSecret,
          postfach: e.msPostfach,
        },
        mail,
      )
    }

    case 'GOOGLE': {
      if (!e.googleClientId || !e.googleClientSecret || !e.googleRefreshToken || !e.googleAbsender) {
        return { ok: false, transport: 'Google', fehler: 'Google ist nicht vollständig eingerichtet.' }
      }
      return sendeUeberGoogle(
        {
          clientId: e.googleClientId,
          clientSecret: e.googleClientSecret,
          refreshToken: e.googleRefreshToken,
          absender: e.googleAbsender,
        },
        mail,
      )
    }

    default:
      return {
        ok: false,
        transport: 'keiner',
        fehler: 'Es ist kein Mailversand eingerichtet (Einstellungen → Mailversand).',
      }
  }
}

export async function mailversandEingerichtet(): Promise<boolean> {
  const e = await ladeEinstellungen()
  return e.mailTransport !== 'DEAKTIVIERT'
}
