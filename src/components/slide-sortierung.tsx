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
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import { Knopf } from './ui'

export type Slide = { id: string; url: string }

/**
 * Sortieren ist standardmäßig **gesperrt**: Die Reihenfolge ist der Inhalt
 * des Beitrags, und sie beim Scrollen aus Versehen zu verschieben, fällt
 * womöglich erst dem Kunden auf. Erst der Bearbeiten-Knopf macht die Kacheln
 * beweglich — und dann auch löschbar.
 */
function SortierbarerSlide({
  slide,
  nummer,
  beweglich,
  aufLoeschen,
}: {
  slide: Slide
  nummer: number
  beweglich: boolean
  aufLoeschen: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: slide.id,
    disabled: !beweglich,
  })

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
      }}
      {...(beweglich ? attributes : {})}
      {...(beweglich ? listeners : {})}
      className={`relative ${beweglich ? 'cursor-grab touch-none active:cursor-grabbing' : ''}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={slide.url}
        alt={`Slide ${nummer}`}
        className={`aspect-[3/4] w-full rounded-[3px] border object-cover ${
          beweglich ? 'border-akzent/40' : 'border-rahmen'
        }`}
        draggable={false}
      />
      <span className="absolute left-1 top-1 rounded-[3px] bg-black/55 px-1.5 py-px font-mono text-[9.5px] text-white">
        {nummer}
      </span>

      {beweglich && (
        <button
          type="button"
          // Der Ziehgriff liegt auf der ganzen Kachel — ohne das hier begänne
          // der Klick aufs × als Ziehversuch.
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation()
            aufLoeschen()
          }}
          aria-label={`Slide ${nummer} entfernen`}
          className="absolute right-1 top-1 flex size-[18px] items-center justify-center rounded-full bg-black/55 text-[12px] leading-none text-white transition-colors hover:bg-akzent"
        >
          ×
        </button>
      )}
    </div>
  )
}

/**
 * Karussell-Slides per Ziehen sortieren. Die Reihenfolge wird sofort
 * gespeichert — ein „Speichern"-Knopf für eine Geste, deren Ergebnis man
 * schon sieht, wäre eine Zumutung.
 */
export function SlideSortierung({
  postId,
  slides,
  reihenfolgeSpeichern,
  entfernen,
  wiederherstellen,
}: {
  postId: string
  slides: Slide[]
  reihenfolgeSpeichern: (ids: string[]) => Promise<void>
  entfernen: (postId: string, mediumId: string) => Promise<void>
  wiederherstellen: (postId: string, mediumId: string, position: number) => Promise<void>
}) {
  const router = useRouter()
  const [reihenfolge, setReihenfolge] = useState(slides)
  const [bearbeiten, setBearbeiten] = useState(false)
  const [laeuft, starte] = useTransition()

  /** Der zuletzt entfernte Slide — für genau einen Schritt zurück. */
  const [zurueckholbar, setZurueckholbar] = useState<{ slide: Slide; position: number } | null>(
    null,
  )

  // Nach einem Upload kommen neue Slides von außen — dann gilt deren Reihenfolge.
  useEffect(() => {
    setReihenfolge(slides)
  }, [slides])

  const sensoren = useSensors(
    // Erst ab ein paar Pixeln ziehen, sonst verschluckt es jeden Klick.
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function beimLoslassen(ereignis: DragEndEvent) {
    const { active, over } = ereignis
    if (!over || active.id === over.id) return

    const von = reihenfolge.findIndex((s) => s.id === active.id)
    const nach = reihenfolge.findIndex((s) => s.id === over.id)
    if (von < 0 || nach < 0) return

    const neu = arrayMove(reihenfolge, von, nach)
    setReihenfolge(neu)

    starte(async () => {
      await reihenfolgeSpeichern(neu.map((s) => s.id))
      router.refresh()
    })
  }

  function loesche(slide: Slide, position: number) {
    setZurueckholbar({ slide, position })
    setReihenfolge((alt) => alt.filter((s) => s.id !== slide.id))

    starte(async () => {
      await entfernen(postId, slide.id)
      router.refresh()
    })
  }

  /**
   * Nur ein Schritt zurück, und nur für das Entfernen. Der Slide selbst
   * bleibt in der Bibliothek — zurückzuholen ist deshalb bloß die Zuordnung.
   */
  function holeZurueck() {
    const gemerkt = zurueckholbar
    if (!gemerkt) return
    setZurueckholbar(null)

    starte(async () => {
      await wiederherstellen(postId, gemerkt.slide.id, gemerkt.position)
      router.refresh()
    })
  }

  if (reihenfolge.length === 0 && !zurueckholbar) return null

  return (
    <div>
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-3">
        <span className="text-[11px] uppercase tracking-[0.1em] text-still">
          Slides · {reihenfolge.length}
        </span>

        <div className="flex items-center gap-2">
          {zurueckholbar && (
            <Knopf klein art="gefahr" onClick={holeZurueck} disabled={laeuft}>
              Entfernen rückgängig
            </Knopf>
          )}
          <Knopf
            klein
            art={bearbeiten ? 'primaer' : 'sekundaer'}
            onClick={() => setBearbeiten((v) => !v)}
          >
            {bearbeiten ? 'Fertig' : 'Bearbeiten'}
          </Knopf>
        </div>
      </div>

      <DndContext sensors={sensoren} collisionDetection={closestCenter} onDragEnd={beimLoslassen}>
        <SortableContext items={reihenfolge.map((s) => s.id)} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-2">
            {reihenfolge.map((slide, index) => (
              <SortierbarerSlide
                key={slide.id}
                slide={slide}
                nummer={index + 1}
                beweglich={bearbeiten}
                aufLoeschen={() => loesche(slide, index)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <p className="mt-2 text-[11.5px] text-stiller">
        {laeuft
          ? 'Wird gespeichert …'
          : bearbeiten
            ? 'Zum Sortieren ziehen · × entfernt einen Slide aus dem Beitrag.'
            : 'Zum Sortieren oder Entfernen auf „Bearbeiten".'}
      </p>
    </div>
  )
}
