import Link from 'next/link'
import { redirect } from 'next/navigation'
import { aktuellerNutzer, beendeTeamSession } from '@/lib/auth'
import { ladeEinstellungen } from '@/lib/einstellungen'
import { Initialen } from '@/components/ui'

async function abmelden() {
  'use server'
  await beendeTeamSession()
  redirect('/anmelden')
}

export default async function TeamLayout({ children }: { children: React.ReactNode }) {
  const nutzer = await aktuellerNutzer()
  if (!nutzer) redirect('/anmelden')

  const einstellungen = await ladeEinstellungen()

  const punkte = [
    { href: '/kunden', text: 'Kunden' },
    { href: '/kommentare', text: 'Kommentare' },
    { href: '/bibliothek', text: 'Bibliothek' },
    { href: '/einstellungen', text: 'Einstellungen' },
  ]

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-rahmen bg-grund/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1440px] items-center gap-8 px-8">
          <Link href="/kunden" className="text-[11px] uppercase tracking-[0.22em] text-leiser hover:text-tinte">
            preroll
          </Link>

          <nav className="flex flex-1 items-center gap-6">
            {punkte.map((punkt) => (
              <Link
                key={punkt.href}
                href={punkt.href}
                className="text-[13px] text-tinte-3 transition-colors hover:text-tinte"
              >
                {punkt.text}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-[12px] font-medium leading-tight text-tinte">{nutzer.name}</div>
              <div className="text-[10.5px] leading-tight text-still">
                {einstellungen.workspaceName}
              </div>
            </div>
            <Initialen text={nutzer.initialen} />
            <form action={abmelden}>
              <button
                type="submit"
                className="text-[11.5px] text-leiser transition-colors hover:text-akzent"
              >
                Abmelden
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1440px] px-8 py-8">{children}</main>
    </div>
  )
}
