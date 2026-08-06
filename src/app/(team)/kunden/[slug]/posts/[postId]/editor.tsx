'use client'

import type { CustomFeldTyp, PostStatus, PostTyp } from '@prisma/client'
import { useState } from 'react'
import { IPhoneVorschau } from '@/components/iphone'
import { MedienDialog, type Medienabsicht } from '@/components/medien-dialog'
import { KommentarListe, type Kommentareintrag } from '@/components/kommentar-liste'
import {
  Fortschrittsbalken,
  useReferenzstand,
  type Referenzstand,
} from '@/components/referenz-fortschritt'
import { kalenderwoche } from '@/lib/format'
import { SlideSortierung } from '@/components/slide-sortierung'
import { Szenenplan, type Szene } from './szenenplan'
import type { Zielreel } from './uebertragen'
import { FreigabeFeld, type FreigabeZeile } from './freigabe-feld'
import { KlappeFeld, type KlappeVideoWahl } from './klappe-feld'
import { referenzvideoEntfernen, referenzvideoSetzen } from '../../referenz-aktionen'
import {
  Abschnitt,
  Eingabe,
  Feld,
  Fehler,
  Knopf,
  Schalter,
  Textfeld,
  TYP_TEXT,
  TypBadge,
  Warnung,
} from '@/components/ui'
import { postSpeichern, postStatusSetzen, slidesSortieren } from '../../aktionen'

type PostDaten = {
  id: string
  typ: PostTyp
  status: PostStatus
  titel: string
  kurzbeschreibung: string | null
  caption: string
  /** Leer heißt: der Post ist noch ungeplant. */
  postenAm: string | null
  laenge: string | null
  ziel: string | null
  stil: string | null
  inhalte: string | null
  szenenplanAktiv: boolean
  referenzVideoUrl: string | null
  referenzVideoTitel: string | null
}

type CustomFeld = { id: string; name: string; typ: CustomFeldTyp; wert: string | null }

const STATUS: PostStatus[] = ['KONZEPT', 'VORSCHAU', 'FINAL']
const STATUS_TEXT: Record<PostStatus, string> = {
  KONZEPT: 'Konzept',
  VORSCHAU: 'Vorschau',
  FINAL: 'Final',
}
/** Ein Name, damit Titel und Speichern-Knopf außerhalb des Formulars stehen können. */
const FORMULAR = 'post-formular'

