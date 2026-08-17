'use client'

import type { CustomFeldTyp, Plattform, PostStatus, PostTyp, Verhaeltnis } from '@prisma/client'
import { useState } from 'react'
import { IPhoneVorschau } from '@/components/iphone'
import { MedienDialog } from '@/components/medien-dialog'
import type { Erwaehnbar } from '@/components/kommentar-feld'
import { KommentarListe, type Kommentareintrag } from '@/components/kommentar-liste'
import {
  Fortschrittsbalken,
  useDownloadstand,
  type Downloadstand,
} from '@/components/download-fortschritt'
import { kalenderwoche } from '@/lib/format'
import type { Anzeigephase } from '@/lib/status'
import { PhasenBadge } from '@/components/ui'
import { ERLAUBT, postBeschriftung, VERHAELTNIS_TEXT } from '@/lib/verhaeltnis'
import { PlattformWahl } from '@/components/plattform-wahl'
import { SlideSortierung } from '@/components/slide-sortierung'
import { Szenenplan, type Szene } from './szenenplan'
import { VariantenFeld, type VariantenZeile } from './varianten-feld'
import type { VariantenMedium } from './varianten-medien'
import type { Zielreel } from './uebertragen'
import { FreigabeFeld, type FreigabeZeile } from './freigabe-feld'
import { type KlappeVideoWahl } from './klappe-feld'
import { VideoQuellen } from './video-quellen'
import { videoVonLinkLaden } from '../../video-download-aktionen'
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
import {
  postSpeichern,
  postStatusSetzen,
  slideEntfernen,
  slidesSortieren,
  slideWiederherstellen,
} from '../../aktionen'

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
  verhaeltnis: Verhaeltnis
  videoDownloadUrl: string | null

}

type CustomFeld = { id: string; name: string; typ: CustomFeldTyp; wert: string | null }

const STATUS: PostStatus[] = ['ENTWURF', 'KONZEPT', 'VORSCHAU', 'FINAL']
const STATUS_TEXT: Record<PostStatus, string> = {
  ENTWURF: 'Entwurf',
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
  ENTWURF: 'bg-flaeche-tief text-tinte-3',
  KONZEPT: 'bg-konzept-flaeche text-konzept',
  VORSCHAU: 'bg-vorschau-flaeche text-vorschau',
  FINAL: 'bg-final-flaeche text-final',
}

