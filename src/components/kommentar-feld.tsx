'use client'

import { useRef, useState } from 'react'
import { erwaehnungMarke, istIntern } from '@/lib/kommentar-text'

export type Erwaehnbar = { art: 'nutzer' | 'gast'; id: string; name: string; zusatz: string }

/**
 * Textfeld für Kommentare, mit @-Auswahl.
 *
 * Getippt wird ein sichtbarer Text, abgeschickt wird derselbe Text mit
 * Markierungen (`@[Name](n:id)`). Beides in einem Feld zu halten hieße, dem
 * Menschen davor die Kennungen zu zeigen — deshalb steht die Rohfassung in
 * einem versteckten Feld und die Anzeige bleibt sauber.
 *
 * Bewusst ohne Bibliothek: Es geht um ein Menü unter dem Cursor, nicht um
 * einen Editor. Die Liste ist so kurz, dass im Browser gefiltert wird.
 */
export function KommentarFeld({
  name = 'text',
  erwaehnbar,
  rows = 3,
  platzhalter,
  standardwert = '',
  autoFokus,
  intern,
}: {
  name?: string
  erwaehnbar: Erwaehnbar[]
  rows?: number
  platzhalter?: string
  standardwert?: string
  autoFokus?: boolean
  /** Nur im Backend: dort darf `#intern` einen Kommentar im Haus behalten. */
  intern?: boolean
}) {
  const feld = useRef<HTMLTextAreaElement>(null)
  const [wert, setWert] = useState(standardwert)
  const [suche, setSuche] = useState<{ ab: number; begriff: string } | null>(null)
  const [gewaehlt, setGewaehlt] = useState(0)

  // Wer schon im Text steht, wird beim Abschicken zur Markierung.
  const roh = erwaehnbar.reduce(
    (text, person) =>
      text.split(`@${person.name}`).join(erwaehnungMarke(person.art, person.id, person.name)),
    wert,
  )

  const treffer =
    suche === null
      ? []
      : erwaehnbar
          .filter((p) => p.name.toLowerCase().includes(suche.begriff.toLowerCase()))
          .slice(0, 6)

  /** Steht der Cursor hinter einem angefangenen @Wort? */
  function pruefeSuche(text: string, cursor: number) {
    const davor = text.slice(0, cursor)
    // Das @ muss am Wortanfang stehen — sonst löst jede Mailadresse aus.
    const start = /(?:^|\s)@([^\s@]{0,40})$/.exec(davor)
    if (!start) return setSuche(null)

    setSuche({ ab: cursor - start[1].length - 1, begriff: start[1] })
    setGewaehlt(0)
  }

  function setzeEin(person: Erwaehnbar) {
    if (!suche || !feld.current) return

    const cursor = feld.current.selectionStart
    const neu = `${wert.slice(0, suche.ab)}@${person.name} ${wert.slice(cursor)}`
    setWert(neu)
    setSuche(null)

    // Der Cursor gehört hinter den eingesetzten Namen, nicht ans Ende.
    const hinter = suche.ab + person.name.length + 2
    requestAnimationFrame(() => {
      feld.current?.focus()
      feld.current?.setSelectionRange(hinter, hinter)
    })
  }

  return (
    <div className="relative">
      <textarea
        ref={feld}
        rows={rows}
        required
        autoFocus={autoFokus}
        value={wert}
        placeholder={platzhalter}
        onChange={(e) => {
          setWert(e.target.value)
          pruefeSuche(e.target.value, e.target.selectionStart)
        }}
        onClick={(e) => pruefeSuche(wert, e.currentTarget.selectionStart)}
        onBlur={() => {
          // Erst nach dem Klick schließen — sonst verschwindet die Liste,
          // bevor die Auswahl ankommt.
          window.setTimeout(() => setSuche(null), 150)
        }}
        onKeyDown={(e) => {
          if (treffer.length === 0) return
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setGewaehlt((i) => (i + 1) % treffer.length)
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setGewaehlt((i) => (i - 1 + treffer.length) % treffer.length)
          } else if (e.key === 'Enter' || e.key === 'Tab') {
            e.preventDefault()
            setzeEin(treffer[gewaehlt])
          } else if (e.key === 'Escape') {
            setSuche(null)
          }
        }}
        className="w-full rounded-[5px] border border-rahmen-3 bg-flaeche px-3 py-2 text-[13px] leading-relaxed text-tinte placeholder:text-stiller focus:border-rahmen-4 focus:outline-none"
      />

      {/* Die Rohfassung mit den Kennungen — das ist, was der Server bekommt. */}
      <input type="hidden" name={name} value={roh} />

      {/*
        Die Marke wirkt beim Abschicken, deshalb sagt die Zeile schon beim
        Tippen, was sie tut. Wer sie nur erklärt bekäme, wenn er sie kennt,
        benutzte sie nie.
      */}
      {intern &&
        (istIntern(wert) ? (
          <p className="mt-1.5 text-[11px] font-medium text-akzent">
            Bleibt im Haus — der Kunde sieht diesen Kommentar nicht und bekommt keine Meldung.
          </p>
        ) : (
          <p className="mt-1.5 text-[11px] text-stiller">
            <span className="font-medium">#intern</span> schreiben, dann bleibt der Kommentar im
            Team.
          </p>
        ))}

      {treffer.length > 0 && (
        <ul className="absolute left-2 top-full z-30 mt-1 w-[240px] overflow-hidden rounded-md border border-rahmen bg-flaeche py-1 shadow-lg">
          {treffer.map((person, i) => (
            <li key={`${person.art}:${person.id}`}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setzeEin(person)}
                onMouseEnter={() => setGewaehlt(i)}
                className={`flex w-full items-baseline gap-2 px-3 py-1.5 text-left text-[12.5px] ${
                  i === gewaehlt ? 'bg-flaeche-tief text-tinte' : 'text-tinte-3'
                }`}
              >
                <span className="truncate font-medium">{person.name}</span>
                <span className="ml-auto shrink-0 text-[10.5px] text-stiller">{person.zusatz}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
