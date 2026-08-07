'use client'

import type { PostTyp } from '@prisma/client'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { kalenderwoche } from '@/lib/format'
import { postBezeichnung, standardVerhaeltnis } from '@/lib/verhaeltnis'
import { TYP_FARBE, TYP_TEXT, TypPunkt } from './ui'
import { WOCHENTAGE, gleicherTag, wochenDesMonats, type Kalendereintrag } from './kalender'

/**
 * Der Kalender im Backend kann mehr als der beim Kunden: Termine lassen sich
 * ziehen, und links stehen die Posts, die noch gar keinen haben. Deshalb ein
 * eigenes Bauteil statt Schalter am Kunden-Kalender — dort wäre jede Zeile
 * davon toter Ballast.
 */

const MAX_EINTRAEGE = 3

/** JJJJ-MM-TT eines lokalen Tages — die Kennung der Ablagefläche. */
function tagesSchluessel(tag: Date): string {
  const mm = String(tag.getMonth() + 1).padStart(2, '0')
  const tt = String(tag.getDate()).padStart(2, '0')
  return `${tag.getFullYear()}-${mm}-${tt}`
}

const UHRZEIT = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' })

// ---------------------------------------------------------------- Bausteine

function Streifen({ eintrag, klein }: { eintrag: Kalendereintrag; klein?: boolean }) {
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <span
        aria-hidden
        className="block size-[6px] shrink-0 rounded-full"
        style={{ background: TYP_FARBE[eintrag.typ] }}
      />
      <span
        className={`min-w-0 flex-1 truncate leading-none text-tinte-3 ${klein ? 'text-[9.5px]' : 'text-[11.5px]'}`}
      >
        {eintrag.titel}
      </span>
    </span>
  )
}

/** Ein Post, den man anfassen kann. Ohne Ziehen bleibt es ein Link. */
function ZiehbarerEintrag({
  eintrag,
  klein,
}: {
  eintrag: Kalendereintrag
  klein?: boolean
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: eintrag.id })

  const beschriftung = `${TYP_TEXT[eintrag.typ]} · ${eintrag.titel}${
    eintrag.postenAm ? ` · ${UHRZEIT.format(eintrag.postenAm)} Uhr` : ''
  }`

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      title={beschriftung}
      style={{ opacity: isDragging ? 0.3 : 1 }}
      className={`shrink-0 cursor-grab touch-none rounded-[3px] transition-colors active:cursor-grabbing hover:bg-flaeche-tief ${
        klein ? 'px-0.5 py-[3px]' : 'border border-rahmen bg-flaeche px-2 py-1.5'
      }`}
    >
      {eintrag.href ? (
        // Ein Klick soll weiterhin öffnen — dnd-kit unterdrückt ihn, sobald
        // tatsächlich gezogen wurde.
        <Link href={eintrag.href} draggable={false} className="block">
          <Streifen eintrag={eintrag} klein={klein} />
        </Link>
      ) : (
        <Streifen eintrag={eintrag} klein={klein} />
      )}
    </div>
  )
}

/** Eine Tageszelle, auf der ein Post landen kann. */
function Tageszelle({
  tag,
  imMonat,
  eintraege,
}: {
  tag: Date
  imMonat: boolean
  eintraege: Kalendereintrag[]
}) {
  const { setNodeRef, isOver } = useDroppable({ id: tagesSchluessel(tag) })

  const sichtbar = eintraege.slice(0, MAX_EINTRAEGE)
  const weitere = eintraege.length - sichtbar.length

  return (
    <div
      ref={setNodeRef}
      className={`flex h-[96px] min-w-0 flex-col overflow-hidden border-r border-rahmen px-1.5 py-1.5 transition-colors last:border-r-0 ${
        isOver ? 'bg-akzent-zart' : imMonat ? '' : 'bg-flaeche-leise/60'
      }`}
    >
      <span
        className={`block shrink-0 text-[10.5px] leading-none ${imMonat ? 'text-leise' : 'text-stiller'}`}
      >
        {tag.getDate()}
      </span>

      <div className="mt-1 flex min-h-0 flex-1 flex-col gap-[3px] overflow-hidden">
        {sichtbar.map((eintrag) => (
          <ZiehbarerEintrag key={eintrag.id} eintrag={eintrag} klein />
        ))}
        {weitere > 0 && (
          <span
            className="shrink-0 px-0.5 text-[9px] leading-none text-stiller"
            title={eintraege
              .slice(sichtbar.length)
              .map((e) => `${postBezeichnung(e.typ, e.verhaeltnis ?? standardVerhaeltnis(e.typ))} · ${e.titel}`)
              .join('\n')}
          >
            +{weitere} weitere
          </span>
        )}
      </div>
    </div>
  )
}

