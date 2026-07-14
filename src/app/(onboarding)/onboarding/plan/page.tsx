'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { PLAN_LIST, COMMON_FEATURES, type PlanDef } from '@/lib/plans'

const REFERRAL_DISCOUNT = 0.20

type PromoResult =
  | { valid: true; type: 'affiliate'; username: string; display_name: string; percent_off: 20; amount_off: null }
  | { valid: true; type: 'promo'; percent_off: number | null; amount_off: number | null; name: string }
  | { valid: false }

function PlanPageInner() {
  const searchParams = useSearchParams()
  const canceled = searchParams.get('canceled')
  const [interval, setInterval] = useState<'monthly' | 'yearly'>('monthly')
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [referredBy, setReferredBy] = useState<string | null>(null)
  const [promoCode, setPromoCode] = useState('')
  const [showPromoInput, setShowPromoInput] = useState(false)
  const [promoStatus, setPromoStatus] = useState<null | 'validating' | PromoResult>(null)

  useEffect(() => {
    fetch('/api/user/profile')
      .then(r => r.json())
      .then(d => { if (d.referred_by_username) setReferredBy(d.referred_by_username) })
      .catch(() => {})
  }, [])

  // Debounced live validation
  useEffect(() => {
    const trimmed = promoCode.trim()
    if (!trimmed) { setPromoStatus(null); return }
    setPromoStatus('validating')
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/billing/validate-promo?code=${encodeURIComponent(trimmed)}`)
        const data = await res.json()
        setPromoStatus(data.valid ? data as PromoResult : { valid: false })
      } catch {
        setPromoStatus({ valid: false })
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [promoCode])

  const hasDiscount = !!referredBy
  // Explicit promo code overrides referral discount
  const promoApplied = promoStatus !== null && promoStatus !== 'validating' && (promoStatus as PromoResult).valid

  function effectiveMonthly(base: number): number {
    if (promoApplied) {
      const p = promoStatus as { valid: true; percent_off: number | null; amount_off: number | null }
      if (p.percent_off) return Math.round(base * (1 - p.percent_off / 100) * 100) / 100
      if (p.amount_off) return Math.max(0, base - Math.round(p.amount_off / 100))
    }
    if (hasDiscount) return Math.round(base * (1 - REFERRAL_DISCOUNT) * 100) / 100
    return base
  }

  function effectiveYearly(base: number): number {
    if (promoApplied) {
      const p = promoStatus as { valid: true; percent_off: number | null; amount_off: number | null }
      if (p.percent_off) return Math.round(base * (1 - p.percent_off / 100) * 100) / 100
      if (p.amount_off) return Math.max(0, base - Math.round(p.amount_off / 100))
    }
    if (hasDiscount) return Math.round(base * (1 - REFERRAL_DISCOUNT) * 100) / 100
    return base
  }

  async function selectPlan(planKey: string) {
    setLoading(planKey)
    setError('')
    try {
      const body: Record<string, string> = { plan: planKey, interval }
      if (promoCode.trim()) body.promo_code = promoCode.trim().toUpperCase()
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
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
    const baseMonthly = effectiveMonthly(plan.monthly_eur)
    const baseYearly = effectiveYearly(plan.yearly_eur)
    return Math.round(baseMonthly * 12 - baseYearly)
  }

  return (
    <div className="w-full max-w-3xl">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">Wähle deinen Tarif</h1>
        <p className="text-sm" style={{ color: '#6B7280' }}>
          Schalte deine Webseite online. Jederzeit kündbar.
        </p>
      </div>

      {/* Discount banner — referral (only shown when no promo code is overriding) */}
      {hasDiscount && !promoApplied && (
        <div className="mb-4 px-4 py-3 rounded-xl flex items-center gap-3"
          style={{ background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2">
            <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
          </svg>
          <div>
            <p className="text-sm font-semibold" style={{ color: '#15803D' }}>
              20% Partner-Rabatt (dauerhaft) wird automatisch angewendet
            </p>
            <p className="text-xs" style={{ color: '#166534' }}>
              Dein Empfehlungscode gibt dir dauerhaft 20% Rabatt auf jeden Monat und jedes Jahr.
            </p>
          </div>
        </div>
      )}

      {/* Promo code section */}
      <div className="mb-6">
        {!showPromoInput ? (
          <button
            onClick={() => setShowPromoInput(true)}
            className="text-sm underline underline-offset-2"
            style={{ color: '#9CA3AF' }}
          >
            Hast du einen Gutschein-Code?
          </button>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <input
                type="text"
                value={promoCode}
                onChange={e => setPromoCode(e.target.value.toUpperCase())}
                placeholder="CODE EINGEBEN"
                className="flex-1 px-3 py-2 text-sm font-mono rounded-xl outline-none"
                style={{
                  border: promoStatus === null || promoStatus === 'validating'
                    ? '1.5px solid #E5E7EB'
                    : promoApplied ? '1.5px solid #16A34A' : '1.5px solid #EF4444',
                  background: '#FAFAFA',
                  letterSpacing: '0.06em',
                }}
                autoFocus
              />
              <button
                onClick={() => { setShowPromoInput(false); setPromoCode(''); setPromoStatus(null) }}
                className="px-3 py-2 text-sm rounded-xl"
                style={{ background: '#F3F4F6', color: '#6B7280' }}
              >
                ✕
              </button>
            </div>
            {promoStatus === 'validating' && (
              <p className="text-xs" style={{ color: '#9CA3AF' }}>Wird geprüft…</p>
            )}
            {promoApplied && (() => {
              const p = promoStatus as { valid: true; type: string; percent_off: number | null; amount_off: number | null; name?: string; display_name?: string }
              const label = p.type === 'affiliate' ? `${p.percent_off}% Partner-Rabatt (dauerhaft)` : p.name ?? 'Aktionscode'
              const discountText = p.percent_off ? `${p.percent_off}% Rabatt` : p.amount_off ? `${(p.amount_off / 100).toFixed(2).replace('.', ',')} € Rabatt` : 'Rabatt'
              return (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
                  <span className="text-xs font-semibold" style={{ color: '#15803D' }}>{label} — {discountText} angewendet</span>
                </div>
              )
            })()}
            {promoStatus !== null && promoStatus !== 'validating' && !(promoStatus as PromoResult).valid && promoCode.trim() && (
              <p className="text-xs" style={{ color: '#EF4444' }}>Ungültiger oder abgelaufener Code.</p>
            )}
          </div>
        )}
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
          const showMonthly = effectiveMonthly(baseMonthly)
          const showYearly = effectiveYearly(baseYearly)
          const anyDiscount = hasDiscount || promoApplied
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
                {anyDiscount && showMonthly !== baseMonthly && (
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
                  {anyDiscount && showYearly !== baseYearly ? (
                    <p className="text-xs font-semibold" style={{ color: '#15803D' }}>
                      <span className="line-through mr-1" style={{ color: '#9CA3AF' }}>€{baseYearly}</span>
                      €{showYearly.toFixed(2).replace('.', ',')}/Jahr · du sparst €{savings}
                    </p>
                  ) : (
                    <p className="text-xs font-semibold" style={{ color: '#15803D' }}>
                      €{plan.yearly_eur}/Jahr · du sparst €{savings}
                    </p>
                  )}
                </div>
              ) : (
                <div className="mb-4">
                  {anyDiscount && showMonthly !== baseMonthly && (() => {
                    const p = promoApplied ? promoStatus as { valid: true; percent_off: number | null } : null
                    return <p className="text-xs font-semibold" style={{ color: '#15803D' }}>{p?.percent_off ?? 20}% Rabatt, dauerhaft</p>
                  })()}
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
                {isLoading ? 'Weiter zu Stripe…' : 'Jetzt freischalten'}
              </button>
            </div>
          )
        })}
      </div>

      <div className="text-center mb-6">
        <p className="text-sm font-medium" style={{ color: '#6B7280' }}>
          Günstiger als ein Brötchen täglich. Ab €{(PLAN_LIST[0].monthly_eur / 30).toFixed(2).replace('.', ',')} / Tag
        </p>
      </div>

      <p className="text-xs text-center" style={{ color: '#9CA3AF' }}>
        Sichere Zahlung via Stripe · Karte oder SEPA-Lastschrift · Jederzeit kündbar
      </p>

      <div className="mt-6 text-center">
        <a href="/sites" className="text-sm" style={{ color: '#9CA3AF' }}>
          Zurück zur Übersicht
        </a>
      </div>
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
