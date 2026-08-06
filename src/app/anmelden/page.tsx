import { redirect } from 'next/navigation'
import { aktuellerGast, aktuellerNutzer, pruefePasswort, starteTeamSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { leseDomaenen, istEigeneDomaene } from '@/lib/domaenen'
import { ladeEinstellungen } from '@/lib/einstellungen'
import { codeAnfordern } from '@/app/f/[token]/aktionen'
import { Eingabe, Feld, Fehler, Hinweis, Knopf } from '@/components/ui'

export const metadata = { title: 'Anmelden — Preroll' }
// Fragt beim Rendern die Datenbank, ob es schon ein Konto gibt — darf deshalb
// nicht beim Bauen vorgerendert werden.
export const dynamic = 'force-dynamic'

/**
 * Eine Zeile für alle.
 *
 * Wer hierher kommt, weiß seine Mailadresse — aber nicht unbedingt, ob er
 * „Team" oder „Gast" ist, ob sein Konto an Microsoft hängt oder ein Passwort
 * hat. Deshalb entscheidet die Adresse über den Weg, nicht der Mensch:
 * eigene Domäne → Microsoft, bekannter Gast → Code per Mail, sonst Passwort.
 */
async function weiter(formular: FormData) {
  'use server'

  const email = String(formular.get('email') ?? '')
    .trim()
    .toLowerCase()
  if (!email.includes('@')) redirect('/anmelden?fehler=email')

  const e = await ladeEinstellungen()

  // Eigene Domäne: direkt zu Microsoft. Die Adresse geht als login_hint mit,
  // damit dort niemand sie erneut tippt.
  if (e.m365LoginErlaubt && istEigeneDomaene(email, leseDomaenen(e.m365Domaenen))) {
    redirect(`/api/auth/m365/start?email=${encodeURIComponent(email)}`)
  }

  const nutzer = await prisma.nutzer.findUnique({ where: { email } })

  if (nutzer?.aktiv && nutzer.passwortHash && e.lokalerLoginErlaubt) {
    redirect(`/anmelden?schritt=passwort&email=${encodeURIComponent(email)}`)
  }

  // Ein Teamkonto ohne den passenden Weg — sagen, statt es als „unbekannt"
  // auszugeben. Wer hier steht, sucht sonst an der falschen Stelle.
  if (nutzer?.aktiv) {
    redirect(
      e.m365LoginErlaubt
        ? `/anmelden?fehler=nur-m365&email=${encodeURIComponent(email)}`
        : '/anmelden?fehler=kein-weg',
    )
  }

  // Bekannter Gast: Code per Mail. Bewusst nur für Gäste, die es schon gibt —
  // die Anmeldeseite soll keine neuen Konten aus dem Nichts erzeugen.
  const gast = await prisma.gast.findUnique({ where: { email } })
  if (gast) {
    // Wer noch eine gültige Sitzung hat, braucht keinen Code — sonst bekäme er
    // eine Mail für eine Anmeldung, die längst steht.
    const angemeldet = await aktuellerGast()
    if (angemeldet?.id === gast.id && angemeldet.name.trim()) redirect('/portal')

    await codeAnfordern(null, formular)
  }

  redirect('/anmelden?fehler=unbekannt')
}

async function mitPasswort(formular: FormData) {
  'use server'

  const email = String(formular.get('email') ?? '')
    .trim()
    .toLowerCase()
  const passwort = String(formular.get('passwort') ?? '')
  const zurueck = `/anmelden?schritt=passwort&email=${encodeURIComponent(email)}`

  if (!email || !passwort) redirect(`${zurueck}&fehler=leer`)

  const e = await ladeEinstellungen()
  if (!e.lokalerLoginErlaubt) redirect('/anmelden?fehler=kein-weg')

  const nutzer = await prisma.nutzer.findUnique({ where: { email } })
  // Immer beide Prüfungen laufen lassen, damit sich unbekannte Adressen nicht
  // an der Antwortzeit erkennen lassen.
  const passt = nutzer?.passwortHash
    ? await pruefePasswort(passwort, nutzer.passwortHash)
    : await pruefePasswort(passwort, 'scrypt:00:00')

  if (!nutzer || !nutzer.aktiv || !passt) redirect(`${zurueck}&fehler=falsch`)

  await prisma.nutzer.update({
    where: { id: nutzer.id },
    data: { zuletztAktivAm: new Date() },
  })
  await starteTeamSession(nutzer.id)
  redirect('/kunden')
}

/**
 * Was schiefgehen kann, im Klartext. Vorher trug jeder Fehler beim Anmelden
 * über Microsoft die Meldung „E-Mail oder Passwort stimmen nicht" — bei einem
 * Weg ohne Passwort führt das nur in die Irre.
 */
const MELDUNG: Record<string, string> = {
  email: 'Bitte eine E-Mail-Adresse angeben.',
  leer: 'Bitte das Passwort ausfüllen.',
  falsch: 'E-Mail oder Passwort stimmen nicht.',
  unbekannt:
    'Mit dieser Adresse ist hier kein Zugang hinterlegt. Kunden kommen über ihren persönlichen Freigabe-Link herein.',
  'nur-m365': 'Für dieses Konto läuft die Anmeldung über Microsoft 365 — bitte den Knopf oben.',
  'kein-weg': 'Für dieses Konto ist derzeit kein Anmeldeweg eingeschaltet. Bitte im Team melden.',
  'm365-aus': 'Die Anmeldung über Microsoft 365 ist nicht eingerichtet.',
  'm365-state': 'Die Anmeldung ist abgelaufen. Bitte noch einmal beginnen.',
  'm365-netz':
    'Microsoft war nicht erreichbar. Bitte noch einmal versuchen — hält es an, stimmt etwas mit der Netzwerkverbindung des Servers nicht.',
  'm365-token': 'Microsoft hat die Anmeldung abgelehnt. Bitte noch einmal versuchen.',
  'm365-fremd':
    'Diese Adresse gehört nicht zu einer freigeschalteten Domäne. Bitte im Team ein Konto anlegen lassen.',
  'm365-gesperrt': 'Dieses Konto ist abgeschaltet. Bitte im Team nachfragen.',
}

export default async function AnmeldenSeite({
  searchParams,
}: {
  searchParams: Promise<{ fehler?: string; schritt?: string; email?: string }>
}) {
  // Frische Installation: erst muss ein Konto entstehen.
  if ((await prisma.nutzer.count()) === 0) redirect('/einrichten')
  if (await aktuellerNutzer()) redirect('/kunden')

  const { fehler, schritt, email } = await searchParams
  const e = await ladeEinstellungen()

  const passwortSchritt = schritt === 'passwort' && email && e.lokalerLoginErlaubt

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-[360px]">
        <div className="mb-7">
          <div className="text-[11px] uppercase tracking-[0.22em] text-leiser">preroll</div>
          <h1 className="mt-3 text-[26px] font-semibold tracking-[-0.02em]">Anmelden</h1>
          <p className="mt-1.5 text-[13px] leading-relaxed text-leise">
            {passwortSchritt
              ? `Passwort für ${email}.`
              : `Zugang zu ${e.workspaceName} — für das Team und für Kunden.`}
          </p>
        </div>

        {fehler && (
          <div className="mb-5">
            <Fehler>{MELDUNG[fehler] ?? 'Das hat nicht geklappt.'}</Fehler>
          </div>
        )}

        {passwortSchritt ? (
          <form action={mitPasswort} className="grid gap-4">
            <input type="hidden" name="email" value={email} />
            <Feld beschriftung="Passwort">
              <Eingabe
                name="passwort"
                type="password"
                autoComplete="current-password"
                required
                autoFocus
              />
            </Feld>
            <Knopf art="primaer" type="submit" className="w-full">
              Anmelden
            </Knopf>
            <a href="/anmelden" className="text-center text-[12px] text-leiser hover:text-tinte">
              Andere Adresse verwenden
            </a>
          </form>
        ) : (
          <>
            {e.m365LoginErlaubt && (
              <>
                <a
                  href="/api/auth/m365/start"
                  className="flex w-full items-center justify-center gap-2.5 rounded-[5px] border border-rahmen-3 bg-flaeche px-4 py-2.5 text-[13px] font-medium text-tinte transition-colors hover:border-rahmen-4"
                >
                  <MicrosoftZeichen />
                  Mit Microsoft 365 anmelden
                </a>

                <div className="my-5 flex items-center gap-3" aria-hidden>
                  <span className="h-px flex-1 bg-rahmen" />
                  <span className="text-[11px] text-stiller">oder</span>
                  <span className="h-px flex-1 bg-rahmen" />
                </div>
              </>
            )}

            <form action={weiter} className="grid gap-4">
              <Feld
                beschriftung="E-Mail"
                hinweis="Wie es weitergeht, hängt an der Adresse — Kunden bekommen einen Code per Mail."
              >
                <Eingabe
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  autoFocus
                  placeholder="name@firma.de"
                />
              </Feld>
              <Knopf art="primaer" type="submit" className="w-full">
                Weiter
              </Knopf>
            </form>

            {!e.m365LoginErlaubt && !e.lokalerLoginErlaubt && (
              <div className="mt-5">
                <Hinweis>
                  Für das Team ist zurzeit kein Anmeldeweg eingeschaltet. Kunden können sich
                  weiterhin mit einem Code anmelden.
                </Hinweis>
              </div>
            )}
          </>
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

/** Die vier Quadrate, an denen man den Microsoft-Knopf ohne Text erkennt. */
function MicrosoftZeichen() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
      <rect width="6.4" height="6.4" fill="#f25022" />
      <rect x="7.6" width="6.4" height="6.4" fill="#7fba00" />
      <rect y="7.6" width="6.4" height="6.4" fill="#00a4ef" />
      <rect x="7.6" y="7.6" width="6.4" height="6.4" fill="#ffb900" />
    </svg>
  )
}