export function PostEditor({
  post,
  phase,
  gleichzeitig,
  plattformen,
  varianten,
  szenen,
  customFelder,
  slides,
  slideUrls,
  mediumUrl,
  thumbnailUrl,
  thumbnailAutomatisch,
  istVideo,
  videoQuelle,
  vorschau,
  standardUhrzeit,
  kommentare,
  erwaehnbar,
  andereReels,
  freigabenNoetig,
  downloadStand,
  klappe,
  kundeSlug,
  meldungen,
  freigabe,
}: {
  post: PostDaten
  /**
   * Am Server gerechnet, nicht hier: „Gepostet" hängt an der aktuellen Zeit,
   * und wer das im Browser bestimmt, riskiert einen Hydrationsbruch, wenn der
   * Termin genau zwischen Serverlauf und Hydration verstreicht.
   */
  phase: Anzeigephase
  /** Wie viele **andere** Beiträge zur selben Minute veröffentlicht werden. */
  gleichzeitig: number
  /**
   * Wohin dieser Beitrag geht (`gewaehlt`) und was zur Wahl steht (`moeglich`
   * — die Wahl des Kunden, beschnitten auf das, wofür ein Kanal zugeordnet
   * ist). Mehr als sein Kunde kann ein Beitrag nicht, und nichts, was gar
   * nicht eingerichtet ist.
   */
  plattformen: { gewaehlt: Plattform[]; moeglich: Plattform[] }
  /**
   * Abweichende Fassungen je Plattform. Fehlt die Angabe, entfällt der
   * Abschnitt — bei einem Beitrag, der nur eine Plattform bespielt, gäbe es
   * nichts abzuweichen.
   */
  varianten?: {
    zeilen: VariantenZeile[]
    /** Die Medien des Beitrags — was eine Fassung ohne eigene zeigt. */
    geerbteMedien: VariantenMedium[]
    frei: Plattform[]
    ausserhalb: Plattform[]
    anlegen: (formular: FormData) => Promise<void>
    speichern: (varianteId: string, formular: FormData) => Promise<void>
    loeschen: (varianteId: string) => Promise<void>
    medienVerwerfen: (varianteId: string) => Promise<void>
  }
  szenen: Szene[]
  customFelder: CustomFeld[]
  slides: Array<{ id: string; url: string }>
  /** Volle Auflösung für die Vorschau im Geräterahmen. */
  slideUrls: string[]
  mediumUrl: string | null
  thumbnailUrl: string | null
  /** Aus dem Video gezogen statt hochgeladen. */
  thumbnailAutomatisch: boolean
  istVideo: boolean
  /** Der eine Video-Platz — eigenes MEDIUM oder eingebettete Klappe-Fassung. */
  videoQuelle: { url: string; herkunft: 'MEDIUM' | 'KLAPPE' } | null
  vorschau: { kunde: string; logo: string | null }
  /** Uhrzeit aus den Stammdaten — Vorbelegung für noch ungeplante Posts. */
  standardUhrzeit: string
  kommentare: Kommentareintrag[]
  /** Team und Kundenkontakte — die Auswahl hinter dem @ im Kommentarfeld. */
  erwaehnbar: Erwaehnbar[]
  /** Aus. bei eigenen Kanälen — dann entfällt der Freigabeschritt ganz. */
  freigabenNoetig: boolean
  /** Andere Reels desselben Kunden — Ziele fürs Übertragen des Ablaufs. */
  andereReels: Zielreel[]
  downloadStand: Downloadstand
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
  meldungen: { klappe?: string }
  freigabe: {
    offen: import('@prisma/client').Freigabestufe | null
    erledigt: boolean
    zeilen: FreigabeZeile[]
    vorschlagName: string | null
  }
}) {
  const [dialogOffen, setDialogOffen] = useState(false)
  // Der Stand wird an einer Stelle abgefragt und an beide Balken gereicht —
  // im Dialog und über den Eckdaten.
  const downloadstand = useDownloadstand(post.id, downloadStand)
  const [szenenplan, setSzenenplan] = useState(post.szenenplanAktiv)
  // Die Caption steht im Zustand, damit die Vorschau beim Tippen mitläuft.
  const [caption, setCaption] = useState(post.caption)
  // Dasselbe fürs Format: Wer umstellt, will den Rahmen sofort anders sehen,
  // nicht erst nach dem Speichern.
  const [verhaeltnis, setVerhaeltnis] = useState<Verhaeltnis>(post.verhaeltnis)

  // Beim Reel zeigt der Rahmen den einen Video-Platz — egal, ob das Video
  // hochgeladen, geladen oder aus Klappe eingebettet ist.
  const vorschauMedien =
    post.typ === 'KARUSSELL'
      ? slideUrls
      : post.typ === 'REEL'
        ? videoQuelle
          ? [videoQuelle.url]
          : []
        : mediumUrl
          ? [mediumUrl]
          : []
  const vorschauIstVideo = post.typ === 'REEL' ? Boolean(videoQuelle) : istVideo

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
              <TypBadge typ={post.typ} verhaeltnis={verhaeltnis} />
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

            {/*
              Speichern gehört nach oben: Der Editor ist lang, und wer den Titel
              oder die Eckdaten ändert, hat den Knopf am Seitenende nicht im
              Blick. Er steht außerhalb des Formulars und findet es über `form`.
            */}
            <div className="mt-3">
              <Knopf art="primaer" type="submit" form={FORMULAR}>
                Speichern
              </Knopf>
            </div>
          </div>

          <div className="flex shrink-0 flex-col items-end gap-2.5">
            <a
              href={`/api/posts/${post.id}/zip`}
              title="Alle Medien dieses Beitrags und die Caption als Textdatei"
              className="inline-flex items-center rounded-[5px] border border-rahmen-3 bg-flaeche px-3 py-1.5 text-[12px] font-medium text-tinte transition-colors hover:border-rahmen-4"
            >
              Dateien als ZIP
            </a>

            {/*
              Der Umschalter zeigt die vier Phasen, die sich setzen lassen.
              „Gepostet" steht daneben statt als fünfter Knopf: Es wird aus
              Final plus vergangenem Termin berechnet und lässt sich nicht
              anklicken — ein Knopf, der nichts tut, wäre eine Falle.
            */}
            <span className="flex items-center gap-2 text-[11px] uppercase tracking-[0.1em] text-still">
              Status
              {(phase === 'GEPOSTET' || phase === 'FEHLGESCHLAGEN') && (
                <PhasenBadge phase={phase} klein />
              )}
            </span>
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

      {downloadstand.stand === 'LAEUFT' && <Fortschrittsbalken stand={downloadstand} />}

      {/*
        Ein gescheiterter Download stand bislang nur im Medien-Dialog — also
        genau dort, wo niemand nachschaut, der ihn schon geschlossen hat.
      */}
      {downloadstand.stand === 'FEHLER' && downloadstand.meldung && (
        <Fehler>
          <strong className="font-semibold">Video nicht geladen.</strong>{' '}
          {downloadstand.meldung}{' '}
          <button
            type="button"
            onClick={() => setDialogOffen(true)}
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
              <Feld
                beschriftung="Uhrzeit"
                /*
                  Preroll veröffentlicht nacheinander, nicht gleichzeitig.
                  Kein Grund umzuplanen — zwei Kunden teilen sich ohne Weiteres
                  eine Minute —, aber wer es weiß, wundert sich später nicht
                  über einen Beitrag, der ein paar Minuten zu spät erschien.
                */
                hinweis={
                  gleichzeitig > 0
                    ? `Zu diesem Termin stehen ${gleichzeitig + 1} Beiträge an. Preroll postet sie nacheinander — die letzten erscheinen einige Minuten später.`
                    : undefined
                }
              >
                <Eingabe name="uhrzeit" type="time" defaultValue={uhrzeit} required />
              </Feld>
              <Feld
                beschriftung="Format"
                hinweis={
                  post.typ === 'REEL' && verhaeltnis !== 'VERTIKAL_9_16'
                    ? 'Quer oder quadratisch heißt es Video, nicht Reel.'
                    : undefined
                }
              >
                <select
                  name="verhaeltnis"
                  value={verhaeltnis}
                  onChange={(e) => setVerhaeltnis(e.target.value as Verhaeltnis)}
                  className="w-full rounded-[5px] border border-rahmen-3 bg-flaeche px-3 py-[7px] text-[13px] text-tinte focus:border-rahmen-4 focus:outline-none"
                >
                  {ERLAUBT[post.typ].map((wert, i) => (
                    <option key={wert} value={wert}>
                      {VERHAELTNIS_TEXT[wert]}
                      {i === 0 ? ' (Standard)' : ''}
                    </option>
                  ))}
                </select>
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

            <Feld
              beschriftung="Plattformen"
              hinweis={
                plattformen.moeglich.length === 0
                  ? undefined
                  : plattformen.gewaehlt.length === 0
                    ? 'Nichts gewählt — dieser Beitrag geht nirgendwohin. Preroll veröffentlicht ihn nicht, und auf der Kundenseite steht keine Marke.'
                    : 'Aus den Stammdaten vorbelegt. Was hier steht, sieht auch der Kunde am Beitrag.'
              }
            >
              <PlattformWahl
                auswahl={plattformen.gewaehlt}
                moeglich={plattformen.moeglich}
                leerText="Für diesen Kunden ist keine Plattform eingerichtet — dafür muss in den Stammdaten eine Facebook-Seite zugeordnet sein."
              />
            </Feld>

            <Feld beschriftung="Kurzbeschreibung">
              <Eingabe name="kurzbeschreibung" defaultValue={post.kurzbeschreibung ?? ''} />
            </Feld>

          </div>
        </Abschnitt>

        {/* ---------------------------------------------------------- Slides */}
        {post.typ === 'KARUSSELL' && slides.length > 0 && (
          <Abschnitt
            titel="Slides"
            hinweis="In dieser Reihenfolge wischt sich der Kunde durch. Sortieren und Entfernen erst nach einem Klick auf „Bearbeiten“."
          >
            <div className="rounded-md border border-rahmen bg-flaeche p-5">
              <SlideSortierung
                postId={post.id}
                slides={slides}
                reihenfolgeSpeichern={slidesSortieren.bind(null, post.id)}
                entfernen={slideEntfernen}
                wiederherstellen={slideWiederherstellen}
              />
            </div>
          </Abschnitt>
        )}

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

      </form>

      {/*
        Abweichende Fassungen liegen **außerhalb** des Beitragsformulars, und
        zwar zwingend: Jede Fassung ist ein eigenes Formular, und ein `<form>`
        im `<form>` wirft der Browser weg. Genau daran lag es, dass „Fassung
        anlegen" eine Weile nichts tat — der Knopf gehörte dem Beitragsformular
        und löste dessen Speichern aus.

        Fachlich passt es ohnehin hierher: Jede Fassung speichert für sich,
        sonst nähme ein Klick auf „Fassung speichern" ungespeicherte Änderungen
        am Beitrag mit — oder umgekehrt.
      */}
      {varianten && plattformen.gewaehlt.length > 1 && (
        <Abschnitt
          titel="Andere Fassungen"
          hinweis="Dieselbe Sache liest sich auf LinkedIn anders als auf Instagram. Was hier leer bleibt, wird vom Beitrag geerbt."
        >
          <VariantenFeld
            postId={post.id}
            postTyp={post.typ}
            postVerhaeltnis={verhaeltnis}
            kundeSlug={kundeSlug}
            geerbteMedien={varianten.geerbteMedien}
            varianten={varianten.zeilen}
            frei={varianten.frei}
            ausserhalb={varianten.ausserhalb}
            anlegen={varianten.anlegen}
            speichern={varianten.speichern}
            loeschen={varianten.loeschen}
            medienVerwerfen={varianten.medienVerwerfen}
          />
        </Abschnitt>
      )}

      {/* ---------------------------------------------------------- Kommentare */}
      <Abschnitt
        titel={
          kommentare.length > 0
            ? `Kommentare · ${kommentare.filter((k) => k.status === 'OFFEN').length} offen`
            : 'Kommentare'
        }
        hinweis="Was der Kunde im Freigabe-Link schreibt. Antworten erscheinen dort sofort."
      >
        <KommentarListe postId={post.id} kommentare={kommentare} erwaehnbar={erwaehnbar} />
      </Abschnitt>

      {/* ----------------------------------------------------------- Freigaben */}
      {freigabenNoetig && (
      <Abschnitt
        titel="Freigaben"
        hinweis="Der Kunde gibt jeden Beitrag einzeln frei — beim Konzept das Konzept, nach dem Dreh die Vorschau."
      >
        <FreigabeFeld
          postId={post.id}
          offen={freigabe.offen}
          erledigt={freigabe.erledigt}
          gepostet={phase === 'GEPOSTET'}
          freigaben={freigabe.zeilen}
          vorschlagName={freigabe.vorschlagName}
        />
      </Abschnitt>
      )}
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
          verhaeltnis={verhaeltnis}
          istVideo={vorschauIstVideo}
          thumbnail={thumbnailUrl}
          aufUpload={() => setDialogOffen(true)}
        />

        <div className="mt-3 flex max-w-[344px] flex-wrap items-center gap-2">
          <Knopf klein onClick={() => setDialogOffen(true)}>
            Hochladen
          </Knopf>
          {post.typ === 'REEL' && thumbnailAutomatisch && (
            <span className="w-full text-[11px] leading-tight text-leiser">
              Das Thumbnail ist ein Standbild aus dem Video.
            </span>
          )}
        </div>

      </div>

      <MedienDialog
        offen={dialogOffen}
        schliessen={() => setDialogOffen(false)}
        postId={post.id}
        typ={post.typ}
        verhaeltnis={verhaeltnis}
        videoUrl={videoQuelle?.url ?? null}
        videoHerkunft={videoQuelle?.herkunft ?? null}
        thumbnailUrl={thumbnailUrl}
        thumbnailAutomatisch={thumbnailAutomatisch}
        videoQuellen={
          post.typ === 'REEL' ? (
            <VideoQuellen
              postId={post.id}
              kundeSlug={kundeSlug}
              klappe={klappe}
              downloadstand={downloadstand}
              videoDownloadUrl={post.videoDownloadUrl}
              meldung={meldungen.klappe}
            />
          ) : null
        }
      />
    </div>
  )
}
