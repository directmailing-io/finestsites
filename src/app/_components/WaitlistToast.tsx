'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'

/**
 * Kurze Rückmeldung, wenn jemand über einen Link aus einer Insider-Mail kommt
 * (`/?waitlist=confirmed|unsubscribed`). Die Insider-Club-Sektion selbst gibt es
 * auf der Startseite seit 14.10.2026 nicht mehr; die Links in alten Mails sollen
 * trotzdem eine Antwort zeigen.
 */
export default function WaitlistToast() {
  const searchParams = useSearchParams()
  const [banner, setBanner] = useState<'confirmed' | 'unsubscribed' | null>(null)

  useEffect(() => {
    const wl = searchParams.get('waitlist')
    if (wl === 'confirmed' || wl === 'unsubscribed') {
      setBanner(wl)
      const url = new URL(window.location.href)
      url.searchParams.delete('waitlist')
      window.history.replaceState({}, '', url.toString())
      const t = setTimeout(() => setBanner(null), 9000)
      return () => clearTimeout(t)
    }
  }, [searchParams])

  if (!banner) return null
  return (
    <div style={{
      position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
      zIndex: 9999, minWidth: 300, maxWidth: 460,
      background: banner === 'confirmed' ? '#D1FAE5' : '#F3F4F6',
      color: banner === 'confirmed' ? '#065F46' : '#374151',
      borderRadius: 16, padding: '14px 18px',
      boxShadow: '0 8px 40px rgba(0,0,0,0.12)',
      display: 'flex', alignItems: 'center', gap: 10,
      fontSize: 14, fontWeight: 500,
    }}>
      {banner === 'confirmed' ? 'Danke, deine E-Mail-Adresse ist bestätigt.' : 'Erfolgreich abgemeldet.'}
      <button onClick={() => setBanner(null)} style={{
        marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer',
        color: 'inherit', opacity: 0.5, fontSize: 16, padding: '0 4px', flexShrink: 0,
      }}>✕</button>
    </div>
  )
}
