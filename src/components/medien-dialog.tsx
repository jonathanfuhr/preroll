'use client'

import type { PostTyp, Verhaeltnis } from '@prisma/client'
import { useRouter } from 'next/navigation'
import { createPortal } from 'react-dom'
import { useEffect, useRef, useState, type DragEvent, type ReactNode } from 'react'
import { berechneAuftrennung, erkenneSlideAnzahl } from '@/lib/karussell'
import { VERHAELTNIS_MASSE, VERHAELTNIS_TEXT } from '@/lib/verhaeltnis'
import { ladeHoch, type Fortschritt } from '@/lib/hochladen'
import { EinfacherPlayer } from './reel-player'
import { UploadBalken } from './upload-balken'
import { Fehler, Hinweis, Knopf, Warnung } from './ui'

/**
 * Medien-Dialog je Post-Typ. Was hochgeladen werden kann, hängt an der Form
 * des Beitrags — deshalb ein Dialog mit drei Gesichtern statt eines
 * Sammelformulars, in dem zwei Drittel der Felder nicht passen.
 *
 * **Derselbe Dialog trägt auch die Fassungen.** Mit `varianteId` gehen alle
 * Uploads an den Platz der Fassung statt an den des Beitrags — sonst gäbe es
 * einen zweiten, ärmeren Weg zu denselben Medien, und die Auftrennung eines
 * Gesamtbildes oder die drei Video-Quellen fehlten dort schlicht.
 */

type Rolle = 'MEDIUM' | 'SLIDE' | 'THUMBNAIL'



/** Fläche zum Ziehen oder Klicken. */
function Ablage({
  titel,
  hinweis,
  mehrere,
  akzeptiert,
  laeuft,
  vorschau,
  aufDateien,
}: {
  titel: string
  hinweis?: string
  mehrere?: boolean
  akzeptiert: string
  laeuft: boolean
  vorschau?: ReactNode
  aufDateien: (dateien: FileList | null) => void
}) {
  const eingabe = useRef<HTMLInputElement>(null)
  const [ueber, setUeber] = useState(false)

  return (
    <div
      onDragOver={(e: DragEvent) => {
        e.preventDefault()
        setUeber(true)
      }}
      onDragLeave={() => setUeber(false)}
      onDrop={(e: DragEvent) => {
        e.preventDefault()
        setUeber(false)
        aufDateien(e.dataTransfer.files)
      }}
      onClick={() => eingabe.current?.click()}
      className={`cursor-pointer rounded-md border border-dashed px-5 py-7 text-center transition-colors ${
        ueber ? 'border-akzent bg-akzent-zart' : 'border-rahmen-3 bg-flaeche-leise hover:border-rahmen-4'
      }`}
    >
      {vorschau}
      <p className="text-[13px] font-medium text-tinte-3">{laeuft ? 'Wird hochgeladen …' : titel}</p>
      {hinweis && <p className="mx-auto mt-1 max-w-[320px] text-[11.5px] leading-relaxed text-leiser">{hinweis}</p>}
      <div className="mt-3">
        <span className="inline-flex items-center rounded-[5px] border border-rahmen-3 bg-flaeche px-3 py-1.5 text-[12px] font-medium text-tinte">
          Datei auswählen
        </span>
      </div>
      <input
        ref={eingabe}
        type="file"
        hidden
        multiple={mehrere}
        accept={akzeptiert}
        onChange={(e) => {
          aufDateien(e.target.files)
          e.target.value = ''
        }}
      />
    </div>
  )
}

// ------------------------------------------------------------- Karussell

