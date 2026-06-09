'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { PLAN_LIST, COMMON_FEATURES, type PlanDef } from '@/lib/plans'

const DISCOUNT = 0.15
const COUPON_LABEL = '15% Partner-Rabatt'

function discounted(price: number) {
  return Math.round(price * (1 - DISCOUNT) * 100) / 100
}

function PlanPageInner() {
  const searchParams = useSearchParams()
  const canceled = searchParams.get('canceled')
  const [interval, setInterval] = useState<'monthly' | 'yearly'>('monthly')
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [hasDiscount, setHasDiscount] = useState(false)

  useEffect(() => {
    fetch('/api/user/profile')
      .then(r => r.json())
      .then(d => { if (d.referred_by_username) setHasDiscount(true) })
      .catch(() => {})
  }, [])

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
      const msg = e instanceof Error ? e.message : ''
      const isRawJsError = !msg || msg.includes('json') || msg.includes('JSON') || msg.includes('fetch') || msg.includes('network') || msg.includes('SyntaxError')
      setError(isRawJsError ? 'Checkout konnte nicht gestartet werden. Bitte versuche es erneut.' : msg)
      setLoading(null)
    }
  }

  const yearlySavings = (plan: PlanDef) => {
    const base = hasDiscount ? discounted(plan.monthly_eur) : plan.monthly_eur
    const yearly = hasDiscount ? discounted(plan.yearly_eur) : plan.yearly_eur
    return Math.round(base * 12 - yearly)
  }

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

      <div className="text-center mb-8">
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">Wähle deinen Plan</h1>
        <p className="text-sm" style={{ color: '#6B7280' }}>
          Wähle und bezahle jetzt — danach richtest du deinen Username ein.
        </p>
      </div>

      {/* Discount banner */}
      {hasDiscount && (
        <div className="mb-6 px-4 py-3 rounded-xl flex items-center gap-3"
          style={{ background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2">
            <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
          </svg>
          <div>
            <p className="text-sm font-semibold" style={{ color: '#15803D' }}>
              {COUPON_LABEL} wird automatisch angewendet
            </p>
            <p className="text-xs" style={{ color: '#166534' }}>
              Dein Empfehlungscode gibt dir 15% Rabatt auf den ersten Monat / das erste Jahr.
            </p>
          </div>
        </div>
      )}

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
      <div className="flex flex-col items-center gap-2 mb-8">
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
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: '#DCFCE7', color: '#15803D' }}>
                    2 Monate geschenkt
                  </span>
                </span>
              )}
            </button>
          ))}
        </div>
        <p className="text-[11px]" style={{ color: '#9CA3AF' }}>
          {interval === 'monthly'
            ? 'Jederzeit kündbar · Mindestlaufzeit 1 Monat'
            : 'Mindestlaufzeit 1 Jahr · einmalige Jahresrechnung'}
        </p>
      </div>

      {/* Plan cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {PLAN_LIST.map(plan => {
          const baseMonthly = interval === 'monthly' ? plan.monthly_eur : Math.round(plan.yearly_eur / 12)
          const baseYearly = plan.yearly_eur
          const discountedMonthly = discounted(baseMonthly)
          const discountedYearly = discounted(baseYearly)
          const showMonthly = hasDiscount ? discountedMonthly : baseMonthly
          const isLoading = loading === plan.key
          const savings = yearlySavings(plan)
          const isPopular = plan.popular

          return (
            <div
              key={plan.key}
              className="relative flex flex-col rounded-2xl p-6"
              style={{
                background: isPopular ? '#EFE9FC' : '#fff',
                border: isPopular ? '2px solid #D4B8F8' : '1.5px solid #E5E7EB',
                boxShadow: isPopular ? '0 8px 32px rgba(109,40,217,0.15)' : '0 2px 8px rgba(0,0,0,0.04)',
              }}
            >
              {isPopular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="text-[11px] font-semibold px-3 py-1 rounded-full text-white" style={{ background: '#7C3AED' }}>
                    ✦ Empfohlen
                  </span>
                </div>
              )}

              <p className="text-sm font-semibold mb-1" style={{ color: isPopular ? '#6D28D9' : '#6B7280' }}>{plan.name}</p>

              <div className="flex items-baseline gap-1 mb-1">
                {hasDiscount && (
                  <span className="text-base line-through mr-1" style={{ color: '#9CA3AF' }}>
                    €{baseMonthly}
                  </span>
                )}
                <span className="text-3xl font-bold" style={{ color: isPopular ? '#3B0764' : '#111827' }}>
                  €{showMonthly % 1 === 0 ? showMonthly : showMonthly.toFixed(2).replace('.', ',')}
                </span>
                <span className="text-sm" style={{ color: isPopular ? '#7C3AED' : '#9CA3AF' }}>/Monat</span>
              </div>

              <p className="text-[10px] mb-1" style={{ color: isPopular ? '#7C3AED' : '#9CA3AF' }}>
                inkl. ges. MwSt.
              </p>

              {interval === 'yearly' ? (
                <div className="mb-4">
                  {hasDiscount ? (
                    <p className="text-xs font-semibold" style={{ color: '#15803D' }}>
                      <span className="line-through mr-1" style={{ color: '#9CA3AF' }}>€{baseYearly}</span>
                      €{discountedYearly.toFixed(2).replace('.', ',')}/Jahr · du sparst €{savings}
                    </p>
                  ) : (
                    <p className="text-xs font-semibold" style={{ color: '#15803D' }}>
                      €{plan.yearly_eur}/Jahr · du sparst €{savings}
                    </p>
                  )}
                </div>
              ) : (
                <div className="mb-4">
                  {hasDiscount && (
                    <p className="text-xs font-semibold" style={{ color: '#15803D' }}>15% Rabatt auf ersten Monat</p>
                  )}
                </div>
              )}

              <ul className="flex flex-col gap-2 mb-6 flex-1">
                <li className="flex items-start gap-2 text-xs font-semibold" style={{ color: isPopular ? '#4A2D9A' : '#111827' }}>
                  <CheckIcon color={isPopular ? '#7C3AED' : '#059669'} />
                  {plan.sites_label}
                </li>
                {COMMON_FEATURES.map(f => (
                  <li key={f} className="flex items-start gap-2 text-xs" style={{ color: isPopular ? '#5B21B6' : '#6B7280' }}>
                    <CheckIcon color={isPopular ? '#7C3AED' : '#059669'} />
                    {f}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => selectPlan(plan.key)}
                disabled={!!loading}
                className="w-full py-3 text-sm font-semibold rounded-xl transition-all"
                style={{
                  background: isPopular ? '#7C3AED' : '#111827',
                  color: '#fff',
                  opacity: loading && !isLoading ? 0.5 : 1,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  boxShadow: isPopular ? '0 4px 16px rgba(124,58,237,0.3)' : 'none',
                }}
              >
                {isLoading ? 'Weiter zu Stripe…' : 'Plan wählen'}
              </button>
            </div>
          )
        })}
      </div>

      <div className="text-center mb-6">
        <p className="text-sm font-medium" style={{ color: '#6B7280' }}>
          ☕ Günstiger als eine Tasse Kaffee täglich — ab €{(PLAN_LIST[0].monthly_eur / 30).toFixed(2).replace('.', ',')} / Tag
        </p>
      </div>

      <p className="text-xs text-center" style={{ color: '#9CA3AF' }}>
        Sichere Zahlung via Stripe · Karte oder SEPA-Lastschrift · Jederzeit kündbar
      </p>
    </div>
  )
}

function CheckIcon({ color }: { color: string }) {
  return (
    <svg className="flex-shrink-0 mt-0.5" width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M2.5 7L5.5 10L11.5 4" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
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
