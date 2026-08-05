import Link from 'next/link'
import { kundeAnlegen } from '../[slug]/aktionen'
import { Eingabe, Feld, Fehler, Karte, Knopf } from '@/components/ui'

export const metadata = { title: 'Kunde anlegen — Preroll' }

export default async function KundeNeuSeite({
  searchParams,
}: {
  searchParams: Promise<{ fehler?: string }>
}) {
  const { fehler } = await searchParams

  return (
    <div className="max-w-[520px]">
      <nav className="mb-4 flex items-center gap-1.5 text-[12px] text-leiser">
        <Link href="/kunden" className="hover:text-tinte">
          Kunden
        </Link>
        <span aria-hidden>/</span>
        <span className="text-tinte-3">Neu</span>
      </nav>

      <h1 className="mb-1.5 text-[24px] font-semibold tracking-[-0.02em]">Kunde anlegen</h1>
      <p className="mb-6 text-[13px] leading-relaxed text-leise">
        Logo, Ansprechpartner und Kennzahlen lassen sich danach ergänzen.
      </p>

      {fehler && (
        <div className="mb-5">
          <Fehler>Bitte einen Namen angeben.</Fehler>
        </div>
      )}

      <Karte className="p-5">
        <form action={kundeAnlegen} className="grid gap-4">
          <Feld beschriftung="Name">
            <Eingabe name="name" required autoFocus placeholder="Beispiel Handwerk GmbH" />
          </Feld>
          <Feld beschriftung="Instagram-Handle" hinweis="Ohne @.">
            <Eingabe name="handle" placeholder="beispiel.handwerk" />
          </Feld>
          <Feld beschriftung="Bio">
            <Eingabe name="bio" placeholder="Garten- & Landschaftsbau · Wendlingen" />
          </Feld>
          <Feld beschriftung="Website">
            <Eingabe name="website" placeholder="www.beispiel-handwerk.de" />
          </Feld>
          <div className="mt-1 flex justify-end">
            <Knopf art="primaer" type="submit">
              Anlegen
            </Knopf>
          </div>
        </form>
      </Karte>
    </div>
  )
}
