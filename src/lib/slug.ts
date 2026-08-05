/** Erzeugt einen URL-tauglichen Slug aus einem Kundennamen. */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    // Kombinierende Akzente entfernen (é → e), nachdem NFD sie abgetrennt hat.
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

/** Initialen aus einem Namen — für Nutzer-Plaketten. */
export function initialen(name: string): string {
  const teile = name.trim().split(/\s+/).filter(Boolean)
  if (teile.length === 0) return '??'
  if (teile.length === 1) return teile[0].slice(0, 2).toUpperCase()
  return (teile[0][0] + teile[teile.length - 1][0]).toUpperCase()
}
