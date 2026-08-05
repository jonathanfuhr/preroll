import { ladeKunde } from '@/lib/abfragen'
import { thumbUrl } from '@/lib/urls'
import { Karte, Leerzustand } from '@/components/ui'
import { AnsprechpartnerFormular } from './formular'

export default async function AnsprechpartnerSeite({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const kunde = await ladeKunde(slug)

  return (
    <div className="max-w-[720px]">
      <div className="mb-6">
        <h2 className="text-[15px] font-semibold">Ansprechpartner</h2>
        <p className="mt-0.5 text-[12.5px] leading-relaxed text-leiser">
          Der Standard-Ansprechpartner erscheint im Fuß der Export-Seite. Pro Freigabe-Link lässt er
          sich überschreiben.
        </p>
      </div>

      {kunde.ansprechpartner.length === 0 && (
        <div className="mb-6">
          <Leerzustand
            titel="Noch kein Ansprechpartner"
            text="Ohne Ansprechpartner bleibt der Fuß der Export-Seite leer."
          />
        </div>
      )}

      <div className="grid gap-4">
        {kunde.ansprechpartner.map((person) => (
          <Karte key={person.id} className="p-5">
            <div className="mb-4 flex items-center gap-3.5">
              {person.fotoId ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={thumbUrl(person.fotoId)!}
                  alt=""
                  className="size-12 rounded-full object-cover"
                />
              ) : (
                <span className="schraffur size-12 rounded-full border border-dashed border-rahmen-3" />
              )}
              <div>
                <div className="text-[14px] font-semibold">{person.name}</div>
                {person.rolle && <div className="text-[12px] text-leiser">{person.rolle}</div>}
              </div>
              {person.standard && (
                <span className="ml-auto rounded-[3px] bg-flaeche-tief px-2 py-0.5 text-[11px] text-leise">
                  Standard
                </span>
              )}
            </div>

            <AnsprechpartnerFormular
              kundeId={kunde.id}
              person={{
                id: person.id,
                name: person.name,
                rolle: person.rolle,
                telefon: person.telefon,
                email: person.email,
                adresse: person.adresse,
                website: person.website,
                standard: person.standard,
              }}
            />
          </Karte>
        ))}

        <Karte className="p-5">
          <h3 className="mb-4 text-[13px] font-semibold">Neuen Ansprechpartner anlegen</h3>
          <AnsprechpartnerFormular kundeId={kunde.id} />
        </Karte>
      </div>
    </div>
  )
}
