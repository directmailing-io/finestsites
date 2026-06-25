'use client'

import { useState } from 'react'

interface Props {
  templateId: string
  templateTitle: string
  light?: boolean
}

export default function TemplateStartCTA({ templateId, templateTitle, light }: Props) {
  const [loading, setLoading] = useState(false)

  function handleStart() {
    setLoading(true)
    // Store intent cookie on current domain (7 days)
    document.cookie = `fs_template_intent=${templateId}; path=/; max-age=604800; SameSite=Lax`
    // Redirect to app with template params
    window.location.href = `https://app.finestsites.io/register?template=${templateId}&tname=${encodeURIComponent(templateTitle)}`
  }

  const bg = loading
    ? (light ? '#ddd' : '#333')
    : (light ? '#fff' : '#111')
  const color = light ? '#111' : '#fff'

  return (
    <button
      onClick={handleStart}
      disabled={loading}
      style={{
        background: bg,
        color,
        padding: '14px 32px',
        borderRadius: 100,
        fontSize: 15,
        fontWeight: 600,
        border: 'none',
        cursor: loading ? 'not-allowed' : 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        transition: 'all 0.15s',
        opacity: loading ? 0.7 : 1,
      }}
    >
      {loading ? (
        <>
          <span style={{
            width: 16,
            height: 16,
            border: `2px solid ${light ? '#aaa' : '#555'}`,
            borderTopColor: light ? '#111' : '#fff',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
            display: 'inline-block',
            flexShrink: 0,
          }} />
          Wird gestartet…
        </>
      ) : (
        <>Mit diesem Template starten →</>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </button>
  )
}
