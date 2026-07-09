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
// Free → green "Gratis", paid → amber "★ Premium"

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
    <span style={{ fontSize: fs, fontWeight: 700, color: '#7C3AED', background: '#F3EEFF', padding: pad, borderRadius: 100, display: 'inline-flex', alignItems: 'center', gap: 3, border: '1px solid #DDD0F8', letterSpacing: '0.01em' }}>
      <svg width={fs - 1} height={fs - 1} viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0 }}>
        <path d="M1 9L3 4.5L6 7L9 4.5L11 9H1Z" fill="#7C3AED" opacity="0.9"/>
        <circle cx="1" cy="9" r="1" fill="#7C3AED"/>
        <circle cx="11" cy="9" r="1" fill="#7C3AED"/>
        <circle cx="6" cy="2" r="1" fill="#7C3AED"/>
      </svg>
      Premium
    </span>
  )
}
