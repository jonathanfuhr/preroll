import { redirect } from 'next/navigation'
import { aktuellerNutzer, pruefePasswort, starteTeamSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { ladeEinstellungen } from '@/lib/einstellungen'
import { Eingabe, Feld, Fehler, Knopf } from '@/components/ui'

export const metadata = { title: 'Anmelden — Preroll' }

async function anmelden(formular: FormData) {
  'use server'

  const email = String(formular.get('email') ?? '').trim().toLowerCase()
  const passwort = String(formular.get('passwort') ?? '')

  if (!email || !passwort) redirect('/anmelden?fehler=leer')

  const nutzer = await prisma.nutzer.findUnique({ where: { email } })
  // Immer beide Prüfungen laufen lassen, damit sich unbekannte Adressen nicht
  // an der Antwortzeit erkennen lassen.
  const passt = nutzer?.passwortHash
    ? await pruefePasswort(passwort, nutzer.passwortHash)
    : await pruefePasswort(passwort, 'scrypt:00:00')

  if (!nutzer || !nutzer.aktiv || !passt) redirect('/anmelden?fehler=falsch')

  await prisma.nutzer.update({
    where: { id: nutzer.id },
    data: { zuletztAktivAm: new Date() },
  })
  await starteTeamSession(nutzer.id)
  redirect('/kunden')
}

export default async function AnmeldenSeite({
  searchParams,
}: {
  searchParams: Promise<{ fehler?: string }>
}) {
  // Frische Installation: erst muss ein Konto entstehen.
  if ((await prisma.nutzer.count()) === 0) redirect('/einrichten')
  if (await aktuellerNutzer()) redirect('/kunden')

  const { fehler } = await searchParams
  const einstellungen = await ladeEinstellungen()

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-[360px]">
        <div className="mb-8">
          <div className="text-[11px] uppercase tracking-[0.22em] text-leiser">preroll</div>
          <h1 className="mt-3 text-[26px] font-semibold tracking-[-0.02em]">Anmelden</h1>
          <p className="mt-1.5 text-[13px] leading-relaxed text-leise">
            Zugang zum Backend von {einstellungen.workspaceName}.
          </p>
        </div>

        {fehler && (
          <div className="mb-5">
            <Fehler>
              {fehler === 'leer'
                ? 'Bitte E-Mail und Passwort ausfüllen.'
                : 'E-Mail oder Passwort stimmen nicht.'}
            </Fehler>
          </div>
        )}

        <form action={anmelden} className="grid gap-4">
          <Feld beschriftung="E-Mail">
            <Eingabe
              name="email"
              type="email"
              autoComplete="username"
              required
              placeholder="name@thdvideo.de"
            />
          </Feld>
          <Feld beschriftung="Passwort">
            <Eingabe name="passwort" type="password" autoComplete="current-password" required />
          </Feld>
          <Knopf art="primaer" type="submit" className="mt-1 w-full">
            Anmelden
          </Knopf>
        </form>

        {einstellungen.m365LoginErlaubt && (
          <a
            href="/api/auth/m365/start"
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-[5px] border border-rahmen-3 bg-flaeche px-4 py-2 text-[13px] font-medium text-tinte hover:border-rahmen-4"
          >
            Mit Microsoft 365 anmelden
          </a>
        )}

        <p className="mt-8 text-center text-[12px] leading-relaxed text-leiser">
          Kunden gelangen über ihren persönlichen Freigabe-Link hierher —{' '}
          <a href="/portal" className="text-akzent">
            oder hier entlang
          </a>
          .
        </p>
      </div>
    </main>
  )
}
