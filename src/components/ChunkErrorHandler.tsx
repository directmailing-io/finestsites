'use client'

import { useEffect } from 'react'

// Automatically reload the page when a ChunkLoadError occurs.
// This happens when a new deployment invalidates old JS chunks
// that the browser still references from a cached HTML page.
//
// ChunkLoadErrors can surface in two ways:
//   1. As a synchronous ErrorEvent on window (caught below)
//   2. As an unhandled promise rejection (also caught below)
export function ChunkErrorHandler() {
  useEffect(() => {
    function isChunkError(err: unknown) {
      return (
        (err instanceof Error && err.name === 'ChunkLoadError') ||
        (typeof err === 'string' && err.includes('ChunkLoadError'))
      )
    }

    function handleError(event: ErrorEvent) {
      if (isChunkError(event.error)) {
        window.location.reload()
      }
    }

    function handleUnhandledRejection(event: PromiseRejectionEvent) {
      if (isChunkError(event.reason)) {
        event.preventDefault()
        window.location.reload()
      }
    }

    window.addEventListener('error', handleError)
    window.addEventListener('unhandledrejection', handleUnhandledRejection)
    return () => {
      window.removeEventListener('error', handleError)
      window.removeEventListener('unhandledrejection', handleUnhandledRejection)
    }
  }, [])
  return null
}
