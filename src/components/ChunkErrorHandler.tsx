'use client'

import { useEffect } from 'react'

// Automatically reload the page when a ChunkLoadError occurs.
// This happens when a new deployment invalidates old JS chunks
// that the browser still references from a cached HTML page.
export function ChunkErrorHandler() {
  useEffect(() => {
    function handleError(event: ErrorEvent) {
      if (event.error?.name === 'ChunkLoadError') {
        window.location.reload()
      }
    }
    window.addEventListener('error', handleError)
    return () => window.removeEventListener('error', handleError)
  }, [])
  return null
}
