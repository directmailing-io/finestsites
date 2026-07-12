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

/** Appends ?ref=<code> to all register links on the page that don't already have it. */
function patchRegisterLinks(ref: string) {
  document
    .querySelectorAll<HTMLAnchorElement>('a[href*="/register"]')
    .forEach(a => {
      try {
        const url = new URL(a.href)
        if (!url.searchParams.has('ref')) {
          url.searchParams.set('ref', ref)
          a.href = url.toString()
        }
      } catch { /* ignore malformed hrefs */ }
    })
}

export default function UrlParamPersistence() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)

    // UTM params — informational, store without validation
    for (const [param, key] of UTM_PARAMS) {
      const val = params.get(param)
      if (val) sessionStorage.setItem(key, val)
    }

    // ref param — validate against DB before storing so invalid codes never trigger discounts.
    // The homepage already validates server-side (PricingSection gets validatedRef prop directly).
    // This path handles direct navigation to any other page with ?ref= in the URL.
    const urlRef = params.get('ref')?.trim()
    const storedRef = sessionStorage.getItem('fs_ref')

    if (storedRef) {
      // Already validated in this session — patch links immediately
      patchRegisterLinks(storedRef)
    } else if (urlRef) {
      // New ref from URL — validate before storing or patching
      fetch(`/api/affiliate/validate?code=${encodeURIComponent(urlRef)}`)
        .then(r => {
          if (r.ok) {
            sessionStorage.setItem('fs_ref', urlRef)
            patchRegisterLinks(urlRef)
          }
        })
        .catch(() => { /* silently ignore — invalid/unknown codes get no discount */ })
    }
  }, [])

  return null
}
