import { redirect } from 'next/navigation'
import { hashePasswort, starteTeamSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { pruefePasswortRegeln, passwortRegelText } from '@/lib/passwort'
import { initialen } from '@/lib/slug'
import { Eingabe, Feld, Fehler, Hinweis, Knopf } from '@/components/ui'

export const metadata = { title: 'Einrichten — Preroll' }
export const dynamic = 'force-dynamic'

/**
 * Ersteinrichtung. Solange es kein Team-Konto gibt, führt jeder Weg hierher —
 * danach ist die Seite gesperrt, damit sich niemand nachträglich selbst zum
 * Administrator macht.
 */
async function einrichten(formular: FormData) {
  'use server'

  if ((await prisma.nutzer.count()) > 0) redirect('/anmelden')

  const name = String(formular.get('name') ?? '').trim()
  const email = String(formular.get('email') ?? '').trim().toLowerCase()
  const passwort = String(formular.get('passwort') ?? '')
  const wiederholung = String(formular.get('wiederholung') ?? '')

  if (!name || !email) redirect('/einrichten?fehler=pflicht')
  if (passwort !== wiederholung) redirect('/einrichten?fehler=ungleich')

  const regelbruch = pruefePasswortRegeln(passwort)
  if (regelbruch) redirect(`/einrichten?fehler=passwort&meldung=${encodeURIComponent(regelbruch)}`)

  const nutzer = await prisma.nutzer.create({
    data: {
      email,
      name,
      initialen: initialen(name),
      rolle: 'ADMIN',
      passwortHash: await hashePasswort(passwort),
    },
  })

  // Gleich angemeldet weiterreichen — der erste Weg führt in die Einstellungen.
  await starteTeamSession(nutzer.id)
  redirect('/einstellungen')
}

export default async function EinrichtenSeite({
  searchParams,
}: {
  searchParams: Promise<{ fehler?: string; meldung?: string }>
}) {
  // Ist schon jemand da, gibt es hier nichts mehr zu tun.
  if ((await prisma.nutzer.count()) > 0) redirect('/anmelden')

  const { fehler, meldung } = await searchParams

  const fehlertext =
    fehler === 'pflicht'
      ? 'Bitte Name und E-Mail ausfüllen.'
      : fehler === 'ungleich'
        ? 'Die beiden Passwörter stimmen nicht überein.'
        : fehler === 'passwort'
          ? (meldung ?? 'Das Passwort erfüllt die Anforderungen nicht.')
          : null

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-[400px]">
        <div className="mb-7">
          <div className="text-[11px] uppercase tracking-[0.22em] text-leiser">preroll</div>
          <h1 className="mt-3 text-[26px] font-semibold tracking-[-0.02em]">Willkommen</h1>
          <p className="mt-1.5 text-[13px] leading-relaxed text-leise">
            Diese Installation ist noch leer. Legen Sie das erste Konto an — es wird automatisch
            Administrator und kann danach weitere Konten einladen.
          </p>
        </div>

        {fehlertext && (
          <div className="mb-5">
            <Fehler>{fehlertext}</Fehler>
          </div>
        )}

        <form action={einrichten} className="grid gap-4">
          <Feld beschriftung="Name">
            <Eingabe name="name" required autoFocus autoComplete="name" placeholder="Vor- und Nachname" />
          </Feld>
          <Feld beschriftung="E-Mail">
            <Eingabe
              name="email"
              type="email"
              required
              autoComplete="username"
              placeholder="name@thdvideo.de"
            />
          </Feld>
          <Feld beschriftung="Passwort" hinweis={passwortRegelText()}>
            <Eingabe name="passwort" type="password" required autoComplete="new-password" />
          </Feld>
          <Feld beschriftung="Passwort wiederholen">
            <Eingabe name="wiederholung" type="password" required autoComplete="new-password" />
          </Feld>

          <Knopf art="primaer" type="submit" className="mt-1 w-full">
            Konto anlegen und starten
          </Knopf>
        </form>

        <div className="mt-6">
          <Hinweis>
            Im nächsten Schritt richten Sie den Mailversand ein — ohne ihn können sich Kunden nicht
            per Code anmelden.
          </Hinweis>
        </div>
      </div>
    </main>
  )
}
