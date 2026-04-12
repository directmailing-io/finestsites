'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface Site {
  id: string
  status: 'draft' | 'published' | 'deleted'
  created_at: string
  templates: {
    title: string
    domain: string
  } | null
}

export default function SitesPage() {
  const [sites, setSites] = useState<Site[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/sites')
      .then(r => r.json())
      .then(data => { setSites(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Meine Seiten</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
            Alle deine Websites auf einen Blick.
          </p>
        </div>
        <Link href="/sites/new"
          className="text-sm font-medium px-5 py-2.5 text-white rounded-[16px]"
          style={{ background: '#1a1a1a', boxShadow: '0 4px 14px rgba(26,26,26,0.20)' }}>
          + Neue Website
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-6 h-6 rounded-full border-2 border-gray-200 border-t-gray-900 animate-spin" />
        </div>
      ) : sites.length === 0 ? (
        <div className="p-12 rounded-[24px] bg-white text-center"
          style={{ boxShadow: 'var(--shadow-card)', border: '1px solid var(--border)' }}>
          <div className="w-14 h-14 rounded-[20px] flex items-center justify-center mx-auto mb-4"
            style={{ background: '#F3F4F6' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10"/>
              <line x1="2" y1="12" x2="22" y2="12"/>
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
            </svg>
          </div>
          <h3 className="font-semibold text-gray-900 mb-1">Noch keine Website erstellt</h3>
          <p className="text-sm mb-6" style={{ color: 'var(--muted-foreground)' }}>
            Wähle ein Template und erstelle deine erste Website in wenigen Minuten.
          </p>
          <Link href="/sites/new"
            className="inline-flex items-center gap-2 px-6 py-3 text-sm font-medium text-white rounded-[16px]"
            style={{ background: '#1a1a1a', boxShadow: '0 4px 14px rgba(26,26,26,0.25)' }}>
            Template auswählen
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {sites.map(site => {
            const isPublished = site.status === 'published'
            const domain = site.templates?.domain
            const url = isPublished && domain ? `https://me.${domain}` : null

            return (
              <div key={site.id}
                className="px-5 py-4 rounded-[20px] bg-white flex items-center gap-4"
                style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1px solid var(--border)' }}>

                {/* Status dot */}
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ background: isPublished ? '#16A34A' : '#D1D5DB' }} />

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-medium text-gray-900 text-sm truncate">
                      {site.templates?.title ?? 'Unbekanntes Template'}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full flex-shrink-0"
                      style={{
                        background: isPublished ? '#F0FDF4' : '#F3F4F6',
                        color: isPublished ? '#16A34A' : '#6B7280',
                      }}>
                      {isPublished ? 'Veröffentlicht' : 'Entwurf'}
                    </span>
                  </div>
                  {domain && (
                    <p className="text-xs font-mono truncate" style={{ color: 'var(--muted-foreground)' }}>
                      {isPublished ? `https://me.${domain}` : domain}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {isPublished && url && (
                    <a href={url.replace('me.', '')} target="_blank" rel="noopener noreferrer"
                      className="p-2 rounded-[10px] transition-all"
                      style={{ color: '#6B7280', background: '#F3F4F6' }}
                      title="Website öffnen">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"/>
                      </svg>
                    </a>
                  )}
                  <Link href={`/sites/${site.id}/submissions`}
                    className="p-2 rounded-[10px] transition-all"
                    style={{ color: '#6B7280', background: '#F3F4F6' }}
                    title="Formular-Eingaben">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
                    </svg>
                  </Link>
                  <Link href={`/sites/${site.id}/edit`}
                    className="px-4 py-2 text-sm font-medium rounded-[12px] transition-all"
                    style={{ background: '#1a1a1a', color: 'white' }}>
                    Bearbeiten
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
