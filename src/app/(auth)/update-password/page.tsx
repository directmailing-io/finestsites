'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [sessionReady, setSessionReady] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    // Session is set by the auth/callback route via PKCE exchange
    // Just verify we have a valid session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSessionReady(true)
      } else {
        // No session - the link may have expired
        setError('Der Reset-Link ist abgelaufen. Bitte fordere einen neuen an.')
      }
    })
  }, [supabase.auth])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 8) { setError('Mindestens 8 Zeichen erforderlich.'); return }
    if (password !== confirm) { setError('Passwörter stimmen nicht überein.'); return }

    setLoading(true)
    setError('')

    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setSuccess(true)
      setTimeout(() => router.push('/sites'), 2000)
    }
  }

  if (success) {
    return (
      <div className="text-center py-2">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-5" style={{ background: '#F0FDF4' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="1.5">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
            <polyline points="22 4 12 14.01 9 11.01"/>
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Passwort geändert</h2>
        <p className="text-sm" style={{ color: '#6B7280' }}>Du wirst weitergeleitet…</p>
      </div>
    )
  }

  return (
    <>
      <div className="mb-7">
        <h1 className="text-xl font-semibold text-gray-900 mb-1">Neues Passwort</h1>
        <p className="text-sm" style={{ color: '#6B7280' }}>Wähle ein sicheres Passwort für deinen Account.</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {error && (
          <div className="px-4 py-3 rounded-2xl text-sm" style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C' }}>
            {error}
            {error.includes('abgelaufen') && (
              <div className="mt-2">
                <a href="/forgot-password" className="font-semibold underline underline-offset-2">Neuen Link anfordern</a>
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium" style={{ color: '#374151' }}>Neues Passwort</label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              disabled={!sessionReady}
              placeholder="Mindestens 8 Zeichen"
              autoComplete="new-password"
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
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium" style={{ color: '#374151' }}>Passwort bestätigen</label>
          <input
            type="password"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            required
            disabled={!sessionReady}
            placeholder="••••••••"
            autoComplete="new-password"
            className="w-full px-4 py-3 text-sm rounded-2xl outline-none transition-all"
            style={{ ...fieldStyle, borderColor: confirm && password !== confirm ? '#F87171' : '#E5E7EB' }}
            onFocus={e => (e.target.style.borderColor = '#111827')}
            onBlur={e => (e.target.style.borderColor = confirm && password !== confirm ? '#F87171' : '#E5E7EB')}
          />
          {confirm && password !== confirm && (
            <p className="text-xs px-1" style={{ color: '#DC2626' }}>Passwörter stimmen nicht überein</p>
          )}
        </div>

        <button
          type="submit"
          disabled={loading || !sessionReady}
          className="w-full py-3 text-sm font-semibold rounded-2xl transition-all mt-1"
          style={{
            background: loading || !sessionReady ? '#E5E7EB' : '#111827',
            color: loading || !sessionReady ? '#9CA3AF' : '#fff',
            cursor: loading || !sessionReady ? 'not-allowed' : 'pointer',
            boxShadow: loading || !sessionReady ? 'none' : '0 4px 14px rgba(17,24,39,0.2)',
          }}
        >
          {loading ? 'Wird gespeichert…' : 'Passwort speichern'}
        </button>
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
