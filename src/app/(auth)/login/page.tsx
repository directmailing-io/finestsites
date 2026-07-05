'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { authClient } from '@/lib/auth/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [needsConfirm, setNeedsConfirm] = useState(false)
  const [resending, setResending] = useState(false)
  const [resent, setResent] = useState(false)

  // Suppress Chrome's automatic credential manager prompt on load
  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.credentials?.preventSilentAccess) {
      navigator.credentials.preventSilentAccess()
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setNeedsConfirm(false)

    // Raw fetch instead of signIn.email() — eliminates BetterAuth client as a variable,
    // handles non-JSON responses gracefully, and gives us explicit timeout control.
    // signIn.email() uses better-fetch which throws (not returns error) on network-level
    // failures, making it impossible to distinguish from JS errors. Raw fetch is reliable
    // on all browsers including Safari iOS.
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000)

    try {
      const res = await fetch('/api/auth/sign-in/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.toLowerCase().trim(), password, rememberMe: true }),
        credentials: 'include',
        signal: controller.signal,
      })
      clearTimeout(timeoutId)

      let data: { message?: string; code?: string } = {}
      try { data = await res.json() } catch { /* non-JSON fallback — just use status code */ }

      if (!res.ok) {
        const msg = (data.message ?? '').toLowerCase()
        const code = (data.code ?? '').toLowerCase()
        if (code.includes('not_verified') || msg.includes('not confirmed') || msg.includes('not verified')) {
          setNeedsConfirm(true)
        } else if (res.status === 401) {
          setError('E-Mail oder Passwort falsch.')
        } else {
          setError('Anmeldung fehlgeschlagen. Bitte versuche es erneut.')
        }
        setLoading(false)
        return
      }

      window.location.href = '/sites'
    } catch (err) {
      clearTimeout(timeoutId)
      if (err instanceof DOMException && err.name === 'AbortError') {
        setError('Zeitüberschreitung. Bitte versuche es erneut.')
      } else {
        setError('Verbindungsfehler. Bitte prüfe deine Internetverbindung.')
      }
      setLoading(false)
    }
  }

  async function resendConfirmation() {
    setResending(true)
    await authClient.sendVerificationEmail({ email, callbackURL: '/sites' })
    setResent(true)
    setResending(false)
  }

  return (
    <>
      <h1 className="text-xl font-semibold text-gray-900 mb-1">Willkommen zurück</h1>
      <p className="text-sm mb-7" style={{ color: '#6B7280' }}>
        Noch kein Account?{' '}
        <Link href="/register" className="font-medium text-gray-900 underline underline-offset-4">
          Registrieren
        </Link>
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4" autoComplete="on">
        {error && (
          <p className="text-sm" style={{ color: '#DC2626' }}>{error}</p>
        )}

        {needsConfirm && (
          <div className="px-4 py-3 rounded-2xl text-sm" style={{ background: '#FEF9C3', border: '1px solid #FDE68A', color: '#92400E' }}>
            <p className="font-medium mb-1">E-Mail noch nicht bestätigt</p>
            <p className="text-xs mb-2">Bitte bestätige deine E-Mail-Adresse, um dich anzumelden.</p>
            {!resent ? (
              <button
                type="button"
                onClick={resendConfirmation}
                disabled={resending}
                className="text-xs font-semibold underline underline-offset-2"
                style={{ color: '#92400E' }}
              >
                {resending ? 'Wird gesendet…' : 'Bestätigungslink erneut senden'}
              </button>
            ) : (
              <p className="text-xs font-medium" style={{ color: '#065F46' }}>✓ E-Mail gesendet – bitte prüfe deinen Posteingang.</p>
            )}
          </div>
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

        <AuthField
          label="Passwort"
          right={
            <Link href="/forgot-password" className="text-xs underline underline-offset-2" style={{ color: '#6B7280' }}>
              Vergessen?
            </Link>
          }
        >
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              autoComplete="current-password"
              className="w-full px-4 py-3 pr-11 text-sm rounded-2xl outline-none transition-all"
              style={fieldStyle}
              onFocus={e => (e.target.style.borderColor = '#111827')}
              onBlur={e => (e.target.style.borderColor = '#E5E7EB')}
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
          {loading ? 'Anmelden…' : 'Anmelden'}
        </button>
      </form>
    </>
  )
}

function AuthField({ label, right, children }: { label: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium" style={{ color: '#374151' }}>{label}</label>
        {right}
      </div>
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
