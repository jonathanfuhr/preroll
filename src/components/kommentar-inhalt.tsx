import { zerlegeText } from '@/lib/kommentar-text'

/**
 * Der Text einer Rückmeldung, Erwähnungen als Chip. Ohne diese Anzeige
 * stünden im Kommentar die rohen Kennungen — lesbar wäre er dann nicht mehr.
 */
export function KommentarInhalt({ text, klein }: { text: string; klein?: boolean }) {
  return (
    <p
      className={`whitespace-pre-wrap leading-relaxed text-tinte-3 ${
        klein ? 'text-[12.5px]' : 'text-[13px]'
      }`}
    >
      {zerlegeText(text).map((stueck, i) =>
        stueck.art === 'text' ? (
          stueck.inhalt
        ) : (
          <span
            key={`${stueck.erwaehnung.id}-${i}`}
            className="rounded-[3px] bg-akzent-zart px-1 py-px font-medium text-akzent"
          >
            @{stueck.erwaehnung.name}
          </span>
        ),
      )}
    </p>
  )
}
