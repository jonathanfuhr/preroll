import Link from 'next/link'
import { prisma } from '@/lib/db'
import { env } from '@/lib/env'
import { ladeEinstellungen } from '@/lib/einstellungen'
import { metaZugaengeMitSeiten } from '@/lib/plattform-zugang'
import { PLATTFORM_TEXT } from '@/lib/plattformen'
import { VERFALL } from '@/lib/veroeffentlichung'
import { Abschnitt, Eingabe, Feld, Fehler, Hinweis, Karte, Knopf, Schalter, Warnung } from '@/components/ui'
import {
  hauptschalterSpeichern,
  laufAnstossen,
  linkedInAppSpeichern,
  linkedInZugangLoesen,
  linkedInZugangPruefen,
  metaZugangLoesen,
  metaZugangPruefen,
  metaZugangSpeichern,
} from '../veroeffentlichen-aktionen'
import { kundenAmLinkedInZugang, ladeLinkedInZugang } from '@/lib/linkedin-zugang'

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
  searchParams: Promise<{ stand?: string; meldung?: string; linkedin?: string }>
}) {
  const { stand, meldung, linkedin } = await searchParams

  /*
    Jeder Zugang mit seinen Seiten. Ein Fehlschlag darf diese Seite nicht
    mitnehmen — sonst kommt niemand mehr an das Feld, in dem er ihn
    reparieren würde; deshalb steht der Fehler am Zugang statt in einem
    Wurf.
  */
  const [e, zugaenge, liZugang, liKunden] = await Promise.all([
    ladeEinstellungen(),
    metaZugaengeMitSeiten(),
    ladeLinkedInZugang(),
    kundenAmLinkedInZugang(),
  ])

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
        titel="Meta-Zugänge"
        hinweis="Systemnutzer-Token aus dem Business Manager. Sie haben kein Passwort, laufen nicht ab und hängen an keinem Mitarbeiterkonto. Liegen die Kunden in mehreren Portfolios, kommt je Portfolio einer dazu — die Seiten daraus stehen danach gemeinsam in der Auswahl."
      >
        <div className="grid gap-4">
          {zugaenge.map(({ zugang, seiten: eigene, fehler }) => (
            <Karte key={zugang.id} className="p-5">
              {fehler && (
                <div className="mb-4">
                  <Warnung>
                    Meta lehnt diesen Zugang ab: {fehler} — bis das behoben ist, geht für alle
                    daran hängenden Kunden nichts raus.
                  </Warnung>
                </div>
              )}

              <form action={metaZugangSpeichern} className="grid gap-4">
                <input type="hidden" name="zugangId" value={zugang.id} />

                <Feld
                  beschriftung="Bezeichnung"
                  hinweis="Steht später in Fehlermeldungen. Zum Beispiel: Systemnutzer Portfolio Nord."
                >
                  <Eingabe name="bezeichnung" defaultValue={zugang.bezeichnung} />
                </Feld>

                <Feld
                  beschriftung="Systemnutzer-Token"
                  hinweis="Hinterlegt — nur ausfüllen, um es zu ersetzen."
                >
                  <Eingabe name="token" type="password" placeholder="unverändert" />
                </Feld>

                <div className="flex flex-wrap items-end justify-between gap-4 border-t border-rahmen pt-4">
                  <div className="text-[12.5px] text-leise">
                    {zugang.geprueftAm ? (
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
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Knopf klein type="submit" formAction={metaZugangPruefen}>
                      Verbindung prüfen
                    </Knopf>
                    <Knopf klein art="primaer" type="submit">
                      Speichern
                    </Knopf>
                  </div>
                </div>
              </form>

              <div className="mt-5 border-t border-rahmen pt-5">
                <h3 className="mb-2 text-[10.5px] font-medium uppercase tracking-[0.1em] text-still">
                  Erreichbare Seiten ({eigene.length})
                </h3>
                {eigene.length === 0 ? (
                  <p className="text-[12.5px] leading-relaxed text-leise">
                    Diesem Systemnutzer ist noch keine Seite zugewiesen. Das passiert in den
                    Business-Einstellungen unter Nutzer → Systemnutzer → Assets zuweisen — und zwar
                    für die Seite <em>und</em> das Instagram-Konto getrennt, die sind dort zwei
                    Dinge.
                  </p>
                ) : (
                  <ul className="grid gap-1.5">
                    {eigene.map((seite) => (
                      <li key={seite.id} className="text-[12.5px] text-leise">
                        <strong className="font-medium text-tinte-3">{seite.name}</strong>
                        {seite.igName ? (
                          <span className="text-leiser"> · Instagram @{seite.igName}</span>
                        ) : (
                          <span className="text-leiser"> · ohne Instagram-Konto</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}

                <form action={metaZugangLoesen} className="mt-4">
                  <input type="hidden" name="zugangId" value={zugang.id} />
                  <button
                    type="submit"
                    className="text-[11.5px] text-leise underline underline-offset-2 hover:text-akzent"
                  >
                    Zugang entfernen
                  </button>
                </form>
              </div>
            </Karte>
          ))}

          {/*
            Der Knopf zum Hinzufügen steht als eigene Karte darunter und nicht
            in einer der bestehenden: Sonst sähe es aus, als hinge der neue
            Zugang am alten.
          */}
          <Karte className="p-5">
            <h3 className="mb-1 text-[13.5px] font-medium text-tinte">
              {zugaenge.length === 0 ? 'Zugang einrichten' : 'Weiteren Zugang hinzufügen'}
            </h3>
            <p className="mb-4 text-[12px] leading-relaxed text-leise">
              Business-Einstellungen → Nutzer → Systemnutzer → Neues Token generieren. Ablauf auf
              „Nie" stellen, Berechtigungen: pages_show_list, pages_read_engagement,
              pages_manage_posts, instagram_basic, instagram_content_publish.
            </p>

            <form action={metaZugangSpeichern} className="grid gap-4">
              <Feld beschriftung="Bezeichnung">
                <Eingabe
                  name="bezeichnung"
                  defaultValue={zugaenge.length === 0 ? 'Systemnutzer Preroll' : ''}
                  placeholder="Systemnutzer Portfolio …"
                />
              </Feld>

              <Feld beschriftung="Systemnutzer-Token">
                <Eingabe name="token" type="password" placeholder="EAAG…" />
              </Feld>

              <div className="flex justify-end border-t border-rahmen pt-4">
                <Knopf klein art="primaer" type="submit">
                  Zugang hinzufügen
                </Knopf>
              </div>
            </form>
          </Karte>
        </div>
      </Abschnitt>

      <Abschnitt
        titel="LinkedIn"
        hinweis="Ein Zugang für alle Kunden: das Konto der Agentur, das an den Firmenseiten als Administrator eingetragen ist."
      >
        <div className="grid gap-4">
          {linkedin === 'verbunden' && <Hinweis>LinkedIn ist verbunden.</Hinweis>}
          {linkedin === 'app-fehlt' && (
            <Fehler>Bitte zuerst Client-ID und Secret der LinkedIn-App eintragen.</Fehler>
          )}
          {linkedin === 'fehler' && (
            <Fehler>{meldung ?? 'Die Verbindung zu LinkedIn ist fehlgeschlagen.'}</Fehler>
          )}

          <Karte className="p-5">
            <h3 className="mb-1 text-[13px] font-semibold">Die App</h3>
            <p className="mb-4 text-[11.5px] leading-relaxed text-leiser">
              Zum Posten auf Firmenseiten verlangt LinkedIn die <strong>Community Management
              API</strong>, und die gibt es nur nach einer Freigabe — vergleichbar mit dem Meta App
              Review. Solange sie fehlt, lässt sich hier nichts verbinden, und LinkedIn bleibt in
              der Plattformwahl gesperrt. Als Rücksprungadresse gehört{' '}
              <code className="rounded bg-flaeche-leise px-1 py-0.5 font-mono text-[11px]">
                {`${env.appUrl}/api/auth/linkedin/callback`}
              </code>{' '}
              in die App.
            </p>

            <form action={linkedInAppSpeichern} className="grid gap-4">
              <Feld beschriftung="Client-ID">
                <Eingabe name="linkedinClientId" defaultValue={e.linkedinClientId ?? ''} />
              </Feld>
              <Feld
                beschriftung="Client-Secret"
                hinweis={
                  e.linkedinClientSecret
                    ? 'Hinterlegt. Leer lassen heißt: unverändert.'
                    : 'Wird nie zurück in dieses Feld geschrieben.'
                }
              >
                <Eingabe
                  name="linkedinClientSecret"
                  type="password"
                  placeholder={e.linkedinClientSecret ? '••••••••' : ''}
                />
              </Feld>
              <div className="flex justify-end">
                <Knopf klein type="submit">
                  Speichern
                </Knopf>
              </div>
            </form>
          </Karte>

          <Karte className="p-5">
            <h3 className="mb-1 text-[13px] font-semibold">Der Zugang</h3>

            {!liZugang ? (
              <>
                <p className="mb-4 text-[11.5px] leading-relaxed text-leiser">
                  Noch nicht verbunden. Der Ablauf öffnet LinkedIn, dort wird das Konto der Agentur
                  bestätigt — danach kann Preroll für jede Seite posten, an der es Administrator
                  ist.
                </p>
                {e.linkedinClientId && e.linkedinClientSecret ? (
                  <a
                    href="/api/auth/linkedin/start"
                    className="inline-block rounded-[5px] bg-akzent px-3.5 py-2 text-[12px] font-medium text-white hover:opacity-90"
                  >
                    Mit LinkedIn verbinden
                  </a>
                ) : (
                  <p className="text-[11.5px] text-stiller">
                    Dafür oben Client-ID und Secret eintragen.
                  </p>
                )}
              </>
            ) : (
              <div className="grid gap-3">
                <p className="text-[12.5px] text-leise">
                  <strong className="text-tinte">{liZugang.bezeichnung}</strong>
                  {liZugang.gueltigBis && ` · Token gilt bis ${DATUM.format(liZugang.gueltigBis)}`}
                  {liZugang.geprueftAm && ` · geprüft ${DATUM.format(liZugang.geprueftAm)}`}
                </p>

                {liZugang.fehler && <Warnung>{liZugang.fehler}</Warnung>}

                {liKunden.length > 0 && (
                  <p className="text-[11.5px] text-leiser">
                    Daran hängen: {liKunden.map((k) => k.name).join(', ')}. Wird der Zugang gelöst,
                    postet Preroll für sie nicht mehr auf LinkedIn.
                  </p>
                )}

                <div className="flex flex-wrap gap-2">
                  <form action={linkedInZugangPruefen}>
                    <Knopf klein type="submit">
                      Prüfen
                    </Knopf>
                  </form>
                  <a
                    href="/api/auth/linkedin/start"
                    className="rounded-[5px] border border-rahmen-3 px-3 py-1.5 text-[12px] font-medium text-tinte hover:border-rahmen-4"
                  >
                    Neu verbinden
                  </a>
                  <form action={linkedInZugangLoesen}>
                    <Knopf klein art="gefahr" type="submit">
                      Zugang lösen
                    </Knopf>
                  </form>
                </div>
              </div>
            )}
          </Karte>
        </div>
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
