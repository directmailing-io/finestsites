'use client'

import { useState } from 'react'

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '')
const WAITLIST_ENDPOINT = APP_URL ? `${APP_URL}/api/waitlist` : '/api/waitlist'

export default function FooterWaitlistMini() {
  const [firstName, setFirstName] = useState('')
  const [email, setEmail] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || !agreed || loading) return
    setLoading(true)
    try {
      await fetch(WAITLIST_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), name: firstName.trim() || null, source: 'footer' }),
      })
    } catch { /* ignore */ }
    setLoading(false)
    setDone(true)
  }

  if (done) {
    return (
      <div style={{
        padding: '14px 18px',
        background: 'rgba(128,96,176,0.15)',
        border: '1px solid rgba(128,96,176,0.25)',
        borderRadius: 12,
        color: '#c4a8f0',
        fontSize: 13,
        lineHeight: 1.6,
      }}>
        Fast geschafft! Schau kurz in deine Mails und bestätige den Link.
      </div>
    )
  }

  return (
    <>
      <style>{`
        .fwl:-webkit-autofill,
        .fwl:-webkit-autofill:focus {
          -webkit-box-shadow: 0 0 0 1000px #221a35 inset !important;
          -webkit-text-fill-color: rgba(255,255,255,0.8) !important;
          transition: background-color 5000s ease-in-out 0s;
        }
        .fwl::placeholder { color: rgba(255,255,255,0.22); }
      `}</style>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            className="fwl"
            type="text"
            placeholder="Vorname"
            value={firstName}
            onChange={e => setFirstName(e.target.value)}
            style={{
              flex: 1, minWidth: 0,
              background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8, padding: '9px 12px',
              fontSize: 13, color: 'rgba(255,255,255,0.8)',
              outline: 'none', fontFamily: 'inherit',
            }}
          />
          <input
            className="fwl"
            type="email"
            required
            placeholder="E-Mail"
            value={email}
            onChange={e => setEmail(e.target.value)}
            style={{
              flex: 1.5, minWidth: 0,
              background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8, padding: '9px 12px',
              fontSize: 13, color: 'rgba(255,255,255,0.8)',
              outline: 'none', fontFamily: 'inherit',
            }}
          />
        </div>

        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer' }}>
          <input
            type="checkbox"
            required
            checked={agreed}
            onChange={e => setAgreed(e.target.checked)}
            style={{ marginTop: 2, flexShrink: 0, accentColor: '#8060b0' }}
          />
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', lineHeight: 1.5 }}>
            Ich stimme zu, per E-Mail informiert zu werden.{' '}
            <a href="/datenschutz" target="_blank" rel="noopener noreferrer"
              style={{ color: 'rgba(196,168,240,0.6)', textDecoration: 'underline' }}>
              Datenschutz
            </a>
          </span>
        </label>

        <button
          type="submit"
          disabled={loading || !email.trim() || !agreed}
          style={{
            background: (agreed && email.trim()) ? '#8060b0' : 'rgba(128,96,176,0.2)',
            color: (agreed && email.trim()) ? '#fff' : 'rgba(255,255,255,0.25)',
            border: 'none', borderRadius: 8,
            padding: '9px 18px', fontSize: 13, fontWeight: 600,
            cursor: (loading || !email.trim() || !agreed) ? 'default' : 'pointer',
            transition: 'background 0.2s, color 0.2s',
            fontFamily: 'inherit',
          }}
        >
          {loading ? '...' : 'Auf die Warteliste'}
        </button>
      </form>
    </>
  )
}
