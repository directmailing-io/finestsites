'use client'

import { useEffect, useRef, useState } from 'react'
import { campaignAmountLabel, type PublicCampaign } from '@/lib/billing/campaign-shared'
import { useCampaignCountdown } from '@/components/billing/useCampaign'
import CampaignCountdown from '@/components/billing/CampaignCountdown'
import { CAMPAIGN_VIOLET } from '@/components/billing/CampaignCard'

/**
 * Announcement strip below the nav pill while a site-wide campaign runs.
 * - full size at the top of the page (offer + segmented countdown)
 * - shrinks to one line once the visitor scrolls, so it never eats a phone screen
 * - disappears by itself the second the campaign ends
 */
export default function CampaignStrip({ campaign, href }: { campaign: PublicCampaign; href: string }) {
  const { live, remaining, parts } = useCampaignCountdown(campaign)
  // Visitors who came through a partner link get the partner discount instead
  const [hasRef, setHasRef] = useState(false)
  const [compact, setCompact] = useState(false)
  // Height of the full-size strip — the hero is pushed down by exactly this much
  const [height, setHeight] = useState(84)
  const ref = useRef<HTMLAnchorElement>(null)

  useEffect(() => {
    try { setHasRef(!!sessionStorage.getItem('fs_ref')) } catch { /* storage blocked */ }
    const onScroll = () => setCompact(window.scrollY > 220)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const visible = live && !hasRef
  const hasCountdown = parts !== null
  useEffect(() => {
    const el = ref.current
    if (!visible || compact || !el || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => setHeight(Math.ceil(el.getBoundingClientRect().height)))
    observer.observe(el)
    return () => observer.disconnect()
  }, [visible, compact, hasCountdown])

  if (!visible) return null

  return (
    <>
      {/* Make room for the strip so it never covers the hero or an anchored section */}
      <style>{`
        .fs-hero-content { padding-top: max(150px, ${112 + height}px) !important; }
        @media (max-width: 1023px) { .fs-hero-content { padding-top: max(140px, ${104 + height}px) !important; } }
        section[id] { scroll-margin-top: 150px !important; }
        .fs-campaign-cta { display: none; }
        .fs-campaign-label { display: none; }
        @media (min-width: 380px) { .fs-campaign-label { display: inline; } }
        @media (min-width: 768px) { .fs-campaign-cta { display: inline-block; } }
      `}</style>
      <a
        ref={ref}
        href={href}
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'center',
          columnGap: 14,
          rowGap: 8,
          maxWidth: 1200,
          margin: '8px auto 0',
          background: CAMPAIGN_VIOLET,
          color: '#fff',
          borderRadius: 20,
          padding: compact ? '9px 14px' : '11px 14px 12px',
          textAlign: 'center',
          textDecoration: 'none',
          boxShadow: '0 10px 28px rgba(109,40,217,0.32)',
        }}
      >
        {compact ? (
          <span style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.3, fontVariantNumeric: 'tabular-nums' }}>
            {campaignAmountLabel(campaign)}
            {remaining && <span style={{ fontWeight: 500, color: 'rgba(255,255,255,0.88)' }}> · endet in {remaining}</span>}
          </span>
        ) : (
          <>
            <span style={{ fontSize: 'clamp(14px, 4.1vw, 16px)', fontWeight: 700, lineHeight: 1.25 }}>
              {campaign.code}: {campaignAmountLabel(campaign)}
            </span>
            {parts ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <span className="fs-campaign-label" style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.82)', whiteSpace: 'nowrap' }}>Endet in</span>
                <CampaignCountdown parts={parts} size="sm" />
              </span>
            ) : (
              <span style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.88)' }}>Automatisch abgezogen, kein Code nötig</span>
            )}
          </>
        )}
        <span className="fs-campaign-cta" style={{ background: '#fff', color: CAMPAIGN_VIOLET, fontSize: 13, fontWeight: 700, padding: '6px 14px', borderRadius: 100 }}>
          Jetzt sichern
        </span>
      </a>
    </>
  )
}
