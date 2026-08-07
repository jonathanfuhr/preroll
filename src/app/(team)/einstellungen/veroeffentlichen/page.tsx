import Link from 'next/link'
import { prisma } from '@/lib/db'
import { ladeEinstellungen } from '@/lib/einstellungen'
import { ladeMetaZugang, metaSeiten } from '@/lib/plattform-zugang'
import { PLATTFORM_TEXT } from '@/lib/plattformen'
import { VERFALL } from '@/lib/veroeffentlichung'
import { Abschnitt, Eingabe, Feld, Fehler, Hinweis, Karte, Knopf, Schalter, Warnung } from '@/components/ui'
import {
  hauptschalterSpeichern,
  laufAnstossen,
  metaTokenSpeichern,
  metaZugangLoesen,
  metaZugangPruefen,
} from '../veroeffentlichen-aktionen'

export const metadata = { title: 'Veröffentlichen — Preroll' }

const DATUM = new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' })

const STAND_TEXT: Record<string, string> = {
  GEPLANT: 'geplant',
  LAEUFT: 'läuft',
  UEBERGEBEN: 'übergeben',
  ERFOLGT: 'erfolgt',
  FEHLGESCHLAGEN: 'fehlgeschlagen',
}

export default async function VeroeffentlichenSeite({
  searchParams,
}: {
  searchParams: Promise<{ stand?: string; meldung?: string }>
}) {
  const { stand, meldung } = await searchParams

  const [e, zugang] = await Promise.all([ladeEinstellungen(), ladeMetaZugang()])

  // Die Seiten werden nur geholt, wenn ein Zugang steht — und ein Fehlschlag
  // darf diese Seite nicht mitnehmen, sonst kommt niemand mehr an das Feld,
  // in dem er ihn reparieren würde.
  const seiten = zugang ? await metaSeiten() : []

  const [kunden, letzte] = await Promise.all([
    prisma.kunde.findMany({
      where: { archiviert: false, postenAktiv: true },
      orderBy: { name: 'asc' },
      select: { slug: true, name: true, fbSeitenName: true, igName: true },
    }),
    prisma.veroeffentlichung.findMany({
      orderBy: { geplantFuer: 'desc' },
      take: 15,
      select: {
        id: true,
        plattform: true,
        stand: true,
        geplantFuer: true,
        meldung: true,
        versuche: true,
        post: { select: { id: true, titel: true, kunde: { select: { slug: true, name: true } } } },
      },
    }),
  ])

  const offeneFehler = letzte.filter((v) => v.stand === 'FEHLGESCHLAGEN')

  return (
    <>
      <Abschnitt
        titel="Direkt veröffentlichen"
        hinweis="Preroll postet freigegebene Beiträge zum geplanten Termin selbst — auf die Facebook-Seite und das damit verknüpfte Instagram-Konto."
      >
        <Karte className="p-5">
          {stand === 'ok' && (
            <div className="mb-4">
              <Hinweis>{meldung ?? 'Verbindung steht.'}</Hinweis>
            </div>
          )}
          {stand === 'fehler' && (
            <div className="mb-4">
              <Fehler>{meldung ?? 'Die Verbindung kam nicht zustande.'}</Fehler>
            </div>
          )}

          <form action={hauptschalterSpeichern} className="grid gap-4">
            <Schalter
              name="veroeffentlichenAktiv"
              beschriftung="Zeitplaner eingeschaltet"
              hinweis="Aus heißt: Nichts geht raus, auch nicht bei Kunden, für die das Posten eingeschaltet ist. Der Hauptschalter, wenn etwas schiefläuft."
              defaultChecked={e.veroeffentlichenAktiv}
            />
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-rahmen pt-4">
              <p className="text-[12.5px] text-leise">
                {e.veroeffentlichenLaufAm ? (
                  <>
                    Zuletzt gelaufen am{' '}
                    <strong className="font-medium text-tinte-3">
                      {DATUM.format(e.veroeffentlichenLaufAm)}
                    </strong>
                    .
                  </>
                ) : (
                  'Noch nie gelaufen.'
                )}
                <span className="mt-1 block text-[11.5px] text-stiller">
                  Der Takt schlägt jede Minute. Verpasste Termine werden bis zu{' '}
                  {VERFALL / 3600_000} Stunden nachgeholt — was älter ist, geht nicht mehr raus.
                </span>
              </p>
              <div className="flex gap-2">
                <Knopf klein type="submit" formAction={laufAnstossen}>
                  Jetzt laufen lassen
                </Knopf>
                <Knopf klein art="primaer" type="submit">
                  Speichern
                </Knopf>
              </div>
            </div>
          </form>
        </Karte>
      </Abschnitt>

      <Abschnitt
        titel="Meta-Zugang"
        hinweis="Ein Systemnutzer-Token aus dem Business Manager. Es hat kein Passwort, läuft nicht ab und hängt an keinem Mitarbeiterkonto."
      >
        <Karte className="p-5">
          {zugang?.fehler && (
            <div className="mb-4">
              <Warnung>
                Meta lehnt den Zugang ab: {zugang.fehler} — bis das behoben ist, geht für alle
                daran hängenden Kunden nichts raus.
              </Warnung>
            </div>
          )}

          <form action={metaTokenSpeichern} className="grid gap-4">
            <Feld
              beschriftung="Bezeichnung"
              hinweis="Steht später in Fehlermeldungen. Zum Beispiel: Systemnutzer Preroll."
            >
              <Eingabe
                name="bezeichnung"
                defaultValue={zugang?.bezeichnung ?? 'Systemnutzer Preroll'}
              />
            </Feld>

            <Feld
              beschriftung="Systemnutzer-Token"
              hinweis={
                zugang
                  ? 'Hinterlegt — nur ausfüllen, um es zu ersetzen.'
                  : 'Business-Einstellungen → Nutzer → Systemnutzer → Neues Token generieren. Ablauf auf „Nie" stellen, Berechtigungen: pages_show_list, pages_read_engagement, pages_manage_posts, instagram_basic, instagram_content_publish.'
              }
            >
              <Eingabe
                name="token"
                type="password"
                placeholder={zugang ? 'unverändert' : 'EAAG…'}
              />
            </Feld>

            <div className="flex flex-wrap items-end justify-between gap-4 border-t border-rahmen pt-4">
              <div className="text-[12.5px] text-leise">
                {zugang?.geprueftAm ? (
                  <>
                    Zuletzt geprüft am{' '}
                    <strong className="font-medium text-tinte-3">
                      {DATUM.format(zugang.geprueftAm)}
                    </strong>
                    .
                  </>
                ) : (
                  'Noch nie geprüft.'
                )}
                <p className="mt-1 text-[11.5px] text-stiller">
                  Geprüft wird mit demselben Aufruf, der beim Posten die Grundlage bildet — nicht
                  bloß, ob ein Endpunkt „OK" sagt.
                </p>
              </div>

              <div className="flex gap-2">
                {zugang && (
                  <Knopf klein type="submit" formAction={metaZugangPruefen}>
                    Verbindung prüfen
                  </Knopf>
                )}
                <Knopf klein art="primaer" type="submit">
                  Speichern
                </Knopf>
              </div>
            </div>
          </form>

          {zugang && (
            <div className="mt-5 border-t border-rahmen pt-5">
              <h3 className="mb-2 text-[10.5px] font-medium uppercase tracking-[0.1em] text-still">
                Erreichbare Seiten ({seiten.length})
              </h3>
              {seiten.length === 0 ? (
                <p className="text-[12.5px] leading-relaxed text-leise">
                  Diesem Systemnutzer ist noch keine Seite zugewiesen. Das passiert in den
                  Business-Einstellungen unter Nutzer → Systemnutzer → Assets zuweisen — und zwar
                  für die Seite <em>und</em> das Instagram-Konto getrennt, die sind dort zwei
                  Dinge.
                </p>
              ) : (
                <ul className="grid gap-1.5">
                  {seiten.map((s) => (
                    <li key={s.id} className="text-[12.5px] text-leise">
                      <strong className="font-medium text-tinte-3">{s.name}</strong>
                      {s.igName ? (
                        <span className="text-leiser"> · Instagram @{s.igName}</span>
                      ) : (
                        <span className="text-leiser"> · ohne Instagram-Konto</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              <form action={metaZugangLoesen} className="mt-4">
                <button
                  type="submit"
                  className="text-[11.5px] text-leise underline underline-offset-2 hover:text-akzent"
                >
                  Zugang entfernen
                </button>
              </form>
            </div>
          )}
        </Karte>
      </Abschnitt>

      <Abschnitt
        titel="Kunden, für die veröffentlicht wird"
        hinweis="Eingeschaltet wird das je Kunde in den Stammdaten — nie pauschal."
      >
        <Karte className="p-5">
          {kunden.length === 0 ? (
            <p className="text-[12.5px] text-leise">
              Für keinen Kunden ist das Veröffentlichen eingeschaltet. Solange das so bleibt, tut
              der Zeitplaner nichts.
            </p>
          ) : (
            <ul className="grid gap-2">
              {kunden.map((k) => (
                <li key={k.slug} className="flex flex-wrap items-baseline gap-x-2 text-[12.5px]">
                  <Link
                    href={`/kunden/${k.slug}/stammdaten`}
                    className="font-medium text-tinte-3 hover:text-akzent"
                  >
                    {k.name}
                  </Link>
                  <span className="text-leiser">
                    {k.fbSeitenName ?? 'ohne Seite'}
                    {k.igName ? ` · @${k.igName}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Karte>
      </Abschnitt>

      <Abschnitt
        titel="Zuletzt"
        hinweis={
          offeneFehler.length > 0
            ? `${offeneFehler.length} Fehlschlag/Fehlschläge unter den letzten Einträgen.`
            : undefined
        }
      >
        <Karte className="p-5">
          {letzte.length === 0 ? (
            <p className="text-[12.5px] text-leise">Noch nichts veröffentlicht.</p>
          ) : (
            <ul className="grid gap-3">
              {letzte.map((v) => (
                <li key={v.id} className="grid gap-0.5 text-[12.5px]">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span
                      className={
                        v.stand === 'FEHLGESCHLAGEN'
                          ? 'font-medium text-akzent'
                          : v.stand === 'ERFOLGT'
                            ? 'font-medium text-tinte-3'
                            : 'font-medium text-leise'
                      }
                    >
                      {STAND_TEXT[v.stand] ?? v.stand}
                    </span>
                    <span className="text-leiser">·</span>
                    <span className="text-leise">{PLATTFORM_TEXT[v.plattform]}</span>
                    <span className="text-leiser">·</span>
                    <Link
                      href={`/kunden/${v.post.kunde.slug}/posts/${v.post.id}`}
                      className="text-leise hover:text-akzent"
                    >
                      {v.post.titel}
                    </Link>
                    <span className="text-leiser">
                      {v.post.kunde.name} · {DATUM.format(v.geplantFuer)}
                    </span>
                  </div>
                  {v.meldung && (
                    <p className="text-[11.5px] leading-relaxed text-leiser">
                      {v.meldung}
                      {v.versuche > 1 ? ` (${v.versuche} Versuche)` : ''}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Karte>
      </Abschnitt>
    </>
  )
}
