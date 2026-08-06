'use client'

import type { Fortschritt } from '@/lib/hochladen'

/**
 * Fortschritt eines Uploads. Bewusst dieselbe Optik wie beim
 * Referenzvideo-Download — für den, der davorsitzt, ist es dasselbe Warten.
 */
export function UploadBalken({ stand }: { stand: Fortschritt | null }) {
  if (!stand) return null

  const prozent = Math.round(stand.anteil * 100)

  return (
    <div className="rounded-md border border-rahmen bg-flaeche px-4 py-3">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <span className="min-w-0 truncate text-[12.5px] font-medium text-tinte">
          {stand.dateiAnzahl > 1 && (
            <span className="text-still">
              {stand.dateiNummer}/{stand.dateiAnzahl}{' '}
            </span>
          )}
          {stand.dateiname}
        </span>
        <span className="shrink-0 font-mono text-[11.5px] text-leise">{prozent}%</span>
      </div>

      <div
        role="progressbar"
        aria-valuenow={prozent}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-[5px] overflow-hidden rounded-full bg-flaeche-tief"
      >
        <div
          className="h-full rounded-full bg-akzent transition-[width] duration-200"
          style={{ width: `${Math.max(2, prozent)}%` }}
        />
      </div>

      {prozent === 100 && (
        <p className="mt-2 text-[11.5px] text-leiser">Wird verarbeitet …</p>
      )}
    </div>
  )
}
