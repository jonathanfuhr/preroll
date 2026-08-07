import Link from 'next/link'
import { ladeKunde } from '@/lib/abfragen'
import { aktuellerNutzer } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { erwaehnbarePersonen } from '@/lib/erwaehnbar'
import { darfBearbeiten } from '@/lib/kommentar-rechte'
import { KommentarInhalt } from '@/components/kommentar-inhalt'
import { Karte, Leerzustand, TypBadge } from '@/components/ui'
import { KommentarZeile } from '../../../kommentare/zeile'

const ZEIT = new Intl.DateTimeFormat('de-DE', { dateStyle: 'short', timeStyle: 'short' })

export default async function KundenKommentareSeite({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const kunde = await ladeKunde(slug)

  const kommentare = await prisma.kommentar.findMany({
    where: { post: { kundeId: kunde.id } },
    orderBy: { erstelltAm: 'desc' },
    include: { post: true },
  })

  const offene = kommentare.filter((k) => k.status === 'OFFEN').length

  const ich = await aktuellerNutzer()
  const betrachter = { art: 'nutzer' as const, id: ich?.id ?? '', rolle: ich?.rolle ?? 'EDITOR' }
  const erwaehnbar = await erwaehnbarePersonen(kunde.id)

  return (
    <div className="max-w-[800px]">
      <div className="mb-6">
        <h2 className="text-[15px] font-semibold">Kommentare</h2>
        <p className="mt-0.5 text-[12.5px] text-leiser">
          {kommentare.length} insgesamt, {offene} offen
        </p>
      </div>

      {kommentare.length === 0 ? (
        <Leerzustand
          titel="Noch keine Rückmeldungen"
          text={`Kommentare aus den Freigabe-Links von ${kunde.name} sammeln sich hier.`}
        />
      ) : (
        <div className="grid gap-3">
          {kommentare.map((kommentar) => (
            <Karte key={kommentar.id} className="p-4">
              <div className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="text-[13px] font-semibold text-tinte">{kommentar.autorName}</span>
                {kommentar.nutzerId && (
                  <span className="text-[10px] uppercase tracking-[0.08em] text-still">Agentur</span>
                )}
                {kommentar.post && (
                  <>
                    <TypBadge typ={kommentar.post.typ} verhaeltnis={kommentar.post.verhaeltnis} />
                    <Link
                      href={`/kunden/${slug}/posts/${kommentar.postId}`}
                      className="text-[12.5px] text-leise hover:text-akzent"
                    >
                      {kommentar.post.titel}
                    </Link>
                  </>
                )}
                <span className="ml-auto text-[11px] text-stiller">
                  {ZEIT.format(kommentar.erstelltAm)}
                  {kommentar.bearbeitetAm && ' · bearbeitet'}
                </span>
              </div>

              <KommentarInhalt text={kommentar.text} />

              <KommentarZeile
                kommentarId={kommentar.id}
                status={kommentar.status}
                postId={kommentar.postId}
                exportId={kommentar.exportId}
                text={kommentar.text}
                erwaehnbar={erwaehnbar}
                darfAendern={darfBearbeiten(kommentar, betrachter)}
                istAntwort={Boolean(kommentar.antwortAufId)}
              />
            </Karte>
          ))}
        </div>
      )}
    </div>
  )
}
