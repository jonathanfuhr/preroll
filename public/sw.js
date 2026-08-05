/* Service Worker für Push-Benachrichtigungen. */

self.addEventListener('push', (ereignis) => {
  if (!ereignis.data) return

  let daten
  try {
    daten = ereignis.data.json()
  } catch {
    daten = { titel: 'Preroll', text: ereignis.data.text() }
  }

  ereignis.waitUntil(
    self.registration.showNotification(daten.titel ?? 'Preroll', {
      body: daten.text ?? '',
      icon: '/icon.png',
      badge: '/icon.png',
      data: { url: daten.url ?? '/' },
    }),
  )
})

self.addEventListener('notificationclick', (ereignis) => {
  ereignis.notification.close()
  const ziel = ereignis.notification.data?.url ?? '/'

  ereignis.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((fenster) => {
      // Ein bereits offenes Fenster wiederverwenden, statt ein neues zu öffnen.
      for (const f of fenster) {
        if (f.url === ziel && 'focus' in f) return f.focus()
      }
      return self.clients.openWindow(ziel)
    }),
  )
})
