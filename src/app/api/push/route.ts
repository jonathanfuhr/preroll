import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { aktuellerGast, aktuellerNutzer } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { oeffentlicherVapidSchluessel } from '@/lib/push'

const Abo = z.object({
  endpoint: z.string().url(),
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
})

/** Der Browser braucht den öffentlichen VAPID-Schlüssel, um ein Abo anzulegen. */
export async function GET() {
  return Response.json({ schluessel: await oeffentlicherVapidSchluessel() })
}

/** Legt ein Push-Abo für das angemeldete Konto an — Team oder Gast. */
export async function POST(anfrage: NextRequest) {
  const nutzer = await aktuellerNutzer()
  const gast = nutzer ? null : await aktuellerGast()
  if (!nutzer && !gast) return Response.json({ fehler: 'Nicht angemeldet.' }, { status: 401 })

  const geprueft = Abo.safeParse(await anfrage.json())
  if (!geprueft.success) return Response.json({ fehler: 'Ungültiges Abo.' }, { status: 400 })

  const { endpoint, keys } = geprueft.data

  await prisma.pushAbo.upsert({
    where: { endpoint },
    update: { p256dh: keys.p256dh, auth: keys.auth },
    create: {
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      nutzerId: nutzer?.id ?? null,
      gastId: gast?.id ?? null,
    },
  })

  return Response.json({ ok: true })
}

/** Meldet ein Gerät wieder ab. */
export async function DELETE(anfrage: NextRequest) {
  const endpoint = anfrage.nextUrl.searchParams.get('endpoint')
  if (!endpoint) return Response.json({ fehler: 'endpoint fehlt.' }, { status: 400 })

  await prisma.pushAbo.deleteMany({ where: { endpoint } })
  return Response.json({ ok: true })
}
