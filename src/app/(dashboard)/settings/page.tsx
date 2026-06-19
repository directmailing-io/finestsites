'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { PLAN_LIST, PLAN_LABELS, COMMON_FEATURES, PLAN_ORDER, type PlanKey } from '@/lib/plans'

interface SubscriptionInfo {
  status: string
  current_period_end: number
  cancel_at_period_end: boolean
  cancel_at: number | null
  plan: string
  billing_interval: string | null
}

interface UserProfile {
  plan: string
  billing_interval: string | null
  subscription_status: string | null
  stripe_customer_id: string | null
  paid_sites_count: number
}

interface Invoice {
  id: string
  number: string | null
  created: number
  amount_paid: number
  amount_due: number
  currency: string
  status: string
  hosted_invoice_url: string | null
  invoice_pdf: string | null
  period_start: number
  period_end: number
}

const FAQ = [
  ['Kann ich jederzeit upgraden?',     'Ja. Der Wechsel ist sofort aktiv und die Kosten werden anteilig verrechnet.'],
  ['Was passiert bei Kündigung?',      'Deine Webseiten bleiben bis zum Ende des Abrechnungszeitraums aktiv. Danach werden aktive Premium-Webseiten deaktiviert.'],
  ['Wie ändere ich meine Zahlungsmethode?', 'Klicke auf "Zahlung & Rechnungen" – du wirst zum sicheren Stripe-Kundenportal weitergeleitet.'],
  ['Kann ich auch einen niedrigeren Tarif wählen?', 'Ein Downgrade auf einen kleineren Tarif ist aktuell nicht möglich. Du kannst dein Abo aber jederzeit kündigen und neu abschließen.'],
]

