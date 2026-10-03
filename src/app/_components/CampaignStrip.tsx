'use client'

import { useEffect, useState } from 'react'
import { campaignAmountLabel, type PublicCampaign } from '@/lib/billing/campaign-shared'
import { useCampaignCountdown } from '@/components/billing/useCampaign'

/**
 * Announcement strip below the nav pill while a site-wide campaign runs.
 * Disappears by itself the second the campaign ends.
 */
export default function CampaignStrip({ campaign, href }: { campaign: PublicCampaign; href: string }) {
  const { live, remaining } = useCampaignCountdown(campaign)
  // Visitors who came through a partner link get the partner discount instead
  const [hasRef, setHasRef] = useState(false)
  useEffect(() => {
    try { setHasRef(!!sessionStorage.getItem('fs_ref')) } catch { /* storage blocked */ }
  }, [])

  if (!live || hasRef) return null

  return (
    <>
    {/* On phones the strip wraps to two lines — give the hero room so nothing is covered */}
    <style>{`@media (max-width: 767px) { .fs-hero-content { padding-top: 176px !important; } }`}</style>
    <a
      href={href}
      style={{
        display: 'block',
        maxWidth: 1200,
        margin: '8px auto 0',
        background: '#111',
        color: '#fff',
        borderRadius: 18,
        padding: '9px 16px',
        textAlign: 'center',
        fontSize: 13.5,
        lineHeight: 1.4,
        textDecoration: 'none',
        boxShadow: '0 2px 24px rgba(0,0,0,0.12)',
      }}
    >
      <strong style={{ fontWeight: 700, display: 'inline-block' }}>
        Aktion {campaign.code}: {campaignAmountLabel(campaign)}
      </strong>
      <span style={{ display: 'inline-block', color: 'rgba(255,255,255,0.72)', marginLeft: 8 }}>
        Automatisch abgezogen{remaining ? ` · endet in ${remaining}` : ''}
      </span>
    </a>
    </>
  )
}
