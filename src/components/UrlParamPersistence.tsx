'use client'

/**
 * UrlParamPersistence — captures ref + UTM params on first page load and
 * persists them to sessionStorage so they survive client-side navigation.
 *
 * Keys stored:  fs_ref, fs_utm_source, fs_utm_medium, fs_utm_campaign,
 *               fs_utm_term, fs_utm_content
 *
 * Mount this component once in the root layout. It has no visible output.
 */

import { useEffect } from 'react'

const TRACKED = [
  ['ref',          'fs_ref'],
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
    for (const [param, key] of TRACKED) {
      const val = params.get(param)
      if (val) {
        sessionStorage.setItem(key, val)
      }
    }
  }, [])

  return null
}
