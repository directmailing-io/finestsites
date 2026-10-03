'use client'

import type { ReactNode } from 'react'
import { campaignAmountLabel, type PublicCampaign } from '@/lib/billing/campaign-shared'
import type { CampaignCountdownState } from './useCampaign'
import CampaignCountdown from './CampaignCountdown'

export const CAMPAIGN_VIOLET = '#6D28D9'

/**
 * Prominent notice for a running site-wide campaign: what you get, that it is
 * applied automatically (no code entry) and how long it still runs.
 * Used on the marketing pricing section, registration, plan selection and the upgrade modal.
 */
export default function CampaignCard({
  campaign,
  countdown,
  note,
  headlineFont,
  compact,
  style,
}: {
  campaign: PublicCampaign
  countdown: CampaignCountdownState
  /** Optional extra line, e.g. the concrete price for the selected plan. */
  note?: ReactNode
  headlineFont?: string
  /** Smaller version for forms and dialogs, where the notice must not push the content away. */
  compact?: boolean
  style?: React.CSSProperties
}) {
  const scope = campaign.interval === 'both' ? 'auf alle Tarife'
    : campaign.interval === 'yearly' ? 'bei jährlicher Zahlung' : 'bei monatlicher Zahlung'
  if (compact) {
    return (
      <div
        style={{
          background: CAMPAIGN_VIOLET,
          color: '#fff',
          borderRadius: 18,
          padding: '14px 16px 15px',
          textAlign: 'center',
          boxShadow: '0 8px 24px rgba(109,40,217,0.24)',
          ...style,
        }}
      >
        <p style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.25, marginBottom: 4 }}>
          {campaign.code}: {campaignAmountLabel(campaign)}
        </p>
        <p style={{ fontSize: 13.5, lineHeight: 1.45, color: 'rgba(255,255,255,0.92)' }}>
          Wird beim Bezahlen automatisch abgezogen. Du musst keinen Code eingeben.
        </p>
        {note && (
          <p style={{ fontSize: 13.5, lineHeight: 1.45, color: 'rgba(255,255,255,0.92)', marginTop: 4 }}>{note}</p>
        )}
        {countdown.parts && (
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', columnGap: 8, rowGap: 5, marginTop: 10 }}>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: 'rgba(255,255,255,0.82)' }}>Endet in</span>
            <CampaignCountdown parts={countdown.parts} size="sm" dropSeconds />
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      style={{
        background: CAMPAIGN_VIOLET,
        color: '#fff',
        borderRadius: 22,
        padding: '20px 20px 22px',
        textAlign: 'center',
        boxShadow: '0 12px 32px rgba(109,40,217,0.28)',
        ...style,
      }}
    >
      <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.78)', marginBottom: 6 }}>
        Aktion {campaign.code}
      </p>
      <p style={{ fontFamily: headlineFont, fontSize: 'clamp(26px, 7.4vw, 34px)', fontWeight: headlineFont ? 500 : 700, lineHeight: 1.12, letterSpacing: '-0.02em', marginBottom: 8 }}>
        {campaignAmountLabel(campaign)} {scope}
      </p>
      <p style={{ fontSize: 15, lineHeight: 1.5, color: 'rgba(255,255,255,0.92)', maxWidth: 420, margin: '0 auto' }}>
        Wird beim Bezahlen automatisch abgezogen. Du musst keinen Code eingeben.
      </p>
      {note && (
        <p style={{ fontSize: 14, lineHeight: 1.5, color: 'rgba(255,255,255,0.92)', maxWidth: 420, margin: '6px auto 0' }}>{note}</p>
      )}
      {countdown.parts && (
        <div style={{ marginTop: 16 }}>
          <p style={{ fontSize: 12.5, fontWeight: 600, color: 'rgba(255,255,255,0.78)', marginBottom: 7 }}>Die Aktion endet in</p>
          <CampaignCountdown parts={countdown.parts} />
        </div>
      )}
    </div>
  )
}
