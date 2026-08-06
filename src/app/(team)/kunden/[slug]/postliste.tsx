'use client'

import type { PostStatus, PostTyp } from '@prisma/client'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { Karte, Leerzustand, StatusBadge, TypBadge } from '@/components/ui'
import { kalenderwoche } from '@/lib/format'

const DATUM = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
const UHRZEIT = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' })
const MONAT = new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' })

export type Filter = 'alle' | 'freigabe' | 'kommentare'

export type Postzeile = {
  id: string
  typ: PostTyp
  status: PostStatus
  titel: string
  kurzbeschreibung: string | null
  postenAm: Date | null
  bild: string | null
  slides: number
  wer: string | null
  kommentare: number
  freigabeOffen: boolean
}

const FILTER: Array<{ wert: Filter; text: string }> = [
  { wert: 'alle', text: 'Alle' },
  { wert: 'freigabe', text: 'Freigabe offen' },
  { wert: 'kommentare', text: 'Neue Kommentare' },
]

/**
 * Die Liste nach Mockup 2b: Suchfeld und Filter über der Tabelle, darunter
 * Monatsüberschriften. Gesucht und gefiltert wird im Browser — die Menge an
 * Posts eines Kunden passt in eine Antwort, und ein Rundgang zum Server je
 * Tastendruck wäre nur langsamer.
 */
