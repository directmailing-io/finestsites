'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface SubscriptionInfo {
  status: string
  current_period_end: number
  cancel_at_period_end: boolean
  cancel_at: number | null
  plan: string
  billing_interval: string | null
}

const PLAN_LABELS: Record<string, string> = {
  starter: 'Starter',
  pro: 'Pro',
  unlimited: 'Unlimited',
}

export default function SettingsPage() {
  const supabase = createClient()
  const router = useRouter()

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwLoading, setPwLoading] = useState(false)
  const [pwError, setPwError] = useState('')
  const [pwSuccess, setPwSuccess] = useState('')
  const [portalLoading, setPortalLoading] = useState(false)

  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null)
  const [subLoading, setSubLoading] = useState(true)
  const [cancelLoading, setCancelLoading] = useState(false)
  const [cancelError, setCancelError] = useState('')
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)

  const inputStyle = {
    background: '#FFFFFF', border: '1.5px solid #E5E7EB',
    borderRadius: '14px', padding: '10px 14px',
    fontSize: '14px', outline: 'none', width: '100%',
  }

  useEffect(() => {
    fetch('/api/billing/subscription')
      .then(r => r.json())
      .then(d => setSubscription(d.subscription ?? null))
      .finally(() => setSubLoading(false))
  }, [])

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault()
    setPwError('')
    setPwSuccess('')

    if (newPassword.length < 6) {
      setPwError('Das neue Passwort muss mindestens 6 Zeichen lang sein.')
      return
    }
    if (newPassword !== confirmPassword) {
      setPwError('Die Passwörter stimmen nicht überein.')
      return
    }

    setPwLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.email) { setPwError('Nicht eingeloggt.'); setPwLoading(false); return }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    })
    if (signInError) {
      setPwError('Aktuelles Passwort ist falsch.')
      setPwLoading(false)
      return
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) {
      setPwError(error.message)
    } else {
      setPwSuccess('Passwort erfolgreich geändert.')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setTimeout(() => setPwSuccess(''), 4000)
    }
    setPwLoading(false)
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

  async function handleCancelSubscription() {
    setCancelLoading(true)
    setCancelError('')
    const res = await fetch('/api/billing/subscription', { method: 'DELETE' })
    const data = await res.json()
    if (data.error) {
      setCancelError(data.error)
    } else {
      setSubscription(prev => prev ? {
        ...prev,
        cancel_at_period_end: true,
        cancel_at: data.current_period_end,
      } : null)
      setShowCancelConfirm(false)
    }
    setCancelLoading(false)
  }

  const periodEnd = subscription?.current_period_end
    ? new Date(subscription.current_period_end * 1000).toLocaleDateString('de-DE', {
        day: '2-digit', month: 'long', year: 'numeric'
      })
    : null

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">Einstellungen</h1>
        <p className="text-sm mt-1" style={{ color: '#94A3B8' }}>
          Account und Abonnement verwalten
        </p>
      </div>

      <div className="flex flex-col gap-6">

        {/* Password change */}
        <div className="p-6 rounded-[24px] bg-white flex flex-col gap-4"
          style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.06)', border: '1px solid #F1F5F9' }}>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-[14px] flex items-center justify-center flex-shrink-0"
              style={{ background: '#F3F4F6' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="1.5">
                <rect x="3" y="11" width="18" height="11" rx="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-sm">Passwort ändern</p>
              <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>Ändere dein Login-Passwort</p>
            </div>
          </div>

          <form onSubmit={handlePasswordChange} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-gray-700">Aktuelles Passwort</label>
              <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)}
                placeholder="••••••••" required style={inputStyle}
                onFocus={e => (e.target.style.borderColor = '#1a1a1a')}
                onBlur={e => (e.target.style.borderColor = '#E5E7EB')} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-gray-700">Neues Passwort</label>
              <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                placeholder="Min. 6 Zeichen" required style={inputStyle}
                onFocus={e => (e.target.style.borderColor = '#1a1a1a')}
                onBlur={e => (e.target.style.borderColor = '#E5E7EB')} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-gray-700">Neues Passwort bestätigen</label>
              <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                placeholder="••••••••" required style={inputStyle}
                onFocus={e => (e.target.style.borderColor = '#1a1a1a')}
                onBlur={e => (e.target.style.borderColor = '#E5E7EB')} />
            </div>

            {pwError && (
              <p className="text-xs font-medium px-3 py-2 rounded-[10px]"
                style={{ background: '#FEF2F2', color: '#DC2626' }}>
                {pwError}
              </p>
            )}
            {pwSuccess && (
              <p className="text-xs font-medium px-3 py-2 rounded-[10px]"
                style={{ background: '#F0FDF4', color: '#16A34A' }}>
                ✓ {pwSuccess}
              </p>
            )}

            <button type="submit" disabled={pwLoading}
              className="self-start flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white rounded-[14px] disabled:opacity-70"
              style={{ background: '#1a1a1a', boxShadow: '0 4px 14px rgba(26,26,26,0.2)' }}>
              {pwLoading && <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />}
              Passwort speichern
            </button>
          </form>
        </div>

        {/* Subscription & Billing */}
        <div className="p-6 rounded-[24px] bg-white flex flex-col gap-4"
          style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.06)', border: '1px solid #F1F5F9' }}>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-[14px] flex items-center justify-center flex-shrink-0"
              style={{ background: '#F3F4F6' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="1.5">
                <rect x="1" y="4" width="22" height="16" rx="2"/>
                <line x1="1" y1="10" x2="23" y2="10"/>
              </svg>
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-sm">Abonnement & Rechnungen</p>
              <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>Plan, Zahlungsmethode, Rechnungen</p>
            </div>
          </div>

          {/* Subscription status card */}
          {subLoading ? (
            <div className="h-16 rounded-[14px] animate-pulse" style={{ background: '#F3F4F6' }} />
          ) : subscription ? (
            <div className="rounded-[14px] p-4 flex flex-col gap-3"
              style={{ background: subscription.cancel_at_period_end ? '#FFF7ED' : '#F0FDF4', border: `1px solid ${subscription.cancel_at_period_end ? '#FED7AA' : '#BBF7D0'}` }}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                      style={{ background: '#1a1a1a', color: '#fff' }}>
                      {PLAN_LABELS[subscription.plan] ?? subscription.plan}
                    </span>
                    {subscription.billing_interval && (
                      <span className="text-xs" style={{ color: '#6B7280' }}>
                        {subscription.billing_interval === 'year' ? 'Jährlich' : 'Monatlich'}
                      </span>
                    )}
                  </div>
                  {subscription.cancel_at_period_end ? (
                    <p className="text-xs font-medium" style={{ color: '#C2410C' }}>
                      Kündigung zum {periodEnd} — danach kein Zugang mehr
                    </p>
                  ) : (
                    <p className="text-xs" style={{ color: '#4B5563' }}>
                      Verlängerung am <span className="font-medium">{periodEnd}</span>
                    </p>
                  )}
                </div>
                <div className="w-8 h-8 rounded-[10px] flex items-center justify-center flex-shrink-0"
                  style={{ background: subscription.cancel_at_period_end ? '#FED7AA' : '#BBF7D0' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                    stroke={subscription.cancel_at_period_end ? '#C2410C' : '#16A34A'} strokeWidth="2">
                    {subscription.cancel_at_period_end
                      ? <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>
                      : <polyline points="20 6 9 17 4 12"/>
                    }
                  </svg>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-[14px] p-4 text-sm" style={{ background: '#F9FAFB', color: '#6B7280' }}>
              Kein aktives Abonnement. <a href="/billing" className="font-medium underline" style={{ color: '#1a1a1a' }}>Jetzt upgraden</a>
            </div>
          )}

          <p className="text-sm leading-relaxed" style={{ color: '#64748B' }}>
            Über das Stripe-Kundenportal kannst du deinen Plan verwalten, Zahlungsmethoden ändern und Rechnungen herunterladen.
          </p>

          <div className="flex gap-3 flex-wrap">
            <button onClick={handlePortal} disabled={portalLoading}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white rounded-[14px] disabled:opacity-70"
              style={{ background: '#1a1a1a', boxShadow: '0 4px 14px rgba(26,26,26,0.2)' }}>
              {portalLoading
                ? <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"/>
                  </svg>
              }
              Zum Stripe-Kundenportal
            </button>
            <a href="/billing"
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-[14px]"
              style={{ background: '#F3F4F6', color: '#374151' }}>
              Tarif-Übersicht
            </a>
            {subscription && !subscription.cancel_at_period_end && (
              <button onClick={() => setShowCancelConfirm(true)}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-[14px]"
                style={{ color: '#DC2626', background: '#FEF2F2' }}>
                Abonnement kündigen
              </button>
            )}
          </div>
        </div>

      </div>

      {/* Cancel confirmation modal */}
      {showCancelConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-[24px] p-6 max-w-sm w-full flex flex-col gap-4"
            style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-[14px] flex items-center justify-center flex-shrink-0"
                style={{ background: '#FEF2F2' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="1.5">
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </div>
              <div>
                <p className="font-semibold text-gray-900 text-sm">Abonnement kündigen?</p>
                <p className="text-xs mt-1" style={{ color: '#6B7280' }}>
                  Dein Abonnement bleibt bis zum <strong>{periodEnd}</strong> aktiv. Danach wird dein Account auf den kostenlosen Plan zurückgesetzt und aktive Webseiten werden deaktiviert.
                </p>
              </div>
            </div>

            {cancelError && (
              <p className="text-xs font-medium px-3 py-2 rounded-[10px]"
                style={{ background: '#FEF2F2', color: '#DC2626' }}>
                {cancelError}
              </p>
            )}

            <div className="flex gap-3">
              <button onClick={() => { setShowCancelConfirm(false); setCancelError('') }}
                className="flex-1 px-4 py-2.5 text-sm font-medium rounded-[14px]"
                style={{ background: '#F3F4F6', color: '#374151' }}>
                Abbrechen
              </button>
              <button onClick={handleCancelSubscription} disabled={cancelLoading}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white rounded-[14px] disabled:opacity-70"
                style={{ background: '#DC2626' }}>
                {cancelLoading && <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />}
                Jetzt kündigen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
