'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState, type DragEvent } from 'react'
import { Fehler, Knopf, Warnung } from './ui'

type Rolle = 'MEDIUM' | 'SLIDE' | 'THUMBNAIL'

async function hochladen(formular: FormData): Promise<{ ok: boolean; daten: Record<string, unknown> }> {
  const antwort = await fetch('/api/upload', { method: 'POST', body: formular })
  const daten = (await antwort.json()) as Record<string, unknown>
  return { ok: antwort.ok, daten }
}

/**
 * Drag-&-Drop-Fläche für ein einzelnes Medium (Beitragsbild, Reel-Video,
 * Reel-Thumbnail) oder für mehrere Karussell-Slides.
 */
export function MedienAblage({
  postId,
  rolle,
  beschriftung,
  hinweis,
  mehrere,
  vorhanden,
}: {
  postId: string
  rolle: Rolle
  beschriftung: string
  hinweis?: string
  mehrere?: boolean
  vorhanden?: React.ReactNode
}) {
  const router = useRouter()
  const eingabe = useRef<HTMLInputElement>(null)
  const [ueber, setUeber] = useState(false)
  const [laeuft, setLaeuft] = useState(false)
  const [warnungen, setWarnungen] = useState<string[]>([])
  const [fehler, setFehler] = useState<string | null>(null)

  async function verarbeite(dateien: FileList | null) {
    if (!dateien || dateien.length === 0) return
    setLaeuft(true)
    setFehler(null)
    setWarnungen([])

    const formular = new FormData()
    formular.set('postId', postId)
    formular.set('rolle', rolle)
    formular.set('modus', 'einzeln')
    for (const datei of Array.from(dateien)) formular.append('dateien', datei)

    const { ok, daten } = await hochladen(formular)
    setLaeuft(false)

    if (!ok) {
      setFehler(String(daten.fehler ?? 'Der Upload ist fehlgeschlagen.'))
      return
    }
    setWarnungen((daten.hinweise as string[]) ?? [])
    router.refresh()
  }

  return (
    <div className="grid gap-2.5">
      <div
        onDragOver={(e: DragEvent) => {
          e.preventDefault()
          setUeber(true)
        }}
        onDragLeave={() => setUeber(false)}
        onDrop={(e: DragEvent) => {
          e.preventDefault()
          setUeber(false)
          void verarbeite(e.dataTransfer.files)
        }}
        onClick={() => eingabe.current?.click()}
        className={`cursor-pointer rounded-md border border-dashed px-5 py-6 text-center transition-colors ${
          ueber ? 'border-akzent bg-akzent-zart' : 'border-rahmen-3 bg-flaeche-leise hover:border-rahmen-4'
        }`}
      >
        {vorhanden}
        <p className="text-[12.5px] font-medium text-tinte-3">
          {laeuft ? 'Wird hochgeladen …' : beschriftung}
        </p>
        {hinweis && <p className="mt-1 text-[11.5px] leading-relaxed text-leiser">{hinweis}</p>}
        <input
          ref={eingabe}
          type="file"
          hidden
          multiple={mehrere}
          accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime"
          onChange={(e) => void verarbeite(e.target.files)}
        />
      </div>

      {fehler && <Fehler>{fehler}</Fehler>}
      {warnungen.map((w) => (
        <Warnung key={w}>{w}</Warnung>
      ))}
    </div>
  )
}

/**
 * Karussell-Upload mit den zwei Wegen aus dem Konzept: mehrere Einzelbilder
 * oder ein Gesamtbild, das automatisch aufgetrennt wird.
 */
