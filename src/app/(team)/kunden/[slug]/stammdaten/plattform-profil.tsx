import { formatiereTag } from '@/lib/datum'
import { istGepflegt, type Profilwerte } from '@/lib/plattform-profil'
import { Eingabe, Feld, Knopf } from '@/components/ui'
import { SpeichernKnopf } from '@/components/speichern-knopf'

/**
 * Die Angaben zu einem Profil: Handle, Bio, Website und die drei Zahlen.
 *
 * Ein Formular je Plattform, nicht eines für alle. Gemeinsam hätte das Speichern
 * von LinkedIn die Instagram-Felder mitgeschickt — und wer dort nichts
 * eingetragen hat, hätte gepflegte Werte geleert.
 *
 * Welche Felder eine Plattform braucht, unterscheidet sich: Nur Instagram zeigt
 * Bio und Website (die stehen in der Feed-Vorschau), und „Gefolgt" gibt es bei
 * einer Firmenseite nicht.
 */
export function ProfilFelder({
  speichern,
  werte,
  handleBeschriftung,
  handleHinweis,
  handlePlatzhalter,
  mitBio,
  mitGefolgt,
  mitLikes,
  beitraegeBeschriftung = 'Beiträge',
  /** Steht neben dem Speichern-Knopf, etwa der Abruf von Instagram. */
  nebenKnopf,
  /** Formular-Kennung für Knöpfe, die außerhalb stehen. */
  id,
}: {
  speichern: (formular: FormData) => Promise<void>
  werte: Profilwerte
  handleBeschriftung: string
  handleHinweis?: string
  handlePlatzhalter?: string
  mitBio?: boolean
  /** Nur TikTok führt die Summe der Herzen über alle Videos. */
  mitLikes?: boolean
  mitGefolgt?: boolean
  beitraegeBeschriftung?: string
  nebenKnopf?: React.ReactNode
  id?: string
}) {
  return (
    <form action={speichern} id={id} className="grid gap-4">
      <Feld beschriftung={handleBeschriftung} hinweis={handleHinweis}>
        <Eingabe name="handle" defaultValue={werte.handle ?? ''} placeholder={handlePlatzhalter} />
      </Feld>

      {mitBio && (
        <>
          <Feld beschriftung="Bio" hinweis="Erscheint in der Feed-Vorschau unter dem Namen.">
            <Eingabe name="bio" defaultValue={werte.bio ?? ''} />
          </Feld>
          <Feld beschriftung="Website">
            <Eingabe name="website" defaultValue={werte.website ?? ''} />
          </Feld>
        </>
      )}

      <div className="border-t border-rahmen pt-4">
        <h4 className="mb-1 text-[13px] font-semibold">Kennzahlen</h4>
        <p className="mb-3 text-[11.5px] leading-relaxed text-leiser">
          {istGepflegt(werte) && werte.standAm
            ? `Stand ${formatiereTag(werte.standAm, { dateStyle: 'long' })}${
                werte.quelle === 'MANUELL' ? ', von Hand eingetragen' : ', automatisch geholt'
              }.`
            : 'Noch nichts eingetragen.'}
        </p>

        {nebenKnopf}

        <div
          className={`grid gap-4 ${
            [mitGefolgt, mitLikes].filter(Boolean).length === 2
              ? 'grid-cols-2 sm:grid-cols-4'
              : mitGefolgt || mitLikes
                ? 'grid-cols-3'
                : 'grid-cols-2'
          }`}
        >
          <Feld beschriftung={beitraegeBeschriftung}>
            <Eingabe name="beitraege" inputMode="numeric" defaultValue={werte.beitraege ?? ''} />
          </Feld>
          <Feld beschriftung="Follower">
            <Eingabe name="follower" inputMode="numeric" defaultValue={werte.follower ?? ''} />
          </Feld>
          {mitGefolgt && (
            <Feld beschriftung="Gefolgt">
              <Eingabe name="gefolgt" inputMode="numeric" defaultValue={werte.gefolgt ?? ''} />
            </Feld>
          )}
          {mitLikes && (
            <Feld beschriftung="Likes">
              <Eingabe name="likes" inputMode="numeric" defaultValue={werte.likes ?? ''} />
            </Feld>
          )}
        </div>
      </div>

      {/*
        Still, nicht im Akzent. Die Stammdaten bestehen aus einem Dutzend
        gleichrangiger Abschnitte, und jeder speichert für sich — zwölf rote
        Knöpfe auf einer Seite entwerten die Farbe, und einzelne rote zwischen
        stillen lassen einen Abschnitt wichtiger aussehen, als er ist. Der
        Akzent bleibt dem vorbehalten, was etwas auslöst: anlegen, senden,
        koppeln, ein Dialog-OK.
      */}
      <div className="flex justify-end">
        <SpeichernKnopf klein>
          Speichern
        </SpeichernKnopf>
      </div>
    </form>
  )
}
