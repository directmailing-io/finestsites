'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    setSent(true)
    setLoading(false)
  }

  if (sent) {
    return (
      <div className="text-center py-2">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-5"
          style={{ background: '#F0FDF4' }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="4" width="20" height="16" rx="2"/>
            <polyline points="2,4 12,13 22,4"/>
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">E-Mail gesendet</h2>
        <p className="text-sm mb-6 leading-relaxed" style={{ color: '#6B7280' }}>
          Falls ein Account mit dieser E-Mail existiert,<br />
          hast du einen Reset-Link erhalten.
        </p>
        <Link href="/login" className="text-sm font-medium text-gray-900 underline underline-offset-4">
          Zurück zum Login
        </Link>
      </div>
    )
  }

  return (
    <>
      <div className="mb-7">
        <h1 className="text-xl font-semibold text-gray-900 mb-1">Passwort vergessen</h1>
        <p className="text-sm" style={{ color: '#6B7280' }}>
          Wir schicken dir einen Reset-Link per E-Mail.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium" style={{ color: '#374151' }}>E-Mail</label>
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
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 text-sm font-semibold rounded-2xl transition-all"
          style={{
            background: loading ? '#E5E7EB' : '#111827',
            color: loading ? '#9CA3AF' : '#fff',
            cursor: loading ? 'not-allowed' : 'pointer',
            boxShadow: loading ? 'none' : '0 4px 14px rgba(17,24,39,0.2)',
          }}
        >
          {loading ? 'Wird gesendet…' : 'Reset-Link senden'}
        </button>

        <Link
          href="/login"
          className="text-sm text-center underline underline-offset-4"
          style={{ color: '#6B7280' }}
        >
          Zurück zum Login
        </Link>
      </form>
    </>
  )
}

const fieldStyle = {
  background: '#fff',
  border: '1.5px solid #E5E7EB',
  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
}
