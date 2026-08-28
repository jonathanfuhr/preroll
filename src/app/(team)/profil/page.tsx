import { aktuellerNutzer } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { passwortRegelText } from '@/lib/passwort'
import { ROLLE_BESCHREIBUNG, ROLLE_TEXT } from '@/lib/rollen'
import { thumbUrl } from '@/lib/urls'
import { BildAblage } from '@/components/bild-ablage'
import { PushAnmeldung } from '@/components/push-anmeldung'
import { Abschnitt, Eingabe, Feld, Fehler, Hinweis, Karte, Knopf, Schalter } from '@/components/ui'
import { meineBenachrichtigungen, passwortAendern, profilSpeichern } from '../einstellungen/benutzer-aktionen'
import { SpeichernKnopf } from '@/components/speichern-knopf'

export const metadata = { title: 'Profil & Sicherheit — Preroll' }
export const dynamic = 'force-dynamic'

const FEHLERTEXT: Record<string, string> = {
  alt: 'Das bisherige Passwort stimmt nicht.',
  ungleich: 'Die beiden neuen Passwörter stimmen nicht überein.',
}

export default async function ProfilSeite({
  searchParams,
}: {
  searchParams: Promise<{ fehler?: string; meldung?: string; geaendert?: string }>
}) {
  const nutzer = await aktuellerNutzer()
  if (!nutzer) return null

  const { fehler, meldung, geaendert } = await searchParams
  const mitFoto = await prisma.nutzer.findUnique({ where: { id: nutzer.id }, include: { foto: true } })

  return (
    <div className="max-w-[720px]">
      <h1 className="mb-1.5 text-[24px] font-semibold tracking-[-0.02em]">Profil & Sicherheit</h1>
      <p className="mb-7 text-[13px] leading-relaxed text-leise">
        Ihre Rolle: <strong className="text-tinte">{ROLLE_TEXT[nutzer.rolle]}</strong> —{' '}
        {ROLLE_BESCHREIBUNG[nutzer.rolle]}
      </p>

      <Abschnitt
        titel="Angaben"
        hinweis="Name, Position und Telefon erscheinen im Kontakt-Fuß der Export-Seiten, auf denen Sie als Ansprechpartner stehen."
      >
        <Karte className="p-5">
          <div className="mb-5 border-b border-rahmen pb-5">
            <BildAblage
              bild={thumbUrl(mitFoto?.fotoId)}
              beschriftung="Profilbild"
              hinweis="Erscheint im Kontakt-Fuß der Export-Seite."
            />
          </div>

          <form action={profilSpeichern} className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Feld beschriftung="Name">
                <Eingabe name="name" defaultValue={nutzer.name} required />
              </Feld>
              <Feld beschriftung="E-Mail">
                <Eingabe name="email" type="email" defaultValue={nutzer.email} required />
              </Feld>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Feld beschriftung="Position">
                <Eingabe name="position" defaultValue={nutzer.position ?? ''} placeholder="Projektleitung" />
              </Feld>
              <Feld beschriftung="Telefon">
                <Eingabe name="telefon" defaultValue={nutzer.telefon ?? ''} />
              </Feld>
            </div>
            <div className="flex justify-end">
              <SpeichernKnopf klein>
                Speichern
              </SpeichernKnopf>
            </div>
          </form>
        </Karte>
      </Abschnitt>

      <Abschnitt titel="Passwort ändern">
        {geaendert && (
          <div className="mb-4 rounded-[5px] border border-[#cfe4d6] bg-final-flaeche px-3.5 py-2.5 text-[12.5px] text-final">
            Passwort geändert.
          </div>
        )}
        {fehler && (
          <div className="mb-4">
            <Fehler>{meldung ?? FEHLERTEXT[fehler] ?? 'Das hat nicht geklappt.'}</Fehler>
          </div>
        )}

        <Karte className="p-5">
          <form action={passwortAendern} className="grid gap-4">
            <Feld beschriftung="Bisheriges Passwort">
              <Eingabe name="alt" type="password" required autoComplete="current-password" />
            </Feld>
            <div className="grid gap-4 sm:grid-cols-2">
              <Feld beschriftung="Neues Passwort" hinweis={passwortRegelText()}>
                <Eingabe name="neu" type="password" required autoComplete="new-password" />
              </Feld>
              <Feld beschriftung="Wiederholen">
                <Eingabe name="wiederholung" type="password" required autoComplete="new-password" />
              </Feld>
            </div>
            <div className="flex justify-end">
              <Knopf klein type="submit">
                Passwort ändern
              </Knopf>
            </div>
          </form>
        </Karte>
      </Abschnitt>

      <Abschnitt
        titel="Meine Benachrichtigungen"
        hinweis="Die Glocke in der Kopfleiste zeigt immer alles — hier geht es nur um Mail und Push."
      >
        <Karte className="p-5">
          {nutzer.rolle === 'EDITOR' && (
            <div className="mb-4">
              <Hinweis>
                In der Rolle {ROLLE_TEXT.EDITOR} bekommen Sie keine Meldungen zu Kundenrückmeldungen.
                Die Schalter greifen erst, wenn Ihnen eine andere Rolle zugewiesen wird.
              </Hinweis>
            </div>
          )}

          <form action={meineBenachrichtigungen} className="grid gap-3">
            <Schalter
              name="mailBenachrichtigungen"
              beschriftung="E-Mail bei neuen Kommentaren und Freigaben"
              defaultChecked={nutzer.mailBenachrichtigungen}
            />
            <Schalter
              name="pushBenachrichtigungen"
              beschriftung="Push-Benachrichtigung im Browser"
              defaultChecked={nutzer.pushBenachrichtigungen}
            />
            <div className="flex items-center justify-between gap-4">
              <PushAnmeldung />
              <SpeichernKnopf klein>
                Speichern
              </SpeichernKnopf>
            </div>
          </form>
        </Karte>
      </Abschnitt>
    </div>
  )
}
