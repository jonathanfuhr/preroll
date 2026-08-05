'use client'

import type { CustomFeldTyp, PostStatus, PostTyp } from '@prisma/client'
import { useState } from 'react'
import { KarussellDialog, MedienAblage } from '@/components/medien-upload'
import {
  Abschnitt,
  Auswahl,
  Eingabe,
  Feld,
  Hinweis,
  Knopf,
  Schalter,
  Textfeld,
} from '@/components/ui'
import {
  postSpeichern,
  postStatusSetzen,
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
  postenAm: string
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
  mediumUrl,
  thumbnailUrl,
  istVideo,
}: {
  post: PostDaten
  szenen: Szene[]
  customFelder: CustomFeld[]
  slides: Array<{ id: string; url: string }>
  mediumUrl: string | null
  thumbnailUrl: string | null
  istVideo: boolean
}) {
  const [dialogOffen, setDialogOffen] = useState(false)
  const [szenenplan, setSzenenplan] = useState(post.szenenplanAktiv)

  const datum = post.postenAm.slice(0, 10)
  const uhrzeit = new Date(post.postenAm).toTimeString().slice(0, 5)

  return (
    <div className="grid gap-8">
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
              <Feld beschriftung="Posting-Datum">
                <Eingabe name="postenAm" type="date" defaultValue={datum} required />
              </Feld>
              <Feld beschriftung="Uhrzeit">
                <Eingabe name="uhrzeit" type="time" defaultValue={uhrzeit} required />
              </Feld>
            </div>

            <Feld beschriftung="Kurzbeschreibung">
              <Eingabe name="kurzbeschreibung" defaultValue={post.kurzbeschreibung ?? ''} />
            </Feld>

            <div className="grid grid-cols-3 gap-4">
              <Feld beschriftung="Länge">
                <Eingabe name="laenge" defaultValue={post.laenge ?? ''} placeholder="ca. 30 Sek." />
              </Feld>
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
          <Textfeld name="caption" defaultValue={post.caption} rows={7} />
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

        {/* --------------------------------------------------- Referenzvideo */}
        <Abschnitt
          titel="Referenzvideo"
          hinweis="Link auf ein Vorbild — wird im Editor und in der Kundenvorschau eingebettet."
        >
          <div className="grid gap-4 rounded-md border border-rahmen bg-flaeche p-5">
            <Feld beschriftung="Link">
              <Eingabe
                name="referenzVideoUrl"
                type="url"
                defaultValue={post.referenzVideoUrl ?? ''}
                placeholder="https://www.instagram.com/reel/…"
              />
            </Feld>
            <Feld beschriftung="Beschriftung">
              <Eingabe
                name="referenzVideoTitel"
                defaultValue={post.referenzVideoTitel ?? ''}
                placeholder={'Referenz: „Handwerk sucht dich“'}
              />
            </Feld>
          </div>
        </Abschnitt>

        <div className="flex justify-end gap-2">
          <Knopf art="primaer" type="submit">
            Speichern
          </Knopf>
        </div>
      </form>

      {/* ------------------------------------------- Szenenplan (eigene Forms) */}
      {post.typ === 'REEL' && szenenplan && (
        <Abschnitt
          titel="Szenenplan"
          aktion={
            <form action={szeneAnlegen.bind(null, post.id)}>
              <Knopf klein type="submit">
                Szene hinzufügen
              </Knopf>
            </form>
          }
        >
          {szenen.length === 0 ? (
            <Hinweis>
              Noch keine Szene angelegt. Ein typischer Aufbau: Hook → Intro → Szenen → Abbinder.
            </Hinweis>
          ) : (
            <div className="overflow-hidden rounded-md border border-rahmen bg-flaeche">
              <div className="grid grid-cols-[34px_110px_1fr_1fr_1fr_34px] gap-2 border-b border-rahmen bg-flaeche-leise px-3 py-2 text-[10px] font-medium uppercase tracking-[0.08em] text-still">
                <span>#</span>
                <span>Abschnitt</span>
                <span>Bild / Szene</span>
                <span>Sprechertext</span>
                <span>Texteinblendung</span>
                <span />
              </div>

              {szenen.map((szene, index) => (
                <form
                  key={szene.id}
                  action={szeneSpeichern.bind(null, szene.id)}
                  className="grid grid-cols-[34px_110px_1fr_1fr_1fr_34px] items-start gap-2 border-b border-rahmen px-3 py-2.5 last:border-b-0"
                >
                  <span className="pt-2 font-mono text-[11px] text-still">{index + 1}</span>

                  <Auswahl name="abschnitt" defaultValue={szene.abschnitt} className="!px-2 !py-1.5 !text-[12px]">
                    {ABSCHNITTE.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </Auswahl>

                  <Textfeld
                    name="bildSzene"
                    defaultValue={szene.bildSzene ?? ''}
                    rows={2}
                    className="!px-2 !py-1.5 !text-[12px]"
                  />
                  <Textfeld
                    name="sprechertext"
                    defaultValue={szene.sprechertext ?? ''}
                    rows={2}
                    className="!px-2 !py-1.5 !text-[12px]"
                  />
                  <Textfeld
                    name="texteinblendung"
                    defaultValue={szene.texteinblendung ?? ''}
                    rows={2}
                    className="!px-2 !py-1.5 !text-[12px]"
                  />

                  <div className="grid gap-1 pt-1">
                    <button
                      type="submit"
                      title="Szene speichern"
                      className="text-[11px] text-leise hover:text-akzent"
                    >
                      ✓
                    </button>
                    <button
                      type="submit"
                      formAction={szeneLoeschen.bind(null, szene.id)}
                      title="Szene löschen"
                      className="text-[13px] leading-none text-stiller hover:text-akzent"
                    >
                      ×
                    </button>
                  </div>
                </form>
              ))}
            </div>
          )}
        </Abschnitt>
      )}

      {/* -------------------------------------------------------------- Medien */}
      <Abschnitt titel="Medien">
        {post.typ === 'KARUSSELL' ? (
          <div className="grid gap-4">
            {slides.length > 0 && (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-2">
                {slides.map((slide, index) => (
                  <div key={slide.id} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={slide.url}
                      alt={`Slide ${index + 1}`}
                      className="aspect-[4/5] w-full rounded-[3px] border border-rahmen object-cover"
                    />
                    <span className="absolute left-1 top-1 rounded-[3px] bg-black/55 px-1.5 py-px font-mono text-[9.5px] text-white">
                      {index + 1}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div>
              <Knopf onClick={() => setDialogOffen(true)}>
                {slides.length > 0 ? 'Slides ersetzen' : 'Karussell-Bilder hinzufügen'}
              </Knopf>
            </div>
            <KarussellDialog
              postId={post.id}
              offen={dialogOffen}
              schliessen={() => setDialogOffen(false)}
            />
          </div>
        ) : (
          <div className="grid gap-5">
            <MedienAblage
              postId={post.id}
              rolle="MEDIUM"
              beschriftung={
                mediumUrl
                  ? 'Datei ersetzen — hierher ziehen oder klicken'
                  : post.typ === 'REEL'
                    ? 'Reel hierher ziehen oder klicken'
                    : 'Grafik hierher ziehen oder klicken'
              }
              hinweis={post.typ === 'REEL' ? 'Erwartet: 9:16' : 'Erwartet: 4:5, üblich 1080 × 1350 px'}
              vorhanden={
                mediumUrl ? (
                  <div className="mb-3 flex justify-center">
                    {istVideo ? (
                      <video src={mediumUrl} className="h-40 rounded-[3px]" controls muted />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={mediumUrl} alt="" className="h-40 rounded-[3px] object-contain" />
                    )}
                  </div>
                ) : null
              }
            />

            {post.typ === 'REEL' && (
              <MedienAblage
                postId={post.id}
                rolle="THUMBNAIL"
                beschriftung={
                  thumbnailUrl ? 'Thumbnail ersetzen' : 'Reel-Thumbnail hierher ziehen oder klicken'
                }
                hinweis="Erwartet: 9:16. Im Feed-Raster wird davon der mittige 4:5-Ausschnitt gezeigt."
                vorhanden={
                  thumbnailUrl ? (
                    <div className="mb-3 flex justify-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={thumbnailUrl} alt="" className="h-32 rounded-[3px] object-contain" />
                    </div>
                  ) : null
                }
              />
            )}
          </div>
        )}
      </Abschnitt>
    </div>
  )
}
