'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

const PLANS = [
  {
    key: 'starter',
    name: 'Starter',
    price_monthly: 14,
    price_yearly: 140,
    sites: '1 aktive Website',
    extraFeatures: [] as string[],
  },
  {
    key: 'pro',
    name: 'Pro',
    price_monthly: 21,
    price_yearly: 210,
    popular: true,
    sites: '3 aktive Websites',
    extraFeatures: ['Neue Templates priorisiert'],
  },
  {
    key: 'unlimited',
    name: 'Unlimited',
    price_monthly: 39,
    price_yearly: 390,
    sites: 'Unbegrenzte Websites',
    extraFeatures: ['Neue Templates priorisiert'],
  },
]

const COMMON_FEATURES = [
  'Alle Templates',
  'Eigene Subdomain',
  'SSL inklusive',
  'E-Mail-Support',
  'Formular-Einreichungen',
]

function PlanPageInner() {
  const searchParams = useSearchParams()
  const canceled = searchParams.get('canceled')
  const [interval, setInterval] = useState<'monthly' | 'yearly'>('monthly')
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function selectPlan(planKey: string) {
    setLoading(planKey)
    setError('')
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planKey, interval }),
      })
      const data = await res.json()
      if (!res.ok || !data.url) throw new Error(data.error || 'Fehler beim Checkout.')
      window.location.href = data.url
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Ein Fehler ist aufgetreten.')
      setLoading(null)
    }
  }

  const yearlyDiscount = Math.round((1 - (PLANS[0].price_yearly / (PLANS[0].price_monthly * 12))) * 100)

  return (
    <div className="w-full max-w-3xl">
      {/* Step indicator */}
      <div className="flex items-center justify-center gap-2 mb-10">
        <StepDot n={1} done label="Account" />
        <StepLine />
        <StepDot n={2} active label="Plan wählen" />
        <StepLine />
        <StepDot n={3} label="Username" />
      </div>

      <div className="text-center mb-10">
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">Wähle deinen Plan</h1>
        <p className="text-sm" style={{ color: '#6B7280' }}>
          Wähle und bezahle jetzt — danach richtest du deinen Username ein.
        </p>
      </div>

      {canceled && (
        <div className="mb-6 px-4 py-3 rounded-xl text-sm text-center" style={{ background: '#FEF9C3', border: '1px solid #FDE68A', color: '#92400E' }}>
          Zahlung abgebrochen. Du kannst hier einen anderen Plan wählen.
        </div>
      )}
      {error && (
        <div className="mb-6 px-4 py-3 rounded-xl text-sm text-center" style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C' }}>
          {error}
        </div>
      )}

      {/* Interval toggle */}
      <div className="flex items-center justify-center mb-8">
        <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: '#F3F4F6' }}>
          {(['monthly', 'yearly'] as const).map((iv) => (
            <button
              key={iv}
              onClick={() => setInterval(iv)}
              className="text-sm font-medium px-4 py-2 rounded-lg transition-all"
              style={{
                background: interval === iv ? '#fff' : 'transparent',
                color: interval === iv ? '#111827' : '#6B7280',
                boxShadow: interval === iv ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              }}
            >
              {iv === 'monthly' ? 'Monatlich' : (
                <span className="flex items-center gap-1.5">
                  Jährlich
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: '#D1FAE5', color: '#065F46' }}>
                    -{yearlyDiscount}%
                  </span>
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Plan cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {PLANS.map(plan => {
          const monthlyPrice = interval === 'monthly' ? plan.price_monthly : Math.round(plan.price_yearly / 12)
          const isLoading = loading === plan.key
          const allFeatures = [plan.sites, ...COMMON_FEATURES, ...plan.extraFeatures]
          return (
            <div
              key={plan.key}
              className="relative flex flex-col rounded-2xl p-6"
              style={{
                background: plan.popular ? '#6D28D9' : '#fff',
                border: plan.popular ? 'none' : '1.5px solid #E5E7EB',
                boxShadow: plan.popular ? '0 8px 32px rgba(109,40,217,0.25)' : '0 2px 8px rgba(0,0,0,0.04)',
              }}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="text-[11px] font-semibold px-3 py-1 rounded-full" style={{ background: '#EDE9FE', color: '#6D28D9' }}>
                    ✦ Empfohlen
                  </span>
                </div>
              )}

              <p className="text-sm font-semibold mb-1" style={{ color: plan.popular ? '#C4B5FD' : '#6B7280' }}>{plan.name}</p>
              <div className="flex items-baseline gap-1 mb-4">
                <span className="text-3xl font-bold" style={{ color: plan.popular ? '#fff' : '#111827' }}>€{monthlyPrice}</span>
                <span className="text-sm" style={{ color: plan.popular ? '#A78BFA' : '#9CA3AF' }}>/Monat</span>
              </div>

              {interval === 'yearly' && (
                <p className="text-xs mb-4 -mt-2 font-medium" style={{ color: plan.popular ? '#C4B5FD' : '#6B7280' }}>
                  €{plan.price_yearly} / Jahr – 2 Monate gratis
                </p>
              )}

              <ul className="flex flex-col gap-2 mb-6 flex-1">
                {allFeatures.map(f => (
                  <li key={f} className="flex items-start gap-2 text-xs" style={{ color: plan.popular ? '#DDD6FE' : '#6B7280' }}>
                    <svg className="flex-shrink-0 mt-0.5" width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M2.5 7L5.5 10L11.5 4" stroke={plan.popular ? '#C4B5FD' : '#059669'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => selectPlan(plan.key)}
                disabled={!!loading}
                className="w-full py-3 text-sm font-semibold rounded-xl transition-all"
                style={{
                  background: plan.popular ? '#fff' : '#111827',
                  color: plan.popular ? '#6D28D9' : '#fff',
                  opacity: loading && !isLoading ? 0.5 : 1,
                  cursor: loading ? 'not-allowed' : 'pointer',
                }}
              >
                {isLoading ? 'Weiter zu Stripe…' : 'Plan wählen'}
              </button>
            </div>
          )
        })}
      </div>

      {/* Coffee claim — single prominent spot below all cards */}
      <div className="text-center mb-6">
        <p className="text-sm font-medium" style={{ color: '#6B7280' }}>
          ☕ Günstiger als eine Tasse Kaffee täglich — ab €{(PLANS[0].price_monthly / 30).toFixed(2).replace('.', ',')} / Tag
        </p>
      </div>

      <p className="text-xs text-center" style={{ color: '#9CA3AF' }}>
        Sichere Zahlung via Stripe · Karte oder SEPA-Lastschrift · Jederzeit kündbar
      </p>
    </div>
  )
}

function StepDot({ n, active, done, label }: { n: number; active?: boolean; done?: boolean; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all"
        style={{
          background: done ? '#111827' : active ? '#111827' : '#E5E7EB',
          color: done || active ? '#fff' : '#9CA3AF',
        }}
      >
        {done ? (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2.5 7L5.5 10L11.5 4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        ) : n}
      </div>
      <span className="text-[10px] font-medium hidden sm:block" style={{ color: active ? '#111827' : '#9CA3AF' }}>{label}</span>
    </div>
  )
}

function StepLine() {
  return <div className="flex-1 h-px mx-1" style={{ background: '#E5E7EB', maxWidth: 48 }} />
}

export default function OnboardingPlanPage() {
  return (
    <Suspense>
      <PlanPageInner />
    </Suspense>
  )
}