/** Zwei Wege: fertige Slides oder ein durchgehendes Motiv zum Auftrennen. */
function KarussellInhalt({
  postId,
  varianteId,
  verhaeltnis,
  fertig,
}: {
  postId: string
  varianteId?: string | null
  verhaeltnis: Verhaeltnis
  fertig: () => void
}) {
  const router = useRouter()
  const [weg, setWeg] = useState<'einzeln' | 'gesamt'>('einzeln')
  const [laeuft, setLaeuft] = useState(false)
  const [stand, setStand] = useState<Fortschritt | null>(null)
  const [fehler, setFehler] = useState<string | null>(null)
  const [hinweise, setHinweise] = useState<string[]>([])

  const [datei, setDatei] = useState<File | null>(null)
  const [masse, setMasse] = useState<{ breite: number; hoehe: number } | null>(null)
  const [anzahl, setAnzahl] = useState<number | ''>('')

  /** Maße im Browser lesen, damit die Slide-Zahl sofort dasteht. */
  async function pruefeGesamtbild(dateien: FileList | null) {
    const d = dateien?.[0]
    if (!d) return

    setDatei(d)
    setFehler(null)
    setAnzahl('')

    try {
      const bild = await createImageBitmap(d)
      setMasse({ breite: bild.width, hoehe: bild.height })
      bild.close()
    } catch {
      setMasse(null)
    }
  }

  const erkannt = masse ? erkenneSlideAnzahl(masse.breite, masse.hoehe, verhaeltnis) : null
  const gewaehlt = anzahl === '' ? erkannt : anzahl
  const probe =
    masse && gewaehlt
      ? berechneAuftrennung(masse.breite, masse.hoehe, gewaehlt, verhaeltnis)
      : null

  async function einzelne(dateien: FileList | null) {
    if (!dateien?.length) return
    setLaeuft(true)
    setFehler(null)

    try {
      const { ok, daten } = await ladeHoch({
        dateien: Array.from(dateien),
        felder: { postId, ...(varianteId ? { varianteId } : {}), rolle: 'SLIDE', modus: 'einzeln' },
        aufFortschritt: setStand,
      })
      if (!ok) return setFehler(String(daten.fehler ?? 'Upload fehlgeschlagen.'))

      setHinweise((daten.hinweise as string[]) ?? [])
      router.refresh()
      if (((daten.hinweise as string[]) ?? []).length === 0) fertig()
    } catch (fehler) {
      setFehler(fehler instanceof Error ? fehler.message : 'Upload fehlgeschlagen.')
    } finally {
      setLaeuft(false)
      setStand(null)
    }
  }

  async function auftrennen() {
    if (!datei) return
    setLaeuft(true)
    setFehler(null)

    try {
      const { ok, daten } = await ladeHoch({
        dateien: [datei],
        felder: {
          postId,
          ...(varianteId ? { varianteId } : {}),
          modus: 'gesamtbild',
          ...(anzahl === '' ? {} : { anzahl: String(anzahl) }),
        },
        aufFortschritt: setStand,
      })
      if (!ok) return setFehler(String(daten.fehler ?? 'Das Bild konnte nicht aufgetrennt werden.'))

      router.refresh()
      fertig()
    } catch (fehler) {
      setFehler(fehler instanceof Error ? fehler.message : 'Upload fehlgeschlagen.')
    } finally {
      setLaeuft(false)
      setStand(null)
    }
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-2.5">
        {(
          [
            {
              wert: 'einzeln' as const,
              titel: 'Mehrere Einzelbilder',
              text: `Fertige ${VERHAELTNIS_TEXT[verhaeltnis]}-Grafiken. So viele, wie das Karussell haben soll — die Reihenfolge lässt sich danach ziehen.`,
            },
            {
              wert: 'gesamt' as const,
              titel: 'Ein Gesamtbild auftrennen',
              text: 'Ein durchlaufendes Motiv wird in gleich große Slides zerlegt.',
            },
          ] as const
        ).map((option) => (
          <label
            key={option.wert}
            className={`flex cursor-pointer gap-3 rounded-md border px-4 py-3 transition-colors ${
              weg === option.wert ? 'border-akzent bg-akzent-zart' : 'border-rahmen hover:border-rahmen-4'
            }`}
          >
            <input
              type="radio"
              name="weg"
              checked={weg === option.wert}
              onChange={() => setWeg(option.wert)}
              className="mt-0.5 accent-[var(--color-akzent)]"
            />
            <span>
              <span className="block text-[13px] font-medium text-tinte">{option.titel}</span>
              <span className="mt-0.5 block text-[11.5px] leading-relaxed text-leiser">{option.text}</span>
            </span>
          </label>
        ))}
      </div>

      {weg === 'einzeln' ? (
        <Ablage
          titel="Slides hierher ziehen"
          hinweis={`Erwartet werden ${VERHAELTNIS_TEXT[verhaeltnis]}-Grafiken, üblicherweise ${VERHAELTNIS_MASSE[verhaeltnis]} px.`}
          mehrere
          akzeptiert="image/jpeg,image/png,image/webp"
          laeuft={laeuft}
          aufDateien={(d) => void einzelne(d)}
        />
      ) : (
        <div className="grid gap-3">
          <Ablage
            titel={datei ? datei.name : 'Gesamtbild hierher ziehen'}
            hinweis={
              masse
                ? `${masse.breite} × ${masse.hoehe} px`
                : 'Ein breites Motiv über alle Slides hinweg.'
            }
            akzeptiert="image/jpeg,image/png,image/webp"
            laeuft={laeuft}
            aufDateien={(d) => void pruefeGesamtbild(d)}
          />

          {masse && (
            <>
              {erkannt ? (
                <Hinweis>
                  <strong>{erkannt} Slides erkannt</strong> — das Bild geht glatt im {VERHAELTNIS_TEXT[verhaeltnis]}-Raster auf.
                </Hinweis>
              ) : (
                <Fehler>
                  Die Bildbreite passt nicht ins 3:4-Raster: {masse.breite} × {masse.hoehe} px ergibt
                  keine ganze Zahl an Slides. Bitte die Bildgröße prüfen — ein Gesamtbild sollte ein
                  Vielfaches von 1080 × 1440 px sein.
                </Fehler>
              )}

              {erkannt && (
                <label className="flex flex-wrap items-center gap-3">
                  <span className="text-[12px] text-leise">Anzahl Slides</span>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={anzahl}
                    placeholder={String(erkannt)}
                    onChange={(e) => setAnzahl(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-24 rounded-[5px] border border-rahmen-3 bg-flaeche px-2.5 py-1.5 text-[12.5px]"
                  />
                  <span className="text-[11.5px] text-leiser">
                    leer lassen = {erkannt} (erkannt)
                  </span>
                </label>
              )}

              {probe && !probe.ok && <Fehler>{probe.fehler}</Fehler>}
              {probe?.ok && (
                <p className="text-[11.5px] text-leiser">
                  Ergibt {probe.anzahl} Slides à {probe.slideBreite} × {probe.slideHoehe} px
                  {!probe.exakt && ` — breiter als ${VERHAELTNIS_TEXT[verhaeltnis]}`}.
                </p>
              )}
            </>
          )}

          <div className="flex justify-end">
            <Knopf
              art="primaer"
              onClick={() => void auftrennen()}
              disabled={!datei || laeuft || !probe?.ok}
            >
              {laeuft ? 'Wird aufgetrennt …' : 'Slides erstellen'}
            </Knopf>
          </div>
        </div>
      )}

      <UploadBalken stand={stand} />
      {fehler && <Fehler>{fehler}</Fehler>}
      {hinweise.map((h) => (
        <Warnung key={h}>{h}</Warnung>
      ))}

      <p className="text-[11.5px] text-stiller">Das Original bleibt in der Bibliothek erhalten.</p>
    </div>
  )
}

// ------------------------------------------------------------ Einfacher Weg

function EinfachInhalt({
  postId,
  varianteId,
  rolle,
  titel,
  hinweis,
  video,
  fertig,
}: {
  postId: string
  varianteId?: string | null
  rolle: Rolle
  titel: string
  hinweis: string
  video?: boolean
  fertig: () => void
}) {
  const router = useRouter()
  const [laeuft, setLaeuft] = useState(false)
  const [stand, setStand] = useState<Fortschritt | null>(null)
  const [fehler, setFehler] = useState<string | null>(null)
  const [hinweise, setHinweise] = useState<string[]>([])

  async function hochladen(dateien: FileList | null) {
    if (!dateien?.length) return
    setLaeuft(true)
    setFehler(null)
    setHinweise([])

    try {
      const { ok, daten } = await ladeHoch({
        dateien: [dateien[0]],
        felder: { postId, ...(varianteId ? { varianteId } : {}), rolle, modus: 'einzeln' },
        aufFortschritt: setStand,
      })
      if (!ok) return setFehler(String(daten.fehler ?? 'Upload fehlgeschlagen.'))

      const warnungen = (daten.hinweise as string[]) ?? []
      setHinweise(warnungen)
      router.refresh()
      if (warnungen.length === 0) fertig()
    } catch (fehler) {
      setFehler(fehler instanceof Error ? fehler.message : 'Upload fehlgeschlagen.')
    } finally {
      setLaeuft(false)
      setStand(null)
    }
  }

  return (
    <div className="grid gap-3">
      <Ablage
        titel={titel}
        hinweis={hinweis}
        akzeptiert={
          video
            ? 'video/mp4,video/quicktime'
            : 'image/jpeg,image/png,image/webp'
        }
        laeuft={laeuft}
        aufDateien={(d) => void hochladen(d)}
      />
      <UploadBalken stand={stand} />
      {fehler && <Fehler>{fehler}</Fehler>}
      {hinweise.map((h) => (
        <Warnung key={h}>{h}</Warnung>
      ))}
    </div>
  )
}

// ------------------------------------------------------------------ Rahmen

export function MedienDialog({
  offen,
  schliessen,
  postId,
  varianteId,
  titel,
  typ,
  verhaeltnis,
  videoQuellen,
  videoUrl,
  videoHerkunft,
  thumbnailUrl,
  thumbnailAutomatisch,
}: {
  offen: boolean
  schliessen: () => void
  postId: string
  /**
   * Gesetzt, wenn der Dialog die Medien einer abweichenden Fassung füllt.
   * Alles andere bleibt gleich — dieselbe Route, dieselben Prüfungen.
   */
  varianteId?: string | null
  /** Ersetzt die Überschrift, damit man im Dialog weiß, wessen Medien man ändert. */
  titel?: string
  typ: PostTyp
  /** Bestimmt Zuschnitt-Erwartung und Karussell-Auftrennung. */
  verhaeltnis: Verhaeltnis
  /**
   * Die anderen beiden Wege zum Reel-Video — aus Klappe holen oder von einem
   * Link laden. Sie stehen gleichberechtigt neben der Ablage: Es ist
   * dieselbe Stelle im Post, nur eine andere Quelle.
   */
  videoQuellen?: ReactNode
  videoUrl?: string | null
  /**
   * Woher das gezeigte Video stammt. Die Klappe-Fassung liegt nicht bei
   * Preroll — das soll man ihr ansehen, sonst wundert man sich beim Export.
   */
  videoHerkunft?: 'MEDIUM' | 'KLAPPE' | null
  thumbnailUrl?: string | null
  /**
   * Aus dem Video gezogen statt hochgeladen. Dann zeigt die rechte Spalte
   * weiter ihre Ablage — sonst sähe es aus, als sei die Arbeit getan.
   */
  thumbnailAutomatisch?: boolean
}) {
  // „Ersetzen" blendet die Quellen einer Spalte wieder ein, ohne dass vorher
  // etwas gelöscht werden müsste.
  const [videoErsetzen, setVideoErsetzen] = useState(false)
  const [thumbErsetzen, setThumbErsetzen] = useState(false)

  useEffect(() => {
    if (!offen) {
      setVideoErsetzen(false)
      setThumbErsetzen(false)
    }
  }, [offen])
  // Solange der Dialog steht, soll die Seite dahinter still halten.
  useEffect(() => {
    if (!offen) return

    const vorher = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const beiTaste = (e: KeyboardEvent) => {
      if (e.key === 'Escape') schliessen()
    }
    window.addEventListener('keydown', beiTaste)

    return () => {
      document.body.style.overflow = vorher
      window.removeEventListener('keydown', beiTaste)
    }
  }, [offen, schliessen])

  if (!offen) return null

  /*
    Gehängt an den Seitenkörper, nicht dorthin, wo der Dialog steht.

    Beim Beitrag wäre das gleichgültig — bei einer Fassung nicht: Ihre Karte
    **ist** ein Formular, und die Klappe- und Link-Formulare im Dialog lägen
    darin verschachtelt. Ein `<form>` im `<form>` wirft der Browser still weg;
    die Knöpfe säßen da und täten nichts. Dieselbe Falle wie seinerzeit bei
    „Fassung anlegen".
  */
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-tinte/25 px-3 py-6 sm:px-6 sm:py-10"
      onClick={schliessen}
    >
      <div
        className={`w-full rounded-md border border-rahmen bg-flaeche p-5 shadow-xl sm:p-6 ${
          typ === 'REEL' ? 'max-w-[820px]' : 'max-w-[560px]'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-[16px] font-semibold">
              {titel ??
                (typ === 'REEL'
                  ? 'Video und Thumbnail'
                  : typ === 'KARUSSELL'
                    ? 'Karussell-Bilder'
                    : 'Grafik')}
            </h3>
            <p className="mt-1 text-[12.5px] text-leise">
              {typ === 'REEL'
                ? 'Zwei Sachen, zwei Wege: Das Video kann hochgeladen, aus Klappe geholt oder von einem Link geladen werden — das Thumbnail wird hochgeladen.'
                : typ === 'KARUSSELL'
                  ? 'Einzelne Slides oder ein Gesamtbild, das aufgetrennt wird.'
                  : `Ein Bild im Verhältnis ${VERHAELTNIS_TEXT[verhaeltnis]}.`}
            </p>
          </div>
          <button
            type="button"
            onClick={schliessen}
            className="text-[18px] leading-none text-still hover:text-tinte"
            aria-label="Schließen"
          >
            ×
          </button>
        </div>

        {typ === 'BEITRAG' && (
          <EinfachInhalt
            postId={postId}
            varianteId={varianteId}
            rolle="MEDIUM"
            titel="Grafik hierher ziehen"
            hinweis={`Erwartet: ${VERHAELTNIS_TEXT[verhaeltnis]}, üblicherweise ${VERHAELTNIS_MASSE[verhaeltnis]} px.`}
            fertig={schliessen}
          />
        )}

        {typ === 'KARUSSELL' && (
          <KarussellInhalt
            postId={postId}
            varianteId={varianteId}
            verhaeltnis={verhaeltnis}
            fertig={schliessen}
          />
        )}

        {typ === 'REEL' && (
          <div className="grid gap-6 sm:grid-cols-2">
            {/* ------------------------------------------------------ Video */}
            <div className="grid content-start gap-4">
              <h4 className="text-[10.5px] uppercase tracking-[0.1em] text-still">Video</h4>

              {videoUrl && !videoErsetzen ? (
                <>
                  {/* 9:16 in voller Spaltenbreite wäre über 700 px hoch — dann
                      stünde „Ersetzen" unter dem sichtbaren Bereich. */}
                  {/* Ohne Thumbnail davor: Hier wird geprüft, ob das richtige
                      Video liegt — dafür muss man das Video sehen, nicht das
                      Standbild. Im Geräterahmen liegt es später wieder oben. */}
                  <div className="mx-auto w-full max-w-[190px]">
                    <EinfacherPlayer quelle={videoUrl} thumbnail={null} />
                  </div>
                  {videoHerkunft === 'KLAPPE' && (
                    <p className="text-[11.5px] leading-snug text-leiser">
                      Fassung aus Klappe. Sie liegt dort und wird von dort abgespielt — Preroll
                      hält keine zweite Kopie.
                    </p>
                  )}
                  <Knopf klein onClick={() => setVideoErsetzen(true)}>
                    Ersetzen
                  </Knopf>
                </>
              ) : (
                <>
                  <EinfachInhalt
                    postId={postId}
                    varianteId={varianteId}
                    rolle="MEDIUM"
                    titel="Video hierher ziehen"
                    hinweis="Erwartet: 9:16. MP4 oder MOV."
                    video
                    fertig={() => setVideoErsetzen(false)}
                  />
                  {videoQuellen}
                  {videoUrl && (
                    <button
                      type="button"
                      onClick={() => setVideoErsetzen(false)}
                      className="text-[11.5px] text-stiller hover:text-tinte"
                    >
                      Abbrechen — bestehendes Video behalten
                    </button>
                  )}
                </>
              )}
            </div>

            {/* -------------------------------------------------- Thumbnail */}
            <div className="grid content-start gap-4">
              <h4 className="text-[10.5px] uppercase tracking-[0.1em] text-still">Thumbnail</h4>

              {thumbnailUrl && !thumbnailAutomatisch && !thumbErsetzen ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={thumbnailUrl}
                    alt="Thumbnail"
                    className="mx-auto aspect-[9/16] w-full max-w-[190px] rounded-[5px] border border-rahmen object-cover"
                  />
                  <Knopf klein onClick={() => setThumbErsetzen(true)}>
                    Ersetzen
                  </Knopf>
                </>
              ) : (
                <>
                  <EinfachInhalt
                    postId={postId}
                    varianteId={varianteId}
                    rolle="THUMBNAIL"
                    titel="Thumbnail hierher ziehen"
                    hinweis="Erwartet: 9:16. Im Profilraster wird davon der mittige 3:4-Ausschnitt gezeigt."
                    fertig={() => setThumbErsetzen(false)}
                  />
                  {thumbnailAutomatisch && (
                    <Hinweis>
                      Zurzeit steht dort ein Standbild aus dem Video. Ein eigenes Thumbnail
                      ersetzt es.
                    </Hinweis>
                  )}
                  {thumbnailUrl && !thumbnailAutomatisch && (
                    <button
                      type="button"
                      onClick={() => setThumbErsetzen(false)}
                      className="text-[11.5px] text-stiller hover:text-tinte"
                    >
                      Abbrechen — bestehendes Thumbnail behalten
                    </button>
                  )}
                </>
              )}
            </div>

            <div className="flex justify-end border-t border-rahmen pt-4 sm:col-span-2">
              <Knopf onClick={schliessen}>Fertig</Knopf>
            </div>
          </div>
        )}

      </div>
    </div>,
    document.body,
  )
}
