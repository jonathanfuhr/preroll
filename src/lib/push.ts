import 'server-only'
import webpush from 'web-push'
import { prisma } from './db'
import { ladeEinstellungen, speichereEinstellungen } from './einstellungen'
import { env } from './env'

export type PushNachricht = {
  titel: string
  text: string
  url?: string
}

/**
 * VAPID-Schlüsselpaar. Wird beim ersten Bedarf erzeugt und gespeichert —
 * so muss beim Aufsetzen nichts von Hand hinterlegt werden.
 */
export async function vapidSchluessel(): Promise<{ oeffentlich: string; privat: string }> {
  const e = await ladeEinstellungen()
  if (e.vapidPublicKey && e.vapidPrivateKey) {
    return { oeffentlich: e.vapidPublicKey, privat: e.vapidPrivateKey }
  }

  const paar = webpush.generateVAPIDKeys()
  await speichereEinstellungen({
    vapidPublicKey: paar.publicKey,
    vapidPrivateKey: paar.privateKey,
  })
  return { oeffentlich: paar.publicKey, privat: paar.privateKey }
}

export async function oeffentlicherVapidSchluessel(): Promise<string> {
  return (await vapidSchluessel()).oeffentlich
}

/**
 * Schickt eine Push-Nachricht an alle Geräte eines Nutzers oder Gastes.
 * Abgelaufene Abos werden dabei aufgeräumt.
 */
export async function sendePush(
  empfaenger: { nutzerId: string } | { gastId: string },
  nachricht: PushNachricht,
): Promise<{ zugestellt: number; entfernt: number }> {
  const abos = await prisma.pushAbo.findMany({ where: empfaenger })
  if (abos.length === 0) return { zugestellt: 0, entfernt: 0 }

  const { oeffentlich, privat } = await vapidSchluessel()
  webpush.setVapidDetails(env.appUrl, oeffentlich, privat)

  const nutzlast = JSON.stringify({
    titel: nachricht.titel,
    text: nachricht.text,
    url: nachricht.url ?? env.appUrl,
  })

  let zugestellt = 0
  const abgelaufen: string[] = []

  await Promise.all(
    abos.map(async (abo) => {
      try {
        await webpush.sendNotification(
          { endpoint: abo.endpoint, keys: { p256dh: abo.p256dh, auth: abo.auth } },
          nutzlast,
        )
        zugestellt++
      } catch (fehler) {
        const status = (fehler as { statusCode?: number }).statusCode
        // 404/410: Der Browser hat das Abo verworfen.
        if (status === 404 || status === 410) abgelaufen.push(abo.id)
      }
    }),
  )

  if (abgelaufen.length > 0) {
    await prisma.pushAbo.deleteMany({ where: { id: { in: abgelaufen } } })
  }

  return { zugestellt, entfernt: abgelaufen.length }
}
