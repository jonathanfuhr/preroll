'use client'

import { BildAblage } from '@/components/bild-ablage'

export function LogoAblage({ kundeId, logo }: { kundeId: string; logo: string | null }) {
  return (
    <BildAblage
      bild={logo}
      kundeId={kundeId}
      beschriftung="Profilbild"
      hinweis="Erscheint in der Feed-Vorschau, im iPhone-Rahmen und auf der Export-Seite. Quadratisch am besten."
    />
  )
}
