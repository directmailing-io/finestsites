'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function RegisterPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [referralCode, setReferralCode] = useState('')
  const [referralValid, setReferralValid] = useState<boolean | null>(null)
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

    setSent(true)
    setLoading(false)
  }

  if (sent) {
    return (
      <>
        <div className="w-10 h-10 rounded-[14px] flex items-center justify-center mb-5"
          style={{ background: '#F0FDF4' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
            <polyline points="22,6 12,13 2,6"/>
          </svg>
        </div>
        <h1 className="text-xl font-semibold text-gray-900 mb-2">E-Mail bestätigen</h1>
        <p className="text-sm" style={{ color: '#6B7280' }}>
          Wir haben eine Bestätigungs-E-Mail an{' '}
          <span className="font-medium text-gray-900">{email}</span> geschickt.
          Bitte klicke auf den Link in der E-Mail, um deinen Account zu aktivieren.
        </p>
        <p className="text-xs mt-5" style={{ color: '#9CA3AF' }}>
          Bereits registriert?{' '}
          <Link href="/login" className="underline underline-offset-2" style={{ color: '#6B7280' }}>
            Anmelden
          </Link>
        </p>
      </>
    )
  }

  return (
    <>
      <h1 className="text-xl font-semibold text-gray-900 mb-1">Account erstellen</h1>
      <p className="text-sm mb-7" style={{ color: '#6B7280' }}>
        Bereits registriert?{' '}
        <Link href="/login" className="font-medium text-gray-900 underline underline-offset-4">
          Anmelden
        </Link>
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {error && (
          <p className="text-sm" style={{ color: '#DC2626' }}>{error}</p>
        )}

        <AuthField label="E-Mail">
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            placeholder="deine@email.de"
            autoComplete="email"
            className="w-full px-4 py-3 text-sm rounded-2xl outline-none transition-all"
            style={fieldStyle}
            onFocus={e => (e.target.style.borderColor = '#111827')}
            onBlur={e => (e.target.style.borderColor = '#E5E7EB')}
          />
        </AuthField>

        <AuthField label="Passwort">
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              placeholder="Mindestens 8 Zeichen"
              autoComplete="new-password"
              className="w-full px-4 py-3 pr-11 text-sm rounded-2xl outline-none transition-all"
              style={{ ...fieldStyle, borderColor: password && !passwordStrong ? '#F87171' : '#E5E7EB' }}
              onFocus={e => (e.target.style.borderColor = '#111827')}
              onBlur={e => (e.target.style.borderColor = password && !passwordStrong ? '#F87171' : '#E5E7EB')}
            />
            <button
              type="button"
              onClick={() => setShowPassword(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1"
              style={{ color: '#9CA3AF' }}
              tabIndex={-1}
            >
              {showPassword ? <EyeOff /> : <Eye />}
            </button>
          </div>
          {password && !passwordStrong && (
            <p className="text-xs px-1" style={{ color: '#DC2626' }}>Mindestens 8 Zeichen erforderlich</p>
          )}
        </AuthField>

        <AuthField label="Passwort bestätigen">
          <input
            type="password"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            required
            placeholder="••••••••"
            autoComplete="new-password"
            className="w-full px-4 py-3 text-sm rounded-2xl outline-none transition-all"
            style={{ ...fieldStyle, borderColor: !passwordsMatch ? '#F87171' : '#E5E7EB' }}
            onFocus={e => (e.target.style.borderColor = '#111827')}
            onBlur={e => (e.target.style.borderColor = !passwordsMatch ? '#F87171' : '#E5E7EB')}
          />
          {!passwordsMatch && (
            <p className="text-xs px-1" style={{ color: '#DC2626' }}>Passwörter stimmen nicht überein</p>
          )}
        </AuthField>

        <AuthField label="Empfehlungscode (optional)">
          <div className="relative">
            <input
              type="text"
              value={referralCode}
              onChange={e => { setReferralCode(e.target.value); setReferralValid(null) }}
              onBlur={() => checkReferral(referralCode)}
              placeholder="z.B. max_mustermann"
              autoComplete="off"
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
            <p className="text-xs px-1 flex items-center gap-1" style={{ color: '#16A34A' }}>
              Code gültig — du erhältst 15% Rabatt auf dein Abo!
            </p>
          )}
          {referralValid === false && (
            <p className="text-xs px-1" style={{ color: '#DC2626' }}>Code nicht gefunden.</p>
          )}
        </AuthField>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 text-sm font-semibold rounded-2xl transition-all mt-1"
          style={{
            background: loading ? '#E5E7EB' : '#111827',
            color: loading ? '#9CA3AF' : '#fff',
            cursor: loading ? 'not-allowed' : 'pointer',
            boxShadow: loading ? 'none' : '0 4px 14px rgba(17,24,39,0.2)',
          }}
        >
          {loading ? 'Account wird erstellt…' : 'Weiter'}
        </button>

        <p className="text-xs text-center" style={{ color: '#9CA3AF' }}>
          Mit der Registrierung stimmst du unseren{' '}
          <a href="/agb" className="underline underline-offset-2" style={{ color: '#6B7280' }}>AGB</a> zu.
        </p>
      </form>
    </>
  )
}

function AuthField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium" style={{ color: '#374151' }}>{label}</label>
      {children}
    </div>
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
