'use client'

import type { CustomFeldTyp, PostStatus, PostTyp } from '@prisma/client'
import { useState } from 'react'
import { IPhoneVorschau } from '@/components/iphone'
import { MedienDialog } from '@/components/medien-dialog'
import { SlideSortierung } from '@/components/slide-sortierung'
import { FreigabeFeld, type FreigabeZeile } from './freigabe-feld'
import { KlappeFeld, type KlappeVideoWahl } from './klappe-feld'
import { referenzvideoEntfernen, referenzvideoSetzen } from '../../referenz-aktionen'
import {
  Abschnitt,
  Eingabe,
  Feld,
  Knopf,
  Schalter,
  Textfeld,
  Warnung,
} from '@/components/ui'
import {
  postSpeichern,
  postStatusSetzen,
  slidesSortieren,
  szeneAnlegen,
  szeneLoeschen,
  szeneSpeichern,
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
  referenzVideoUrl: string | null
  referenzVideoTitel: string | null
}

type Szene = {
  id: string
  position: number
  abschnitt: string
  bildSzene: string | null
  sprechertext: string | null
  texteinblendung: string | null
}

type CustomFeld = { id: string; name: string; typ: CustomFeldTyp; wert: string | null }

const STATUS: PostStatus[] = ['KONZEPT', 'VORSCHAU', 'FINAL']
const STATUS_TEXT: Record<PostStatus, string> = {
  KONZEPT: 'Konzept',
  VORSCHAU: 'Vorschau',
  FINAL: 'Final',
}
const ABSCHNITTE = ['Hook', 'Intro', 'Szene', 'Abbinder']

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
  referenz: {
    mediumUrl: string | null
    geladen: boolean
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
  const [dialogOffen, setDialogOffen] = useState(false)
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
    <div className="flex flex-wrap items-start gap-10">
      <div className="grid min-w-[520px] flex-1 gap-8">
      {/* ------------------------------------------------------------ Status */}
      <div className="flex items-center gap-2.5">
        <span className="text-[10.5px] font-medium uppercase tracking-[0.1em] text-still">
          Status
        </span>
        <div className="flex overflow-hidden rounded-[5px] border border-rahmen-3">
          {STATUS.map((status) => (
            <form key={status} action={postStatusSetzen.bind(null, post.id, status)}>
              <button
                type="submit"
                className={`px-3.5 py-1.5 text-[12px] transition-colors ${
                  post.status === status
                    ? 'bg-tinte font-medium text-white'
                    : 'bg-flaeche text-leise hover:bg-flaeche-tief'
                }`}
              >
                {STATUS_TEXT[status]}
              </button>
            </form>
          ))}
        </div>
      </div>

      <form action={postSpeichern.bind(null, post.id)} className="grid gap-8">
        {/* -------------------------------------------------------- Eckdaten */}
        <Abschnitt titel="Eckdaten">
          <div className="grid gap-4 rounded-md border border-rahmen bg-flaeche p-5">
            <Feld beschriftung="Titel">
              <Eingabe name="titel" defaultValue={post.titel} required />
            </Feld>

            <div className="grid grid-cols-[1fr_120px] gap-4">
              <Feld
                beschriftung="Posting-Datum"
                hinweis={post.postenAm ? undefined : 'Noch offen — leer lassen geht.'}
              >
                <Eingabe name="postenAm" type="date" defaultValue={datum} />
              </Feld>
              <Feld beschriftung="Uhrzeit">
                <Eingabe name="uhrzeit" type="time" defaultValue={uhrzeit} required />
              </Feld>
            </div>

            <Feld beschriftung="Kurzbeschreibung">
              <Eingabe name="kurzbeschreibung" defaultValue={post.kurzbeschreibung ?? ''} />
            </Feld>

            <div className={`grid gap-4 ${post.typ === 'REEL' ? 'grid-cols-3' : 'grid-cols-2'}`}>
              {/* Länge ergibt nur beim Bewegtbild einen Sinn. */}
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
            titel="Szenen"
            hinweis="Optional — ohne Szenenplan tritt ein freies Inhalte-Feld an seine Stelle."
          >
            <div className="mb-4">
              <Schalter
                name="szenenplanAktiv"
                beschriftung="Szenenplan verwenden"
                checked={szenenplan}
                onChange={(e) => setSzenenplan(e.target.checked)}
              />
            </div>

            {!szenenplan && (
              <Feld beschriftung="Inhalte" hinweis="Freitext — erscheint so auch in der Kundenvorschau.">
                <Textfeld name="inhalte" defaultValue={post.inhalte ?? ''} rows={5} />
              </Feld>
            )}
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
      <div className="sticky top-24 shrink-0">
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
          aufUpload={() => setDialogOffen(true)}
        />

        <div className="mt-3 flex max-w-[344px] flex-wrap items-center gap-2">
          <Knopf klein onClick={() => setDialogOffen(true)}>
            Datei hochladen
          </Knopf>
          {post.typ === 'REEL' && !thumbnailUrl && (
            <span className="text-[11px] leading-tight text-leiser">
              Thumbnail fehlt fürs Profilraster
            </span>
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
        offen={dialogOffen}
        schliessen={() => setDialogOffen(false)}
        postId={post.id}
        typ={post.typ}
        reelZusatz={
          post.typ === 'REEL' ? (
            <div className="grid gap-5">
              {/* --------------------------------------------------- Referenzvideo */}
              <div className="border-t border-rahmen pt-5">
                <p className="text-[12.5px] font-medium">Referenzvideo</p>
                <p className="mt-1 mb-3 text-[11.5px] leading-relaxed text-leiser">
                  Link auf ein Vorbild. Preroll legt eine lokale Kopie an — eingebettet wird die
                  eigene Datei, weil Instagram und YouTube Einbettungen unvorhersehbar sperren.
                </p>

                {meldungen.referenz && (
                  <div className="mb-3">
                    <Warnung>{meldungen.referenz}</Warnung>
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
                    <Knopf klein art="primaer" type="submit">
                      Übernehmen und laden
                    </Knopf>
                  </div>
                </form>

                {referenz.geladen && (
                  <div className="mt-3 grid gap-2 rounded-md border border-rahmen bg-flaeche p-3">
                    {referenz.mediumUrl && (
                      <video
                        src={referenz.mediumUrl}
                        controls
                        className="max-h-52 rounded-[3px] bg-black"
                      />
                    )}
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[11.5px] text-leiser">
                        Liegt lokal vor und wird in der Kundenvorschau eingebettet.
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
                  </div>
                )}
              </div>

              {/* ----------------------------------------------- Finales Reel */}
              <div className="border-t border-rahmen pt-5">
                <p className="text-[12.5px] font-medium">Finales Reel aus Klappe</p>
                <p className="mt-1 mb-3 text-[11.5px] leading-relaxed text-leiser">
                  Beim Anlegen eines Reels entsteht in Klappe automatisch das passende Video — beim
                  Upload aus dem Schnitt muss dann kein Name mehr getippt werden.
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
            </div>
          ) : null
        }
      />
    </div>
  )
}