function SettingsContent() {
  const supabase = createClient()
  const router = useRouter()
  const searchParams = useSearchParams()

  // ── Password state ─────────────────────────────────────────
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwLoading, setPwLoading] = useState(false)
  const [pwError, setPwError] = useState('')
  const [pwSuccess, setPwSuccess] = useState('')

  // ── Billing state ──────────────────────────────────────────
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null)
  const [subLoading, setSubLoading] = useState(true)
  const [portalLoading, setPortalLoading] = useState(false)
  const [cancelLoading, setCancelLoading] = useState(false)
  const [cancelError, setCancelError] = useState('')
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)

  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'yearly'>('monthly')
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null)
  const [toast, setToast] = useState('')

  // ── Invoices state ─────────────────────────────────────────
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [invoicesLoading, setInvoicesLoading] = useState(true)

  // ── FAQ accordion state ────────────────────────────────────
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  useEffect(() => {
    fetch('/api/billing/subscription')
      .then(r => r.json())
      .then(d => setSubscription(d.subscription ?? null))
      .finally(() => setSubLoading(false))

    fetch('/api/user/profile').then(r => r.json()).then(data => {
      setProfile(data)
      if (data.billing_interval) setBillingInterval(data.billing_interval)
    }).catch(() => {})

    fetch('/api/billing/invoices')
      .then(r => r.json())
      .then(d => setInvoices(Array.isArray(d.invoices) ? d.invoices : []))
      .catch(() => {})
      .finally(() => setInvoicesLoading(false))
  }, [])

  useEffect(() => {
    const success = searchParams.get('success')
    const canceled = searchParams.get('canceled')
    const sessionId = searchParams.get('session_id')

    if (sessionId) {
      fetch(`/api/billing/verify-session?session_id=${encodeURIComponent(sessionId)}`)
        .then(r => r.json())
        .then(data => {
          if (data.ok) {
            fetch('/api/billing/subscription').then(r => r.json()).then(d => setSubscription(d.subscription ?? null))
            fetch('/api/user/profile').then(r => r.json()).then(d => {
              setProfile(d)
              if (d.billing_interval) setBillingInterval(d.billing_interval)
            })
          }
        })
        .catch(() => {})
    }

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

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault()
    setPwError(''); setPwSuccess('')

    if (newPassword.length < 6) { setPwError('Das neue Passwort muss mindestens 6 Zeichen lang sein.'); return }
    if (newPassword !== confirmPassword) { setPwError('Die Passwörter stimmen nicht überein.'); return }

    setPwLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.email) { setPwError('Nicht eingeloggt.'); setPwLoading(false); return }

    const { error: signInError } = await supabase.auth.signInWithPassword({ email: user.email, password: currentPassword })
    if (signInError) { setPwError('Aktuelles Passwort ist falsch.'); setPwLoading(false); return }

    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) {
      setPwError(error.message)
    } else {
      setPwSuccess('Passwort erfolgreich geändert.')
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('')
      setTimeout(() => setPwSuccess(''), 4000)
    }
    setPwLoading(false)
  }

  async function handlePortal() {
    setPortalLoading(true)
    const res = await fetch('/api/billing/portal', { method: 'POST' })
    const data = await res.json()
    if (data.url) router.push(data.url)
    else setPortalLoading(false)
  }

  async function handleCancelSubscription() {
    setCancelLoading(true); setCancelError('')
    const res = await fetch('/api/billing/subscription', { method: 'DELETE' })
    const data = await res.json()
    if (data.error) {
      setCancelError(data.error)
    } else {
      setSubscription(prev => prev ? { ...prev, cancel_at_period_end: true, cancel_at: data.current_period_end } : null)
      setShowCancelConfirm(false)
    }
    setCancelLoading(false)
  }

  async function handleCheckout(plan: string) {
    setCheckoutLoading(plan)
    const res = await fetch('/api/billing/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan, interval: billingInterval }),
    })
    const data = await res.json()
    if (data.url) router.push(data.url)
    else setCheckoutLoading(null)
  }

  const periodEnd = subscription?.current_period_end
    ? new Date(subscription.current_period_end * 1000).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })
    : null

  const currentPlan = profile?.plan ?? subscription?.plan ?? 'starter'
  const hasSubscription = !!profile?.stripe_customer_id

  return (
    <div className="max-w-5xl mx-auto">

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 left-4 right-4 sm:left-auto sm:right-6 sm:top-6 z-50 px-5 py-3 rounded-2xl text-sm font-medium text-white text-center sm:text-left"
          style={{ background: '#1a1a1a', boxShadow: '0 8px 30px rgba(0,0,0,0.25)' }}>
          {toast}
        </div>
      )}

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <div className="mb-10">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
          Einstellungen
        </h1>
        <p className="text-base mt-1.5" style={{ color: '#94A3B8' }}>
          Verwalte dein Abonnement, Zahlungen und Sicherheit.
        </p>
      </div>

      {/* ════════════════════════════════════════════════════════════════
          ABONNEMENT
          ════════════════════════════════════════════════════════════════ */}
      <Section title="Abonnement" subtitle="Aktueller Tarif und Abrechnung">
        {subLoading ? (
          <div className="h-24 rounded-3xl bg-gray-100 animate-pulse" />
        ) : subscription ? (
          <div className="rounded-3xl p-6 sm:p-7"
            style={{
              background: subscription.cancel_at_period_end ? '#FFF7ED' : '#F0FDF4',
            }}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className="text-base font-bold text-gray-900">
                    {PLAN_LABELS[subscription.plan] ?? subscription.plan}
                  </span>
                  {subscription.billing_interval && (
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full"
                      style={{ background: 'rgba(255,255,255,0.7)', color: '#374151' }}>
                      {subscription.billing_interval === 'year' ? 'Jährlich' : 'Monatlich'}
                    </span>
                  )}
                  <StatusBadge cancelling={subscription.cancel_at_period_end}>
                    {subscription.cancel_at_period_end ? 'Wird beendet' : 'Aktiv'}
                  </StatusBadge>
                </div>
                {subscription.cancel_at_period_end ? (
                  <p className="text-sm" style={{ color: '#C2410C' }}>
                    Dein Abo läuft am <strong>{periodEnd}</strong> aus. Danach werden Premium-Webseiten deaktiviert.
                  </p>
                ) : (
                  <p className="text-sm" style={{ color: '#15803D' }}>
                    Nächste Abrechnung am <strong>{periodEnd}</strong>.
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mt-5">
              {hasSubscription && (
                <button onClick={handlePortal} disabled={portalLoading}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl transition-opacity hover:opacity-90 disabled:opacity-70"
                  style={{ background: '#1a1a1a', color: '#fff' }}>
                  {portalLoading
                    ? <Spinner />
                    : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"/></svg>
                  }
                  Zahlung & Rechnungen
                </button>
              )}
              {subscription && !subscription.cancel_at_period_end && (
                <button onClick={() => setShowCancelConfirm(true)}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl transition-colors"
                  style={{ color: '#DC2626', background: 'transparent' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#FEF2F2')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  Abonnement kündigen
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-3xl p-6 sm:p-7" style={{ background: '#F8FAFC' }}>
            <p className="text-base font-semibold text-gray-900 mb-1">Kein aktives Abonnement</p>
            <p className="text-sm" style={{ color: '#64748B' }}>
              Wähle unten einen Tarif, um Premium-Webseiten zu veröffentlichen.
            </p>
          </div>
        )}
      </Section>

      {/* ════════════════════════════════════════════════════════════════
          PLAN WECHSELN
          ════════════════════════════════════════════════════════════════ */}
      <Section title="Plan wählen" subtitle="Wechsle jederzeit. Wir verrechnen anteilig.">
        {/* Interval toggle — segmented control */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-7">
          <div className="inline-flex p-1 rounded-2xl self-start" style={{ background: '#F1F5F9' }}>
            <button
              onClick={() => setBillingInterval('monthly')}
              className="px-5 py-2 text-sm font-semibold rounded-xl transition-all"
              style={{
                background: billingInterval === 'monthly' ? '#fff' : 'transparent',
                color: billingInterval === 'monthly' ? '#1a1a1a' : '#94A3B8',
                boxShadow: billingInterval === 'monthly' ? '0 1px 4px rgba(0,0,0,0.06)' : 'none',
              }}>
              Monatlich
            </button>
            <button
              onClick={() => setBillingInterval('yearly')}
              className="px-5 py-2 text-sm font-semibold rounded-xl transition-all flex items-center gap-2"
              style={{
                background: billingInterval === 'yearly' ? '#fff' : 'transparent',
                color: billingInterval === 'yearly' ? '#1a1a1a' : '#94A3B8',
                boxShadow: billingInterval === 'yearly' ? '0 1px 4px rgba(0,0,0,0.06)' : 'none',
              }}>
              Jährlich
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                style={{ background: '#DCFCE7', color: '#15803D' }}>
                −17%
              </span>
            </button>
          </div>
          <p className="text-xs" style={{ color: '#94A3B8' }}>
            {billingInterval === 'monthly' ? 'Mindestlaufzeit 1 Monat' : 'Jahresrechnung · spare 2 Monate'}
          </p>
        </div>

        {/* Plan cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5">
          {PLAN_LIST.map(plan => {
            const isCurrent = currentPlan === plan.key
            const price = billingInterval === 'monthly' ? plan.monthly_eur : plan.yearly_eur
            const perMonth = billingInterval === 'yearly' ? (plan.yearly_eur / 12).toFixed(0) : plan.monthly_eur
            const isLower = PLAN_ORDER.indexOf(plan.key) < PLAN_ORDER.indexOf(currentPlan as PlanKey)

            return (
              <div key={plan.key}
                className="relative flex flex-col rounded-3xl p-6 sm:p-7 transition-transform"
                style={{
                  background: plan.popular ? '#1a1a1a' : '#F8FAFC',
                  color: plan.popular ? '#fff' : '#1a1a1a',
                  border: plan.popular ? 'none' : '1px solid #E5E7EB',
                }}>

                {plan.popular && (
                  <span className="absolute top-5 right-5 text-[10px] font-bold px-2.5 py-1 rounded-full"
                    style={{ background: '#FBBF24', color: '#78350F' }}>
                    Beliebt
                  </span>
                )}

                <p className="text-sm font-semibold mb-2"
                  style={{ color: plan.popular ? 'rgba(255,255,255,0.7)' : '#64748B' }}>
                  {plan.name}
                </p>

                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-4xl font-bold tracking-tight">
                    €{billingInterval === 'yearly' ? perMonth : price}
                  </span>
                  <span className="text-sm" style={{ color: plan.popular ? 'rgba(255,255,255,0.5)' : '#94A3B8' }}>
                    /Monat
                  </span>
                </div>

                <p className="text-[11px] mb-1"
                  style={{ color: plan.popular ? 'rgba(255,255,255,0.4)' : '#94A3B8' }}>
                  inkl. ges. MwSt.
                </p>

                {billingInterval === 'yearly' ? (
                  <p className="text-xs mb-5"
                    style={{ color: plan.popular ? 'rgba(251,191,36,0.95)' : '#15803D' }}>
                    €{price}/Jahr · spare €{plan.monthly_eur * 12 - price}
                  </p>
                ) : (
                  <div className="mb-5" />
                )}

                <ul className="flex flex-col gap-2.5 flex-1 mb-6">
                  <li className="flex items-start gap-2.5 text-sm font-semibold">
                    <CheckIconForPlan dark={!!plan.popular} />
                    {plan.sites_label}
                  </li>
                  {COMMON_FEATURES.map(f => (
                    <li key={f} className="flex items-start gap-2.5 text-sm"
                      style={{ color: plan.popular ? 'rgba(255,255,255,0.8)' : '#475569' }}>
                      <CheckIconForPlan dark={!!plan.popular} />
                      {f}
                    </li>
                  ))}
                </ul>

                {isCurrent ? (
                  <div className="w-full py-3 text-sm font-semibold text-center rounded-xl"
                    style={{
                      background: plan.popular ? 'rgba(255,255,255,0.10)' : '#E5E7EB',
                      color: plan.popular ? 'rgba(255,255,255,0.6)' : '#6B7280',
                    }}>
                    Aktueller Tarif
                  </div>
                ) : isLower ? (
                  <div className="w-full py-3 text-sm font-medium text-center rounded-xl"
                    style={{
                      background: plan.popular ? 'rgba(255,255,255,0.10)' : 'transparent',
                      color: plan.popular ? 'rgba(255,255,255,0.4)' : '#CBD5E1',
                      border: plan.popular ? 'none' : '1px solid #E2E8F0',
                    }}>
                    Downgrade nicht möglich
                  </div>
                ) : (
                  <button onClick={() => handleCheckout(plan.key)} disabled={checkoutLoading === plan.key}
                    className="w-full py-3 text-sm font-bold rounded-xl transition-opacity hover:opacity-90 disabled:opacity-70 flex items-center justify-center gap-2"
                    style={{
                      background: plan.popular ? '#fff' : '#1a1a1a',
                      color: plan.popular ? '#1a1a1a' : '#fff',
                    }}>
                    {checkoutLoading === plan.key ? <Spinner /> : null}
                    {hasSubscription ? 'Upgraden' : 'Wählen'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </Section>

      {/* ════════════════════════════════════════════════════════════════
          RECHNUNGEN
          ════════════════════════════════════════════════════════════════ */}
      <Section title="Rechnungen" subtitle="Lade hier alle Rechnungen als PDF herunter — fertig für deine Buchhaltung.">
        {invoicesLoading ? (
          <div className="flex flex-col gap-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 rounded-2xl bg-gray-100 animate-pulse" />
            ))}
          </div>
        ) : invoices.length === 0 ? (
          <div className="rounded-3xl p-6 sm:p-7" style={{ background: '#F8FAFC' }}>
            <p className="text-sm font-medium text-gray-700">Noch keine Rechnungen</p>
            <p className="text-sm mt-1" style={{ color: '#94A3B8' }}>
              Rechnungen erscheinen hier, sobald deine erste Zahlung verbucht ist.
            </p>
          </div>
        ) : (
          <div className="flex flex-col">
            {invoices.map((inv, i) => {
              const date = new Date(inv.created * 1000).toLocaleDateString('de-DE', {
                day: '2-digit', month: 'short', year: 'numeric',
              })
              const amount = (inv.amount_paid > 0 ? inv.amount_paid : inv.amount_due) / 100
              const amountStr = amount.toLocaleString('de-DE', {
                style: 'currency',
                currency: inv.currency.toUpperCase(),
              })
              const statusLabel: Record<string, { text: string; bg: string; color: string }> = {
                paid:           { text: 'Bezahlt',       bg: '#ECFDF5', color: '#15803D' },
                open:           { text: 'Offen',         bg: '#FFF7ED', color: '#B45309' },
                uncollectible:  { text: 'Uneinbringlich', bg: '#FEF2F2', color: '#B91C1C' },
                void:           { text: 'Storniert',     bg: '#F3F4F6', color: '#6B7280' },
              }
              const s = statusLabel[inv.status ?? 'paid'] ?? statusLabel.paid
              const isLast = i === invoices.length - 1

              return (
                <div key={inv.id}
                  className="flex items-center gap-3 px-3 py-4 rounded-2xl transition-colors hover:bg-gray-50"
                  style={{ borderBottom: isLast ? 'none' : '1px solid #F1F5F9' }}>
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: '#F1F5F9' }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                      <polyline points="14 2 14 8 20 8"/>
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {inv.number ?? `Rechnung ${inv.id.slice(-8)}`}
                      </p>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                        style={{ background: s.bg, color: s.color }}>
                        {s.text}
                      </span>
                    </div>
                    <p className="text-xs mt-0.5 break-words" style={{ color: '#94A3B8' }}>
                      {date} · {amountStr} inkl. MwSt.
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {inv.invoice_pdf && (
                      <a href={inv.invoice_pdf} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl transition-colors"
                        style={{ background: '#1a1a1a', color: '#fff' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#333')}
                        onMouseLeave={e => (e.currentTarget.style.background = '#1a1a1a')}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
                        </svg>
                        PDF
                      </a>
                    )}
                    {inv.hosted_invoice_url && (
                      <a href={inv.hosted_invoice_url} target="_blank" rel="noopener noreferrer"
                        className="hidden sm:flex items-center justify-center w-9 h-9 rounded-xl transition-colors"
                        style={{ background: '#F3F4F6', color: '#374151' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#E5E7EB')}
                        onMouseLeave={e => (e.currentTarget.style.background = '#F3F4F6')}
                        title="Online ansehen">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"/>
                        </svg>
                      </a>
                    )}
                  </div>
                </div>
              )
            })}
            {hasSubscription && (
              <div className="mt-4 pt-4" style={{ borderTop: '1px solid #F1F5F9' }}>
                <button onClick={handlePortal} disabled={portalLoading}
                  className="text-sm font-medium transition-colors disabled:opacity-50"
                  style={{ color: '#6B7280' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#1a1a1a')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#6B7280')}>
                  {portalLoading ? 'Öffnet…' : 'Alle Rechnungen & Zahlungsmethoden im Stripe-Portal verwalten →'}
                </button>
              </div>
            )}
          </div>
        )}
      </Section>

      {/* ════════════════════════════════════════════════════════════════
          SICHERHEIT (Passwort)
          ════════════════════════════════════════════════════════════════ */}
      <Section title="Sicherheit" subtitle="Aktualisiere dein Passwort regelmäßig.">
        <form onSubmit={handlePasswordChange} className="w-full sm:max-w-md flex flex-col gap-4">
          <Field
            label="Aktuelles Passwort"
            value={currentPassword}
            onChange={setCurrentPassword}
            type="password"
            placeholder="••••••••"
          />
          <Field
            label="Neues Passwort"
            value={newPassword}
            onChange={setNewPassword}
            type="password"
            placeholder="Mindestens 6 Zeichen"
          />
          <Field
            label="Neues Passwort bestätigen"
            value={confirmPassword}
            onChange={setConfirmPassword}
            type="password"
            placeholder="••••••••"
          />

          {pwError && (
            <p className="text-sm font-medium px-4 py-3 rounded-2xl"
              style={{ background: '#FEF2F2', color: '#DC2626' }}>
              {pwError}
            </p>
          )}
          {pwSuccess && (
            <p className="text-sm font-medium px-4 py-3 rounded-2xl flex items-center gap-2"
              style={{ background: '#F0FDF4', color: '#15803D' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M20 6L9 17l-5-5"/>
              </svg>
              {pwSuccess}
            </p>
          )}

          <button type="submit" disabled={pwLoading}
            className="self-start flex items-center gap-2 px-5 py-3 text-sm font-bold text-white rounded-xl transition-opacity hover:opacity-90 disabled:opacity-70 mt-1"
            style={{ background: '#1a1a1a' }}>
            {pwLoading && <Spinner />}
            Passwort ändern
          </button>
        </form>
      </Section>

      {/* ════════════════════════════════════════════════════════════════
          HÄUFIGE FRAGEN
          ════════════════════════════════════════════════════════════════ */}
      <Section title="Häufige Fragen" subtitle="Antworten auf typische Fragen rund um dein Abo.">
        <div className="flex flex-col">
          {FAQ.map(([q, a], i) => {
            const open = openFaq === i
            return (
              <div key={i} className="border-b border-gray-100">
                <button onClick={() => setOpenFaq(open ? null : i)}
                  className="w-full flex items-center justify-between gap-4 py-5 text-left transition-colors hover:bg-gray-50 px-1"
                  aria-expanded={open}>
                  <span className="text-[15px] font-semibold text-gray-900">{q}</span>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2"
                    style={{ transform: open ? 'rotate(45deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                    <path d="M12 5v14M5 12h14" strokeLinecap="round"/>
                  </svg>
                </button>
                {open && (
                  <p className="text-sm pb-5 px-1 leading-relaxed" style={{ color: '#64748B' }}>
                    {a}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      </Section>

      {/* Cancel confirmation modal */}
      {showCancelConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)' }}>
          <div className="bg-white rounded-3xl p-7 max-w-md w-full flex flex-col gap-5"
            style={{ boxShadow: '0 24px 64px rgba(0,0,0,0.20)' }}>
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{ background: '#FEF2F2' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="1.75">
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-gray-900 text-lg tracking-tight">Abonnement kündigen?</h3>
                <p className="text-sm mt-1.5 leading-relaxed" style={{ color: '#64748B' }}>
                  Dein Abonnement bleibt bis zum <strong className="text-gray-900">{periodEnd}</strong> aktiv.
                  Danach werden aktive Premium-Webseiten deaktiviert.
                </p>
              </div>
            </div>

            {cancelError && (
              <p className="text-sm font-medium px-4 py-3 rounded-2xl"
                style={{ background: '#FEF2F2', color: '#DC2626' }}>
                {cancelError}
              </p>
            )}

            <div className="flex gap-3">
              <button onClick={() => { setShowCancelConfirm(false); setCancelError('') }}
                className="flex-1 px-4 py-3 text-sm font-semibold rounded-xl transition-colors hover:bg-gray-200"
                style={{ background: '#F3F4F6', color: '#374151' }}>
                Behalten
              </button>
              <button onClick={handleCancelSubscription} disabled={cancelLoading}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold text-white rounded-xl transition-colors disabled:opacity-70"
                style={{ background: '#DC2626' }}
                onMouseEnter={e => { if (!cancelLoading) (e.currentTarget as HTMLElement).style.background = '#B91C1C' }}
                onMouseLeave={e => { if (!cancelLoading) (e.currentTarget as HTMLElement).style.background = '#DC2626' }}>
                {cancelLoading && <Spinner />}
                Kündigen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Section({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section className="mb-12 sm:mb-14 pb-12 sm:pb-14"
      style={{ borderBottom: '1px solid #F1F5F9' }}>
      <div className="mb-6">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">{title}</h2>
        <p className="text-sm mt-1" style={{ color: '#94A3B8' }}>{subtitle}</p>
      </div>
      {children}
    </section>
  )
}

function StatusBadge({ cancelling, children }: { cancelling: boolean; children: React.ReactNode }) {
  return (
    <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1.5"
      style={{
        background: cancelling ? '#FED7AA' : '#BBF7D0',
        color: cancelling ? '#9A3412' : '#14532D',
      }}>
      <span className="w-1.5 h-1.5 rounded-full"
        style={{ background: cancelling ? '#EA580C' : '#16A34A' }} />
      {children}
    </span>
  )
}

function Field({
  label, value, onChange, type = 'text', placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  placeholder?: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-semibold text-gray-700">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        required
        className="w-full px-4 py-3 text-[15px] rounded-2xl outline-none transition-all bg-white"
        style={{ border: '1.5px solid #E5E7EB' }}
        onFocus={e => (e.target.style.borderColor = '#1a1a1a')}
        onBlur={e => (e.target.style.borderColor = '#E5E7EB')}
      />
    </div>
  )
}

function CheckIconForPlan({ dark }: { dark?: boolean }) {
  return (
    <svg className="flex-shrink-0 mt-0.5" width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke={dark ? '#FBBF24' : '#16A34A'} strokeWidth="2.5">
      <path d="M20 6L9 17l-5-5"/>
    </svg>
  )
}

function Spinner() {
  return (
    <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
  )
}

// ── Page entry with Suspense ─────────────────────────────────────────────────

export default function SettingsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 rounded-full border-2 border-gray-200 border-t-gray-900 animate-spin" />
      </div>
    }>
      <SettingsContent />
    </Suspense>
  )
}
