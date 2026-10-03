'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { usePlanQuota } from './PlanQuotaContext'

/**
 * Permanent orientation for accounts without a plan: three short steps that
 * make clear the plan is only chosen (and paid) when publishing.
 * Sits in the page flow at the top — never covers content. Gone once a plan is active.
 */
const STEPS = [
  { title: 'Webseite auswählen', text: 'Such dir eine Vorlage aus.' },
  { title: 'Bearbeiten', text: 'Du musst nicht alles ausfüllen. Ändern geht jederzeit.' },
  { title: 'Veröffentlichen', text: 'Erst jetzt wählst du deinen Tarif und bezahlst.' },
]

export function GettingStartedSteps() {
  const quota = usePlanQuota()
  const pathname = usePathname()
  // null = not known yet (no step highlighted until the count is loaded)
  const [siteCount, setSiteCount] = useState<number | null>(null)

  const onSitesPages = pathname === '/dashboard' || (pathname.startsWith('/sites') && !pathname.endsWith('/edit'))
  const show = onSitesPages && !quota.loading && !quota.hasSub

  useEffect(() => {
    if (!show) return
    let cancelled = false
    fetch('/api/sites', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (!cancelled && Array.isArray(d)) setSiteCount(d.length) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [show, pathname])

  if (!show) return null
  // Step the user is at: no site yet → 1, otherwise editing/publishing → 2
  const current = siteCount === null ? -1 : siteCount === 0 ? 0 : 1

  return (
    <section
      aria-label="So geht's in 3 Schritten"
      className="max-w-7xl mx-auto mb-7 rounded-3xl px-4 py-4 sm:px-6 sm:py-5"
      style={{ background: '#F5F0FB', border: '1px solid #E4D7F5' }}
    >
      <p className="text-base sm:text-lg font-bold text-gray-900">
        So geht&rsquo;s: 3 Schritte. Bezahlt wird erst am Schluss.
      </p>
      <ol className="grid gap-2 md:grid-cols-3 md:gap-4" style={{ listStyle: 'none', padding: 0, margin: '12px 0 0' }}>
        {STEPS.map((step, i) => {
          const done = i < current
          const active = i === current
          return (
            <li key={step.title} className="flex items-start gap-3 rounded-2xl px-3.5 py-2.5 md:px-4 md:py-3.5"
              style={{ background: '#fff', border: active ? '2px solid #7C3AED' : '1px solid #E9E2F5' }}>
              <span className="flex items-center justify-center flex-shrink-0 rounded-full font-bold"
                style={{
                  width: 30, height: 30, fontSize: 15, marginTop: 1,
                  background: done ? '#16A34A' : active ? '#7C3AED' : '#EDE5F8',
                  color: done || active ? '#fff' : '#6D28D9',
                }}>
                {done
                  ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
                  : i + 1}
              </span>
              <span className="min-w-0">
                <span className="block text-base font-bold text-gray-900 leading-snug">{step.title}</span>
                <span className="block text-sm leading-snug mt-0.5" style={{ color: '#4B5563' }}>{step.text}</span>
              </span>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
