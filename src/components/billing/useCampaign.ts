'use client'

import { useEffect, useState } from 'react'
import { formatRemaining, type PublicCampaign } from '@/lib/billing/campaign-shared'

/**
 * Live state of a campaign in the browser: ticks every second and switches
 * `live` off the moment the promotion ends — prices fall back without a reload.
 */
export function useCampaignCountdown(campaign: PublicCampaign | null | undefined): { live: boolean; remaining: string | null } {
  // null until mounted, so server and client render the same markup
  const [now, setNow] = useState<number | null>(null)
  const endsAt = campaign?.endsAt ?? null

  useEffect(() => {
    if (!campaign) return
    setNow(Date.now())
    if (!endsAt) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [campaign, endsAt])

  if (!campaign) return { live: false, remaining: null }
  if (!endsAt || now === null) return { live: true, remaining: null }
  const left = new Date(endsAt).getTime() - now
  return left > 0 ? { live: true, remaining: formatRemaining(left) } : { live: false, remaining: null }
}

/** Campaign this visitor gets automatically at checkout (app pages). */
export function useFetchedCampaign(): PublicCampaign | null {
  const [campaign, setCampaign] = useState<PublicCampaign | null>(null)
  useEffect(() => {
    fetch('/api/billing/campaign', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => setCampaign(d.campaign ?? null))
      .catch(() => {})
  }, [])
  return campaign
}
