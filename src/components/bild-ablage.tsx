'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState, type DragEvent } from 'react'
import { Fehler, Knopf } from './ui'

/**
 * Profilbild hochladen — für Kundenlogos und Kontofotos. Rund dargestellt,
 * weil es überall rund erscheint.
 */
export function BildAblage({
  bild,
  kundeId,
  nutzerId,
  beschriftung,
  hinweis,
  eckig,
}: {
  bild: string | null
  kundeId?: string
  nutzerId?: string
  beschriftung: string
  hinweis?: string
  eckig?: boolean
}) {
  const router = useRouter()
  const eingabe = useRef<HTMLInputElement>(null)
  const [laeuft, setLaeuft] = useState(false)
  const [ueber, setUeber] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)

  async function hochladen(dateien: FileList | null) {
    const datei = dateien?.[0]
    if (!datei) return

    setLaeuft(true)
    setFehler(null)

    const formular = new FormData()
    formular.set('datei', datei)
    if (kundeId) formular.set('kundeId', kundeId)
    if (nutzerId) formular.set('nutzerId', nutzerId)

    const antwort = await fetch('/api/upload/logo', { method: 'POST', body: formular })
    const daten = (await antwort.json()) as { fehler?: string }
    setLaeuft(false)

    if (!antwort.ok) {
      setFehler(daten.fehler ?? 'Das Hochladen ist fehlgeschlagen.')
      return
    }
    router.refresh()
  }

  const rund = eckig ? 'rounded-lg' : 'rounded-full'

  return (
    <div className="grid gap-2.5">
      <div className="flex items-center gap-4">
        <div
          onDragOver={(e: DragEvent) => {
            e.preventDefault()
            setUeber(true)
          }}
          onDragLeave={() => setUeber(false)}
          onDrop={(e: DragEvent) => {
            e.preventDefault()
            setUeber(false)
            void hochladen(e.dataTransfer.files)
          }}
          onClick={() => eingabe.current?.click()}
          className={`flex size-20 shrink-0 cursor-pointer items-center justify-center overflow-hidden border transition-colors ${rund} ${
            ueber ? 'border-akzent bg-akzent-zart' : 'border-dashed border-rahmen-3 bg-flaeche-leise'
          }`}
        >
          {bild ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={bild} alt="" className="size-full object-cover" />
          ) : (
            <span className="px-2 text-center font-mono text-[9px] leading-tight text-leiser">
              {laeuft ? '…' : 'Bild'}
            </span>
          )}
        </div>

        <div>
          <div className="text-[13px] font-medium text-tinte">{beschriftung}</div>
          {hinweis && <p className="mt-0.5 text-[11.5px] leading-relaxed text-leiser">{hinweis}</p>}
          <div className="mt-2">
            <Knopf klein type="button" disabled={laeuft} onClick={() => eingabe.current?.click()}>
              {laeuft ? 'Wird geladen …' : bild ? 'Bild ersetzen' : 'Bild wählen'}
            </Knopf>
          </div>
        </div>
      </div>

      <input
        ref={eingabe}
        type="file"
        hidden
        accept="image/jpeg,image/png,image/webp"
        onChange={(e) => void hochladen(e.target.files)}
      />

      {fehler && <Fehler>{fehler}</Fehler>}
    </div>
  )
}
