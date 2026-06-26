'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'

type Status = 'idle' | 'loading' | 'success' | 'error'

// finestsites.io leitet /api/* per 307 auf app.finestsites.io weiter.
// Cross-Origin POST mit Redirect blockiert Browser — direkte URL nutzen.
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '')
const WAITLIST_ENDPOINT = APP_URL ? `${APP_URL}/api/waitlist` : '/api/waitlist'

const INPUT_STYLE: React.CSSProperties = {
  width: '100%',
  background: 'rgba(255,255,255,0.07)',
  border: '1px solid rgba(255,255,255,0.14)',
  borderRadius: 12,
  padding: '13px 16px',
  fontSize: 14,
  color: '#fff',
  outline: 'none',
  fontFamily: 'inherit',
}

export default function WaitlistSection() {
  const searchParams = useSearchParams()
  const [firstName, setFirstName] = useState('')
  const [email, setEmail] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [status, setStatus] = useState<Status>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [banner, setBanner] = useState<'confirmed' | 'unsubscribed' | null>(null)

  useEffect(() => {
    const wl = searchParams.get('waitlist')
    if (wl === 'confirmed' || wl === 'unsubscribed') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setBanner(wl)
      const url = new URL(window.location.href)
      url.searchParams.delete('waitlist')
      window.history.replaceState({}, '', url.toString())
      const t = setTimeout(() => setBanner(null), 9000)
      return () => clearTimeout(t)
    }
  }, [searchParams])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || !agreed) return
    setStatus('loading')
    setErrorMsg('')
    try {
      const res = await fetch(WAITLIST_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          name: firstName.trim() || null,
          source: 'homepage-section',
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setStatus('error')
        setErrorMsg(data.error ?? 'Ein Fehler ist aufgetreten.')
      } else {
        setStatus('success')
      }
    } catch {
      setStatus('error')
      setErrorMsg('Bitte versuche es erneut.')
    }
  }

  return (
    <>
      {/* Autofill-Override für dunkle Inputs */}
      <style>{`
        .wl-input:-webkit-autofill,
        .wl-input:-webkit-autofill:hover,
        .wl-input:-webkit-autofill:focus {
          -webkit-box-shadow: 0 0 0 1000px #1c1c1c inset !important;
          -webkit-text-fill-color: #ffffff !important;
          transition: background-color 5000s ease-in-out 0s;
          caret-color: #ffffff;
        }
        .wl-input::placeholder { color: rgba(255,255,255,0.3); }
        .wl-input:focus { border-color: rgba(255,255,255,0.35) !important; }
        .wl-check:checked { accent-color: #8060b0; }
      `}</style>

      {/* ── Status Toast ── */}
      {banner && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          zIndex: 9999, minWidth: 300, maxWidth: 460,
          background: banner === 'confirmed' ? '#D1FAE5' : '#F3F4F6',
          color: banner === 'confirmed' ? '#065F46' : '#374151',
          borderRadius: 16, padding: '14px 18px',
          boxShadow: '0 8px 40px rgba(0,0,0,0.14)',
          display: 'flex', alignItems: 'center', gap: 10,
          fontSize: 14, fontWeight: 500,
        }}>
          {banner === 'confirmed'
            ? 'E-Mail bestaetigt! Du bist auf der Warteliste.'
            : 'Erfolgreich abgemeldet. Du bekommst keine weiteren Mails.'}
          <button onClick={() => setBanner(null)} style={{
            marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer',
            color: 'inherit', opacity: 0.5, fontSize: 16, padding: '0 4px', flexShrink: 0,
          }}>✕</button>
        </div>
      )}

      {/* ── Wartelisten-Sektion ── */}
      <section id="warteliste" style={{
        background: 'linear-gradient(160deg, #0d0d0d 0%, #181020 100%)',
        padding: '88px 7vw',
      }}>
        <div style={{ maxWidth: 480, margin: '0 auto' }}>

          {/* Badge */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
              textTransform: 'uppercase', color: '#c4a8f0',
              background: 'rgba(128,96,176,0.15)',
              border: '1px solid rgba(128,96,176,0.3)',
              borderRadius: 100, padding: '5px 14px',
            }}>
              <span style={{ fontSize: 9 }}>●</span> Fruehzugang sichern
            </span>
          </div>

          {/* Headline */}
          <h2 style={{
            fontFamily: '"Plein", sans-serif',
            fontSize: 'clamp(24px, 2.6vw, 36px)',
            fontWeight: 400,
            color: '#fff',
            letterSpacing: '-0.02em',
            lineHeight: 1.15,
            textAlign: 'center',
            marginBottom: 12,
          }}>
            Sei dabei, wenn wir starten.
          </h2>

          <p style={{
            fontSize: 14, color: 'rgba(255,255,255,0.45)',
            lineHeight: 1.7, textAlign: 'center', marginBottom: 32,
          }}>
            Trag dich jetzt ein und erhalte als Erste/r Zugang zu FinestSites, inklusive einem exklusiven Angebot fuer Fruehzugaenger.
          </p>

          {/* Formular oder Erfolg */}
          {status === 'success' ? (
            <div style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 20, padding: '32px 28px',
              textAlign: 'center',
            }}>
              <div style={{
                width: 48, height: 48, borderRadius: '50%',
                background: 'rgba(128,96,176,0.2)',
                border: '1px solid rgba(128,96,176,0.4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 16px', fontSize: 20, color: '#c4a8f0',
              }}>✓</div>
              <p style={{ color: '#fff', fontWeight: 600, fontSize: 16, marginBottom: 10 }}>
                Fast geschafft!
              </p>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, lineHeight: 1.7 }}>
                Wir haben dir eine Bestaetigungs-Mail geschickt. Bitte klick auf den Link darin, um deinen Platz zu sichern.
              </p>
              <p style={{
                color: 'rgba(255,255,255,0.3)', fontSize: 12, lineHeight: 1.6,
                marginTop: 14,
                background: 'rgba(255,255,255,0.04)',
                borderRadius: 10, padding: '10px 14px',
              }}>
                Die Mail kann ein paar Minuten brauchen. Schau auch kurz im Spam-Ordner nach, falls sie nicht direkt ankommt.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Vorname */}
              <input
                className="wl-input"
                type="text"
                placeholder="Vorname"
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                disabled={status === 'loading'}
                autoComplete="given-name"
                style={INPUT_STYLE}
              />
              {/* E-Mail */}
              <input
                className="wl-input"
                type="email"
                required
                placeholder="E-Mail-Adresse"
                value={email}
                onChange={e => setEmail(e.target.value)}
                disabled={status === 'loading'}
                autoComplete="email"
                style={INPUT_STYLE}
              />

              {/* DSGVO-Checkbox */}
              <label style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                cursor: 'pointer', marginTop: 4,
              }}>
                <input
                  className="wl-check"
                  type="checkbox"
                  required
                  checked={agreed}
                  onChange={e => setAgreed(e.target.checked)}
                  style={{ marginTop: 3, flexShrink: 0, width: 16, height: 16 }}
                />
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', lineHeight: 1.6 }}>
                  Ich bin damit einverstanden, per E-Mail ueber den Launch von FinestSites informiert zu werden, und habe die{' '}
                  <a href="/datenschutz" target="_blank" rel="noopener noreferrer"
                    style={{ color: 'rgba(196,168,240,0.8)', textDecoration: 'underline' }}>
                    Datenschutzerklaerung
                  </a>{' '}
                  gelesen.
                </span>
              </label>

              {status === 'error' && (
                <p style={{ color: '#FCA5A5', fontSize: 13, margin: 0 }}>{errorMsg}</p>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={status === 'loading' || !email.trim() || !agreed}
                style={{
                  marginTop: 4,
                  width: '100%',
                  background: agreed && email.trim() ? '#8060b0' : 'rgba(128,96,176,0.3)',
                  color: agreed && email.trim() ? '#fff' : 'rgba(255,255,255,0.4)',
                  border: 'none',
                  borderRadius: 12,
                  padding: '14px 24px',
                  fontSize: 14, fontWeight: 700,
                  cursor: (status === 'loading' || !email.trim() || !agreed) ? 'default' : 'pointer',
                  transition: 'background 0.2s, color 0.2s',
                  fontFamily: 'inherit',
                }}
              >
                {status === 'loading' ? 'Einen Moment...' : 'Jetzt auf die Warteliste'}
              </button>

              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', textAlign: 'center', marginTop: 4 }}>
                Kein Spam. Abmeldung jederzeit per Klick moeglich.
              </p>
            </form>
          )}
        </div>
      </section>
    </>
  )
}
