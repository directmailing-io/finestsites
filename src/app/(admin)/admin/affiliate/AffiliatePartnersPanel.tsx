'use client'

import { useState } from 'react'

interface ReferredUser {
  id: string
  email: string
  plan: string
  subscriptionStatus: string | null
  createdAt: string
  commissionEarnedCents: number
}

interface AffiliatePartner {
  id: string
  username: string | null
  email: string
  affiliateOnboarded: boolean
  referredUsers: ReferredUser[]
  commissions: { pending: number; available: number; paid: number; total: number }
}

interface AffiliatePartnersPanelProps {
  partners: AffiliatePartner[]
}

function fmtEur(cents: number) {
  return (cents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
}

function fmtDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('de-DE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function getInitials(username: string | null, email: string): string {
  const src = username ?? email
  return src.slice(0, 2).toUpperCase()
}

const PLAN_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  starter:   { bg: '#EFF6FF', text: '#1D4ED8', label: 'Starter' },
  pro:       { bg: '#F5F3FF', text: '#7C3AED', label: 'Pro' },
  unlimited: { bg: '#F0FDF4', text: '#16A34A', label: 'Unlimited' },
}

function getPlanBadge(plan: string) {
  return PLAN_BADGE[plan] ?? { bg: '#F1F5F9', text: '#64748B', label: plan }
}

function getStatusDisplay(status: string | null): { label: string; color: string } {
  switch (status) {
    case 'active':    return { label: 'Aktiv',           color: '#16A34A' }
    case 'canceled':  return { label: 'Gekündigt',       color: '#DC2626' }
    case 'past_due':  return { label: 'Zahlung offen',   color: '#D97706' }
    case 'trialing':  return { label: 'Testphase',       color: '#1D4ED8' }
    default:          return { label: 'Kein Abo',        color: '#94A3B8' }
  }
}

function getHealthDot(referredUsers: ReferredUser[]): { color: string; title: string } {
  if (referredUsers.length === 0) {
    return { color: '#CBD5E1', title: 'Kein Nutzer zugeordnet' }
  }
  const hasActive = referredUsers.some(u => u.subscriptionStatus === 'active')
  if (hasActive) {
    return { color: '#16A34A', title: 'Mindestens ein aktiver Nutzer' }
  }
  return { color: '#F59E0B', title: 'Nutzer vorhanden, keiner aktiv' }
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
        transition: 'transform 0.15s ease',
        color: '#94A3B8',
      }}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}

function InfoIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ color: '#CBD5E1', flexShrink: 0 }}
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  )
}

function UsersIcon() {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ color: '#CBD5E1' }}
    >
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

