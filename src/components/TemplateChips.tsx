'use client'

/**
 * Shared template chip components — used on both the marketing site
 * (TemplateGridSection) and the platform (/sites/new). Keep styles
 * in sync here so a single change propagates everywhere.
 */

// ── Company chip ─────────────────────────────────────────────────────────────
// Shows "Allgemein" for allrounder templates, otherwise the company name.

export function CompanyChip({
  name,
  isAllrounder,
  size = 'sm',
}: {
  name?: string
  isAllrounder?: boolean
  size?: 'sm' | 'xs'
}) {
  const pad = size === 'xs' ? '2px 8px' : '3px 9px'
  const fs = size === 'xs' ? 10 : 11

  if (isAllrounder) {
    return (
      <span style={{ fontSize: fs, fontWeight: 700, color: '#2563EB', background: '#EFF6FF', padding: pad, borderRadius: 100, display: 'inline-block' }}>
        Allgemein
      </span>
    )
  }
  if (!name) return null
  return (
    <span style={{ fontSize: fs, fontWeight: 700, color: '#8060b0', background: '#F5F0FB', padding: pad, borderRadius: 100, display: 'inline-block' }}>
      {name}
    </span>
  )
}

// ── Badge chip ───────────────────────────────────────────────────────────────
// "brandneu" → ✦ Neu (purple), "beliebt" → 🔥 Heiß beliebt (orange)

export function BadgeChip({ badge, size = 'sm' }: { badge: string | null; size?: 'sm' | 'xs' }) {
  const pad = size === 'xs' ? '2px 8px' : '3px 9px'
  const fs = size === 'xs' ? 10 : 11

  if (badge === 'brandneu') {
    return (
      <span style={{ fontSize: fs, fontWeight: 700, color: '#7C3AED', background: '#F5F3FF', padding: pad, borderRadius: 100, display: 'inline-block' }}>
        ✦ Neu
      </span>
    )
  }
  if (badge === 'beliebt') {
    return (
      <span style={{ fontSize: fs, fontWeight: 700, color: '#C2410C', background: '#FFF7ED', padding: pad, borderRadius: 100, display: 'inline-block' }}>
        🔥 Heiß beliebt
      </span>
    )
  }
  return null
}

// ── Price chip ───────────────────────────────────────────────────────────────
// Free → green "Gratis", paid → purple "Premium"

export function PriceChip({ isFree, size = 'sm' }: { isFree: boolean; size?: 'sm' | 'xs' }) {
  const pad = size === 'xs' ? '2px 8px' : '3px 9px'
  const fs = size === 'xs' ? 10 : 11

  if (isFree) {
    return (
      <span style={{ fontSize: fs, fontWeight: 700, color: '#15803D', background: '#F0FDF4', padding: pad, borderRadius: 100, display: 'inline-block' }}>
        Gratis
      </span>
    )
  }
  return (
    <span style={{ fontSize: fs, fontWeight: 700, color: '#6D28D9', background: '#EEE8FF', padding: pad, borderRadius: 100, display: 'inline-block', letterSpacing: '0.06em', textTransform: 'uppercase', border: '1px solid #D4C5FA' }}>
      Premium
    </span>
  )
}
