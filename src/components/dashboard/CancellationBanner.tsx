'use client'

import { useState } from 'react'
import Link from 'next/link'

interface Props {
  subscriptionStatus: string | null
  cancelAtPeriodEnd: boolean
  currentPeriodEnd: Date | null
}

function fmtDate(d: Date) {
  return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function daysLeft(d: Date) {
  return Math.max(0, Math.ceil((new Date(d).getTime() - Date.now()) / 86_400_000))
}

type Phase = 1 | 2 | 3 | 4

function getPhase(status: string | null, cancelAtPeriodEnd: boolean, periodEnd: Date | null): Phase | null {
  if (status === 'canceled') return 4
  if (cancelAtPeriodEnd && periodEnd) {
    const days = daysLeft(periodEnd)
    if (days > 14) return 1
    if (days > 7) return 2
    return 3
  }
  return null
}

const PHASE_STYLES: Record<Phase, { bg: string; border: string; iconBg: string; iconColor: string; textColor: string; ctaBg: string; ctaText: string }> = {
  1: {
    bg: '#FEFCE8',
    border: '#FEF08A',
    iconBg: '#FEF9C3',
    iconColor: '#A16207',
    textColor: '#713F12',
    ctaBg: '#854D0E',
    ctaText: '#fff',
  },
  2: {
    bg: '#FFF7ED',
    border: '#FED7AA',
    iconBg: '#FFEDD5',
    iconColor: '#C2410C',
    textColor: '#7C2D12',
    ctaBg: '#C2410C',
    ctaText: '#fff',
  },
  3: {
    bg: '#FEF2F2',
    border: '#FECACA',
    iconBg: '#FEE2E2',
    iconColor: '#B91C1C',
    textColor: '#7F1D1D',
    ctaBg: '#B91C1C',
    ctaText: '#fff',
  },
  4: {
    bg: '#FEF2F2',
    border: '#FECACA',
    iconBg: '#FEE2E2',
    iconColor: '#991B1B',
    textColor: '#7F1D1D',
    ctaBg: '#991B1B',
    ctaText: '#fff',
  },
}

function PhaseIcon({ phase, color }: { phase: Phase; color: string }) {
  if (phase === 4) {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
        <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
      </svg>
    )
  }
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
      <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  )
}

export default function CancellationBanner({ subscriptionStatus, cancelAtPeriodEnd, currentPeriodEnd }: Props) {
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const phase = getPhase(subscriptionStatus, cancelAtPeriodEnd, currentPeriodEnd)
  if (!phase || done) return null

  const s = PHASE_STYLES[phase]
  const days = currentPeriodEnd ? daysLeft(currentPeriodEnd) : 0
  const dateStr = currentPeriodEnd ? fmtDate(currentPeriodEnd) : ''

  const messages: Record<Phase, { title: string; body: string; cta: string }> = {
    1: {
      title: 'Du hast dein Abo gekündigt.',
      body: `Du hast noch bis ${dateStr} vollen Zugang. Danach gehen deine Seiten offline.`,
      cta: 'Kündigung zurückziehen',
    },
    2: {
      title: `Noch ${days} Tage bis dein Zugang endet.`,
      body: `Am ${dateStr} gehen deine Seiten offline. Reaktiviere jetzt, damit alles online bleibt.`,
      cta: 'Jetzt reaktivieren',
    },
    3: {
      title: `Nur noch ${days} ${days === 1 ? 'Tag' : 'Tage'}!`,
      body: `Am ${dateStr} werden deine Seiten offline geschaltet.`,
      cta: 'Sofort reaktivieren',
    },
    4: {
      title: 'Dein Abo ist abgelaufen.',
      body: 'Deine Seiten sind gerade offline. Reaktiviere dein Abo, um sie sofort wieder online zu bringen.',
      cta: 'Abo reaktivieren',
    },
  }

  const msg = messages[phase]

  async function handleReactivate() {
    setLoading(true)
    try {
      const res = await fetch('/api/billing/reactivate', { method: 'POST' })
      if (res.ok) {
        setDone(true)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        background: s.bg,
        borderBottom: `1px solid ${s.border}`,
        padding: '10px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}
    >
      {/* Icon */}
      <div style={{
        width: 28, height: 28, borderRadius: 8, flexShrink: 0,
        background: s.iconBg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <PhaseIcon phase={phase} color={s.iconColor} />
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: s.textColor }}>
          {msg.title}
        </span>
        {' '}
        <span style={{ fontSize: 13, color: s.textColor, opacity: 0.85 }}>
          {msg.body}
        </span>
      </div>

      {/* CTA */}
      {phase === 4 ? (
        <Link
          href="/billing"
          style={{
            display: 'inline-block',
            background: s.ctaBg,
            color: s.ctaText,
            fontSize: 12,
            fontWeight: 700,
            padding: '7px 16px',
            borderRadius: 100,
            textDecoration: 'none',
            whiteSpace: 'nowrap',
            flexShrink: 0,
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          }}
        >
          {msg.cta}
        </Link>
      ) : (
        <button
          onClick={handleReactivate}
          disabled={loading}
          style={{
            background: loading ? 'rgba(0,0,0,0.15)' : s.ctaBg,
            color: s.ctaText,
            fontSize: 12,
            fontWeight: 700,
            padding: '7px 16px',
            borderRadius: 100,
            border: 'none',
            cursor: loading ? 'not-allowed' : 'pointer',
            whiteSpace: 'nowrap',
            flexShrink: 0,
            boxShadow: loading ? 'none' : '0 2px 8px rgba(0,0,0,0.15)',
          }}
        >
          {loading ? 'Wird gespeichert...' : msg.cta}
        </button>
      )}
    </div>
  )
}
