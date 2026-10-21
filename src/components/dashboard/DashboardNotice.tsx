'use client'

import { useEffect, useState } from 'react'

/**
 * Allgemeiner Hinweis oben im Dashboard (z. B. Serverarbeiten). Der Text kommt aus
 * app_settings ('dashboard_notice'); leer = kein Hinweis. Nutzer können ihn schließen,
 * ein neuer Text erscheint wieder (gemerkt wird der Text, nicht nur „geschlossen“).
 */
export default function DashboardNotice({ text }: { text: string }) {
  const storageKey = 'fs_notice_closed'
  const [closed, setClosed] = useState(true)

  useEffect(() => {
    try {
      setClosed(localStorage.getItem(storageKey) === text)
    } catch {
      setClosed(false)
    }
  }, [text])

  if (closed) return null

  const close = () => {
    setClosed(true)
    try { localStorage.setItem(storageKey, text) } catch { /* privater Modus */ }
  }

  return (
    <div
      role="status"
      style={{
        background: '#EFF6FF',
        borderBottom: '1px solid #BFDBFE',
        color: '#1E3A8A',
        padding: '10px 20px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        fontSize: 14,
        lineHeight: 1.5,
      }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }} aria-hidden="true">
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
      </svg>
      <span style={{ flex: 1 }}>{text}</span>
      <button
        type="button"
        onClick={close}
        aria-label="Hinweis schließen"
        style={{
          background: 'transparent',
          border: 0,
          color: '#1E3A8A',
          cursor: 'pointer',
          fontSize: 20,
          lineHeight: 1,
          padding: '0 4px',
          minWidth: 32,
          minHeight: 32,
        }}
      >
        ×
      </button>
    </div>
  )
}
