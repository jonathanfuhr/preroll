'use client'

import { Eingabe, Feld, Knopf, Schalter } from '@/components/ui'
import { ansprechpartnerLoeschen, ansprechpartnerSpeichern } from '../aktionen'

type Person = {
  id: string
  name: string
  rolle: string | null
  telefon: string | null
  email: string | null
  adresse: string | null
  website: string | null
  standard: boolean
}

export function AnsprechpartnerFormular({
  kundeId,
  person,
}: {
  kundeId: string
  person?: Person
}) {
  return (
    <form action={ansprechpartnerSpeichern.bind(null, kundeId)} className="grid gap-4">
      {person && <input type="hidden" name="id" value={person.id} />}

      <div className="grid grid-cols-2 gap-4">
        <Feld beschriftung="Name">
          <Eingabe name="name" defaultValue={person?.name ?? ''} required />
        </Feld>
        <Feld beschriftung="Rolle">
          <Eingabe
            name="rolle"
            defaultValue={person?.rolle ?? ''}
            placeholder="Ansprechpartnerin · THD Video"
          />
        </Feld>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Feld beschriftung="Telefon">
          <Eingabe name="telefon" defaultValue={person?.telefon ?? ''} />
        </Feld>
        <Feld beschriftung="E-Mail">
          <Eingabe name="email" type="email" defaultValue={person?.email ?? ''} />
        </Feld>
      </div>

      <Feld beschriftung="Adresse">
        <Eingabe
          name="adresse"
          defaultValue={person?.adresse ?? ''}
          placeholder="Stuttgarter Str. 1, 73240 Wendlingen"
        />
      </Feld>

      <Feld beschriftung="Website">
        <Eingabe name="website" defaultValue={person?.website ?? ''} placeholder="www.thdvideo.de" />
      </Feld>

      <Schalter
        name="standard"
        beschriftung="Standard-Ansprechpartner für diesen Kunden"
        defaultChecked={person?.standard}
      />

      <div className="flex items-center justify-between gap-2">
        {person ? (
          <button
            type="submit"
            formAction={ansprechpartnerLoeschen.bind(null, person.id)}
            className="text-[12px] text-stiller hover:text-akzent"
          >
            Löschen
          </button>
        ) : (
          <span />
        )}
        <Knopf klein art={person ? 'sekundaer' : 'primaer'} type="submit">
          {person ? 'Speichern' : 'Anlegen'}
        </Knopf>
      </div>
    </form>
  )
}
