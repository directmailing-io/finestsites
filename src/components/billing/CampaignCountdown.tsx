'use client'

import type { CountdownParts } from './useCampaign'

/**
 * Segmented countdown (Tage · Std · Min · Sek) for use on the violet campaign surfaces.
 * Fixed-width digits so nothing jumps while it ticks; fits a 320px phone.
 */
export default function CampaignCountdown({ parts, size = 'md', dropSeconds }: {
  parts: CountdownParts
  size?: 'sm' | 'md'
  /** Leave out the seconds while whole days remain — keeps it on one line in narrow cards. */
  dropSeconds?: boolean
}) {
  const small = size === 'sm'
  const segments = [
    ...(parts.days > 0 ? [{ value: String(parts.days), label: parts.days === 1 ? 'Tag' : 'Tage' }] : []),
    { value: String(parts.hours).padStart(2, '0'), label: 'Std' },
    { value: String(parts.minutes).padStart(2, '0'), label: 'Min' },
    ...(dropSeconds && parts.days > 0 ? [] : [{ value: String(parts.seconds).padStart(2, '0'), label: 'Sek' }]),
  ]
  return (
    <span
      role="timer"
      aria-label={`Die Aktion endet in ${parts.days > 0 ? `${parts.days} Tagen ` : ''}${parts.hours} Stunden ${parts.minutes} Minuten`}
      style={small
        ? { display: 'inline-flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 5 }
        : { display: 'flex', alignItems: 'stretch', justifyContent: 'center', gap: 8, width: '100%', maxWidth: 264, margin: '0 auto' }}
    >
      {segments.map(seg => (
        <span
          key={seg.label}
          aria-hidden="true"
          style={{
            display: 'inline-flex',
            flexDirection: small ? 'row' : 'column',
            alignItems: small ? 'baseline' : 'center',
            justifyContent: 'center',
            gap: small ? 3 : 1,
            minWidth: 0,
            flex: small ? '0 0 auto' : '1 1 0',
            padding: small ? '5px 8px' : '8px 6px 7px',
            borderRadius: small ? 9 : 12,
            background: 'rgba(255,255,255,0.16)',
            color: '#fff',
            lineHeight: 1,
          }}
        >
          <span style={{ fontSize: small ? 15 : 'clamp(19px, 6vw, 24px)', fontWeight: 700, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em' }}>{seg.value}</span>
          <span style={{ fontSize: 11, fontWeight: 600, opacity: 0.8 }}>{seg.label}</span>
        </span>
      ))}
    </span>
  )
}
