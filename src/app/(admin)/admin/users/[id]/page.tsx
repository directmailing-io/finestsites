'use client'

import { useState, useEffect, use, useCallback, useRef } from 'react'
import Link from 'next/link'
import { CONSENT_TEXTS, hashConsentText } from '@/lib/constants/consent'

interface UserProfile {
  id: string
  email: string
  username: string | null
  plan: string
  billingInterval: string | null
  subscriptionStatus: string | null
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean
  createdAt: string
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
  contentConsentAt: string | null
  contentConsentIp: string | null
  contentConsentVersion: string | null
  contentConsentTextHash: string | null
  contentConsentUa: string | null
  referredByUsername: string | null
  firstName: string | null
  lastName: string | null
  phone: string | null
  websiteUrl: string | null
  instagram: string | null
  facebook: string | null
  linkedin: string | null
  tiktok: string | null
  youtube: string | null
}

interface AffiliateSearchResult {
  id: string
  email: string
  username: string | null
}

type AffiliateCardState =
  | { mode: 'view' }
  | { mode: 'search'; query: string; results: AffiliateSearchResult[]; selected: AffiliateSearchResult | null; saving: boolean }
  | { mode: 'removing' }

interface UserSite {
  id: string
  status: string
  customDomain: string | null
  customDomainStatus: string | null
  contentConsentGivenAt: string | null
  contentConsentIp: string | null
  createdAt: string
  template: { title: string; domain: string } | null
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

interface SubscriptionEvent {
  id: string
  eventType: string
  plan: string | null
  billingInterval: string | null
  amountCents: number | null
  createdAt: string
  stripeInvoiceId: string | null
  metadata: Record<string, unknown> | null
}

interface UserDetail {
  profile: UserProfile
  sites: UserSite[]
  invoices: Invoice[]
  events: SubscriptionEvent[]
  subscriptionDiscount: { couponName: string | null; promoCode: string | null } | null
}

interface SupportConv {
  id: string
  status: 'open' | 'closed' | 'waiting'
  subject: string | null
  lastMessageAt: string | null
  unreadByAdmin: number
  createdAt: string
  lastMessage: { content: string; contentType?: string } | null
}

/** Extracts a clean username/handle from any social value.
 * Handles full URLs (https://instagram.com/handle), @-prefixed, or plain. */
function extractSocialHandle(value: string): string {
  const v = value.trim().replace(/\/$/, '')
  try {
    const url = new URL(v)
    const parts = url.pathname.split('/').filter(Boolean)
    if (parts.length > 0) return parts[parts.length - 1].replace(/^@/, '')
  } catch { /* not a URL — treat as plain handle */ }
  return v.replace(/^@/, '')
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  open: { bg: '#F0FDF4', text: '#16A34A' },
  waiting: { bg: '#FFF7ED', text: '#C2410C' },
  closed: { bg: '#F5F5F5', text: '#9CA3AF' },
}

const STATUS_LABEL: Record<string, string> = {
  open: 'Offen', waiting: 'Wartend', closed: 'Geschlossen',
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

type ImpersonateStep =
  | { state: 'idle' }
  | { state: 'requesting' }
  | { state: 'waiting'; requestId: string; token: string }
  | { state: 'approved'; token: string }
  | { state: 'rejected' }
  | { state: 'error'; message: string }

export default function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [data, setData] = useState<UserDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [supportConvs, setSupportConvs] = useState<SupportConv[]>([])
  const [impersonate, setImpersonate] = useState<ImpersonateStep>({ state: 'idle' })
  const [consentTextOpen, setConsentTextOpen] = useState(false)
  const [hashStatus, setHashStatus] = useState<'checking' | 'ok' | 'mismatch' | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [affiliateCard, setAffiliateCard] = useState<AffiliateCardState>({ mode: 'view' })
  const affiliateSearchRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [usernameEdit, setUsernameEdit] = useState<{ value: string; saving: boolean; error: string } | null>(null)

  async function saveUsername() {
    if (!usernameEdit || !data) return
    setUsernameEdit(prev => prev ? { ...prev, saving: true, error: '' } : prev)
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: usernameEdit.value }),
      })
      const json = await res.json()
      if (!res.ok) {
        setUsernameEdit(prev => prev ? { ...prev, saving: false, error: json.error ?? 'Fehler beim Speichern.' } : prev)
        return
      }
      setData(prev => prev ? { ...prev, profile: { ...prev.profile, username: json.username } } : prev)
      setUsernameEdit(null)
    } catch {
      setUsernameEdit(prev => prev ? { ...prev, saving: false, error: 'Netzwerkfehler.' } : prev)
    }
  }

  const fetchSupportConvs = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/support/conversations?userId=${id}`)
      if (res.ok) {
        const d = await res.json()
        setSupportConvs(d.conversations ?? [])
      }
    } catch { /* ignore */ }
  }, [id])

  useEffect(() => {
    fetch(`/api/admin/users/${id}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); setLoading(false); return }
        setData(d)
        setLoading(false)
      })
      .catch(() => { setError('Fehler beim Laden.'); setLoading(false) })
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchSupportConvs()
  }, [id, fetchSupportConvs])

  // Poll for impersonation approval
  useEffect(() => {
    if (impersonate.state !== 'waiting') {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
      return
    }
    const { requestId, token } = impersonate
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/admin/users/${id}/impersonate?requestId=${requestId}`)
        const data = await res.json()
        if (data.status === 'approved') {
          setImpersonate({ state: 'approved', token })
        } else if (data.status === 'rejected') {
          setImpersonate({ state: 'rejected' })
        }
      } catch { /* ignore */ }
    }, 3000)
    return () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null } }
  }, [impersonate, id])

  // Verify stored hash matches the canonical consent text for that version
  useEffect(() => {
    if (!data) return
    const { contentConsentTextHash, contentConsentVersion } = data.profile
    if (!contentConsentTextHash || !contentConsentVersion) return
    if (contentConsentTextHash === 'migration-pre-consent-feature') return
    const text = CONSENT_TEXTS[contentConsentVersion]
    if (!text) return
    setHashStatus('checking')
    hashConsentText(text).then(computed => {
      setHashStatus(computed === contentConsentTextHash ? 'ok' : 'mismatch')
    })
  }, [data])

  function handleAffiliateSearch(query: string) {
    setAffiliateCard({ mode: 'search', query, results: [], selected: null, saving: false })
    if (affiliateSearchRef.current) clearTimeout(affiliateSearchRef.current)
    if (query.length < 2) return
    affiliateSearchRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/users/search?q=${encodeURIComponent(query)}&affiliate=true`)
        const results = await res.json()
        setAffiliateCard(prev => prev.mode === 'search' ? { ...prev, results: Array.isArray(results) ? results : [] } : prev)
      } catch { /* ignore */ }
    }, 300)
  }

  async function assignAffiliate(selected: AffiliateSearchResult) {
    setAffiliateCard({ mode: 'search', query: selected.username ?? selected.email, results: [], selected, saving: true })
    try {
      const res = await fetch(`/api/admin/users/${id}/affiliate`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ affiliateUsername: selected.username }),
      })
      if (!res.ok) {
        const d = await res.json()
        alert(d.error ?? 'Fehler beim Speichern.')
        setAffiliateCard({ mode: 'search', query: selected.username ?? selected.email, results: [], selected, saving: false })
        return
      }
      setData(prev => prev ? { ...prev, profile: { ...prev.profile, referredByUsername: selected.username } } : prev)
      setAffiliateCard({ mode: 'view' })
    } catch {
      alert('Netzwerkfehler.')
      setAffiliateCard({ mode: 'search', query: selected.username ?? selected.email, results: [], selected, saving: false })
    }
  }

  async function removeAffiliate() {
    setAffiliateCard({ mode: 'removing' })
    try {
      await fetch(`/api/admin/users/${id}/affiliate`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ affiliateUsername: null }),
      })
      setData(prev => prev ? { ...prev, profile: { ...prev.profile, referredByUsername: null } } : prev)
    } catch { /* ignore */ }
    setAffiliateCard({ mode: 'view' })
  }

  async function requestImpersonation() {
    setImpersonate({ state: 'requesting' })
    try {
      const res = await fetch(`/api/admin/users/${id}/impersonate`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { setImpersonate({ state: 'error', message: data.error ?? 'Fehler' }); return }
      setImpersonate({ state: 'waiting', requestId: data.requestId, token: data.token })
    } catch {
      setImpersonate({ state: 'error', message: 'Netzwerkfehler' })
    }
  }

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

  const { profile, sites, invoices, events, subscriptionDiscount } = data
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
              {usernameEdit ? (
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-sm font-mono" style={{ color: 'var(--muted-foreground)' }}>@</span>
                  <input
                    autoFocus
                    value={usernameEdit.value}
                    onChange={e => setUsernameEdit(prev => prev ? { ...prev, value: e.target.value, error: '' } : prev)}
                    onKeyDown={e => { if (e.key === 'Enter') saveUsername(); if (e.key === 'Escape') setUsernameEdit(null) }}
                    disabled={usernameEdit.saving}
                    className="text-sm font-mono rounded-lg px-2 py-0.5 border outline-none"
                    style={{ borderColor: usernameEdit.error ? '#EF4444' : '#D1D5DB', width: 160 }}
                    placeholder="username"
                  />
                  <button
                    onClick={saveUsername}
                    disabled={usernameEdit.saving}
                    className="text-xs font-medium px-2.5 py-1 rounded-lg"
                    style={{ background: '#111827', color: '#fff', opacity: usernameEdit.saving ? 0.6 : 1 }}
                  >
                    {usernameEdit.saving ? '…' : 'Speichern'}
                  </button>
                  <button
                    onClick={() => setUsernameEdit(null)}
                    disabled={usernameEdit.saving}
                    className="text-xs px-2 py-1 rounded-lg"
                    style={{ color: 'var(--muted-foreground)' }}
                  >
                    Abbrechen
                  </button>
                  {usernameEdit.error && (
                    <span className="text-xs" style={{ color: '#EF4444' }}>{usernameEdit.error}</span>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-1.5 mt-0.5">
                  {profile.username && (
                    <p className="text-sm font-mono" style={{ color: 'var(--muted-foreground)' }}>
                      @{profile.username}
                    </p>
                  )}
                  <button
                    onClick={() => setUsernameEdit({ value: profile.username ?? '', saving: false, error: '' })}
                    className="p-0.5 rounded hover:bg-gray-100 transition-colors"
                    title="Benutzername ändern"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2">
                      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                  </button>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
              <span className="text-xs font-medium px-2.5 py-1 rounded-full"
                style={{ background: planColor.bg, color: planColor.text }}>
                {profile.plan}{profile.billingInterval ? ` · ${profile.billingInterval === 'yearly' ? 'Jährlich' : 'Monatlich'}` : ''}
              </span>
              {!profile.stripeCustomerId && profile.plan !== 'starter' && (
                <span className="text-xs px-2.5 py-1 rounded-full"
                  style={{ background: '#FFF7ED', color: '#C2410C' }}>
                  Manuell gesetzt
                </span>
              )}
              {profile.subscriptionStatus && !profile.cancelAtPeriodEnd && (
                <span className="text-xs px-2.5 py-1 rounded-full"
                  style={{
                    background: profile.subscriptionStatus === 'active' ? '#F0FDF4' : '#FEF2F2',
                    color: profile.subscriptionStatus === 'active' ? '#16A34A' : '#DC2626',
                  }}>
                  {STATUS_LABELS[profile.subscriptionStatus] ?? profile.subscriptionStatus}
                </span>
              )}
              {profile.cancelAtPeriodEnd && (
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
                  style={{ background: '#FFF7ED', color: '#C2410C', border: '1px solid #FED7AA' }}>
                  Kündigt{profile.currentPeriodEnd ? ` zum ${new Date(profile.currentPeriodEnd).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}` : ''}
                </span>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 pt-2" style={{ borderTop: '1px solid #F3F4F6' }}>
            <div>
              <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--muted-foreground)' }}>Registriert</p>
              <p className="text-sm text-gray-900">{new Date(profile.createdAt).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
            </div>
            {profile.currentPeriodEnd && profile.subscriptionStatus && (
              <div>
                <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--muted-foreground)' }}>
                  {profile.cancelAtPeriodEnd ? 'Zugang bis' : 'Nächste Verlängerung'}
                </p>
                <p className="text-sm font-medium" style={{ color: profile.cancelAtPeriodEnd ? '#C2410C' : '#374151' }}>
                  {new Date(profile.currentPeriodEnd).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })}
                </p>
              </div>
            )}
            {profile.stripeCustomerId && (
              <div>
                <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--muted-foreground)' }}>Stripe-Kunde</p>
                <a
                  href={`https://dashboard.stripe.com/customers/${profile.stripeCustomerId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-mono flex items-center gap-1 hover:underline"
                  style={{ color: '#6D28D9' }}
                >
                  {profile.stripeCustomerId}
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                  </svg>
                </a>
              </div>
            )}
            {profile.stripeSubscriptionId && (
              <div>
                <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--muted-foreground)' }}>Stripe-Abo</p>
                <a
                  href={`https://dashboard.stripe.com/subscriptions/${profile.stripeSubscriptionId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-mono flex items-center gap-1 hover:underline"
                  style={{ color: '#6D28D9' }}
                >
                  {profile.stripeSubscriptionId}
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                  </svg>
                </a>
              </div>
            )}
          </div>

          {/* Consent Audit */}
          <div className="pt-3 flex flex-col gap-2" style={{ borderTop: '1px solid #F3F4F6' }}>
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-700">Content-Einwilligung</p>
              {profile.contentConsentAt ? (
                <span className="text-xs px-2.5 py-1 rounded-full flex items-center gap-1"
                  style={{ background: '#F0FDF4', color: '#15803D' }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  Erteilt
                </span>
              ) : (
                <span className="text-xs px-2.5 py-1 rounded-full flex items-center gap-1"
                  style={{ background: '#FEF2F2', color: '#DC2626' }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                  Nicht erteilt
                </span>
              )}
            </div>
            {profile.contentConsentAt ? (
              <div className="rounded-xl flex flex-col gap-0 text-xs overflow-hidden"
                style={{ border: '1px solid #E5E7EB' }}>

                {/* Metadata rows */}
                <div className="flex flex-col gap-0 p-3 pb-2" style={{ background: '#F9FAFB' }}>
                  <div className="flex gap-2 py-1">
                    <span className="font-medium text-gray-500 w-16 flex-shrink-0">Zeitpunkt</span>
                    <span className="text-gray-800 font-mono">
                      {new Date(profile.contentConsentAt).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })} UTC
                    </span>
                  </div>
                  <div className="flex gap-2 py-1">
                    <span className="font-medium text-gray-500 w-16 flex-shrink-0">Version</span>
                    <span className="text-gray-800 font-mono">{profile.contentConsentVersion ?? '—'}</span>
                  </div>
                  {profile.contentConsentIp && profile.contentConsentIp !== 'migration-pre-consent-feature' && (
                    <div className="flex gap-2 py-1">
                      <span className="font-medium text-gray-500 w-16 flex-shrink-0">IP</span>
                      <span className="text-gray-800 font-mono">{profile.contentConsentIp}</span>
                    </div>
                  )}
                  {profile.contentConsentTextHash && profile.contentConsentTextHash !== 'migration-pre-consent-feature' && (
                    <div className="flex gap-2 py-1 items-start">
                      <span className="font-medium text-gray-500 w-16 flex-shrink-0 mt-0.5">Hash</span>
                      <div className="flex flex-col gap-1 min-w-0">
                        <span className="text-gray-700 font-mono break-all" style={{ fontSize: 10 }}>{profile.contentConsentTextHash}</span>
                        {hashStatus === 'ok' && (
                          <span className="flex items-center gap-1 text-[10px] font-semibold" style={{ color: '#15803D' }}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                            Hash verifiziert — stimmt mit Textversion überein
                          </span>
                        )}
                        {hashStatus === 'mismatch' && (
                          <span className="flex items-center gap-1 text-[10px] font-semibold" style={{ color: '#DC2626' }}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            Hash stimmt NICHT überein — Text wurde möglicherweise verändert!
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                  {profile.contentConsentUa && profile.contentConsentUa !== 'migration-pre-consent-feature' && (
                    <div className="flex gap-2 py-1">
                      <span className="font-medium text-gray-500 w-16 flex-shrink-0">Browser</span>
                      <span className="text-gray-600 break-all" style={{ fontSize: 10, lineHeight: '1.4' }}>{profile.contentConsentUa}</span>
                    </div>
                  )}
                  {profile.contentConsentIp === 'migration-pre-consent-feature' && (
                    <div className="mt-1 flex items-center gap-1.5 px-2 py-1 rounded-lg" style={{ background: '#FEF9C3', color: '#92400E' }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                        <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                      </svg>
                      <span className="text-[10px] font-semibold">Altbestand — vor Einführung der Consent-Protokollierung registriert. IP, Hash und Browser nicht verfügbar.</span>
                    </div>
                  )}
                </div>

                {/* Consent text toggle */}
                {profile.contentConsentVersion && CONSENT_TEXTS[profile.contentConsentVersion] && (
                  <>
                    <button
                      type="button"
                      onClick={() => setConsentTextOpen(v => !v)}
                      className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium transition-colors"
                      style={{ background: '#F3F4F6', borderTop: '1px solid #E5E7EB', color: '#374151' }}>
                      <span className="flex items-center gap-1.5">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
                        </svg>
                        Bestätigten Text anzeigen ({profile.contentConsentVersion})
                      </span>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                        style={{ transform: consentTextOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                        <path d="M6 9l6 6 6-6"/>
                      </svg>
                    </button>
                    {consentTextOpen && (
                      <pre className="px-3 py-3 text-xs leading-relaxed whitespace-pre-wrap"
                        style={{ color: '#374151', fontFamily: 'inherit', background: '#fff', borderTop: '1px solid #F3F4F6' }}>
                        {CONSENT_TEXTS[profile.contentConsentVersion]}
                      </pre>
                    )}
                  </>
                )}
              </div>
            ) : (
              <p className="text-xs" style={{ color: '#9CA3AF' }}>
                User hat noch keine Inhalts-Einwilligung erteilt. Er wird beim nächsten Login auf /onboarding/consent geleitet.
              </p>
            )}
          </div>
        </div>

        {/* Profildaten */}
        {(profile.firstName || profile.lastName || profile.phone || profile.websiteUrl ||
          profile.instagram || profile.facebook || profile.linkedin || profile.tiktok || profile.youtube) && (
          <div className="p-6 rounded-[24px] bg-white flex flex-col gap-4"
            style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.08)', border: '1px solid var(--border)' }}>
            <h2 className="font-medium text-gray-900">Profildaten</h2>

            {/* Name & Kontakt */}
            {(profile.firstName || profile.lastName || profile.phone || profile.websiteUrl) && (
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                {(profile.firstName || profile.lastName) && (
                  <div>
                    <p className="text-xs font-medium mb-0.5" style={{ color: '#94A3B8' }}>Name</p>
                    <p className="text-sm text-gray-900">
                      {[profile.firstName, profile.lastName].filter(Boolean).join(' ')}
                    </p>
                  </div>
                )}
                {profile.phone && (
                  <div>
                    <p className="text-xs font-medium mb-0.5" style={{ color: '#94A3B8' }}>Telefon</p>
                    <a href={`tel:${profile.phone}`} className="text-sm hover:underline" style={{ color: '#374151' }}>
                      {profile.phone}
                    </a>
                  </div>
                )}
                {profile.websiteUrl && (
                  <div className="col-span-2">
                    <p className="text-xs font-medium mb-0.5" style={{ color: '#94A3B8' }}>Website</p>
                    <a href={profile.websiteUrl} target="_blank" rel="noopener noreferrer"
                      className="text-sm hover:underline truncate block" style={{ color: '#2563EB' }}>
                      {profile.websiteUrl}
                    </a>
                  </div>
                )}
              </div>
            )}

            {/* Social Media */}
            {(profile.instagram || profile.facebook || profile.linkedin || profile.tiktok || profile.youtube) && (
              <div className="flex flex-col gap-2 pt-2" style={{ borderTop: '1px solid #F3F4F6' }}>
                <p className="text-xs font-medium" style={{ color: '#94A3B8' }}>Social Media</p>
                <div className="flex flex-wrap gap-2">
                  {profile.instagram && (() => {
                    const handle = extractSocialHandle(profile.instagram)
                    return (
                      <a href={`https://instagram.com/${handle}`}
                        target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
                        style={{ background: '#FDF2F8', color: '#9D174D', border: '1px solid #FBCFE8' }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
                        </svg>
                        @{handle}
                      </a>
                    )
                  })()}
                  {profile.tiktok && (() => {
                    const handle = extractSocialHandle(profile.tiktok)
                    return (
                      <a href={`https://tiktok.com/@${handle}`}
                        target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
                        style={{ background: '#F0FDF4', color: '#166534', border: '1px solid #BBF7D0' }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.77 1.52V6.76a4.85 4.85 0 01-1-.07z"/>
                        </svg>
                        @{handle}
                      </a>
                    )
                  })()}
                  {profile.facebook && (() => {
                    const handle = extractSocialHandle(profile.facebook)
                    return (
                      <a href={profile.facebook.startsWith('http') ? profile.facebook : `https://facebook.com/${handle}`}
                        target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
                        style={{ background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE' }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z"/>
                        </svg>
                        {handle}
                      </a>
                    )
                  })()}
                  {profile.linkedin && (() => {
                    const handle = extractSocialHandle(profile.linkedin)
                    return (
                      <a href={profile.linkedin.startsWith('http') ? profile.linkedin : `https://linkedin.com/in/${handle}`}
                        target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
                        style={{ background: '#F0F9FF', color: '#0369A1', border: '1px solid #BAE6FD' }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6zM2 9h4v12H2z"/><circle cx="4" cy="4" r="2"/>
                        </svg>
                        {handle}
                      </a>
                    )
                  })()}
                  {profile.youtube && (() => {
                    const handle = extractSocialHandle(profile.youtube)
                    return (
                      <a href={profile.youtube.startsWith('http') ? profile.youtube : `https://youtube.com/@${handle}`}
                        target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
                        style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M22.54 6.42a2.78 2.78 0 00-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 00-1.95 1.96A29 29 0 001 12a29 29 0 00.46 5.58A2.78 2.78 0 003.41 19.6C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 001.95-1.95A29 29 0 0023 12a29 29 0 00-.46-5.58z"/><polygon fill="white" points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02"/>
                        </svg>
                        {handle}
                      </a>
                    )
                  })()}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Sites */}
        <div className="p-6 rounded-[24px] bg-white flex flex-col gap-3"
          style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.08)', border: '1px solid var(--border)' }}>
          <h2 className="font-medium text-gray-900">Websites ({sites.length})</h2>
          {sites.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Keine Websites vorhanden.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {sites.map(site => {
                const subdomain = profile.username && site.template?.domain
                  ? `${profile.username}.${site.template.domain}`
                  : null
                const hasCustomDomain = site.customDomainStatus === 'active' && !!site.customDomain
                return (
                  <div key={site.id} className="flex items-center justify-between p-3 rounded-[14px]"
                    style={{ background: '#F9FAFB', border: '1px solid #F3F4F6' }}>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-900">{site.template?.title ?? 'Website'}</p>
                        <span className="text-[10px]" style={{ color: '#94A3B8' }}>
                          {new Date(site.createdAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                        </span>
                      </div>
                      {subdomain && (
                        <a href={`https://${subdomain}`} target="_blank" rel="noopener noreferrer"
                          className="text-xs font-mono mt-0.5 flex items-center gap-1 hover:underline"
                          style={{ color: '#94A3B8' }}>
                          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                          </svg>
                          {subdomain}
                        </a>
                      )}
                      {site.customDomain && (
                        <a href={hasCustomDomain ? `https://${site.customDomain}` : undefined}
                          target={hasCustomDomain ? '_blank' : undefined}
                          rel="noopener noreferrer"
                          className="text-xs font-mono mt-0.5 flex items-center gap-1"
                          style={{ color: hasCustomDomain ? '#16A34A' : '#F59E0B', cursor: hasCustomDomain ? 'pointer' : 'default' }}
                          onClick={e => { if (!hasCustomDomain) e.preventDefault() }}>
                          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
                            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                          </svg>
                          {site.customDomain}
                          {!hasCustomDomain && (
                            <span className="ml-1 text-[9px] font-semibold px-1 py-0.5 rounded"
                              style={{ background: '#FEF3C7', color: '#92400E' }}>
                              {site.customDomainStatus === 'pending_ssl' ? 'SSL pending' : 'DNS ausstehend'}
                            </span>
                          )}
                        </a>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span className="text-xs px-2.5 py-0.5 rounded-full"
                        style={{
                          background: site.status === 'published' ? '#F0FDF4' : '#F3F4F6',
                          color: site.status === 'published' ? '#16A34A' : '#6B7280',
                        }}>
                        {site.status === 'published' ? '● Live' : '○ Entwurf'}
                      </span>
                      {site.contentConsentGivenAt ? (
                        <span className="text-[10px] flex items-center gap-1" style={{ color: '#16A34A' }}
                          title={`IP: ${site.contentConsentIp ?? 'unbekannt'}`}>
                          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/>
                          </svg>
                          Consent {new Date(site.contentConsentGivenAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                        </span>
                      ) : (
                        <span className="text-[10px]" style={{ color: '#D1D5DB' }}>Kein Consent</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Affiliate Partner */}
        <div className="p-6 rounded-[24px] bg-white flex flex-col gap-4"
          style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.08)', border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-medium text-gray-900">Partner-Zuordnung</h2>
              <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>
                Der zugeordnete Partner erhält ab diesem Zeitpunkt Provision auf alle zukünftigen Zahlungen.
              </p>
            </div>
            {profile.referredByUsername && affiliateCard.mode === 'view' && (
              <button
                onClick={() => setAffiliateCard({ mode: 'search', query: '', results: [], selected: null, saving: false })}
                className="text-xs px-3 py-1.5 rounded-[8px] font-medium"
                style={{ background: '#F3F4F6', color: '#374151' }}
              >
                Ändern
              </button>
            )}
          </div>

          {/* State: assigned + view */}
          {profile.referredByUsername && affiliateCard.mode === 'view' && (
            <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-[14px]"
              style={{ background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: '#DCFCE7', border: '1.5px solid #86EFAC' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2">
                    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
                    <path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: '#15803D' }}>@{profile.referredByUsername}</p>
                  <p className="text-xs" style={{ color: '#16A34A' }}>Aktiver Partner — erhält Provision</p>
                </div>
              </div>
              <button
                onClick={removeAffiliate}
                className="text-xs px-3 py-1.5 rounded-[8px]"
                style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}
              >
                Aufheben
              </button>
            </div>
          )}

          {/* State: removing */}
          {affiliateCard.mode === 'removing' && (
            <div className="flex items-center gap-2 p-3 rounded-[12px]" style={{ background: '#F9FAFB' }}>
              <div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid #9CA3AF', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
              <span className="text-sm" style={{ color: '#6B7280' }}>Zuordnung wird aufgehoben…</span>
            </div>
          )}

          {/* State: no affiliate assigned + view */}
          {!profile.referredByUsername && affiliateCard.mode === 'view' && (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: '#F3F4F6', border: '1.5px solid #E5E7EB' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-sm" style={{ color: '#6B7280' }}>Kein Partner zugeordnet</p>
              </div>
              <button
                onClick={() => setAffiliateCard({ mode: 'search', query: '', results: [], selected: null, saving: false })}
                className="text-sm font-semibold px-4 py-2 rounded-[10px] text-white"
                style={{ background: '#111827' }}
              >
                Partner zuordnen
              </button>
            </div>
          )}

          {/* State: search / confirm */}
          {affiliateCard.mode === 'search' && (
            <div className="flex flex-col gap-3">
              <div className="relative">
                <input
                  type="text"
                  value={affiliateCard.query}
                  onChange={e => handleAffiliateSearch(e.target.value)}
                  placeholder="Partner suchen (E-Mail oder @username)…"
                  autoFocus
                  className="w-full px-4 py-2.5 text-sm rounded-[12px] outline-none"
                  style={{ background: '#F9FAFB', border: '1.5px solid #E5E7EB' }}
                  onFocus={e => (e.target.style.borderColor = '#111827')}
                  onBlur={e => (e.target.style.borderColor = '#E5E7EB')}
                />
                {affiliateCard.results.length > 0 && !affiliateCard.selected && (
                  <div className="absolute top-full left-0 right-0 z-10 mt-1 rounded-[12px] overflow-hidden"
                    style={{ background: '#fff', border: '1px solid #E5E7EB', boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}>
                    {affiliateCard.results.map(r => (
                      <button
                        key={r.id}
                        onClick={() => assignAffiliate(r)}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50 transition-colors"
                        style={{ borderBottom: '1px solid #F3F4F6' }}
                      >
                        <div>
                          <p className="text-sm font-medium text-gray-900">{r.username ? `@${r.username}` : r.email}</p>
                          {r.username && <p className="text-xs" style={{ color: '#9CA3AF' }}>{r.email}</p>}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {affiliateCard.selected && (
                <div className="flex items-center gap-3 px-4 py-3 rounded-[12px]"
                  style={{ background: '#EFF6FF', border: '1px solid #BFDBFE' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/><polyline points="12 8 12 12 14 14"/>
                  </svg>
                  <p className="text-sm flex-1" style={{ color: '#1D4ED8' }}>
                    Wird zugeordnet: <strong>@{affiliateCard.selected.username}</strong>
                  </p>
                  {affiliateCard.saving && (
                    <div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid #2563EB', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
                  )}
                </div>
              )}

              {affiliateCard.query.length >= 2 && affiliateCard.results.length === 0 && !affiliateCard.selected && (
                <p className="text-xs px-1" style={{ color: '#9CA3AF' }}>Kein aktiver Partner mit diesem Namen gefunden.</p>
              )}

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setAffiliateCard({ mode: 'view' })}
                  className="text-sm px-4 py-2 rounded-[10px]"
                  style={{ background: '#F3F4F6', color: '#374151' }}
                >
                  Abbrechen
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Impersonation */}
        <div className="p-6 rounded-[24px] bg-white flex flex-col gap-3"
          style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.08)', border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-medium text-gray-900">Account-Zugriff</h2>
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#F5F3FF', color: '#7C3AED' }}>
              Nur mit Freigabe
            </span>
          </div>
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
            Sende dem User eine Freigabeanfrage im Support-Chat. Wenn er zustimmt, kannst du dich in seinen Account einloggen.
          </p>
          {impersonate.state === 'idle' && (
            <button
              onClick={requestImpersonation}
              className="self-start text-sm font-semibold px-4 py-2 rounded-[10px] border transition-colors"
              style={{ background: '#F5F3FF', color: '#7C3AED', border: '1px solid #DDD6FE' }}
            >
              Freigabe anfordern
            </button>
          )}
          {impersonate.state === 'requesting' && (
            <p className="text-sm" style={{ color: '#7C3AED' }}>Anfrage wird gesendet...</p>
          )}
          {impersonate.state === 'waiting' && (
            <div className="flex items-center gap-3 p-3 rounded-[12px]"
              style={{ background: '#F5F3FF', border: '1px solid #DDD6FE' }}>
              <div style={{
                width: 16, height: 16, borderRadius: '50%',
                border: '2.5px solid #7C3AED', borderTopColor: 'transparent',
                animation: 'spin 0.8s linear infinite', flexShrink: 0,
              }} />
              <p className="text-sm font-medium" style={{ color: '#7C3AED' }}>
                Warte auf Freigabe durch den User...
              </p>
            </div>
          )}
          {impersonate.state === 'approved' && (
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold" style={{ color: '#059669' }}>
                Freigabe erteilt.
              </span>
              <a
                href={`/api/admin/impersonate/enter?token=${impersonate.token}`}
                className="text-sm font-semibold px-4 py-2 rounded-[10px] text-white"
                style={{ background: '#7C3AED' }}
              >
                Als User einloggen →
              </a>
            </div>
          )}
          {impersonate.state === 'rejected' && (
            <div className="flex items-center gap-3">
              <span className="text-sm" style={{ color: '#DC2626' }}>
                Der User hat die Anfrage abgelehnt.
              </span>
              <button
                onClick={() => setImpersonate({ state: 'idle' })}
                className="text-xs px-3 py-1.5 rounded-[8px]"
                style={{ background: '#F3F4F6', color: '#374151' }}
              >
                Zurücksetzen
              </button>
            </div>
          )}
          {impersonate.state === 'error' && (
            <div className="flex items-center gap-3">
              <span className="text-sm" style={{ color: '#DC2626' }}>{impersonate.message}</span>
              <button
                onClick={() => setImpersonate({ state: 'idle' })}
                className="text-xs px-3 py-1.5 rounded-[8px]"
                style={{ background: '#F3F4F6', color: '#374151' }}
              >
                Erneut versuchen
              </button>
            </div>
          )}
        </div>

        {/* Invoices */}
        <div className="p-6 rounded-[24px] bg-white flex flex-col gap-3"
          style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.08)', border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-medium text-gray-900">Zahlungen</h2>
            {subscriptionDiscount && (subscriptionDiscount.promoCode || subscriptionDiscount.couponName) && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                style={{ background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5">
                  <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/>
                  <line x1="7" y1="7" x2="7.01" y2="7"/>
                </svg>
                <span className="text-xs font-semibold" style={{ color: '#16A34A' }}>
                  {subscriptionDiscount.promoCode ?? subscriptionDiscount.couponName}
                </span>
              </div>
            )}
          </div>
          {!profile.stripeCustomerId ? (
            <div className="flex items-center gap-2 p-3 rounded-[12px]" style={{ background: '#FFF7ED', border: '1px solid #FED7AA' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#C2410C" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <p className="text-xs" style={{ color: '#92400E' }}>
                Kein Stripe-Kunde verknüpft – Plan wurde manuell gesetzt, keine Zahlungshistorie vorhanden.
              </p>
            </div>
          ) : invoices.length === 0 ? (
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

        {/* Abo-Verlauf */}
        <div className="p-6 rounded-[24px] bg-white flex flex-col gap-3"
          style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.08)', border: '1px solid var(--border)' }}>
          <h2 className="font-medium text-gray-900">Abo-Verlauf</h2>
          {(!events || events.length === 0) ? (
            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
              {!profile.stripeCustomerId
                ? 'Plan manuell gesetzt – kein Abo-Verlauf via Stripe vorhanden.'
                : 'Noch keine Ereignisse aufgezeichnet.'}
            </p>
          ) : (
            <div className="relative flex flex-col gap-0 mt-1">
              <div className="absolute left-[9px] top-3 bottom-3 w-px" style={{ background: '#E5E7EB' }} />
              {events.map((ev, idx) => {
                const isLast = idx === events.length - 1
                const dt = new Date(ev.createdAt)
                const dateStr = dt.toLocaleDateString('de-DE', { day: 'numeric', month: 'short', year: 'numeric' })
                  + ' · '
                  + dt.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })

                type DotColor = { dot: string; bg: string }
                const STYLE: Record<string, DotColor> = {
                  subscription_created: { dot: '#16A34A', bg: '#F0FDF4' },
                  subscription_renewed: { dot: '#2563EB', bg: '#EFF6FF' },
                  subscription_updated: { dot: '#9CA3AF', bg: '#F9FAFB' },
                  subscription_canceled: { dot: '#F97316', bg: '#FFF7ED' },
                  subscription_deleted: { dot: '#DC2626', bg: '#FEF2F2' },
                  payment_failed: { dot: '#DC2626', bg: '#FEF2F2' },
                  payment_succeeded: { dot: '#16A34A', bg: '#F0FDF4' },
                  account_deactivated: { dot: '#DC2626', bg: '#FEF2F2' },
                }
                const style = STYLE[ev.eventType] ?? { dot: '#9CA3AF', bg: '#F9FAFB' }

                const LABEL: Record<string, string> = {
                  subscription_created: 'Abo gestartet',
                  subscription_renewed: 'Verlängerung',
                  subscription_updated: 'Abo geändert',
                  subscription_canceled: 'Kündigung gesetzt',
                  subscription_deleted: 'Abo beendet',
                  payment_failed: 'Zahlung fehlgeschlagen',
                  payment_succeeded: 'Zahlung erfolgreich',
                  account_deactivated: 'Konto deaktiviert',
                }
                const label = LABEL[ev.eventType] ?? ev.eventType

                let detail: string | null = null
                if (ev.eventType === 'subscription_created' && ev.plan) {
                  detail = `${ev.plan}${ev.billingInterval ? ` · ${ev.billingInterval}` : ''}`
                } else if (ev.eventType === 'subscription_renewed') {
                  const parts: string[] = []
                  if (ev.plan) parts.push(ev.plan)
                  if (ev.amountCents != null) parts.push(`€ ${(ev.amountCents / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
                  detail = parts.join(' · ') || null
                } else if (ev.eventType === 'subscription_updated' && ev.plan) {
                  detail = ev.plan
                } else if (ev.eventType === 'payment_succeeded' && ev.amountCents != null) {
                  detail = `€ ${(ev.amountCents / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                }

                return (
                  <div key={ev.id} className={`relative flex items-start gap-4 ${isLast ? '' : 'pb-4'}`}>
                    <div className="relative z-10 mt-0.5 flex-shrink-0">
                      <div className="w-[19px] h-[19px] rounded-full flex items-center justify-center"
                        style={{ background: style.bg, border: `2px solid ${style.dot}` }}>
                        <div className="w-1.5 h-1.5 rounded-full" style={{ background: style.dot }} />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-4">
                        <span className="text-sm font-medium text-gray-900">{label}</span>
                        <span className="text-xs flex-shrink-0 tabular-nums" style={{ color: '#94A3B8' }}>
                          {dateStr}
                        </span>
                      </div>
                      {detail && (
                        <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>{detail}</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Support-Gespräche */}
        <div className="p-6 rounded-[24px] bg-white flex flex-col gap-3"
          style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.08)', border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between">
            <h2 className="font-medium text-gray-900">Support-Gespräche ({supportConvs.length})</h2>
            <Link href="/admin/support" className="text-xs font-medium" style={{ color: '#3B82F6' }}>
              Alle anzeigen →
            </Link>
          </div>
          {supportConvs.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Keine Support-Gespräche vorhanden.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {supportConvs.map(conv => {
                const months = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez']
                const d = new Date(conv.createdAt)
                const title = conv.subject ?? `Chat vom ${d.getDate()}. ${months[d.getMonth()]} ${d.getFullYear()}`
                const statusStyle = STATUS_COLORS[conv.status] ?? STATUS_COLORS.closed

                let preview = 'Noch keine Nachrichten'
                if (conv.lastMessage) {
                  if (conv.lastMessage.contentType === 'image') preview = '📷 Bild'
                  else if (conv.lastMessage.contentType === 'gif') preview = '🎬 GIF'
                  else {
                    preview = conv.lastMessage.content.length > 60
                      ? conv.lastMessage.content.slice(0, 60) + '…'
                      : conv.lastMessage.content
                  }
                }

                return (
                  <div key={conv.id} className="flex items-start justify-between gap-3 p-3 rounded-[14px]"
                    style={{ background: '#F9FAFB', border: '1px solid #F3F4F6' }}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-900 truncate">{title}</span>
                        {conv.unreadByAdmin > 0 && (
                          <div className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-white"
                            style={{ background: '#3B82F6', fontSize: 10, fontWeight: 700 }}>
                            {conv.unreadByAdmin > 9 ? '9+' : conv.unreadByAdmin}
                          </div>
                        )}
                      </div>
                      <p className="text-xs mt-0.5 truncate" style={{ color: '#9CA3AF' }}>{preview}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: statusStyle.bg, color: statusStyle.text }}>
                        {STATUS_LABEL[conv.status]}
                      </span>
                      <span className="text-xs" style={{ color: '#9CA3AF' }}>
                        {new Date(conv.lastMessageAt ?? conv.createdAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                      </span>
                    </div>
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
