'use client'

import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'

type Status = 'idle' | 'loading' | 'success' | 'error'

// finestsites.io redirects /api/* to app.finestsites.io — use absolute URL to avoid
// the cross-origin POST redirect that browsers block (CORS preflight on 307).
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '')
const WAITLIST_ENDPOINT = APP_URL ? `${APP_URL}/api/waitlist` : '/api/waitlist'

export default function WaitlistSection() {
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [banner, setBanner] = useState<'confirmed' | 'unsubscribed' | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Show status banner from ?waitlist= query param (set after confirm/unsubscribe redirect)
  useEffect(() => {
    const wl = searchParams.get('waitlist')
    if (wl === 'confirmed' || wl === 'unsubscribed') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setBanner(wl)
      const url = new URL(window.location.href)
      url.searchParams.delete('waitlist')
      window.history.replaceState({}, '', url.toString())
      const t = setTimeout(() => setBanner(null), 8000)
      return () => clearTimeout(t)
    }
  }, [searchParams])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setStatus('loading')
    setErrorMsg('')
    try {
      const res = await fetch(WAITLIST_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setStatus('error')
        setErrorMsg(data.error ?? 'Ein Fehler ist aufgetreten.')
      } else {
        setStatus('success')
        setEmail('')
      }
    } catch {
      setStatus('error')
      setErrorMsg('Bitte versuche es erneut.')
    }
  }

  return (
    <>
      {/* Autofill override — prevents browsers from applying white/blue autofill bg on dark input */}
      <style>{`
        #waitlist-email:-webkit-autofill,
        #waitlist-email:-webkit-autofill:hover,
        #waitlist-email:-webkit-autofill:focus {
          -webkit-box-shadow: 0 0 0 1000px #1a1a1a inset !important;
          -webkit-text-fill-color: #ffffff !important;
          transition: background-color 5000s ease-in-out 0s;
          caret-color: #ffffff;
        }
        #waitlist-email::placeholder { color: rgba(255,255,255,0.35); }
      `}</style>

      {/* ── Status banners ── */}
      {banner && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          zIndex: 9999, minWidth: 320, maxWidth: 480,
          background: banner === 'confirmed' ? '#D1FAE5' : '#F3F4F6',
          color: banner === 'confirmed' ? '#065F46' : '#374151',
          borderRadius: 16, padding: '14px 20px',
          boxShadow: '0 8px 40px rgba(0,0,0,0.13)',
          display: 'flex', alignItems: 'center', gap: 12,
          fontSize: 14, fontWeight: 500,
        }}>
          {banner === 'confirmed'
            ? 'E-Mail-Adresse bestätigt! Du bist auf der Warteliste.'
            : 'Erfolgreich abgemeldet. Du erhältst keine weiteren E-Mails.'}
          <button onClick={() => setBanner(null)} style={{
            marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer',
            color: 'inherit', opacity: 0.6, fontSize: 16, padding: '0 4px',
          }}>✕</button>
        </div>
      )}

      {/* ── Waitlist section ── */}
      <section id="warteliste" style={{ background: '#111', padding: '96px 7vw' }}>
        <div style={{ maxWidth: 600, margin: '0 auto', textAlign: 'center' }}>

          <p style={{
            fontSize: 11, fontWeight: 600, letterSpacing: '0.12em',
            textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)',
            marginBottom: 16,
          }}>
            Bald verfügbar
          </p>

          <h2 style={{
            fontFamily: '"Plein", sans-serif',
            fontSize: 'clamp(26px, 2.8vw, 40px)',
            fontWeight: 400,
            color: '#fff',
            letterSpacing: '-0.022em',
            lineHeight: 1.12,
            marginBottom: 16,
          }}>
            Sei einer der Ersten.
          </h2>

          <p style={{
            fontSize: 15, color: 'rgba(255,255,255,0.5)',
            lineHeight: 1.7, maxWidth: 400, margin: '0 auto 36px',
          }}>
            Trag dich ein und erhalte als Erstes Zugang — noch vor dem offiziellen Launch.
          </p>

          {status === 'success' ? (
            <div style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 20, padding: '28px 32px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: '50%',
                background: 'rgba(255,255,255,0.08)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: 20,
              }}>✓</div>
              <p style={{ color: '#fff', fontWeight: 600, fontSize: 15 }}>Fast geschafft!</p>
              <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14, lineHeight: 1.65 }}>
                Wir haben dir eine Bestätigungs-E-Mail geschickt.<br />
                Klick auf den Link, um deinen Platz zu sichern.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
              {/* Pill input row */}
              <div style={{
                display: 'flex', alignItems: 'center',
                width: '100%', maxWidth: 440,
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 100,
                padding: '5px 5px 5px 20px',
              }}>
                <input
                  id="waitlist-email"
                  ref={inputRef}
                  type="email"
                  required
                  placeholder="deine@email.de"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  disabled={status === 'loading'}
                  autoComplete="email"
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    color: '#fff',
                    fontSize: 14,
                    minWidth: 0,
                  }}
                />
                <button
                  type="submit"
                  disabled={status === 'loading' || !email.trim()}
                  style={{
                    flexShrink: 0,
                    background: '#fff',
                    color: '#111',
                    border: 'none',
                    borderRadius: 100,
                    padding: '11px 22px',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: (status === 'loading' || !email.trim()) ? 'default' : 'pointer',
                    opacity: (status === 'loading' || !email.trim()) ? 0.45 : 1,
                    transition: 'opacity 0.15s',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {status === 'loading' ? '…' : 'Eintragen'}
                </button>
              </div>

              {status === 'error' && (
                <p style={{ color: '#FCA5A5', fontSize: 13, margin: 0 }}>{errorMsg}</p>
              )}

              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)', marginTop: 2 }}>
                Kein Spam. Jederzeit abmeldbar.
              </p>
            </form>
          )}
        </div>
      </section>
    </>
  )
}
