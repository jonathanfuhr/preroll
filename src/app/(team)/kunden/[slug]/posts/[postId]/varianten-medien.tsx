'use client'

import { useRef, useState } from 'react'
import { ladeHoch, type Fortschritt } from '@/lib/hochladen'
import { Fehler, Knopf, Warnung } from '@/components/ui'

export type VariantenMedium = {
  /** Die Zuordnung, nicht das Medium — sie wird gelöst, die Datei bleibt. */
  id: string
  url: string
  istVideo: boolean
}

/**
 * Die eigenen Medien einer Fassung: zeigen, hochladen, wieder lösen.
 *
 * **Leer heißt geerbt** — dann gilt, was am Beitrag hängt. Deshalb steht hier
 * kein „kein Medium"-Fehler, sondern der Hinweis, was stattdessen greift; und
 * das Lösen des letzten Mediums ist kein Sonderfall, sondern der Weg zurück
 * zum geerbten Stand.
 *
 * Hochgeladen wird über **dieselbe** Route wie am Beitrag (`/api/upload` mit
 * `varianteId`). Dort hängen Blockupload, Formatprüfung, Transparenzwarnung
 * und die Karussell-Auftrennung; ein zweiter Weg daneben wäre eine zweite
 * Stelle, an der das auseinanderläuft.
 */
export function VariantenMedien({
  postId,
  varianteId,
  typ,
  medien,
  entfernen,
}: {
  postId: string
  varianteId: string
  typ: 'REEL' | 'KARUSSELL' | 'BEITRAG'
  medien: VariantenMedium[]
  entfernen: (varianteMediumId: string) => Promise<void>
}) {
  const feld = useRef<HTMLInputElement>(null)
  const [stand, setStand] = useState<Fortschritt | null>(null)
  const [fehler, setFehler] = useState<string | null>(null)
  const [hinweise, setHinweise] = useState<string[]>([])

  // Beim Karussell sind es Slides, sonst das eine Medium.
  const rolle = typ === 'KARUSSELL' ? 'SLIDE' : 'MEDIUM'

  async function nimm(dateien: FileList | null) {
    if (!dateien || dateien.length === 0) return
    setFehler(null)
    setHinweise([])

    const ergebnis = await ladeHoch({
      dateien: [...dateien],
      felder: { postId, varianteId, rolle, modus: 'einzeln' },
      aufFortschritt: setStand,
    })

    setStand(null)
    if (feld.current) feld.current.value = ''

    if (!ergebnis.ok) {
      setFehler(String(ergebnis.daten.fehler ?? 'Der Upload ist nicht durchgegangen.'))
      return
    }
    setHinweise((ergebnis.daten.hinweise as string[]) ?? [])
    // Die Liste kommt vom Server — nach dem Upload neu holen lassen.
    location.reload()
  }

  return (
    <div className="grid gap-2.5">
      {medien.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {medien.map((m) => (
            <div key={m.id} className="relative">
              {m.istVideo ? (
                <video src={m.url} className="h-20 w-16 rounded-[3px] bg-black object-cover" muted />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.url} alt="" className="h-20 w-16 rounded-[3px] object-cover" />
              )}
              <form action={entfernen.bind(null, m.id)} className="absolute right-1 top-1">
                <button
                  type="submit"
                  aria-label="Medium lösen"
                  title="Lösen — die Datei bleibt in der Bibliothek"
                  className="flex size-5 items-center justify-center rounded-full bg-black/55 text-[11px] leading-none text-white backdrop-blur transition-colors hover:bg-black/75"
                >
                  ×
                </button>
              </form>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[11.5px] leading-relaxed text-leiser">
          Ohne eigene Medien gilt, was am Beitrag hängt. Ein eigenes Format wirkt erst mit eigenen
          Medien — sonst stünde das geerbte Bild in einer Fläche, für die es nicht gemacht ist.
        </p>
      )}

      {stand && (
        <p className="text-[11.5px] text-leise">
          {stand.dateiname} — {Math.round(stand.anteil * 100)} %
          {stand.dateiAnzahl > 1 && ` (${stand.dateiNummer} von ${stand.dateiAnzahl})`}
        </p>
      )}

      {fehler && <Fehler>{fehler}</Fehler>}
      {hinweise.map((h) => (
        <Warnung key={h}>{h}</Warnung>
      ))}

      <div>
        <input
          ref={feld}
          type="file"
          hidden
          accept={typ === 'REEL' ? 'video/*' : 'image/*'}
          multiple={typ === 'KARUSSELL'}
          onChange={(e) => void nimm(e.currentTarget.files)}
        />
        <Knopf klein art="leise" type="button" onClick={() => feld.current?.click()}>
          {medien.length > 0 ? 'Medien ersetzen' : 'Eigene Medien hochladen'}
        </Knopf>
      </div>
    </div>
  )
}
