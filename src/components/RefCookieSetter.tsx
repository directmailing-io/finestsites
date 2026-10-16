'use client'

import { useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

// Reads ?ref= from the URL and stores it in a 30-day cookie (fs_ref).
// This lets the ref code survive navigation across pages and subdomains
// so the register page can pick it up even if the user doesn't register immediately.
function RefCookieSetterInner() {
  const searchParams = useSearchParams()

  useEffect(() => {
    const ref = searchParams.get('ref')
    if (ref && /^[a-z0-9][a-z0-9-]{1,29}$/.test(ref)) {
      // Auf finestsites.io für alle Subdomains setzen (Marketing → app.finestsites.io),
      // sonst sieht die Registrierung auf app. den Code nicht
      const host = window.location.hostname
      const domain = host === 'finestsites.io' || host.endsWith('.finestsites.io') ? '; domain=.finestsites.io' : ''
      const secure = window.location.protocol === 'https:' ? '; Secure' : ''
      document.cookie = `fs_ref=${encodeURIComponent(ref)}; max-age=2592000; path=/${domain}; SameSite=Lax${secure}`
    }
  }, [searchParams])

  return null
}

export default function RefCookieSetter() {
  return (
    <Suspense fallback={null}>
      <RefCookieSetterInner />
    </Suspense>
  )
}
