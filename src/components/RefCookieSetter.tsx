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
      document.cookie = `fs_ref=${encodeURIComponent(ref)}; max-age=2592000; path=/; SameSite=Lax`
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
