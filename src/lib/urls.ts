/** Öffentliche URL eines Mediums. */
export function medienUrl(mediumId: string | null | undefined): string | null {
  return mediumId ? `/api/medien/${mediumId}` : null
}

/** Vorschaubild (mittiger 4:5-Ausschnitt) eines Mediums. */
export function thumbUrl(mediumId: string | null | undefined): string | null {
  return mediumId ? `/api/medien/${mediumId}?v=thumb` : null
}

export function kundenPfad(slug: string, unterseite = ''): string {
  return `/kunden/${slug}${unterseite ? `/${unterseite}` : ''}`
}

export function postPfad(slug: string, postId: string): string {
  return `/kunden/${slug}/posts/${postId}`
}

export function freigabePfad(token: string): string {
  return `/f/${token}`
}
