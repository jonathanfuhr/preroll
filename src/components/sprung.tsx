import Link from 'next/link'
import type { ReactNode } from 'react'

/**
 * Ein Verweis, der auch eine Sprungmarke auf derselben Seite sein darf.
 *
 * Für `#post-…` **kein** `next/link`: Der Router behandelt den Klick als
 * Navigation, springt zwar zur Marke, setzt danach aber die Rollposition
 * zurück auf 0 — man landet wieder ganz oben. Ein schlichtes `<a>` überlässt
 * das dem Browser, samt sanftem Rollen aus `globals.css`.
 */
export function Sprung({
  href,
  className,
  title,
  children,
}: {
  href: string
  className?: string
  title?: string
  children: ReactNode
}) {
  if (href.startsWith('#')) {
    return (
      <a href={href} className={className} title={title}>
        {children}
      </a>
    )
  }

  return (
    <Link href={href} className={className} title={title}>
      {children}
    </Link>
  )
}
