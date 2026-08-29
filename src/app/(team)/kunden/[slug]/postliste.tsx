'use client'

import type { Freigabestufe, Plattform, PostStatus, PostTyp, Verhaeltnis } from '@prisma/client'
import type { Veroeffentlichungslage } from '@/lib/status'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { PlattformMarken } from '@/components/plattform-marken'
import { Karte, Leerzustand, StatusBadge, TypBadge } from '@/components/ui'
import { Sammelleiste } from './sammelleiste'
import { TerminKnopf } from './termin-knopf'
import { ZeilenMenue } from './zeilen-menue'
import { kalenderwoche } from '@/lib/format'
import { istInterneStufe, STUFE_TEXT } from '@/lib/freigabe'

const MONAT = new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' })

export type Filter = 'alle' | 'freigabe' | 'kommentare'

export type Postzeile = {
  id: string
  typ: PostTyp
  verhaeltnis: Verhaeltnis
  status: PostStatus
  titel: string
  kurzbeschreibung: string | null
  postenAm: Date | null
  veroeffentlichungen: Veroeffentlichungslage
  /** Wohin der Beitrag geht — leer heißt: nirgendwohin. */
  plattformen: Plattform[]
  bild: string | null
  slides: number
  wer: string | null
  kommentare: number
  /** Welche Freigabe in dieser Phase ansteht; null bei Final. */
  freigabeStufe: Freigabestufe | null
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
  standardUhrzeit,
}: {
  slug: string
  zeilen: Postzeile[]
  suche: string
  filter: Filter
  /** Jüngster Export-Link des Kunden — der, den man gerade herumreicht. */
  freigabeLink: { token: string; titel: string | null } | null
  /** Vorbelegung im Termin-Fenster, wenn ein Beitrag noch ungeplant ist. */
  standardUhrzeit: string
}) {
  const [suche, setSuche] = useState(startSuche)
  const [filter, setFilter] = useState<Filter>(startFilter)
  const [kopiert, setKopiert] = useState(false)
  /*
    Die Auswahl für den Sammelzugriff. Als Menge und nicht als Feld an der
    Zeile: Sie überlebt so das Umstellen von Suche und Filter, und wer nach
    „Recruiting" sucht, drei anhakt und dann nach „Team" sucht, hat die drei
    noch. Beim Ausführen wird gegen die sichtbaren Zeilen geschnitten — was
    man nicht sieht, löscht man nicht.
  */
  const [ausgewaehlt, setAusgewaehlt] = useState<Set<string>>(new Set())

  const umschalten = (id: string) =>
    setAusgewaehlt((vorher) => {
      const neu = new Set(vorher)
      if (neu.has(id)) neu.delete(id)
      else neu.add(id)
      return neu
    })

  /** Eine ganze Gruppe an- oder abwählen — je nachdem, was überwiegt. */
  const gruppeUmschalten = (ids: string[]) =>
    setAusgewaehlt((vorher) => {
      const neu = new Set(vorher)
      const alleDrin = ids.every((id) => neu.has(id))
      for (const id of ids) {
        if (alleDrin) neu.delete(id)
        else neu.add(id)
      }
      return neu
    })

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

  // Nur was gerade in der Liste steht: Ein Filterwechsel darf keine Beiträge
  // mit in eine Sammelaktion nehmen, die niemand mehr vor sich sieht.
  const sichtbarAusgewaehlt = gefiltert.filter((z) => ausgewaehlt.has(z.id)).map((z) => z.id)
  const alleSichtbaren = gefiltert.map((z) => z.id)

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

      <Sammelleiste
        slug={slug}
        ids={sichtbarAusgewaehlt}
        aufAufheben={() => setAusgewaehlt(new Set())}
      />

      {gefiltert.length === 0 ? (
        <Leerzustand titel="Nichts gefunden" text="Andere Suche oder anderer Filter." />
      ) : (
        <Karte className="overflow-hidden">
          {/*
            Neun Spalten passen auf kein Telefon. Statt sie dort wegzulassen
            — und jemanden vor einer Liste sitzen zu lassen, die weniger
            zeigt als der Rechner — rollt die Tabelle waagerecht in ihrer
            Karte. Die Seite selbst bleibt dabei stehen.
          */}
          <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-[13px] md:min-w-[820px]">
            <thead>
              <tr className="border-b border-rahmen bg-flaeche-leise text-left">
                {/*
                  Die KW steht am Telefon nicht mit: Sie lässt sich aus dem
                  Datum daneben ablesen, und die 55 px entscheiden darüber,
                  ob der Titel ohne Rollen im Bild ist.
                */}
                <th className="w-8 px-2 py-2.5 md:px-3">
                  <Kaestchen
                    an={alleSichtbaren.length > 0 && sichtbarAusgewaehlt.length === alleSichtbaren.length}
                    teils={sichtbarAusgewaehlt.length > 0}
                    beschriftung="Alle sichtbaren Beiträge auswählen"
                    aufKlick={() => gruppeUmschalten(alleSichtbaren)}
                  />
                </th>
                {['', 'KW', 'Datum', 'Typ', 'Titel', 'Status', 'Freigabe', 'Wer', 'Kommentare', ''].map((kopf, i) => (
                  <th
                    key={i}
                    className={`px-3 py-2.5 text-[10.5px] font-medium uppercase tracking-[0.1em] text-still ${
                      kopf === 'KW' ? 'hidden md:table-cell' : ''
                    }`}
                  >
                    {kopf}
                  </th>
                ))}
              </tr>
            </thead>

            {abschnitte.map((abschnitt) => (
              <tbody key={abschnitt.titel}>
                <tr>
                  {/* Der ganze Monat auf einmal — die häufigste Vorauswahl. */}
                  <td className="border-b border-rahmen bg-flaeche-leise/60 px-2 py-1.5 md:px-3">
                    <Kaestchen
                      an={abschnitt.zeilen.every((z) => ausgewaehlt.has(z.id))}
                      teils={abschnitt.zeilen.some((z) => ausgewaehlt.has(z.id))}
                      beschriftung={`Alle Beiträge aus ${abschnitt.titel} auswählen`}
                      aufKlick={() => gruppeUmschalten(abschnitt.zeilen.map((z) => z.id))}
                    />
                  </td>
                  <td
                    colSpan={9}
                    className="border-b border-rahmen bg-flaeche-leise/60 px-3 py-1.5 text-[10.5px] font-medium uppercase tracking-[0.1em] text-still"
                  >
                    {abschnitt.titel}
                  </td>
                </tr>

                {abschnitt.zeilen.map((zeile) => (
                  <tr
                    key={zeile.id}
                    className={`border-b border-rahmen last:border-b-0 hover:bg-flaeche-leise ${
                      ausgewaehlt.has(zeile.id) ? 'bg-akzent-zart' : ''
                    }`}
                  >
                    <td className="w-8 px-2 py-2 md:px-3">
                      <Kaestchen
                        an={ausgewaehlt.has(zeile.id)}
                        beschriftung={`${zeile.titel} auswählen`}
                        aufKlick={() => umschalten(zeile.id)}
                      />
                    </td>
                    <td className="w-11 px-2 py-2 md:w-14 md:px-3">
                      <Link href={`/kunden/${slug}/posts/${zeile.id}`} className="block">
                        {zeile.bild ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={zeile.bild}
                            alt=""
                            className="aspect-[3/4] w-7 rounded-[3px] object-cover md:w-9"
                          />
                        ) : (
                          <span className="schraffur block aspect-[3/4] w-7 rounded-[3px] border border-dashed border-rahmen-3 md:w-9" />
                        )}
                      </Link>
                    </td>
                    <td className="hidden px-3 py-2 font-mono text-[11.5px] text-still md:table-cell">
                      {zeile.postenAm ? kalenderwoche(zeile.postenAm) : '—'}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-tinte-3">
                      <TerminKnopf
                        postId={zeile.id}
                        postenAm={zeile.postenAm}
                        standardUhrzeit={standardUhrzeit}
                      />
                    </td>
                    <td className="px-3 py-2">
                      {/* Auch Typ und Titel führen in den Beitrag — das
                          Vorschaubild allein ist ein kleines Ziel. */}
                      <Link href={`/kunden/${slug}/posts/${zeile.id}`} className="text-tinte">
                        <TypBadge typ={zeile.typ} verhaeltnis={zeile.verhaeltnis} />
                        {zeile.typ === 'KARUSSELL' && zeile.slides > 0 && (
                          <span className="ml-1.5 text-[11px] text-still">{zeile.slides} Slides</span>
                        )}
                      </Link>
                      {/*
                        Zur Typspalte statt in eine eigene: Neun Spalten sind
                        genug, und „was für ein Beitrag" und „wohin er geht"
                        liest man ohnehin zusammen.
                      */}
                      <span className="ml-1.5 inline-flex align-middle">
                        <PlattformMarken plattformen={zeile.plattformen} groesse={12} />
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {/* Die ganze Zelle, nicht nur die Zeile mit dem Titel:
                          Wer die Kurzbeschreibung trifft, meint denselben
                          Beitrag. */}
                      <Link
                        href={`/kunden/${slug}/posts/${zeile.id}`}
                        className="group/titel block"
                      >
                        <span className="font-medium text-tinte group-hover/titel:text-akzent">
                          {zeile.titel}
                        </span>
                        {zeile.kurzbeschreibung && (
                          <p className="mt-0.5 line-clamp-1 text-[11.5px] text-leiser">
                            {zeile.kurzbeschreibung}
                          </p>
                        )}
                      </Link>
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge
                        status={zeile.status}
                        postenAm={zeile.postenAm}
                        veroeffentlichungen={zeile.veroeffentlichungen}
                      />
                    </td>
                    {/*
                      Die Freigabe **der laufenden Phase** — Haken oder Kreuz.
                      Welche gemeint ist, sagt die Phase daneben; bei Final
                      steht ein Strich, weil dort nichts mehr abzusegnen ist.
                      Der Titel nennt die Stufe im Klartext, damit ein Zeichen
                      allein nicht raten lässt.
                    */}
                    <td className="px-3 py-2">
                      <Freigabezeichen stufe={zeile.freigabeStufe} offen={zeile.freigabeOffen} />
                    </td>
                    <td className="px-3 py-2 text-[12px] text-leise">{zeile.wer ?? '—'}</td>
                    <td className="px-3 py-2 text-[12px] text-leise">{zeile.kommentare || '—'}</td>
                    <td className="px-3 py-2">
                      <ZeilenMenue postId={zeile.id} status={zeile.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
          </div>
        </Karte>
      )}
    </>
  )
}

/**
 * Ein Kästchen, das auch „teilweise" ausdrücken kann.
 *
 * Über die Monats- und Kopfzeile ist das der Normalfall: Drei von acht
 * Beiträgen gewählt ist weder an noch aus, und ein Kästchen, das dabei leer
 * aussieht, verschweigt die halbe Auswahl.
 */
function Kaestchen({
  an,
  teils,
  beschriftung,
  aufKlick,
}: {
  an: boolean
  teils?: boolean
  beschriftung: string
  aufKlick: () => void
}) {
  return (
    <input
      type="checkbox"
      checked={an}
      // `indeterminate` gibt es nur als Eigenschaft, nicht als Attribut.
      ref={(el) => {
        if (el) el.indeterminate = !an && Boolean(teils)
      }}
      onChange={aufKlick}
      aria-label={beschriftung}
      title={beschriftung}
      className="block size-4 cursor-pointer accent-[var(--color-akzent)]"
    />
  )
}

/**
 * Ob die Freigabe der laufenden Phase vorliegt.
 *
 * Ein Zeichen statt eines Wortes, weil die Spalte schmal bleiben soll — die
 * Tabelle rollt am Telefon ohnehin schon waagerecht. Was das Zeichen bedeutet,
 * steht im `title`; ein Haken ohne Erklärung ließe offen, *wessen* Freigabe
 * gemeint ist, und das ist je nach Phase das Team oder der Kunde.
 */
function Freigabezeichen({
  stufe,
  offen,
}: {
  stufe: Freigabestufe | null
  offen: boolean
}) {
  if (!stufe) {
    return (
      <span className="text-[12px] text-stiller" title="Final — hier ist nichts mehr abzusegnen">
        —
      </span>
    )
  }

  const wer = istInterneStufe(stufe) ? 'intern' : 'vom Kunden'
  return offen ? (
    <span
      className="text-[13px] font-semibold text-akzent"
      title={`${STUFE_TEXT[stufe]} noch nicht freigegeben (${wer})`}
      aria-label={`${STUFE_TEXT[stufe]} noch nicht freigegeben`}
    >
      ✗
    </span>
  ) : (
    <span
      className="text-[13px] font-semibold text-final"
      title={`${STUFE_TEXT[stufe]} freigegeben (${wer})`}
      aria-label={`${STUFE_TEXT[stufe]} freigegeben`}
    >
      ✓
    </span>
  )
}
