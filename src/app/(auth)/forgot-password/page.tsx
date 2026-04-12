'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/update-password`,
    })
    setSent(true)
    setLoading(false)
  }

  if (sent) {
    return (
      <div className="text-center">
        <div className="w-14 h-14 rounded-[20px] flex items-center justify-center mx-auto mb-6"
          style={{ background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="1.5">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.41 2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.6a16 16 0 0 0 6 6l.94-.94a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
          </svg>
        </div>
        <h1 className="text-xl font-semibold text-gray-900 mb-2">E-Mail gesendet</h1>
        <p className="text-sm mb-6" style={{ color: 'var(--muted-foreground)' }}>
          Falls ein Account mit dieser E-Mail existiert, hast du eine E-Mail mit dem Reset-Link erhalten.
        </p>
        <Link href="/login" className="text-sm font-medium underline underline-offset-4 text-gray-900">
          Zurück zum Login
        </Link>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900 mb-1">Passwort zurücksetzen</h1>
      <p className="text-sm mb-8" style={{ color: 'var(--muted-foreground)' }}>
        Wir schicken dir einen Link per E-Mail.{' '}
        <Link href="/login" className="font-medium text-gray-900 underline underline-offset-4">
          Zurück zum Login
        </Link>
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700">E-Mail</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)}
            required placeholder="deine@email.de"
            className="w-full px-4 py-3 text-sm outline-none"
            style={{
              background: '#FFFFFF', border: '1.5px solid var(--border)',
              borderRadius: '16px', boxShadow: 'var(--shadow-soft)',
            }}
            onFocus={e => (e.target.style.borderColor = '#1a1a1a')}
            onBlur={e => (e.target.style.borderColor = 'var(--border)')} />
        </div>
        <button type="submit" disabled={loading}
          className="w-full py-3 text-sm font-medium text-white transition-all"
          style={{
            background: loading ? '#6B7280' : '#1a1a1a', borderRadius: '16px',
            boxShadow: loading ? 'none' : '0 4px 14px rgba(26,26,26,0.25)',
          }}>
          {loading ? 'Wird gesendet...' : 'Reset-Link senden'}
        </button>
      </form>
    </div>
  )
}
