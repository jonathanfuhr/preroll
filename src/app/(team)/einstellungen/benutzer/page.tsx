import { prisma } from '@/lib/db'
import { ALLE_ROLLEN, ROLLE_BESCHREIBUNG, ROLLE_TEXT } from '@/lib/rollen'
import { thumbUrl } from '@/lib/urls'
import { Abschnitt, Fehler, Karte } from '@/components/ui'
import { NutzerAnlegen, NutzerZeile } from './verwaltung'

export const metadata = { title: 'Benutzer — Preroll' }

const FEHLERTEXT: Record<string, string> = {
  pflicht: 'Bitte Name und E-Mail ausfüllen.',
  vorhanden: 'Für diese Adresse gibt es bereits ein Konto.',
  selbst: 'Sich selbst die Administratorrechte oder den Zugang zu nehmen, würde Sie aussperren.',
  'letzter-admin': 'Es muss mindestens ein aktives Administratorkonto geben.',
}

export default async function BenutzerSeite({
  searchParams,
}: {
  searchParams: Promise<{ fehler?: string; meldung?: string }>
}) {
  const { fehler, meldung } = await searchParams

  const nutzer = await prisma.nutzer.findMany({
    orderBy: [{ aktiv: 'desc' }, { name: 'asc' }],
    include: { foto: true, betreut: { include: { kunde: true } } },
  })

  return (
    <>
      {fehler && (
        <div className="mb-5">
          <Fehler>{meldung ?? FEHLERTEXT[fehler] ?? 'Das hat nicht geklappt.'}</Fehler>
        </div>
      )}

      <Abschnitt
        titel="Konten"
        hinweis="Alle Rollen dürfen alles lesen und bearbeiten. Sie unterscheiden sich darin, wer verwalten darf und wer worüber benachrichtigt wird."
      >
        <div className="grid gap-3">
          {nutzer.map((n) => (
            <NutzerZeile
              key={n.id}
              nutzer={{
                id: n.id,
                name: n.name,
                email: n.email,
                rolle: n.rolle,
                aktiv: n.aktiv,
                position: n.position,
                telefon: n.telefon,
                initialen: n.initialen,
                foto: thumbUrl(n.fotoId),
                betreut: n.betreut.map((b) => b.kunde.name),
              }}
            />
          ))}
        </div>
      </Abschnitt>

      <Abschnitt titel="Konto anlegen">
        <Karte className="p-5">
          <NutzerAnlegen />
        </Karte>
      </Abschnitt>

      <Abschnitt titel="Was die Rollen bedeuten">
        <Karte className="overflow-hidden">
          {ALLE_ROLLEN.map((rolle) => (
            <div key={rolle} className="border-b border-rahmen px-4 py-3 last:border-b-0">
              <div className="text-[13px] font-medium text-tinte">{ROLLE_TEXT[rolle]}</div>
              <p className="mt-0.5 text-[12px] leading-relaxed text-leise">
                {ROLLE_BESCHREIBUNG[rolle]}
              </p>
            </div>
          ))}
        </Karte>
      </Abschnitt>
    </>
  )
}
