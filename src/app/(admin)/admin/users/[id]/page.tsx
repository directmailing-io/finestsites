'use client'

import { useState, useEffect, use, useCallback } from 'react'
import Link from 'next/link'

interface UserProfile {
  id: string
  email: string
  username: string | null
  plan: string
  subscriptionStatus: string | null
  createdAt: string
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
}

interface UserSite {
  id: string
  status: string
  customDomain: string | null
  customDomainStatus: string | null
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

export default function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [data, setData] = useState<UserDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [supportConvs, setSupportConvs] = useState<SupportConv[]>([])

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
              {!profile.stripeCustomerId && profile.plan !== 'starter' && (
                <span className="text-xs px-2.5 py-1 rounded-full"
                  style={{ background: '#FFF7ED', color: '#C2410C' }}>
                  Manuell gesetzt
                </span>
              )}
              {profile.subscriptionStatus && (
                <span className="text-xs px-2.5 py-1 rounded-full"
                  style={{
                    background: profile.subscriptionStatus === 'active' ? '#F0FDF4' : '#FEF2F2',
                    color: profile.subscriptionStatus === 'active' ? '#16A34A' : '#DC2626',
                  }}>
                  {STATUS_LABELS[profile.subscriptionStatus] ?? profile.subscriptionStatus}
                </span>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 pt-2" style={{ borderTop: '1px solid #F3F4F6' }}>
            <div>
              <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--muted-foreground)' }}>Registriert</p>
              <p className="text-sm text-gray-900">{new Date(profile.createdAt).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
            </div>
            {profile.stripeCustomerId && (
              <div>
                <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--muted-foreground)' }}>Stripe-ID</p>
                <p className="text-sm font-mono text-gray-700">{profile.stripeCustomerId}</p>
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
                    <span className="text-xs px-2.5 py-0.5 rounded-full flex-shrink-0"
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
