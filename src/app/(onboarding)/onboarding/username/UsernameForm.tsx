'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const SITE_DOMAIN = process.env.NEXT_PUBLIC_SITE_DOMAIN ?? 'finestsites.de'

function sanitize(val: string) {
  return val
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z-]/g, '')
    .replace(/^-+/, '')
    .slice(0, 30)
}

function isValid(u: string) {
  return /^[a-z][a-z-]*[a-z]$/.test(u) && u.length >= 3
}

function StepDot({ n, active, done, label }: { n: number; active?: boolean; done?: boolean; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold"
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

export function UsernameForm() {
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const clean = sanitize(username)
    if (!isValid(clean)) {
      setError('Mindestens 3 Buchstaben. Nur a–z und Bindestriche (nicht am Anfang/Ende).')
      return
    }
    setLoading(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    // Server-side username save — subscription is verified server-side on page load
    const res = await fetch('/api/onboarding/set-username', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: clean }),
    })
    const data = await res.json()

    if (!res.ok) {
      const isDuplicate = data.code === 'DUPLICATE' || data.code === '23505'
      setError(isDuplicate
        ? 'Dieser Username ist bereits vergeben. Bitte wähle einen anderen.'
        : data.error ?? 'Fehler beim Speichern. Bitte versuche es erneut.')
      setLoading(false)
      return
    }

    router.push('/sites')
  }

  const display = sanitize(username)
  const valid = isValid(display)

  return (
    <div className="w-full max-w-sm">
      {/* Step indicator */}
      <div className="flex items-center justify-center gap-2 mb-10">
        <StepDot n={1} done label="Account" />
        <StepLine />
        <StepDot n={2} done label="Plan" />
        <StepLine />
        <StepDot n={3} active label="Username" />
      </div>

      <div className="text-center mb-8">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-5"
          style={{ background: '#F3F4F6' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#111827" strokeWidth="1.5">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
        </div>
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">Wähle deinen Username</h1>
        <p className="text-sm leading-relaxed" style={{ color: '#6B7280' }}>
          Dein Username ist gleichzeitig die Adresse<br />
          all deiner aktiven Websites.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <div
            className="flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-mono mb-1"
            style={{ background: '#F9FAFB', border: '1px solid #E5E7EB' }}
          >
            <span
              className="font-semibold transition-colors"
              style={{ color: valid ? '#111827' : '#9CA3AF' }}
            >
              {display || 'deinname'}
            </span>
            <span style={{ color: '#9CA3AF' }}>.{SITE_DOMAIN}</span>
          </div>

          <input
            type="text"
            value={username}
            onChange={e => {
              setUsername(e.target.value)
              setError('')
            }}
            required
            maxLength={30}
            placeholder="dein-name"
            autoFocus
            autoComplete="username"
            className="w-full px-4 py-3 text-sm rounded-2xl outline-none transition-all"
            style={{
              background: '#fff',
              border: `1.5px solid ${error ? '#F87171' : '#E5E7EB'}`,
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            }}
            onFocus={e => (e.target.style.borderColor = error ? '#F87171' : '#111827')}
            onBlur={e => {
              setUsername(sanitize(e.target.value))
              e.target.style.borderColor = error ? '#F87171' : '#E5E7EB'
            }}
          />

          {error && (
            <p className="text-xs px-1" style={{ color: '#DC2626' }}>{error}</p>
          )}
          <p className="text-xs px-1" style={{ color: '#9CA3AF' }}>
            Nur Buchstaben a–z und Bindestriche · Mindestens 3 Zeichen · Keine Zahlen · Unveränderlich
          </p>
        </div>

        <div className="px-4 py-3 rounded-xl text-xs" style={{ background: '#FEF9C3', border: '1px solid #FDE68A', color: '#92400E' }}>
          ⚠️ Der Username kann nach dem Speichern <strong>nicht mehr geändert</strong> werden.
        </div>

        <button
          type="submit"
          disabled={loading || !valid}
          className="w-full py-3 text-sm font-semibold rounded-2xl transition-all"
          style={{
            background: !valid || loading ? '#E5E7EB' : '#111827',
            color: !valid || loading ? '#9CA3AF' : '#fff',
            cursor: !valid || loading ? 'not-allowed' : 'pointer',
            boxShadow: valid && !loading ? '0 4px 14px rgba(17,24,39,0.2)' : 'none',
          }}
        >
          {loading ? 'Wird gespeichert…' : 'Username bestätigen →'}
        </button>
      </form>
    </div>
  )
}
