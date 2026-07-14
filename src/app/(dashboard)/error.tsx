'use client'

import { useEffect } from 'react'
import Link from 'next/link'

function isStaleDeploymentError(error: Error): boolean {
  return (
    error.message.includes('ChunkLoadError') ||
    error.message.includes('Loading chunk') ||
    error.message.includes('Failed to find Server Action') ||
    error.name === 'ChunkLoadError'
  )
}

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    if (isStaleDeploymentError(error)) {
      window.location.reload()
    }
  }, [error])

  // Show nothing while reloading (stale deployment errors)
  if (isStaleDeploymentError(error)) {
    return null
  }

  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
        style={{ background: '#FEF2F2', color: '#DC2626' }}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
      </div>
      <h2 className="text-xl font-bold text-gray-900 tracking-tight mb-2">
        Etwas ist schiefgelaufen
      </h2>
      <p className="text-sm mb-8" style={{ color: '#94A3B8', maxWidth: 320 }}>
        Ein unerwarteter Fehler ist aufgetreten. Bitte versuche es erneut oder lade die Seite neu.
      </p>
      <div className="flex items-center gap-3">
        <button
          onClick={reset}
          className="px-5 py-2.5 text-sm font-semibold rounded-xl transition-opacity hover:opacity-80"
          style={{ background: '#1a1a1a', color: 'white' }}
        >
          Erneut versuchen
        </button>
        <Link
          href="/sites"
          className="px-5 py-2.5 text-sm font-semibold rounded-xl transition-colors"
          style={{ background: '#F3F4F6', color: '#374151' }}
        >
          Zur Startseite
        </Link>
      </div>
    </div>
  )
}
