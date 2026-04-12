'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Logo } from '@/components/shared/Logo'

export default function SetupUsernamePage() {
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  function isValidUsername(u: string) {
    return /^[a-z0-9-]{3,30}$/.test(u)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isValidUsername(username)) {
      setError('Nur Kleinbuchstaben, Zahlen und Bindestriche (3-30 Zeichen).')
      return
    }
    setLoading(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    // Check if username taken
    const { data: existing } = await supabase
      .from('users').select('id').eq('username', username).single()
    if (existing) { setError('Dieser Username ist bereits vergeben.'); setLoading(false); return }

    const { error: updateError } = await supabase
      .from('users')
      .update({ username, username_set_at: new Date().toISOString() })
      .eq('id', user.id)

    if (updateError) { setError('Fehler beim Speichern.'); setLoading(false); return }
    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'var(--background)' }}>
      <div className="w-full max-w-[420px]">
        <div className="flex justify-center mb-12">
          <Logo variant="black" height={28} />
        </div>

        <div className="p-8 rounded-[24px] bg-white" style={{ boxShadow: 'var(--shadow-card)', border: '1px solid var(--border)' }}>
          <div className="w-12 h-12 rounded-[16px] flex items-center justify-center mb-6"
            style={{ background: '#F5F3FF' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="1.5">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
          </div>

          <h1 className="text-xl font-semibold text-gray-900 mb-1">Wähle deinen Username</h1>
          <p className="text-sm mb-6" style={{ color: 'var(--muted-foreground)' }}>
            Dieser wird Teil deiner Website-Adresse und kann <strong>nicht</strong> geändert werden.
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {error && (
              <div className="px-4 py-3 text-sm text-red-600 rounded-[16px]"
                style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}>
                {error}
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700">Username</label>
              <div className="relative">
                <input
                  type="text" value={username}
                  onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  required maxLength={30} placeholder="dein-name"
                  className="w-full px-4 py-3 text-sm outline-none"
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
              {username && (
                <p className="text-xs px-1" style={{ color: 'var(--muted-foreground)' }}>
                  Deine Seite: <span className="font-medium text-gray-900">{username}.template-domain.de</span>
                </p>
              )}
            </div>

            <div className="px-4 py-3 rounded-[16px] text-xs" style={{ background: '#FEF9C3', border: '1px solid #FDE68A' }}>
              ⚠️ Der Username kann nach dem Speichern <strong>nicht mehr geändert</strong> werden.
            </div>

            <button type="submit" disabled={loading || !username}
              className="w-full py-3 text-sm font-medium text-white transition-all"
              style={{
                background: (!username || loading) ? '#9CA3AF' : '#1a1a1a',
                borderRadius: '16px',
                boxShadow: (!username || loading) ? 'none' : '0 4px 14px rgba(26,26,26,0.25)',
                cursor: (!username || loading) ? 'not-allowed' : 'pointer',
              }}>
              {loading ? 'Wird gespeichert...' : 'Username bestätigen'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
