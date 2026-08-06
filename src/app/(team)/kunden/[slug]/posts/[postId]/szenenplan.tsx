'use client'

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import { szeneAnlegen, szeneLoeschen, szenenSortieren, szeneSpeichern } from '../../aktionen'

export type Szene = {
  id: string
  position: number
  abschnitt: string
  bildSzene: string | null
  sprechertext: string | null
  texteinblendung: string | null
}

/** Vier Spalten wie in Mockup 2e — dieselben Breiten in Kopf und Zeile. */
const RASTER = 'grid-cols-[132px_minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,0.9fr)]'

const ABSCHNITTE = ['Hook', 'Intro', 'Szene', 'Abbinder']

function Griff() {
  return (
    <span aria-hidden className="grid shrink-0 grid-cols-2 gap-[3px]">
      {Array.from({ length: 6 }, (_, i) => (
        <span key={i} className="block size-[3px] bg-rahmen-4" />
      ))}
    </span>
  )
}

/**
 * Eine Zeile speichert für sich. Ein gemeinsames Formular über alle Szenen
 * wäre bequemer zu schreiben, würde aber bei jedem Tastendruck irgendwo alles
 * andere mitschicken — und beim Sortieren mit veralteten Werten überschreiben.
 */
function Szenenzeile({ szene, nummer }: { szene: Szene; nummer: number }) {
  const router = useRouter()
  const [, starteUebergang] = useTransition()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: szene.id,
  })

  // Der Serverstand gewinnt, sobald er sich ändert — etwa nach dem Sortieren.
  const [werte, setWerte] = useState({
    abschnitt: szene.abschnitt,
    bildSzene: szene.bildSzene ?? '',
    sprechertext: szene.sprechertext ?? '',
    texteinblendung: szene.texteinblendung ?? '',
  })
  useEffect(() => {
    setWerte({
      abschnitt: szene.abschnitt,
      bildSzene: szene.bildSzene ?? '',
      sprechertext: szene.sprechertext ?? '',
      texteinblendung: szene.texteinblendung ?? '',
    })
  }, [szene.abschnitt, szene.bildSzene, szene.sprechertext, szene.texteinblendung])

  function sichern(naechste: typeof werte) {
    const formular = new FormData()
    for (const [feld, wert] of Object.entries(naechste)) formular.set(feld, wert)
    starteUebergang(async () => {
      await szeneSpeichern(szene.id, formular)
    })
  }

  const feldStil =
    'w-full resize-none rounded-[4px] border border-transparent bg-transparent px-2 py-1 text-[12.5px] leading-relaxed text-tinte-3 transition-colors hover:border-rahmen hover:bg-flaeche-leise focus:border-rahmen-3 focus:bg-flaeche focus:outline-none'

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`group grid ${RASTER} items-start gap-[18px] border-b border-rahmen px-6 py-4 last:border-b-0 ${
        isDragging ? 'relative z-10 bg-flaeche shadow-lg' : 'hover:bg-flaeche-leise'
      }`}
    >
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`Szene ${nummer} verschieben`}
          className="cursor-grab touch-none py-1 active:cursor-grabbing"
        >
          <Griff />
        </button>

        <span className="flex size-[18px] shrink-0 items-center justify-center rounded-full bg-flaeche-tief text-[10px] font-semibold text-leise">
          {nummer}
        </span>

        <select
          value={werte.abschnitt}
          onChange={(e) => {
            const naechste = { ...werte, abschnitt: e.target.value }
            setWerte(naechste)
            sichern(naechste)
          }}
          className="min-w-0 flex-1 rounded-[4px] border border-transparent bg-transparent px-1 py-1 text-[12.5px] font-medium text-tinte transition-colors hover:border-rahmen hover:bg-flaeche-leise focus:border-rahmen-3 focus:outline-none"
        >
          {[...new Set([...ABSCHNITTE, werte.abschnitt])].map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </div>

      {(['bildSzene', 'sprechertext', 'texteinblendung'] as const).map((feld) => (
        <textarea
          key={feld}
          rows={2}
          value={werte[feld]}
          onChange={(e) => setWerte({ ...werte, [feld]: e.target.value })}
          // Der Wert kommt aus dem Element, nicht aus dem Zustand: Wer tippt
          // und sofort wegklickt, wäre sonst schneller als der nächste Render.
          onBlur={(e) => sichern({ ...werte, [feld]: e.target.value })}
          placeholder={
            feld === 'bildSzene'
              ? 'Was ist zu sehen?'
              : feld === 'sprechertext'
                ? 'Was wird gesagt?'
                : 'Texteinblendung'
          }
          className={feldStil}
        />
      ))}

      <button
        type="button"
        aria-label={`Szene ${nummer} löschen`}
        onClick={() =>
          starteUebergang(async () => {
            await szeneLoeschen(szene.id)
            router.refresh()
          })
        }
        className="absolute right-2 hidden text-[13px] leading-none text-stiller hover:text-akzent group-hover:block"
      >
        ×
      </button>
    </div>
  )
}

