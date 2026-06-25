'use client'

/**
 * UrlParamPersistence — captures ref + UTM params on first page load and
 * persists them to sessionStorage so they survive client-side navigation.
 *
 * Keys stored:  fs_ref, fs_utm_source, fs_utm_medium, fs_utm_campaign,
 *               fs_utm_term, fs_utm_content
 *
 * Security: the `ref` param is validated against the DB via /api/affiliate/validate
 * before being stored. Invalid codes are silently dropped — they never reach
 * sessionStorage and therefore never trigger a discount anywhere in the app.
 * UTM params are informational only and are stored without validation.
 *
 * Mount once in the root layout. No visible output.
 */

import { useEffect } from 'react'

const UTM_PARAMS = [
  ['utm_source',   'fs_utm_source'],
  ['utm_medium',   'fs_utm_medium'],
  ['utm_campaign', 'fs_utm_campaign'],
  ['utm_term',     'fs_utm_term'],
  ['utm_content',  'fs_utm_content'],
] as const

export default function UrlParamPersistence() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)

    // UTM params — informational, store without validation
    for (const [param, key] of UTM_PARAMS) {
      const val = params.get(param)
      if (val) sessionStorage.setItem(key, val)
    }

    // ref param — must be validated against DB before storing.
    // We skip storing if the code is unknown, so invalid codes never trigger discounts.
    // The homepage validates server-side (PricingSection gets validatedRef prop),
    // so this path mainly covers direct navigation to non-homepage URLs with ?ref=.
    const ref = params.get('ref')?.trim()
    if (ref && !sessionStorage.getItem('fs_ref')) {
      // Only validate if not already stored (avoid unnecessary API calls on every navigation)
      fetch(`/api/affiliate/validate?code=${encodeURIComponent(ref)}`)
        .then(r => { if (r.ok) sessionStorage.setItem('fs_ref', ref) })
        .catch(() => { /* silently ignore — no discount on error */ })
    }
  }, [])

  return null
}
