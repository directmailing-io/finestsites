'use client'

import { useEffect, useState } from 'react'
import { formatRemaining, type PublicCampaign } from '@/lib/billing/campaign-shared'

export interface CountdownParts { days: number; hours: number; minutes: number; seconds: number }

export interface CampaignCountdownState {
  /** false as soon as the campaign has ended (or there is none) */
  live: boolean
  /** "1 Tag 7 Std." — null until mounted or when the campaign has no end date */
  remaining: string | null
  /** Same remaining time split up for a segmented countdown */
  parts: CountdownParts | null
}

/**
 * Live state of a campaign in the browser: ticks every second and switches
 * `live` off the moment the promotion ends — prices fall back without a reload.
 */
export function useCampaignCountdown(campaign: PublicCampaign | null | undefined): CampaignCountdownState {
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

  if (!campaign) return { live: false, remaining: null, parts: null }
  if (!endsAt || now === null) return { live: true, remaining: null, parts: null }
  const left = new Date(endsAt).getTime() - now
  if (left <= 0) return { live: false, remaining: null, parts: null }
  const total = Math.floor(left / 1000)
  return {
    live: true,
    remaining: formatRemaining(left),
    parts: {
      days: Math.floor(total / 86400),
      hours: Math.floor((total % 86400) / 3600),
      minutes: Math.floor((total % 3600) / 60),
      seconds: total % 60,
    },
  }
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
