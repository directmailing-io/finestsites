'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'

interface UserProfile {
  id: string
  email: string
  username: string | null
  plan: string
  subscription_status: string | null
  created_at: string
  stripe_customer_id: string | null
}

interface UserSite {
  id: string
  status: string
  username: string | null
  templates: { title: string; domain: string } | null
}

interface Invoice {
  id: string
  created: number
  amount_paid: number
  amount_due: number
  status: string | null
  description: string | null
  lines?: { data: Array<{ description: string | null }> }
}

interface UserDetail {
  profile: UserProfile
  sites: UserSite[]
  invoices: Invoice[]
}

const PLAN_COLORS: Record<string, { bg: string; text: string }> = {
  starter: { bg: '#EFF6FF', text: '#1D4ED8' },
  pro: { bg: '#F5F3FF', text: '#7C3AED' },
  unlimited: { bg: '#F0FDF4', text: '#16A34A' },
}

const STATUS_LABELS: Record<string, string> = {
  active: 'Aktiv',
  trialing: 'Testphase',
  past_due: 'Zahlung offen',
  canceled: 'Gekündigt',
  incomplete: 'Ausstehend',
}

export default function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [data, setData] = useState<UserDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`/api/admin/users/${id}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); setLoading(false); return }
        setData(d)
        setLoading(false)
      })
      .catch(() => { setError('Fehler beim Laden.'); setLoading(false) })
  }, [id])

  if (loading) {
    return (
      <div className="max-w-3xl">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-8 h-8 rounded-[10px] bg-gray-100 animate-pulse" />
          <div className="h-6 w-48 rounded-[10px] bg-gray-100 animate-pulse" />
        </div>
        <div className="flex flex-col gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 rounded-[20px] bg-gray-100 animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="max-w-3xl">
        <Link href="/admin/users" className="flex items-center gap-2 text-sm mb-6" style={{ color: 'var(--muted-foreground)' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
          Alle Nutzer
        </Link>
        <p className="text-sm text-red-500">{error || 'Nutzer nicht gefunden.'}</p>
      </div>
    )
  }

  const { profile, sites, invoices } = data
  const planColor = PLAN_COLORS[profile.plan] ?? PLAN_COLORS.starter

  return (
    <div className="max-w-3xl">
      {/* Back */}
      <Link href="/admin/users" className="flex items-center gap-2 text-sm mb-6" style={{ color: 'var(--muted-foreground)' }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M19 12H5M12 5l-7 7 7 7"/>
        </svg>
        Alle Nutzer
      </Link>

      <div className="flex flex-col gap-5">

        {/* Profile card */}
        <div className="p-6 rounded-[24px] bg-white flex flex-col gap-3"
          style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.08)', border: '1px solid var(--border)' }}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-lg font-semibold text-gray-900">{profile.email}</h1>
              {profile.username && (
                <p className="text-sm font-mono mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                  @{profile.username}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-xs font-medium px-2.5 py-1 rounded-full"
                style={{ background: planColor.bg, color: planColor.text }}>
                {profile.plan}
              </span>
              {profile.subscription_status && (
                <span className="text-xs px-2.5 py-1 rounded-full"
                  style={{
                    background: profile.subscription_status === 'active' ? '#F0FDF4' : '#FEF2F2',
                    color: profile.subscription_status === 'active' ? '#16A34A' : '#DC2626',
                  }}>
                  {STATUS_LABELS[profile.subscription_status] ?? profile.subscription_status}
                </span>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 pt-2" style={{ borderTop: '1px solid #F3F4F6' }}>
            <div>
              <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--muted-foreground)' }}>Registriert</p>
              <p className="text-sm text-gray-900">{new Date(profile.created_at).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
            </div>
            {profile.stripe_customer_id && (
              <div>
                <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--muted-foreground)' }}>Stripe-ID</p>
                <p className="text-sm font-mono text-gray-700">{profile.stripe_customer_id}</p>
              </div>
            )}
          </div>
        </div>

        {/* Sites */}
        <div className="p-6 rounded-[24px] bg-white flex flex-col gap-3"
          style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.08)', border: '1px solid var(--border)' }}>
          <h2 className="font-medium text-gray-900">Websites ({sites.length})</h2>
          {sites.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Keine Websites vorhanden.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {sites.map(site => {
                const url = site.username && site.templates?.domain
                  ? `https://${site.username}.${site.templates.domain}`
                  : null
                return (
                  <div key={site.id} className="flex items-center justify-between p-3 rounded-[14px]"
                    style={{ background: '#F9FAFB', border: '1px solid #F3F4F6' }}>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{site.templates?.title ?? 'Website'}</p>
                      {url && (
                        <a href={url} target="_blank" rel="noopener noreferrer"
                          className="text-xs font-mono mt-0.5 flex items-center gap-1 hover:underline"
                          style={{ color: '#2563EB' }}
                          onClick={e => e.stopPropagation()}>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                          </svg>
                          {site.username}.{site.templates?.domain}
                        </a>
                      )}
                    </div>
                    <span className="text-xs px-2.5 py-0.5 rounded-full"
                      style={{
                        background: site.status === 'published' ? '#F0FDF4' : '#F3F4F6',
                        color: site.status === 'published' ? '#16A34A' : '#6B7280',
                      }}>
                      {site.status === 'published' ? '● Live' : '○ Entwurf'}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Invoices */}
        <div className="p-6 rounded-[24px] bg-white flex flex-col gap-3"
          style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.08)', border: '1px solid var(--border)' }}>
          <h2 className="font-medium text-gray-900">Zahlungen</h2>
          {invoices.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Keine Zahlungen gefunden.</p>
          ) : (
            <div className="overflow-hidden rounded-[14px]" style={{ border: '1px solid #F3F4F6' }}>
              {/* Header */}
              <div className="grid grid-cols-4 gap-3 px-4 py-2.5 text-xs font-medium"
                style={{ background: '#F9FAFB', borderBottom: '1px solid #F3F4F6', color: '#6B7280' }}>
                <span>Datum</span>
                <span>Beschreibung</span>
                <span>Betrag</span>
                <span>Status</span>
              </div>
              {invoices.map(inv => {
                const desc = inv.description ?? inv.lines?.data?.[0]?.description ?? '—'
                const amount = (inv.amount_paid || inv.amount_due) / 100
                const isPaid = inv.status === 'paid'
                return (
                  <div key={inv.id} className="grid grid-cols-4 gap-3 px-4 py-3 text-sm items-center"
                    style={{ borderBottom: '1px solid #F9FAFB' }}>
                    <span style={{ color: 'var(--muted-foreground)' }}>
                      {new Date(inv.created * 1000).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </span>
                    <span className="text-gray-700 truncate text-xs">{desc}</span>
                    <span className="font-medium text-gray-900">
                      {amount.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full w-fit"
                      style={{
                        background: isPaid ? '#F0FDF4' : inv.status === 'void' ? '#F3F4F6' : '#FEF9C3',
                        color: isPaid ? '#16A34A' : inv.status === 'void' ? '#9CA3AF' : '#92400E',
                      }}>
                      {isPaid ? 'Bezahlt' : inv.status === 'void' ? 'Storniert' : 'Offen'}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