function PartnerRow({ partner, expanded, onToggle }: {
  partner: AffiliatePartner
  expanded: boolean
  onToggle: () => void
}) {
  const initials = getInitials(partner.username, partner.email)
  const health = getHealthDot(partner.referredUsers)
  const userCount = partner.referredUsers.length

  return (
    <div
      className="rounded-[20px] bg-white overflow-hidden"
      style={{
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        border: '1px solid #F1F5F9',
      }}
    >
      {/* Collapsed header row */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-5 py-4 text-left"
        style={{ background: 'white' }}
      >
        {/* Health dot */}
        <span
          className="flex-shrink-0 w-2 h-2 rounded-full"
          style={{ background: health.color }}
          title={health.title}
        />

        {/* Avatar */}
        <span
          className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold"
          style={{ background: '#F3F4F6', color: '#374151', fontSize: '13px' }}
        >
          {initials}
        </span>

        {/* Name + email */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">
            {partner.username ? `@${partner.username}` : partner.email}
          </p>
          {partner.username && (
            <p className="text-xs truncate" style={{ color: '#94A3B8' }}>
              {partner.email}
            </p>
          )}
        </div>

        {/* Right side badges */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* User count */}
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{ background: '#EFF6FF', color: '#1D4ED8' }}
          >
            #{userCount} Nutzer
          </span>

          {/* Onboarding status */}
          {partner.affiliateOnboarded ? (
            <span
              className="text-xs font-medium px-2 py-0.5 rounded-full"
              style={{ background: '#F0FDF4', color: '#16A34A' }}
            >
              Onboardet
            </span>
          ) : (
            <span
              className="text-xs font-medium px-2 py-0.5 rounded-full"
              style={{ background: '#F1F5F9', color: '#64748B' }}
            >
              Noch nicht onboardet
            </span>
          )}

          {/* Total commission */}
          {partner.commissions.total > 0 && (
            <span
              className="text-sm font-semibold"
              style={{ color: '#16A34A', minWidth: 56, textAlign: 'right' }}
            >
              {fmtEur(partner.commissions.total)}
            </span>
          )}

          {/* Chevron */}
          <ChevronIcon expanded={expanded} />
        </div>
      </button>

      {/* Expanded user list */}
      {expanded && (
        <div style={{ borderTop: '1px solid #F1F5F9' }}>
          {partner.referredUsers.length === 0 ? (
            <div className="flex items-center gap-2 px-6 py-4" style={{ color: '#94A3B8' }}>
              <InfoIcon />
              <span className="text-sm">Noch kein Nutzer zugeordnet.</span>
            </div>
          ) : (
            <>
              {/* Table header */}
              <div
                className="grid px-5 py-2"
                style={{
                  gridTemplateColumns: '2fr 90px 110px 110px 90px',
                  background: '#F8FAFC',
                  borderBottom: '1px solid #F1F5F9',
                }}
              >
                {['E-Mail', 'Plan', 'Status', 'Zugeordnet seit', 'Provision'].map((col) => (
                  <span
                    key={col}
                    className="text-[11px] font-semibold uppercase tracking-wide"
                    style={{ color: '#94A3B8' }}
                  >
                    {col}
                  </span>
                ))}
              </div>

              {/* User rows */}
              <div>
                {partner.referredUsers.map((user, idx) => {
                  const planBadge = getPlanBadge(user.plan)
                  const status = getStatusDisplay(user.subscriptionStatus)
                  const isLast = idx === partner.referredUsers.length - 1

                  return (
                    <div
                      key={user.id}
                      className="grid items-center px-5 py-2.5"
                      style={{
                        gridTemplateColumns: '2fr 90px 110px 110px 90px',
                        borderBottom: isLast ? 'none' : '1px solid #F8FAFC',
                      }}
                    >
                      {/* Email */}
                      <span className="text-sm text-gray-900 truncate pr-2">{user.email}</span>

                      {/* Plan badge */}
                      <span>
                        <span
                          className="text-xs font-medium px-2 py-0.5 rounded-full"
                          style={{ background: planBadge.bg, color: planBadge.text }}
                        >
                          {planBadge.label}
                        </span>
                      </span>

                      {/* Subscription status */}
                      <span
                        className="text-xs font-medium"
                        style={{ color: status.color }}
                      >
                        {status.label}
                      </span>

                      {/* Date */}
                      <span className="text-xs" style={{ color: '#64748B' }}>
                        {fmtDate(user.createdAt)}
                      </span>

                      {/* Commission */}
                      <span
                        className="text-sm font-semibold"
                        style={{ color: user.commissionEarnedCents > 0 ? '#16A34A' : '#CBD5E1' }}
                      >
                        {fmtEur(user.commissionEarnedCents)}
                      </span>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export function AffiliatePartnersPanel({ partners }: AffiliatePartnersPanelProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  function togglePartner(id: string) {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  return (
    <div>
      <h2 className="text-base font-semibold text-gray-900 mb-3">
        Partner &amp; zugeordnete Nutzer
      </h2>

      {partners.length === 0 ? (
        <div
          className="rounded-[24px] bg-white flex flex-col items-center justify-center py-12 gap-3"
          style={{
            boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
            border: '1px solid #F1F5F9',
          }}
        >
          <UsersIcon />
          <p className="text-sm" style={{ color: '#94A3B8' }}>
            Noch keine Partner oder Zuordnungen vorhanden.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {partners.map(partner => (
            <PartnerRow
              key={partner.id}
              partner={partner}
              expanded={expandedIds.has(partner.id)}
              onToggle={() => togglePartner(partner.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
