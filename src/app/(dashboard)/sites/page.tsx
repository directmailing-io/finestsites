'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface Site {
  id: string
  status: 'draft' | 'published' | 'deleted'
  created_at: string
  username: string | null
  templates: {
    title: string
    domain: string
    preview_images?: string[] | null
  } | null
}

function SiteCard({ site }: { site: Site }) {
  const isPublished = site.status === 'published'
  const domain = site.templates?.domain
  const username = site.username
  const siteUrl = isPublished && domain && username ? `https://${username}.${domain}` : null
  // Use stored preview image, or live screenshot via thum.io for published sites
  const preview = site.templates?.preview_images?.[0]
    ?? (siteUrl ? `https://image.thum.io/get/width/640/crop/400/${siteUrl}` : null)

  return (
    <div className="group relative flex flex-col rounded-[20px] bg-white overflow-hidden transition-all duration-200"
      style={{
        boxShadow: '0 2px 16px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.05)',
      }}>

      {/* Preview image area */}
      <Link href={`/sites/${site.id}/edit`} className="block relative overflow-hidden"
        style={{ aspectRatio: '16/10', background: 'linear-gradient(135deg, #F1F5F9 0%, #E2E8F0 100%)' }}>

        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt={site.templates?.title ?? ''} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
        ) : (
          /* Placeholder with stylized mockup lines */
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6">
            <div className="w-full max-w-[160px] flex flex-col gap-1.5 opacity-30">
              <div className="h-2.5 rounded-full bg-slate-400 w-3/4" />
              <div className="h-1.5 rounded-full bg-slate-300 w-full" />
              <div className="h-1.5 rounded-full bg-slate-300 w-5/6" />
              <div className="h-1.5 rounded-full bg-slate-300 w-4/5 mt-1" />
              <div className="h-6 rounded-lg bg-slate-400/60 w-1/2 mt-2" />
            </div>
          </div>
        )}

        {/* Status badge */}
        <div className="absolute top-3 left-3">
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1"
            style={{
              background: isPublished ? 'rgba(22,163,74,0.15)' : 'rgba(0,0,0,0.12)',
              color: isPublished ? '#15803D' : '#475569',
              backdropFilter: 'blur(8px)',
              border: `1px solid ${isPublished ? 'rgba(22,163,74,0.25)' : 'rgba(0,0,0,0.1)'}`,
            }}>
            <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: isPublished ? '#16A34A' : '#94A3B8' }} />
            {isPublished ? 'Live' : 'Entwurf'}
          </span>
        </div>

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors duration-200 flex items-center justify-center">
          <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-xs font-semibold text-white px-4 py-2 rounded-full"
            style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}>
            Bearbeiten
          </span>
        </div>
      </Link>

      {/* Card body */}
      <div className="px-4 py-3.5 flex flex-col gap-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 text-sm leading-tight truncate">
              {site.templates?.title ?? 'Unbekanntes Template'}
            </p>
            {domain && username && (
              <p className="text-xs font-mono mt-0.5 truncate" style={{ color: '#94A3B8' }}>
                {username}.{domain}
              </p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 pt-0.5" style={{ borderTop: '1px solid #F1F5F9' }}>
          {isPublished && siteUrl && (
            <a href={siteUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-[8px] font-medium transition-colors duration-150"
              style={{ color: '#64748B', background: '#F8FAFC' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#F1F5F9' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#F8FAFC' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"/>
              </svg>
              Öffnen
            </a>
          )}
          <Link href={`/sites/${site.id}/submissions`}
            className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-[8px] font-medium transition-colors duration-150"
            style={{ color: '#64748B', background: '#F8FAFC' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#F1F5F9' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#F8FAFC' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
            </svg>
            Eingaben
          </Link>
          <Link href={`/sites/${site.id}/edit`}
            className="ml-auto flex items-center gap-1 text-xs px-3 py-1.5 rounded-[8px] font-semibold text-white transition-all duration-150"
            style={{ background: '#1a1a1a' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#333' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#1a1a1a' }}>
            Bearbeiten
          </Link>
        </div>
      </div>
    </div>
  )
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
    <div className="max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Meine Seiten</h1>
          <p className="text-sm mt-1" style={{ color: '#94A3B8' }}>
            {loading ? '…' : sites.length === 0 ? 'Noch keine Website erstellt' : `${sites.length} Website${sites.length !== 1 ? 'n' : ''}`}
          </p>
        </div>
        <Link href="/sites/new"
          className="flex items-center gap-2 text-sm font-semibold px-5 py-2.5 text-white rounded-[14px] transition-all duration-150"
          style={{ background: '#1a1a1a', boxShadow: '0 4px 14px rgba(26,26,26,0.20)' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#333' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#1a1a1a' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          Neue Website
        </Link>
      </div>

      {loading ? (
        /* Skeleton grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="rounded-[20px] overflow-hidden" style={{ background: '#F8FAFC', border: '1px solid #F1F5F9' }}>
              <div className="animate-pulse" style={{ aspectRatio: '16/10', background: '#E2E8F0' }} />
              <div className="p-4 flex flex-col gap-3 animate-pulse">
                <div className="h-3.5 rounded-full bg-gray-200 w-2/3" />
                <div className="h-2.5 rounded-full bg-gray-100 w-1/2" />
                <div className="h-7 rounded-[8px] bg-gray-100 mt-1" />
              </div>
            </div>
          ))}
        </div>
      ) : sites.length === 0 ? (
        /* Empty state */
        <div className="flex flex-col items-center justify-center py-24 text-center rounded-[24px]"
          style={{ background: 'linear-gradient(135deg, #F8FAFC 0%, #F1F5F9 100%)', border: '1px solid #E2E8F0' }}>
          <div className="w-16 h-16 rounded-[22px] flex items-center justify-center mb-5"
            style={{ background: 'white', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10"/>
              <line x1="2" y1="12" x2="22" y2="12"/>
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
            </svg>
          </div>
          <h3 className="font-semibold text-gray-800 text-lg mb-2">Noch keine Website erstellt</h3>
          <p className="text-sm mb-8 max-w-xs leading-relaxed" style={{ color: '#94A3B8' }}>
            Wähle ein Template und erstelle deine erste Website in wenigen Minuten.
          </p>
          <Link href="/sites/new"
            className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white rounded-[14px] transition-all duration-150"
            style={{ background: '#1a1a1a', boxShadow: '0 4px 20px rgba(26,26,26,0.20)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            Template auswählen
          </Link>
        </div>
      ) : (
        /* Card grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sites.map(site => <SiteCard key={site.id} site={site} />)}

          {/* "Add new" card */}
          <Link href="/sites/new"
            className="group flex flex-col items-center justify-center rounded-[20px] transition-all duration-200 cursor-pointer min-h-[220px]"
            style={{
              background: '#FAFBFC',
              border: '2px dashed #E2E8F0',
            }}
            onMouseEnter={e => {
              const el = e.currentTarget as HTMLElement
              el.style.borderColor = '#CBD5E1'
              el.style.background = '#F8FAFC'
            }}
            onMouseLeave={e => {
              const el = e.currentTarget as HTMLElement
              el.style.borderColor = '#E2E8F0'
              el.style.background = '#FAFBFC'
            }}>
            <div className="w-10 h-10 rounded-full flex items-center justify-center mb-3 transition-colors duration-150"
              style={{ background: '#F1F5F9' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2">
                <path d="M12 5v14M5 12h14"/>
              </svg>
            </div>
            <p className="text-sm font-medium" style={{ color: '#94A3B8' }}>Neue Website</p>
          </Link>
        </div>
      )}
    </div>
  )
}