const TERMIN = new Intl.DateTimeFormat('de-DE', {
  weekday: 'short',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

/** Der aktive Status trägt seine eigene Farbe — wie überall sonst auch. */
const STATUS_AKTIV: Record<PostStatus, string> = {
  KONZEPT: 'bg-konzept-flaeche text-konzept',
  VORSCHAU: 'bg-vorschau-flaeche text-vorschau',
  FINAL: 'bg-final-flaeche text-final',
}

export function PostEditor({
  post,
  szenen,
  customFelder,
  slides,
  slideUrls,
  mediumUrl,
  thumbnailUrl,
  istVideo,
  vorschau,
  standardUhrzeit,
  kommentare,
  andereReels,
  referenz,
  klappe,
  kundeSlug,
  meldungen,
  freigabe,
}: {
  post: PostDaten
  szenen: Szene[]
  customFelder: CustomFeld[]
  slides: Array<{ id: string; url: string }>
  /** Volle Auflösung für die Vorschau im Geräterahmen. */
  slideUrls: string[]
  mediumUrl: string | null
  thumbnailUrl: string | null
  istVideo: boolean
  vorschau: { kunde: string; logo: string | null }
  /** Uhrzeit aus den Stammdaten — Vorbelegung für noch ungeplante Posts. */
  standardUhrzeit: string
  kommentare: Kommentareintrag[]
  /** Andere Reels desselben Kunden — Ziele fürs Übertragen des Ablaufs. */
  andereReels: Zielreel[]
  referenz: {
    mediumUrl: string | null
    geladen: boolean
    stand: Referenzstand
  }
  klappe: {
    eingerichtet: boolean
    projektName: string | null
    videos: KlappeVideoWahl[]
    ladefehler: string | null
    verknuepft: {
      videoId: string
      videoName: string | null
      videoUrl: string | null
      versionNummer: number | null
      standAm: string | null
      basisUrl: string | null
      fassungId: string | null
    } | null
  }
  kundeSlug: string
  meldungen: { klappe?: string; referenz?: string }
  freigabe: {
    offen: import('@prisma/client').Freigabestufe | null
    erledigt: boolean
    zeilen: FreigabeZeile[]
    vorschlagName: string | null
  }
}) {
  // `null` heißt zu; sonst steht darin, worum es geht.
  const [dialogOffen, setDialogOffen] = useState<Medienabsicht | null>(null)
  // Der Stand wird an einer Stelle abgefragt und an beide Balken gereicht —
  // im Dialog und über den Eckdaten.
  const referenzstand = useReferenzstand(post.id, referenz.stand)
  const [szenenplan, setSzenenplan] = useState(post.szenenplanAktiv)
  // Die Caption steht im Zustand, damit die Vorschau beim Tippen mitläuft.
  const [caption, setCaption] = useState(post.caption)

  const vorschauMedien =
    post.typ === 'KARUSSELL' ? slideUrls : mediumUrl ? [mediumUrl] : []

  const datum = post.postenAm?.slice(0, 10) ?? ''
  const uhrzeit = post.postenAm
    ? new Date(post.postenAm).toTimeString().slice(0, 5)
    : standardUhrzeit

  return (
    <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_344px]">
      <div className="grid min-w-0 gap-8">
        {/* -------------------------------------------------------- Kopfzeile */}
        {/*
          Nach Mockup 2e: Merkmale in einer Zeile, darunter der Titel als
          große, rahmenlose Eingabe. Er ist die Überschrift der Seite und
          zugleich das Feld — ein eigenes „Titel"-Kästchen wäre doppelt.
        */}
        <div className="flex flex-wrap items-start justify-between gap-8">
          <div className="min-w-0 flex-1">
            <div className="mb-2.5 flex flex-wrap items-center gap-3">
              <TypBadge typ={post.typ} />
              {post.postenAm ? (
                <>
                  <span className="flex items-baseline gap-2">
                    <span className="text-[15px] font-bold text-tinte">KW</span>
                    <span className="font-serif text-[22px] leading-none text-akzent">
                      {kalenderwoche(new Date(post.postenAm))}
                    </span>
                  </span>
                  <span className="text-[12.5px] text-still">
                    {TERMIN.format(new Date(post.postenAm))} Uhr
                  </span>
                </>
              ) : (
                <span className="text-[12.5px] text-still">Noch kein Termin</span>
              )}
            </div>

            <input
              form={FORMULAR}
              name="titel"
              defaultValue={post.titel}
              required
              aria-label="Titel"
              className="-ml-2 w-full rounded-[5px] border border-transparent bg-transparent px-2 py-1.5 text-[26px] font-semibold tracking-[-0.02em] text-tinte transition-colors hover:border-rahmen hover:bg-flaeche-leise focus:border-rahmen-3 focus:bg-flaeche focus:outline-none"
            />
          </div>

          <div className="flex shrink-0 flex-col items-end gap-2.5">
            <span className="text-[11px] uppercase tracking-[0.1em] text-still">Status</span>
            <div className="flex items-center gap-1 rounded-md border border-rahmen-3 bg-flaeche p-[3px]">
              {STATUS.map((status) => (
                <form key={status} action={postStatusSetzen.bind(null, post.id, status)}>
                  <button
                    type="submit"
                    className={`flex items-center gap-[7px] rounded-[4px] px-3.5 py-2 text-[12.5px] transition-colors ${
                      post.status === status
                        ? `font-semibold ${STATUS_AKTIV[status]}`
                        : 'text-leise hover:bg-flaeche-tief'
                    }`}
                  >
                    {post.status === status && (
                      <span aria-hidden className="block size-[6px] rounded-full bg-current" />
                    )}
                    {STATUS_TEXT[status]}
                  </button>
                </form>
              ))}
            </div>
          </div>
        </div>

      {referenzstand.stand === 'LAEUFT' && <Fortschrittsbalken stand={referenzstand} />}

      {/*
        Ein gescheiterter Download stand bislang nur im Medien-Dialog — also
        genau dort, wo niemand nachschaut, der ihn schon geschlossen hat.
      */}
      {referenzstand.stand === 'FEHLER' && referenzstand.meldung && (
        <Fehler>
          <strong className="font-semibold">Referenzvideo nicht geladen.</strong>{' '}
          {referenzstand.meldung}{' '}
          <button
            type="button"
            onClick={() => setDialogOffen('MEDIUM')}
            className="font-medium underline underline-offset-2"
          >
            Im Medien-Dialog erneut versuchen
          </button>
        </Fehler>
      )}

      <form id={FORMULAR} action={postSpeichern.bind(null, post.id)} className="grid gap-8">
        {/* -------------------------------------------------------- Eckdaten */}
        <Abschnitt titel="Eckdaten">
          <div className="grid gap-4 rounded-md border border-rahmen bg-flaeche p-5">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Feld
                beschriftung="Posting-Datum"
                hinweis={post.postenAm ? undefined : 'Leer lassen geht.'}
              >
                <Eingabe name="postenAm" type="date" defaultValue={datum} />
              </Feld>
              <Feld beschriftung="Uhrzeit">
                <Eingabe name="uhrzeit" type="time" defaultValue={uhrzeit} required />
              </Feld>
              <Feld beschriftung={post.typ === 'REEL' ? 'Format' : 'Seitenverhältnis'}>
                <div className="rounded-[5px] border border-rahmen bg-flaeche-leise px-3 py-[7px] text-[13px] text-leise">
                  {post.typ === 'REEL' ? 'Reel · 9:16' : `${TYP_TEXT[post.typ]} · 4:5`}
                </div>
              </Feld>
              {post.typ === 'REEL' && (
                <Feld beschriftung="Länge">
                  <Eingabe name="laenge" defaultValue={post.laenge ?? ''} placeholder="ca. 30 Sek." />
                </Feld>
              )}
              <Feld beschriftung="Ziel">
                <Eingabe name="ziel" defaultValue={post.ziel ?? ''} placeholder="Recruiting" />
              </Feld>
              <Feld beschriftung="Stil">
                <Eingabe name="stil" defaultValue={post.stil ?? ''} placeholder="nahbar, direkt" />
              </Feld>
            </div>

            <Feld beschriftung="Kurzbeschreibung">
              <Eingabe name="kurzbeschreibung" defaultValue={post.kurzbeschreibung ?? ''} />
            </Feld>

          </div>
        </Abschnitt>

        {/* --------------------------------------------------------- Caption */}
        <Abschnitt
          titel="Caption"
          hinweis="Erscheint unter dem Medium — Hashtags hängen direkt hinten dran."
        >
          <Textfeld
            name="caption"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            rows={7}
          />
        </Abschnitt>

        {/* --------------------------------------------------- Reel: Szenen */}
        {post.typ === 'REEL' && (
          <Abschnitt
            titel="Ablauf"
            hinweis="Mit Szenenplan entsteht die nummerierte Liste, die der Kunde später sieht."
          >
            <Szenenplan
              postId={post.id}
              szenen={szenen}
              aktiv={szenenplan}
              setAktiv={setSzenenplan}
              inhalte={post.inhalte ?? ''}
              ziele={andereReels}
            />
          </Abschnitt>
        )}

        {/* -------------------------------------------------- Eigene Felder */}
        {customFelder.length > 0 && (
          <Abschnitt
            titel="Eigene Felder"
            hinweis="Pro Kunde frei definierbar — erscheinen auch in der Kundenvorschau."
          >
            <div className="grid gap-4 rounded-md border border-rahmen bg-flaeche p-5">
              {customFelder.map((feld) => (
                <div key={feld.id}>
                  {feld.typ === 'JANEIN' ? (
                    <Schalter
                      name={`custom_${feld.id}`}
                      beschriftung={feld.name}
                      defaultChecked={feld.wert === 'ja'}
                    />
                  ) : (
                    <Feld beschriftung={feld.name}>
                      <Eingabe
                        name={`custom_${feld.id}`}
                        type={feld.typ === 'DATUM' ? 'date' : 'text'}
                        defaultValue={feld.wert ?? ''}
                      />
                    </Feld>
                  )}
                </div>
              ))}
            </div>
          </Abschnitt>
        )}

        <div className="flex justify-end gap-2">
          <Knopf art="primaer" type="submit">
            Speichern
          </Knopf>
        </div>
      </form>

      {/* ---------------------------------------------------------- Kommentare */}
      <Abschnitt
        titel={
          kommentare.length > 0
            ? `Kommentare · ${kommentare.filter((k) => k.status === 'OFFEN').length} offen`
            : 'Kommentare'
        }
        hinweis="Was der Kunde im Freigabe-Link schreibt. Antworten erscheinen dort sofort."
      >
        <KommentarListe postId={post.id} kommentare={kommentare} />
      </Abschnitt>

      {/* ----------------------------------------------------------- Freigaben */}
      <Abschnitt
        titel="Freigaben"
        hinweis="Der Kunde gibt jeden Beitrag einzeln frei — beim Konzept das Konzept, nach dem Dreh die Vorschau."
      >
        <FreigabeFeld
          postId={post.id}
          offen={freigabe.offen}
          erledigt={freigabe.erledigt}
          freigaben={freigabe.zeilen}
          vorschlagName={freigabe.vorschlagName}
        />
      </Abschnitt>
      </div>

      {/* ------------------------------------------------------- Vorschau */}
      <div className="sticky top-24 justify-self-center xl:justify-self-end">
        <p className="mb-3 text-[10.5px] font-medium uppercase tracking-[0.1em] text-still">
          So sieht es der Kunde
        </p>

        <IPhoneVorschau
          typ={post.typ}
          kunde={vorschau.kunde}
          logo={vorschau.logo}
          medien={vorschauMedien}
          caption={caption}
          istVideo={istVideo}
          aufUpload={() => setDialogOffen('MEDIUM')}
        />

        <div className="mt-3 flex max-w-[344px] flex-wrap items-center gap-2">
          {post.typ === 'REEL' ? (
            <>
              <Knopf klein onClick={() => setDialogOffen('MEDIUM')}>
                Reel hochladen
              </Knopf>
              <Knopf klein onClick={() => setDialogOffen('THUMBNAIL')}>
                Thumbnail hochladen
              </Knopf>
              {!thumbnailUrl && (
                <span className="w-full text-[11px] leading-tight text-leiser">
                  Ohne Thumbnail zieht Preroll beim Video-Upload ein Standbild heraus.
                </span>
              )}
            </>
          ) : (
            <Knopf klein onClick={() => setDialogOffen('MEDIUM')}>
              Datei hochladen
            </Knopf>
          )}
        </div>

        {post.typ === 'KARUSSELL' && slides.length > 0 && (
          <div className="mt-4 max-w-[344px]">
            <p className="mb-2 text-[10.5px] font-medium uppercase tracking-[0.1em] text-still">
              Slides · zum Sortieren ziehen
            </p>
            <SlideSortierung slides={slides} reihenfolgeSpeichern={slidesSortieren.bind(null, post.id)} />
          </div>
        )}
      </div>

      <MedienDialog
        offen={dialogOffen !== null}
        schliessen={() => setDialogOffen(null)}
        postId={post.id}
        typ={post.typ}
        absicht={dialogOffen ?? 'MEDIUM'}
        videoQuellen={
          post.typ === 'REEL' ? (
            <>
              {/* ------------------------------------------------- Aus Klappe */}
              <div className="border-t border-rahmen pt-5">
                <h4 className="mb-2 text-[10.5px] uppercase tracking-[0.1em] text-still">
                  Aus Klappe holen
                </h4>
                <p className="mb-3 text-[11.5px] leading-relaxed text-leiser">
                  Das fertige Reel aus dem Schnitt. Beim Anlegen entsteht dort automatisch das
                  passende Video — beim Upload muss dann kein Name mehr getippt werden.
                </p>
                <KlappeFeld
                  postId={post.id}
                  kundeSlug={kundeSlug}
                  eingerichtet={klappe.eingerichtet}
                  projektName={klappe.projektName}
                  videos={klappe.videos}
                  ladefehler={klappe.ladefehler}
                  verknuepft={klappe.verknuepft}
                  meldung={meldungen.klappe}
                />
              </div>

              {/* --------------------------------------------- Von einem Link */}
              <div className="border-t border-rahmen pt-5">
                <h4 className="mb-2 text-[10.5px] uppercase tracking-[0.1em] text-still">
                  Von einem Link laden
                </h4>
                <p className="mb-3 text-[11.5px] leading-relaxed text-leiser">
                  Instagram, TikTok, YouTube, Vimeo — alles, was sich herunterladen lässt. In der
                  Konzeptphase steht hier das Vorbild, später ersetzt es das fertige Reel.
                  Eingebettet wird immer die eigene Kopie, weil die Plattformen Einbettungen
                  unvorhersehbar sperren.
                </p>

                {(meldungen.referenz ?? referenzstand.meldung) && (
                  <div className="mb-3">
                    <Warnung>{meldungen.referenz ?? referenzstand.meldung}</Warnung>
                  </div>
                )}

                {referenzstand.stand === 'LAEUFT' && (
                  <div className="mb-3">
                    <Fortschrittsbalken stand={referenzstand} />
                  </div>
                )}

                <form action={referenzvideoSetzen.bind(null, post.id)} className="grid gap-3">
                  <Eingabe
                    name="referenzVideoUrl"
                    type="url"
                    defaultValue={post.referenzVideoUrl ?? ''}
                    placeholder="https://www.instagram.com/reel/…"
                  />
                  <Eingabe
                    name="referenzVideoTitel"
                    defaultValue={post.referenzVideoTitel ?? ''}
                    placeholder={'Beschriftung, z. B. „Handwerk sucht dich“'}
                  />
                  <div>
                    <Knopf
                      klein
                      art="primaer"
                      type="submit"
                      disabled={referenzstand.stand === 'LAEUFT'}
                    >
                      {referenzstand.stand === 'LAEUFT' ? 'Läuft …' : 'Laden und einsetzen'}
                    </Knopf>
                  </div>
                </form>

                {referenz.geladen && referenzstand.stand !== 'LAEUFT' && (
                  <div className="mt-3 flex items-center justify-between gap-3 rounded-md border border-rahmen bg-flaeche-leise px-3 py-2.5">
                    <p className="text-[11.5px] text-leiser">
                      Kopie liegt vor und steht im Geräterahmen.
                    </p>
                    <form action={referenzvideoEntfernen.bind(null, post.id)}>
                      <button
                        type="submit"
                        className="text-[11.5px] text-stiller hover:text-akzent"
                      >
                        Entfernen
                      </button>
                    </form>
                  </div>
                )}
              </div>
            </>
          ) : null
        }
      />
    </div>
  )
}
