'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { signIn } from '@/lib/auth/client'

export default function RegisterPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [referralCode, setReferralCode] = useState('')
  const [referralValid, setReferralValid] = useState<boolean | null>(null)
  const [showReferral, setShowReferral] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  const passwordsMatch = confirm === '' || password === confirm
  const passwordStrong = password.length >= 8

  async function checkReferral(code: string) {
    if (!code.trim()) { setReferralValid(null); return }
    const res = await fetch(`/api/affiliate/validate?code=${encodeURIComponent(code.trim())}`)
    setReferralValid(res.ok)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!passwordStrong) { setError('Passwort muss mindestens 8 Zeichen haben.'); return }
    if (password !== confirm) { setError('Passwörter stimmen nicht überein.'); return }

    setLoading(true)
    setError('')

    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, referral_code: referralCode.trim() || undefined }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error || 'Registrierung fehlgeschlagen.')
      setLoading(false)
      return
    }

    // Sign in immediately so the session cookie is set in the browser,
    // then redirect to plan selection
    const signInResult = await signIn.email({
      email: email.toLowerCase().trim(),
      password,
    })

    if (signInResult.error) {
      // Registration succeeded but auto-login failed — redirect to login
      router.push('/login?registered=1')
      return
    }

    // Redirect to onboarding
    router.push('/onboarding/plan')
  }

  if (sent) {
    return (
      <div className="text-center py-2">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-5"
          style={{ background: '#F0FDF4' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="1.5">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
            <polyline points="22 4 12 14.01 9 11.01"/>
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Account erstellt!</h2>
        <p className="text-sm" style={{ color: '#6B7280' }}>Du wirst gleich zum Plan-Auswahl weitergeleitet…</p>
      </div>
    )
  }

  return (
    <>
      <div className="mb-7">
        <h1 className="text-xl font-semibold text-gray-900 mb-1">Account erstellen</h1>
        <p className="text-sm" style={{ color: '#6B7280' }}>
          Bereits registriert?{' '}
          <Link href="/login" className="font-medium text-gray-900 underline underline-offset-4">
            Anmelden
          </Link>
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {error && (
          <div className="px-4 py-3 rounded-2xl text-sm"
            style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C' }}>
            {error}
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium" style={{ color: '#374151' }}>E-Mail</label>
          <input
            type="email" value={email} onChange={e => setEmail(e.target.value)}
            required placeholder="deine@email.de" autoComplete="email"
            className="w-full px-4 py-3 text-sm rounded-2xl outline-none transition-all"
            style={fieldStyle}
            onFocus={e => (e.target.style.borderColor = '#111827')}
            onBlur={e => (e.target.style.borderColor = '#E5E7EB')}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium" style={{ color: '#374151' }}>Passwort</label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'} value={password}
              onChange={e => setPassword(e.target.value)}
              required placeholder="Mindestens 8 Zeichen" autoComplete="new-password"
              className="w-full px-4 py-3 pr-11 text-sm rounded-2xl outline-none transition-all"
              style={{ ...fieldStyle, borderColor: password && !passwordStrong ? '#F87171' : '#E5E7EB' }}
              onFocus={e => (e.target.style.borderColor = '#111827')}
              onBlur={e => (e.target.style.borderColor = password && !passwordStrong ? '#F87171' : '#E5E7EB')}
            />
            <button type="button" onClick={() => setShowPassword(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1"
              style={{ color: '#9CA3AF' }} tabIndex={-1}>
              {showPassword ? <EyeOff /> : <Eye />}
            </button>
          </div>
          {password && !passwordStrong && (
            <p className="text-xs px-1" style={{ color: '#DC2626' }}>Mindestens 8 Zeichen erforderlich</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium" style={{ color: '#374151' }}>Passwort bestätigen</label>
          <input
            type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
            required placeholder="••••••••" autoComplete="new-password"
            className="w-full px-4 py-3 text-sm rounded-2xl outline-none transition-all"
            style={{ ...fieldStyle, borderColor: !passwordsMatch ? '#F87171' : '#E5E7EB' }}
            onFocus={e => (e.target.style.borderColor = '#111827')}
            onBlur={e => (e.target.style.borderColor = !passwordsMatch ? '#F87171' : '#E5E7EB')}
          />
          {!passwordsMatch && (
            <p className="text-xs px-1" style={{ color: '#DC2626' }}>Passwörter stimmen nicht überein</p>
          )}
        </div>

        {/* Empfehlungscode — eingeklappt */}
        <div>
          <button
            type="button"
            onClick={() => setShowReferral(v => !v)}
            className="flex items-center gap-1.5 text-xs transition-colors"
            style={{ color: '#9CA3AF' }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5"
              style={{ transform: showReferral ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}>
              <path d="M9 18l6-6-6-6"/>
            </svg>
            Hast du einen Empfehlungscode?
          </button>

          {showReferral && (
            <div className="mt-2.5 flex flex-col gap-1.5">
              <div className="relative">
                <input
                  type="text" value={referralCode}
                  onChange={e => { setReferralCode(e.target.value); setReferralValid(null) }}
                  onBlur={() => checkReferral(referralCode)}
                  placeholder="z.B. max_mustermann" autoComplete="off"
                  className="w-full px-4 py-3 pr-10 text-sm rounded-2xl outline-none transition-all"
                  style={{
                    ...fieldStyle,
                    borderColor: referralValid === true ? '#16A34A' : referralValid === false ? '#F87171' : '#E5E7EB',
                  }}
                  onFocus={e => (e.target.style.borderColor = '#111827')}
                />
                {referralValid === true && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5">
                      <path d="M20 6 9 17l-5-5"/>
                    </svg>
                  </div>
                )}
              </div>
              {referralValid === true && (
                <p className="text-xs px-1" style={{ color: '#16A34A' }}>✓ Code gültig — 15% Rabatt auf dein Abo!</p>
              )}
              {referralValid === false && (
                <p className="text-xs px-1" style={{ color: '#DC2626' }}>Code nicht gefunden.</p>
              )}
            </div>
          )}
        </div>

        <button
          type="submit" disabled={loading}
          className="w-full py-3 text-sm font-semibold rounded-2xl transition-all mt-1"
          style={{
            background: loading ? '#E5E7EB' : '#111827',
            color: loading ? '#9CA3AF' : '#fff',
            cursor: loading ? 'not-allowed' : 'pointer',
            boxShadow: loading ? 'none' : '0 4px 14px rgba(17,24,39,0.2)',
          }}
        >
          {loading ? 'Wird erstellt…' : 'Account erstellen →'}
        </button>

        <p className="text-xs text-center" style={{ color: '#9CA3AF' }}>
          Mit der Registrierung stimmst du unseren{' '}
          <a href="/agb" className="underline underline-offset-2" style={{ color: '#6B7280' }}>AGB</a> zu.
        </p>
      </form>
    </>
  )
}

const fieldStyle = {
  background: '#fff',
  border: '1.5px solid #E5E7EB',
  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
}

function Eye() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  )
}
function EyeOff() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  )
}
