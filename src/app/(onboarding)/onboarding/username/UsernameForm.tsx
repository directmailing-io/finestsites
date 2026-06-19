'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

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

function suggestUsername(first: string, last: string): string {
  const f = sanitize(first.trim())
  const l = sanitize(last.trim())
  if (f && l) return `${f}-${l}`.slice(0, 30)
  if (f) return f
  if (l) return l
  return ''
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

function InputField({
  label, value, onChange, placeholder, autoFocus, autoComplete,
}: {
  label: string; value: string; onChange: (v: string) => void
  placeholder?: string; autoFocus?: boolean; autoComplete?: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-semibold text-gray-700">{label}</label>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        autoComplete={autoComplete}
        className="w-full px-4 py-3 text-sm rounded-2xl outline-none transition-all"
        style={{ background: '#fff', border: '1.5px solid #E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
        onFocus={e => (e.target.style.borderColor = '#111827')}
        onBlur={e => (e.target.style.borderColor = '#E5E7EB')}
      />
    </div>
  )
}

export function UsernameForm() {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [username, setUsername] = useState('')
  const [usernameTouched, setUsernameTouched] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  // Auto-suggest username from first+last name unless user has manually edited it
  function handleFirstName(v: string) {
    setFirstName(v)
    if (!usernameTouched) setUsername(suggestUsername(v, lastName))
  }
  function handleLastName(v: string) {
    setLastName(v)
    if (!usernameTouched) setUsername(suggestUsername(firstName, v))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!firstName.trim()) { setError('Bitte gib deinen Vornamen ein.'); return }
    if (!lastName.trim()) { setError('Bitte gib deinen Nachnamen ein.'); return }
    const clean = sanitize(username)
    if (!isValid(clean)) {
      setError('Mindestens 3 Buchstaben. Nur a–z und Bindestriche (nicht am Anfang/Ende).')
      return
    }
    setLoading(true)
    setError('')

    const res = await fetch('/api/onboarding/set-username', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: clean, first_name: firstName.trim(), last_name: lastName.trim() }),
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
        <StepDot n={3} active label="Profil" />
      </div>

      <div className="text-center mb-8">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-5"
          style={{ background: '#F3F4F6' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#111827" strokeWidth="1.5">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
        </div>
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">Fast geschafft!</h1>
        <p className="text-sm leading-relaxed" style={{ color: '#6B7280' }}>
          Gib deinen Namen ein und wähle deinen Username — er wird Teil deiner Website-Adresse.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Name fields */}
        <div className="grid grid-cols-2 gap-3">
          <InputField
            label="Vorname"
            value={firstName}
            onChange={handleFirstName}
            placeholder="Max"
            autoFocus
            autoComplete="given-name"
          />
          <InputField
            label="Nachname"
            value={lastName}
            onChange={handleLastName}
            placeholder="Mustermann"
            autoComplete="family-name"
          />
        </div>

        {/* Username */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-semibold text-gray-700">Username</label>

          <div
            className="flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-mono mb-1"
            style={{ background: '#F9FAFB', border: '1px solid #E5E7EB' }}
          >
            <span
              className="font-semibold transition-colors"
              style={{ color: valid ? '#111827' : '#9CA3AF' }}
            >
              {display || 'dein-name'}
            </span>
            <span style={{ color: '#9CA3AF' }}>.{SITE_DOMAIN}</span>
          </div>

          <input
            type="text"
            value={username}
            onChange={e => {
              setUsername(e.target.value)
              setUsernameTouched(true)
              setError('')
            }}
            required
            maxLength={30}
            placeholder="dein-name"
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
            Nur Buchstaben a–z und Bindestriche · Mindestens 3 Zeichen · Unveränderlich
          </p>
        </div>

        <div className="px-4 py-3 rounded-xl text-xs" style={{ background: '#FEF9C3', border: '1px solid #FDE68A', color: '#92400E' }}>
          ⚠️ Der Username kann nach dem Speichern <strong>nicht mehr geändert</strong> werden.
        </div>

        <button
          type="submit"
          disabled={loading || !valid || !firstName.trim() || !lastName.trim()}
          className="w-full py-3 text-sm font-semibold rounded-2xl transition-all"
          style={{
            background: (!valid || loading || !firstName.trim() || !lastName.trim()) ? '#E5E7EB' : '#111827',
            color: (!valid || loading || !firstName.trim() || !lastName.trim()) ? '#9CA3AF' : '#fff',
            cursor: (!valid || loading) ? 'not-allowed' : 'pointer',
            boxShadow: (valid && !loading && firstName.trim() && lastName.trim()) ? '0 4px 14px rgba(17,24,39,0.2)' : 'none',
          }}
        >
          {loading ? 'Wird gespeichert…' : 'Loslegen →'}
        </button>
      </form>
    </div>
  )
}
