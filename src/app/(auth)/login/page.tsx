'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('E-Mail oder Passwort falsch.')
      setLoading(false)
    } else {
      router.push('/dashboard')
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900 mb-1">Willkommen zurück</h1>
      <p className="text-sm mb-8" style={{ color: 'var(--muted-foreground)' }}>
        Noch kein Account?{' '}
        <Link href="/register" className="font-medium text-gray-900 underline underline-offset-4">
          Kostenlos registrieren
        </Link>
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {error && (
          <div className="px-4 py-3 text-sm text-red-600 rounded-[16px]"
            style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}>
            {error}
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700">E-Mail</label>
          <input
            type="email" value={email} onChange={e => setEmail(e.target.value)}
            required placeholder="deine@email.de"
            className="w-full px-4 py-3 text-sm outline-none transition-all"
            style={{
              background: '#FFFFFF',
              border: '1.5px solid var(--border)',
              borderRadius: '16px',
              boxShadow: 'var(--shadow-soft)',
            }}
            onFocus={e => (e.target.style.borderColor = '#1a1a1a')}
            onBlur={e => (e.target.style.borderColor = 'var(--border)')}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700">Passwort</label>
            <Link href="/forgot-password" className="text-xs underline underline-offset-4"
              style={{ color: 'var(--muted-foreground)' }}>
              Vergessen?
            </Link>
          </div>
          <input
            type="password" value={password} onChange={e => setPassword(e.target.value)}
            required placeholder="••••••••"
            className="w-full px-4 py-3 text-sm outline-none transition-all"
            style={{
              background: '#FFFFFF',
              border: '1.5px solid var(--border)',
              borderRadius: '16px',
              boxShadow: 'var(--shadow-soft)',
            }}
            onFocus={e => (e.target.style.borderColor = '#1a1a1a')}
            onBlur={e => (e.target.style.borderColor = 'var(--border)')}
          />
        </div>

        <button
          type="submit" disabled={loading}
          className="w-full py-3 text-sm font-medium text-white transition-all mt-2"
          style={{
            background: loading ? '#6B7280' : '#1a1a1a',
            borderRadius: '16px',
            boxShadow: loading ? 'none' : '0 4px 14px rgba(26,26,26,0.25)',
          }}>
          {loading ? 'Anmelden...' : 'Anmelden'}
        </button>
      </form>
    </div>
  )
}