export function Postliste({
  slug,
  zeilen,
  suche: startSuche,
  filter: startFilter,
  freigabeLink,
}: {
  slug: string
  zeilen: Postzeile[]
  suche: string
  filter: Filter
  /** Jüngster Export-Link des Kunden — der, den man gerade herumreicht. */
  freigabeLink: { token: string; titel: string | null } | null
}) {
  const [suche, setSuche] = useState(startSuche)
  const [filter, setFilter] = useState<Filter>(startFilter)
  const [kopiert, setKopiert] = useState(false)

  const gefiltert = useMemo(() => {
    const begriff = suche.trim().toLowerCase()
    return zeilen.filter((zeile) => {
      if (filter === 'freigabe' && !zeile.freigabeOffen) return false
      if (filter === 'kommentare' && zeile.kommentare === 0) return false
      if (!begriff) return true
      return (
        zeile.titel.toLowerCase().includes(begriff) ||
        (zeile.kurzbeschreibung ?? '').toLowerCase().includes(begriff)
      )
    })
  }, [zeilen, suche, filter])

  // Monatsüberschriften: der Wechsel fällt beim Überfliegen sonst nicht auf.
  const abschnitte = useMemo(() => {
    const gruppen: Array<{ titel: string; zeilen: Postzeile[] }> = []
    for (const zeile of gefiltert) {
      const titel = zeile.postenAm ? MONAT.format(zeile.postenAm) : 'Ohne Termin'
      const letzte = gruppen.at(-1)
      if (letzte?.titel === titel) letzte.zeilen.push(zeile)
      else gruppen.push({ titel, zeilen: [zeile] })
    }
    return gruppen
  }, [gefiltert])

  return (
    <>
      {freigabeLink && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-rahmen bg-flaeche px-4 py-2.5">
          <div className="flex min-w-0 items-baseline gap-2.5">
            <span className="text-[10.5px] font-medium uppercase tracking-[0.1em] text-still">
              Freigabe-Link
            </span>
            <span className="truncate font-mono text-[11.5px] text-leise">
              /f/{freigabeLink.token}
            </span>
            <span className="truncate text-[11.5px] text-stiller">{freigabeLink.titel}</span>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <a
              href={`/f/${freigabeLink.token}`}
              target="_blank"
              rel="noreferrer"
              className="rounded-[5px] border border-rahmen-3 px-3 py-1 text-[12px] font-medium text-tinte hover:border-rahmen-4"
            >
              Ansehen
            </a>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(
                  `${window.location.origin}/f/${freigabeLink.token}`,
                )
                setKopiert(true)
                setTimeout(() => setKopiert(false), 1800)
              }}
              className="rounded-[5px] border border-rahmen-3 px-3 py-1 text-[12px] font-medium text-tinte hover:border-rahmen-4"
            >
              {kopiert ? 'Kopiert' : 'Kopieren'}
            </button>
          </div>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={suche}
          onChange={(e) => setSuche(e.target.value)}
          placeholder="Posts durchsuchen …"
          className="w-[260px] rounded-[5px] border border-rahmen-3 bg-flaeche px-3 py-1.5 text-[12.5px] text-tinte placeholder:text-stiller focus:border-rahmen-4 focus:outline-none"
        />

        <div className="flex overflow-hidden rounded-[5px] border border-rahmen-3">
          {FILTER.map((eintrag) => (
            <button
              key={eintrag.wert}
              type="button"
              onClick={() => setFilter(eintrag.wert)}
              aria-pressed={filter === eintrag.wert}
              className={`px-3.5 py-1.5 text-[12px] transition-colors ${
                filter === eintrag.wert
                  ? 'bg-tinte font-medium text-white'
                  : 'bg-flaeche text-leise hover:bg-flaeche-tief'
              }`}
            >
              {eintrag.text}
            </button>
          ))}
        </div>

        <span className="text-[11.5px] text-stiller">
          {gefiltert.length} von {zeilen.length}
        </span>
      </div>

      {gefiltert.length === 0 ? (
        <Leerzustand titel="Nichts gefunden" text="Andere Suche oder anderer Filter." />
      ) : (
        <Karte className="overflow-hidden">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-rahmen bg-flaeche-leise text-left">
                {['', 'KW', 'Datum', 'Typ', 'Titel', 'Status', 'Wer', 'Kommentare'].map((kopf, i) => (
                  <th
                    key={i}
                    className="px-3 py-2.5 text-[10.5px] font-medium uppercase tracking-[0.1em] text-still"
                  >
                    {kopf}
                  </th>
                ))}
              </tr>
            </thead>

            {abschnitte.map((abschnitt) => (
              <tbody key={abschnitt.titel}>
                <tr>
                  <td
                    colSpan={8}
                    className="border-b border-rahmen bg-flaeche-leise/60 px-3 py-1.5 text-[10.5px] font-medium uppercase tracking-[0.1em] text-still"
                  >
                    {abschnitt.titel}
                  </td>
                </tr>

                {abschnitt.zeilen.map((zeile) => (
                  <tr
                    key={zeile.id}
                    className="border-b border-rahmen last:border-b-0 hover:bg-flaeche-leise"
                  >
                    <td className="w-14 px-3 py-2">
                      <Link href={`/kunden/${slug}/posts/${zeile.id}`} className="block">
                        {zeile.bild ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={zeile.bild}
                            alt=""
                            className="aspect-[4/5] w-9 rounded-[3px] object-cover"
                          />
                        ) : (
                          <span className="schraffur block aspect-[4/5] w-9 rounded-[3px] border border-dashed border-rahmen-3" />
                        )}
                      </Link>
                    </td>
                    <td className="px-3 py-2 font-mono text-[11.5px] text-still">
                      {zeile.postenAm ? kalenderwoche(zeile.postenAm) : '—'}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-tinte-3">
                      {zeile.postenAm ? (
                        <>
                          {DATUM.format(zeile.postenAm)}
                          <span className="ml-1.5 text-still">{UHRZEIT.format(zeile.postenAm)}</span>
                        </>
                      ) : (
                        <span className="text-stiller">ungeplant</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <TypBadge typ={zeile.typ} />
                      {zeile.typ === 'KARUSSELL' && zeile.slides > 0 && (
                        <span className="ml-1.5 text-[11px] text-still">{zeile.slides} Slides</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <Link
                        href={`/kunden/${slug}/posts/${zeile.id}`}
                        className="font-medium text-tinte hover:text-akzent"
                      >
                        {zeile.titel}
                      </Link>
                      {zeile.kurzbeschreibung && (
                        <p className="mt-0.5 line-clamp-1 text-[11.5px] text-leiser">
                          {zeile.kurzbeschreibung}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge status={zeile.status} />
                    </td>
                    <td className="px-3 py-2 text-[12px] text-leise">{zeile.wer ?? '—'}</td>
                    <td className="px-3 py-2 text-[12px] text-leise">{zeile.kommentare || '—'}</td>
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </Karte>
      )}
    </>
  )
}