/** Die Ablage links: Posts ohne Termin — und Ziel zum Zurücklegen. */
function UngeplantSpalte({ eintraege }: { eintraege: Kalendereintrag[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'ungeplant' })

  return (
    <div
      ref={setNodeRef}
      className={`w-[228px] shrink-0 self-start rounded-md border p-3 transition-colors ${
        isOver ? 'border-akzent bg-akzent-zart' : 'border-rahmen bg-flaeche'
      }`}
    >
      <h3 className="text-[12.5px] font-medium text-tinte">Ungeplant</h3>
      <p className="mt-1 text-[11px] leading-relaxed text-leiser">
        Auf einen Tag ziehen — die Uhrzeit setzt Preroll aus den Stammdaten.
      </p>

      <div className="mt-3 grid gap-1.5">
        {eintraege.length === 0 ? (
          <p className="rounded-[5px] border border-dashed border-rahmen-3 px-3 py-5 text-center text-[11.5px] text-stiller">
            Alles terminiert.
          </p>
        ) : (
          eintraege.map((eintrag) => <ZiehbarerEintrag key={eintrag.id} eintrag={eintrag} />)
        )}
      </div>
    </div>
  )
}

// ------------------------------------------------------------------- Rahmen

export function KalenderPlanung({
  eintraege,
  startMonat,
  terminieren,
}: {
  eintraege: Kalendereintrag[]
  /** Monat, mit dem die Ansicht aufgeht. */
  startMonat: Date
  /** `tag` leer heißt: zurück in die Ungeplant-Spalte. */
  terminieren: (postId: string, tag: string | null) => Promise<void>
}) {
  const router = useRouter()
  const [, starteUebergang] = useTransition()
  const [monat, setMonat] = useState(
    () => new Date(startMonat.getFullYear(), startMonat.getMonth(), 1),
  )
  const [gezogen, setGezogen] = useState<Kalendereintrag | null>(null)
  // Verschobene Termine sofort zeigen, statt auf den Server zu warten.
  const [vorgriff, setVorgriff] = useState<Record<string, Date | null>>({})

  const sensoren = useSensors(
    // Erst ab ein paar Pixeln ziehen, sonst verschluckt jeder Klick den Link.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  )

  const alle = eintraege.map((e) =>
    e.id in vorgriff ? { ...e, postenAm: vorgriff[e.id] } : e,
  )
  const ungeplant = alle.filter((e) => !e.postenAm)
  const wochen = wochenDesMonats(monat)

  function beiStart(ereignis: DragStartEvent) {
    setGezogen(alle.find((e) => e.id === ereignis.active.id) ?? null)
  }

  function beiEnde(ereignis: DragEndEvent) {
    setGezogen(null)

    const ziel = ereignis.over?.id
    if (!ziel) return

    const postId = String(ereignis.active.id)
    const eintrag = alle.find((e) => e.id === postId)
    if (!eintrag) return

    if (ziel === 'ungeplant') {
      if (!eintrag.postenAm) return
      setVorgriff((v) => ({ ...v, [postId]: null }))
      starteUebergang(async () => {
        await terminieren(postId, null)
        router.refresh()
      })
      return
    }

    const [jahr, monatZahl, tagZahl] = String(ziel).split('-').map(Number)
    if (eintrag.postenAm && gleicherTag(eintrag.postenAm, new Date(jahr, monatZahl - 1, tagZahl))) {
      return
    }

    // Die Uhrzeit bleibt, was am Post steht; ohne Termin setzt der Server die
    // Standard-Uhrzeit des Kunden.
    const stunde = eintrag.postenAm?.getHours() ?? 0
    const minute = eintrag.postenAm?.getMinutes() ?? 0
    setVorgriff((v) => ({
      ...v,
      [postId]: new Date(jahr, monatZahl - 1, tagZahl, stunde, minute),
    }))

    starteUebergang(async () => {
      await terminieren(postId, String(ziel))
      router.refresh()
    })
  }

  const monatsName = new Intl.DateTimeFormat('de-DE', {
    month: 'long',
    year: 'numeric',
  }).format(monat)

  function versetzeMonat(schritte: number) {
    setMonat((m) => new Date(m.getFullYear(), m.getMonth() + schritte, 1))
  }

  return (
    <DndContext
      // Fester Name: ohne ihn zählt dnd-kit die Hilfstexte auf Server und
      // Client unterschiedlich durch, und React meldet einen Hydrationsbruch.
      id="kalender-planung"
      sensors={sensoren}
      collisionDetection={pointerWithin}
      onDragStart={beiStart}
      onDragEnd={beiEnde}
      onDragCancel={() => setGezogen(null)}
    >
      <div className="flex flex-wrap items-start gap-5">
        <UngeplantSpalte eintraege={ungeplant} />

        <div className="min-w-[520px] flex-1">
          <div className="mb-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => versetzeMonat(-1)}
                aria-label="Vorheriger Monat"
                className="flex size-7 items-center justify-center rounded-[5px] border border-rahmen-3 bg-flaeche text-[13px] text-leise transition-colors hover:text-tinte"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={() => versetzeMonat(1)}
                aria-label="Nächster Monat"
                className="flex size-7 items-center justify-center rounded-[5px] border border-rahmen-3 bg-flaeche text-[13px] text-leise transition-colors hover:text-tinte"
              >
                ›
              </button>
              <h3 className="ml-2 text-[15px] font-semibold capitalize text-tinte">{monatsName}</h3>
            </div>

            <div className="flex items-center gap-3.5">
              {(['REEL', 'KARUSSELL', 'BEITRAG'] as PostTyp[]).map((typ) => (
                <span key={typ} className="flex items-center gap-1.5 text-[10.5px] text-leiser">
                  <TypPunkt typ={typ} groesse={6} />
                  {TYP_TEXT[typ]}
                </span>
              ))}
            </div>
          </div>

          <div className="overflow-hidden rounded-md border border-rahmen bg-flaeche">
            <div className="grid grid-cols-[38px_repeat(7,1fr)] border-b border-rahmen bg-flaeche-leise">
              <span className="px-2 py-2 text-[9.5px] font-medium uppercase tracking-[0.1em] text-still">
                KW
              </span>
              {WOCHENTAGE.map((tag) => (
                <span key={tag} className="px-2 py-2 text-center text-[10.5px] font-medium text-still">
                  {tag}
                </span>
              ))}
            </div>

            {wochen.map((woche) => (
              <div
                key={woche[0].toISOString()}
                className="grid grid-cols-[38px_repeat(7,1fr)] border-b border-rahmen last:border-b-0"
              >
                <span className="flex items-start justify-center border-r border-rahmen bg-flaeche-leise px-1 py-2 font-mono text-[10.5px] text-still">
                  {kalenderwoche(woche[0])}
                </span>

                {woche.map((tag) => (
                  <Tageszelle
                    key={tag.toISOString()}
                    tag={tag}
                    imMonat={tag.getMonth() === monat.getMonth()}
                    eintraege={alle.filter((e) => e.postenAm && gleicherTag(e.postenAm, tag))}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {gezogen && (
          <div className="rounded-[3px] border border-akzent bg-flaeche px-2 py-1.5 shadow-lg">
            <Streifen eintrag={gezogen} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}