export function KarussellDialog({
  postId,
  offen,
  schliessen,
}: {
  postId: string
  offen: boolean
  schliessen: () => void
}) {
  const router = useRouter()
  const [weg, setWeg] = useState<'einzeln' | 'gesamt'>('einzeln')
  const [datei, setDatei] = useState<File | null>(null)
  const [anzahl, setAnzahl] = useState<number | ''>('')
  const [laeuft, setLaeuft] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)
  const [erfolg, setErfolg] = useState<string | null>(null)

  if (!offen) return null

  async function einzelneHochladen(dateien: FileList | null) {
    if (!dateien?.length) return
    setLaeuft(true)
    setFehler(null)

    const formular = new FormData()
    formular.set('postId', postId)
    formular.set('rolle', 'SLIDE')
    formular.set('modus', 'einzeln')
    for (const d of Array.from(dateien)) formular.append('dateien', d)

    const { ok, daten } = await hochladen(formular)
    setLaeuft(false)
    if (!ok) return setFehler(String(daten.fehler ?? 'Upload fehlgeschlagen.'))

    router.refresh()
    schliessen()
  }

  async function gesamtbildAuftrennen() {
    if (!datei) return
    setLaeuft(true)
    setFehler(null)
    setErfolg(null)

    const formular = new FormData()
    formular.set('postId', postId)
    formular.set('modus', 'gesamtbild')
    formular.append('dateien', datei)
    if (anzahl !== '') formular.set('anzahl', String(anzahl))

    const { ok, daten } = await hochladen(formular)
    setLaeuft(false)

    if (!ok) return setFehler(String(daten.fehler ?? 'Das Bild konnte nicht aufgetrennt werden.'))

    setErfolg(
      `${daten.anzahl} Slides à ${daten.slideBreite} × ${daten.slideHoehe} px erstellt.` +
        (daten.exakt === false ? ' Hinweis: die Slides sind breiter als 4:5.' : ''),
    )
    router.refresh()
    setTimeout(schliessen, 1200)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-tinte/25 px-6">
      <div className="w-full max-w-[520px] rounded-md border border-rahmen bg-flaeche p-6 shadow-xl">
        <div className="mb-5 flex items-start justify-between gap-4">
          <h3 className="text-[16px] font-semibold">Karussell-Bilder hinzufügen</h3>
          <button
            type="button"
            onClick={schliessen}
            className="text-[18px] leading-none text-still hover:text-tinte"
            aria-label="Schließen"
          >
            ×
          </button>
        </div>

        <div className="mb-5 grid gap-2.5">
          {(
            [
              {
                wert: 'einzeln' as const,
                titel: 'Mehrere Einzelbilder',
                text: 'Fertige 4:5-Grafiken — die Reihenfolge entspricht der Auswahl und lässt sich danach ziehen.',
              },
              {
                wert: 'gesamt' as const,
                titel: 'Ein Gesamtbild auftrennen',
                text: 'Ein breites Motiv wird in gleich große Slides zerlegt — für durchlaufende Panoramen.',
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
                <span className="mt-0.5 block text-[11.5px] leading-relaxed text-leiser">
                  {option.text}
                </span>
              </span>
            </label>
          ))}
        </div>

        {weg === 'einzeln' ? (
          <div>
            <input
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => void einzelneHochladen(e.target.files)}
              className="w-full rounded-[5px] border border-rahmen-3 bg-flaeche px-3 py-2 text-[12.5px]"
            />
            <p className="mt-2 text-[11.5px] leading-relaxed text-leiser">
              Erwartet werden 4:5-Grafiken, üblicherweise 1080 × 1350 px.
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => {
                setDatei(e.target.files?.[0] ?? null)
                setFehler(null)
                setErfolg(null)
              }}
              className="w-full rounded-[5px] border border-rahmen-3 bg-flaeche px-3 py-2 text-[12.5px]"
            />

            <label className="flex items-center gap-3">
              <span className="text-[12px] text-leise">Anzahl Slides</span>
              <input
                type="number"
                min={1}
                max={20}
                value={anzahl}
                placeholder="automatisch"
                onChange={(e) => setAnzahl(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-28 rounded-[5px] border border-rahmen-3 bg-flaeche px-2.5 py-1.5 text-[12.5px]"
              />
              <span className="text-[11.5px] text-leiser">
                leer lassen = automatisch erkennen
              </span>
            </label>

            <Knopf art="primaer" onClick={() => void gesamtbildAuftrennen()} disabled={!datei || laeuft}>
              {laeuft ? 'Wird aufgetrennt …' : 'Slides erstellen'}
            </Knopf>
          </div>
        )}

        {fehler && (
          <div className="mt-4">
            <Fehler>{fehler}</Fehler>
          </div>
        )}
        {erfolg && (
          <div className="mt-4 rounded-[5px] border border-[#cfe4d6] bg-final-flaeche px-3.5 py-2.5 text-[12.5px] text-final">
            {erfolg}
          </div>
        )}

        <p className="mt-5 text-[11.5px] text-stiller">
          Das Original bleibt in der Bibliothek erhalten.
        </p>
      </div>
    </div>
  )
}
