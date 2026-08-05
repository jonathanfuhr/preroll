'use client'

import { useEffect, useState } from 'react'
import { Knopf } from './ui'

/** Base64url → Bytes, wie es die Push-API für den VAPID-Schlüssel erwartet. */
function schluesselAlsBytes(base64: string): Uint8Array<ArrayBuffer> {
  const gefuellt = (base64 + '='.repeat((4 - (base64.length % 4)) % 4))
    .replace(/-/g, '+')
    .replace(/_/g, '/')
  const roh = atob(gefuellt)
  const bytes = new Uint8Array(new ArrayBuffer(roh.length))
  for (let i = 0; i < roh.length; i++) bytes[i] = roh.charCodeAt(i)
  return bytes
}

type Zustand = 'pruefe' | 'nicht-unterstuetzt' | 'aus' | 'an' | 'abgelehnt'

export function PushAnmeldung() {
  const [zustand, setZustand] = useState<Zustand>('pruefe')
  const [laeuft, setLaeuft] = useState(false)

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setZustand('nicht-unterstuetzt')
      return
    }
    if (Notification.permission === 'denied') {
      setZustand('abgelehnt')
      return
    }
    void navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => reg.pushManager.getSubscription())
      .then((abo) => setZustand(abo ? 'an' : 'aus'))
      .catch(() => setZustand('nicht-unterstuetzt'))
  }, [])

  async function anmelden() {
    setLaeuft(true)
    try {
      const erlaubnis = await Notification.requestPermission()
      if (erlaubnis !== 'granted') {
        setZustand('abgelehnt')
        return
      }

      const { schluessel } = (await (await fetch('/api/push')).json()) as { schluessel: string }
      const registrierung = await navigator.serviceWorker.ready
      const abo = await registrierung.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: schluesselAlsBytes(schluessel),
      })

      await fetch('/api/push', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(abo.toJSON()),
      })
      setZustand('an')
    } finally {
      setLaeuft(false)
    }
  }

  async function abmelden() {
    setLaeuft(true)
    try {
      const registrierung = await navigator.serviceWorker.ready
      const abo = await registrierung.pushManager.getSubscription()
      if (abo) {
        await fetch(`/api/push?endpoint=${encodeURIComponent(abo.endpoint)}`, { method: 'DELETE' })
        await abo.unsubscribe()
      }
      setZustand('aus')
    } finally {
      setLaeuft(false)
    }
  }

  if (zustand === 'pruefe') return null

  if (zustand === 'nicht-unterstuetzt') {
    return (
      <p className="text-[11.5px] leading-relaxed text-stiller">
        Dieser Browser unterstützt keine Push-Benachrichtigungen.
      </p>
    )
  }

  if (zustand === 'abgelehnt') {
    return (
      <p className="text-[11.5px] leading-relaxed text-stiller">
        Benachrichtigungen wurden für diese Seite blockiert. Das lässt sich nur in den
        Browsereinstellungen wieder ändern.
      </p>
    )
  }

  return (
    <div className="flex items-center gap-3">
      <Knopf
        klein
        type="button"
        disabled={laeuft}
        onClick={() => void (zustand === 'an' ? abmelden() : anmelden())}
      >
        {laeuft
          ? 'Einen Moment …'
          : zustand === 'an'
            ? 'Dieses Gerät abmelden'
            : 'Dieses Gerät anmelden'}
      </Knopf>
      <span className="text-[11.5px] text-leiser">
        {zustand === 'an' ? 'Push ist auf diesem Gerät aktiv.' : 'Push ist auf diesem Gerät aus.'}
      </span>
    </div>
  )
}