/**
 * Der Szenenplan aus Mockup 2e: vier Spalten, Zeilen zum Ziehen, Nummer und
 * Abschnitt links. Bislang stand hier nur ein Schalter — die Szenen selbst
 * waren nie gebaut.
 */
export function Szenenplan({ postId, szenen }: { postId: string; szenen: Szene[] }) {
  const router = useRouter()
  const [, starteUebergang] = useTransition()
  const [reihenfolge, setReihenfolge] = useState(szenen)
  useEffect(() => setReihenfolge(szenen), [szenen])

  const sensoren = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function beiEnde(ereignis: DragEndEvent) {
    const { active, over } = ereignis
    if (!over || active.id === over.id) return

    const von = reihenfolge.findIndex((s) => s.id === active.id)
    const nach = reihenfolge.findIndex((s) => s.id === over.id)
    const neu = arrayMove(reihenfolge, von, nach)
    setReihenfolge(neu)

    starteUebergang(async () => {
      await szenenSortieren(
        postId,
        neu.map((s) => s.id),
      )
      router.refresh()
    })
  }

  return (
    <div className="overflow-hidden rounded-md border border-rahmen bg-flaeche">
      <div className="flex items-center justify-between gap-4 border-b border-rahmen px-6 py-[18px]">
        <div>
          <div className="text-[13px] font-semibold text-tinte">
            Szenen <span className="font-normal text-still">· {reihenfolge.length}</span>
          </div>
          <p className="mt-[3px] text-[11.5px] text-leiser">
            Ziehen zum Sortieren · Änderungen werden beim Verlassen des Feldes gespeichert
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            starteUebergang(async () => {
              await szeneAnlegen(postId)
              router.refresh()
            })
          }
          className="shrink-0 rounded-[4px] border border-rahmen-3 bg-flaeche px-3.5 py-2 text-[12.5px] text-tinte transition-colors hover:border-akzent hover:text-akzent"
        >
          Szene hinzufügen
        </button>
      </div>

      {reihenfolge.length === 0 ? (
        <p className="px-6 py-8 text-center text-[12.5px] text-stiller">
          Noch keine Szene. Der Plan beginnt üblicherweise mit einem Hook.
        </p>
      ) : (
        <>
          <div
            className={`grid ${RASTER} gap-[18px] border-b border-rahmen bg-flaeche-leise px-6 py-[11px] text-[11px] uppercase tracking-[0.1em] text-still`}
          >
            <span>Abschnitt</span>
            <span>Bild / Szene</span>
            <span>Sprechertext</span>
            <span>Texteinblendung</span>
          </div>

          <DndContext
            id="szenenplan"
            sensors={sensoren}
            collisionDetection={closestCenter}
            onDragEnd={beiEnde}
          >
            <SortableContext
              items={reihenfolge.map((s) => s.id)}
              strategy={verticalListSortingStrategy}
            >
              {reihenfolge.map((szene, i) => (
                <div key={szene.id} className="relative">
                  <Szenenzeile szene={szene} nummer={i + 1} />
                </div>
              ))}
            </SortableContext>
          </DndContext>
        </>
      )}
    </div>
  )
}
