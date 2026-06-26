'use client'

import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'

type Status = 'idle' | 'loading' | 'success' | 'error'

export default function WaitlistSection() {
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [banner, setBanner] = useState<'confirmed' | 'unsubscribed' | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Show status banner from ?waitlist= query param
  useEffect(() => {
    const wl = searchParams.get('waitlist')
    if (wl === 'confirmed' || wl === 'unsubscribed') {
      setBanner(wl)
      // Remove query param from URL without reload
      const url = new URL(window.location.href)
      url.searchParams.delete('waitlist')
      window.history.replaceState({}, '', url.toString())
      // Auto-dismiss after 8s
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
      const res = await fetch('/api/waitlist', {
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
      setErrorMsg('Netzwerkfehler. Bitte versuche es erneut.')
    }
  }

  return (
    <>
      {/* ── Status banners (confirmed / unsubscribed) ── */}
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
          <span style={{ fontSize: 20 }}>{banner === 'confirmed' ? '✓' : '✓'}</span>
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
        <div style={{ maxWidth: 640, margin: '0 auto', textAlign: 'center' }}>

          {/* Eyebrow */}
          <p style={{
            fontSize: 11, fontWeight: 600, letterSpacing: '0.12em',
            textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)',
            marginBottom: 20,
          }}>
            Bald verfügbar
          </p>

          {/* Heading */}
          <h2 style={{
            fontFamily: '"Plein", sans-serif',
            fontSize: 'clamp(28px, 3.6vw, 46px)',
            fontWeight: 400,
            color: '#fff',
            letterSpacing: '-0.025em',
            lineHeight: 1.1,
            marginBottom: 20,
          }}>
            Sei einer der Ersten.
          </h2>

          {/* Subtext */}
          <p style={{
            fontSize: 15, color: 'rgba(255,255,255,0.55)',
            lineHeight: 1.7, marginBottom: 40, maxWidth: 420, margin: '0 auto 40px',
          }}>
            Trag dich in die Warteliste ein und erhalte als Erstes Zugang — noch vor dem offiziellen Launch.
          </p>

          {/* Form */}
          {status === 'success' ? (
            <div style={{
              background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 16, padding: '28px 32px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
            }}>
              <div style={{
                width: 48, height: 48, borderRadius: '50%',
                background: 'rgba(255,255,255,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 22,
              }}>✓</div>
              <p style={{ color: '#fff', fontWeight: 600, fontSize: 16 }}>
                Fast geschafft!
              </p>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, lineHeight: 1.6 }}>
                Wir haben dir eine Bestätigungs-E-Mail geschickt.<br />
                Bitte klick auf den Link, um deinen Platz zu sichern.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
              <div style={{
                display: 'flex', gap: 8, width: '100%', maxWidth: 460,
                background: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,255,255,0.14)',
                borderRadius: 100, padding: '6px 6px 6px 22px',
              }}>
                <input
                  ref={inputRef}
                  type="email"
                  required
                  placeholder="deine@email.de"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  disabled={status === 'loading'}
                  style={{
                    flex: 1, background: 'none', border: 'none', outline: 'none',
                    color: '#fff', fontSize: 15,
                    '::placeholder': { color: 'rgba(255,255,255,0.3)' },
                  } as React.CSSProperties}
                />
                <button
                  type="submit"
                  disabled={status === 'loading' || !email.trim()}
                  style={{
                    background: '#fff', color: '#111',
                    border: 'none', borderRadius: 100,
                    padding: '12px 24px', fontSize: 14, fontWeight: 600,
                    cursor: status === 'loading' ? 'wait' : 'pointer',
                    opacity: (!email.trim() || status === 'loading') ? 0.5 : 1,
                    transition: 'opacity 0.15s',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  {status === 'loading' ? '...' : 'Eintragen'}
                </button>
              </div>

              {status === 'error' && (
                <p style={{ color: '#FCA5A5', fontSize: 13 }}>{errorMsg}</p>
              )}

              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>
                Kein Spam. Jederzeit abmeldbar.
              </p>
            </form>
          )}
        </div>
      </section>
    </>
  )
}
