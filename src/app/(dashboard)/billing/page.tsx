'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter as useNextRouter } from 'next/navigation'
import Link from 'next/link'

interface UserProfile {
  plan: string
  billing_interval: string
  subscription_status: string | null
  stripe_customer_id: string | null
  sites_count: number
}

const PLANS = [
  {
    key: 'starter',
    name: 'Starter',
    price_monthly: 9,
    price_yearly: 79,
    limit: 1,
    features: ['1 Website', 'Alle Templates', 'SSL inklusive', 'E-Mail-Support'],
  },
  {
    key: 'pro',
    name: 'Pro',
    price_monthly: 29,
    price_yearly: 249,
    limit: 3,
    popular: true,
    features: ['3 Websites', 'Alle Templates', 'SSL inklusive', 'Prioritäts-Support', 'Formular-Einreichungen'],
  },
  {
    key: 'unlimited',
    name: 'Unlimited',
    price_monthly: 79,
    price_yearly: 699,
    limit: Infinity,
    features: ['Unbegrenzte Websites', 'Alle Templates', 'SSL inklusive', 'Premium-Support', 'Formular-Einreichungen', 'Eigene Domain (demnächst)'],
  },
]

function BillingContent() {
  const searchParams = useSearchParams()
  const router = useNextRouter()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [interval, setInterval] = useState<'monthly' | 'yearly'>('monthly')
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null)
  const [portalLoading, setPortalLoading] = useState(false)
  const [toast, setToast] = useState('')

  useEffect(() => {
    fetch('/api/user/profile').then(r => r.json()).then(data => {
      setProfile(data)
      if (data.billing_interval) setInterval(data.billing_interval)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    const success = searchParams.get('success')
    const canceled = searchParams.get('canceled')
    if (success === '1') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setToast('Abonnement erfolgreich abgeschlossen!')
      const t = setTimeout(() => setToast(''), 4000)
      return () => clearTimeout(t)
    } else if (canceled === '1') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setToast('Checkout abgebrochen.')
      const t = setTimeout(() => setToast(''), 3000)
      return () => clearTimeout(t)
    }
  }, [searchParams])

  async function handleCheckout(plan: string) {
    setCheckoutLoading(plan)
    const res = await fetch('/api/billing/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan, interval }),
    })
    const data = await res.json()
    if (data.url) {
      router.push(data.url)
    } else {
      setCheckoutLoading(null)
    }
  }

  async function handlePortal() {
    setPortalLoading(true)
    const res = await fetch('/api/billing/portal', { method: 'POST' })
    const data = await res.json()
    if (data.url) {
      router.push(data.url)
    } else {
      setPortalLoading(false)
    }
  }

  const currentPlan = profile?.plan ?? 'starter'
  const hasSubscription = !!profile?.stripe_customer_id

  return (
    <div className="max-w-4xl">
      {/* Toast */}
      {toast && (
        <div className="fixed top-6 right-6 z-50 px-5 py-3 rounded-[16px] text-sm font-medium text-white shadow-lg"
          style={{ background: '#1a1a1a', boxShadow: '0 8px 30px rgba(0,0,0,0.25)' }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">Abrechnung</h1>
        <p className="text-sm mt-1" style={{ color: '#94A3B8' }}>Tarif verwalten und Abonnement anpassen</p>
      </div>

      {/* Current plan summary */}
      {!loading && profile && (
        <div className="mb-8 p-5 rounded-[20px] bg-white flex items-center justify-between gap-4"
          style={{ boxShadow: '0 2px 16px rgba(0,0,0,0.06)', border: '1px solid #F1F5F9' }}>
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-[14px] flex items-center justify-center flex-shrink-0"
              style={{ background: '#F3F4F6' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="1.5">
                <rect x="1" y="4" width="22" height="16" rx="2"/>
                <line x1="1" y1="10" x2="23" y2="10"/>
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900 capitalize">
                {currentPlan}-Plan
                <span className="ml-2 text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{
                    background: profile.subscription_status === 'active' ? '#F0FDF4' : '#F3F4F6',
                    color: profile.subscription_status === 'active' ? '#16A34A' : '#6B7280',
                  }}>
                  {profile.subscription_status === 'active' ? '● Aktiv' :
                   profile.subscription_status === 'past_due' ? '⚠ Zahlung fällig' :
                   profile.subscription_status === 'canceled' ? '✕ Gekündigt' :
                   '○ Kein Abo'}
                </span>
              </p>
              <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>
                {profile.sites_count}/{PLANS.find(p => p.key === currentPlan)?.limit === Infinity ? '∞' : PLANS.find(p => p.key === currentPlan)?.limit ?? 1} Webseiten aktiv
              </p>
            </div>
          </div>
          {hasSubscription && (
            <button onClick={handlePortal} disabled={portalLoading}
              className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-[12px] transition-all disabled:opacity-60 flex-shrink-0"
              style={{ background: '#F3F4F6', color: '#374151' }}>
              {portalLoading ? (
                <span className="w-3.5 h-3.5 rounded-full border-2 border-gray-300 border-t-gray-600 animate-spin" />
              ) : null}
              Abonnement verwalten
            </button>
          )}
        </div>
      )}

      {/* Interval toggle */}
      <div className="flex items-center justify-center gap-3 mb-8">
        <span className="text-sm font-medium" style={{ color: interval === 'monthly' ? '#1a1a1a' : '#94A3B8' }}>Monatlich</span>
        <button
          onClick={() => setInterval(prev => prev === 'monthly' ? 'yearly' : 'monthly')}
          className="relative w-12 h-6 rounded-full transition-colors duration-200 flex-shrink-0"
          style={{ background: interval === 'yearly' ? '#1a1a1a' : '#E2E8F0' }}>
          <span className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all duration-200"
            style={{ left: interval === 'yearly' ? 26 : 2 }} />
        </button>
        <span className="text-sm font-medium flex items-center gap-2" style={{ color: interval === 'yearly' ? '#1a1a1a' : '#94A3B8' }}>
          Jährlich
          <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
            style={{ background: '#F0FDF4', color: '#16A34A' }}>
            2 Monate gratis
          </span>
        </span>
      </div>

      {/* Plans */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {PLANS.map(plan => {
          const isCurrent = currentPlan === plan.key
          const price = interval === 'monthly' ? plan.price_monthly : plan.price_yearly
          const perMonth = interval === 'yearly' ? (plan.price_yearly / 12).toFixed(0) : plan.price_monthly

          return (
            <div key={plan.key}
              className="relative flex flex-col rounded-[20px] bg-white overflow-hidden transition-all duration-200"
              style={{
                boxShadow: plan.popular
                  ? '0 4px 30px rgba(26,26,26,0.12), 0 0 0 2px #1a1a1a'
                  : '0 2px 16px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.05)',
              }}>

              {plan.popular && (
                <div className="absolute top-4 right-4">
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-white"
                    style={{ background: '#1a1a1a' }}>
                    Beliebt
                  </span>
                </div>
              )}

              <div className="p-5 flex flex-col gap-4 flex-1">
                <div>
                  <p className="text-base font-semibold text-gray-900">{plan.name}</p>
                  <div className="flex items-baseline gap-1 mt-2">
                    <span className="text-3xl font-bold text-gray-900">€{interval === 'yearly' ? perMonth : price}</span>
                    <span className="text-sm" style={{ color: '#94A3B8' }}>/Monat</span>
                  </div>
                  {interval === 'yearly' && (
                    <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>
                      €{price}/Jahr
                    </p>
                  )}
                </div>

                <ul className="flex flex-col gap-2 flex-1">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-start gap-2 text-sm" style={{ color: '#475569' }}>
                      <svg className="flex-shrink-0 mt-0.5" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5">
                        <path d="M20 6L9 17l-5-5"/>
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>

                <div className="mt-auto pt-2">
                  {isCurrent ? (
                    <div className="w-full py-2.5 text-sm font-medium text-center rounded-[12px]"
                      style={{ background: '#F3F4F6', color: '#6B7280' }}>
                      Aktueller Tarif
                    </div>
                  ) : loading ? (
                    <div className="w-full py-2.5 rounded-[12px] bg-gray-100 animate-pulse" />
                  ) : (
                    <button onClick={() => handleCheckout(plan.key)} disabled={checkoutLoading === plan.key}
                      className="w-full py-2.5 text-sm font-semibold text-white rounded-[12px] transition-all disabled:opacity-70 flex items-center justify-center gap-2"
                      style={{
                        background: plan.popular ? '#1a1a1a' : '#374151',
                        boxShadow: plan.popular ? '0 4px 14px rgba(26,26,26,0.25)' : 'none',
                      }}>
                      {checkoutLoading === plan.key ? (
                        <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      ) : null}
                      {currentPlan === 'starter' || PLANS.findIndex(p => p.key === plan.key) > PLANS.findIndex(p => p.key === currentPlan)
                        ? 'Upgraden' : 'Wechseln'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* FAQ / info */}
      <div className="mt-8 p-5 rounded-[20px]" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Häufige Fragen</h3>
        <dl className="flex flex-col gap-3">
          {[
            ['Kann ich jederzeit upgraden?', 'Ja. Der Wechsel ist sofort aktiv und die Kosten werden anteilig berechnet.'],
            ['Gibt es eine kostenlose Testphase?', 'Derzeit nicht. Alle Pläne sind kostenpflichtig.'],
            ['Was passiert bei Kündigung?', 'Deine Websites bleiben bis zum Ablauf des Abrechnungszeitraums aktiv.'],
          ].map(([q, a]) => (
            <div key={q}>
              <dt className="text-xs font-semibold text-gray-800">{q}</dt>
              <dd className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>{a}</dd>
            </div>
          ))}
        </dl>
        <p className="text-xs mt-4" style={{ color: '#CBD5E1' }}>
          Fragen?{' '}
          <Link href="/settings" className="underline">Kontakt aufnehmen</Link>
        </p>
      </div>
    </div>
  )
}

export default function BillingPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="w-8 h-8 rounded-full border-2 border-gray-200 border-t-gray-900 animate-spin" /></div>}>
      <BillingContent />
    </Suspense>
  )
}
