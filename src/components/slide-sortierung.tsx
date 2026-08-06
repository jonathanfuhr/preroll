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

export type Slide = { id: string; url: string }

function SortierbarerSlide({ slide, nummer }: { slide: Slide; nummer: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: slide.id,
  })

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
      }}
      {...attributes}
      {...listeners}
      className="relative cursor-grab touch-none active:cursor-grabbing"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={slide.url}
        alt={`Slide ${nummer}`}
        className="aspect-[4/5] w-full rounded-[3px] border border-rahmen object-cover"
        draggable={false}
      />
      <span className="absolute left-1 top-1 rounded-[3px] bg-black/55 px-1.5 py-px font-mono text-[9.5px] text-white">
        {nummer}
      </span>
    </div>
  )
}

/**
 * Karussell-Slides per Ziehen sortieren. Die Reihenfolge wird sofort
 * gespeichert — ein „Speichern"-Knopf für eine Geste, deren Ergebnis man
 * schon sieht, wäre eine Zumutung.
 */
export function SlideSortierung({
  slides,
  reihenfolgeSpeichern,
}: {
  slides: Slide[]
  reihenfolgeSpeichern: (ids: string[]) => Promise<void>
}) {
  const router = useRouter()
  const [reihenfolge, setReihenfolge] = useState(slides)
  const [laeuft, starte] = useTransition()

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

  if (reihenfolge.length === 0) return null

  return (
    <div>
      <DndContext sensors={sensoren} collisionDetection={closestCenter} onDragEnd={beimLoslassen}>
        <SortableContext items={reihenfolge.map((s) => s.id)} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-2">
            {reihenfolge.map((slide, index) => (
              <SortierbarerSlide key={slide.id} slide={slide} nummer={index + 1} />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <p className="mt-2 text-[11.5px] text-stiller">
        {laeuft ? 'Reihenfolge wird gespeichert …' : 'Slides zum Sortieren ziehen.'}
      </p>
    </div>
  )
}
