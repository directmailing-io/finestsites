'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'

type Status = 'idle' | 'loading' | 'success' | 'error'

// finestsites.io leitet /api/* per 307 auf app.finestsites.io weiter —
// Cross-Origin-POST-Redirect blockiert der Browser. Daher absolute URL nutzen.
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '')
const WAITLIST_ENDPOINT = APP_URL ? `${APP_URL}/api/waitlist` : '/api/waitlist'

const BENEFITS = [
  'Du erfährst als Erste/r, wann FinestSites startet',
  'Exklusive Angebote und Aktionen nur für Wartelisten-Mitglieder',
  'Bevorzugte Informationen und ein besonderer Willkommensbonus',
]

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
      <style>{`
        .wl-input:-webkit-autofill,
        .wl-input:-webkit-autofill:focus {
          -webkit-box-shadow: 0 0 0 1000px #fff inset !important;
          -webkit-text-fill-color: #111 !important;
          transition: background-color 5000s ease-in-out 0s;
        }
        .wl-input::placeholder { color: #bbb; }
        .wl-input:focus { border-color: #8060b0 !important; box-shadow: 0 0 0 3px rgba(128,96,176,0.1); }
        .wl-submit:not(:disabled):hover { background: #6a4fa0 !important; }
      `}</style>

      {/* ── Status Toast ── */}
      {banner && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          zIndex: 9999, minWidth: 300, maxWidth: 460,
          background: banner === 'confirmed' ? '#D1FAE5' : '#F3F4F6',
          color: banner === 'confirmed' ? '#065F46' : '#374151',
          borderRadius: 16, padding: '14px 18px',
          boxShadow: '0 8px 40px rgba(0,0,0,0.12)',
          display: 'flex', alignItems: 'center', gap: 10,
          fontSize: 14, fontWeight: 500,
        }}>
          {banner === 'confirmed'
            ? 'E-Mail bestätigt! Du bist auf der Warteliste.'
            : 'Erfolgreich abgemeldet.'}
          <button onClick={() => setBanner(null)} style={{
            marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer',
            color: 'inherit', opacity: 0.5, fontSize: 16, padding: '0 4px', flexShrink: 0,
          }}>✕</button>
        </div>
      )}

      {/* ── Wartelisten-Sektion ── */}
      <section id="warteliste" style={{ background: '#F9F7FF', padding: '88px 7vw' }}>
        <div style={{ maxWidth: 960, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80, alignItems: 'center' }}>

          {/* Linke Seite — Erklärung */}
          <div>
            <span style={{
              display: 'inline-block',
              fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
              textTransform: 'uppercase', color: '#8060b0',
              marginBottom: 20,
            }}>
              Warteliste
            </span>

            <h2 style={{
              fontFamily: '"Plein", sans-serif',
              fontSize: 'clamp(26px, 2.8vw, 38px)',
              fontWeight: 400,
              color: '#111',
              letterSpacing: '-0.022em',
              lineHeight: 1.15,
              marginBottom: 20,
            }}>
              Trag dich ein und sei<br />als Erste/r dabei.
            </h2>

            <p style={{ fontSize: 15, color: '#666', lineHeight: 1.75, marginBottom: 28 }}>
              Noch sind wir nicht live. Auf der Warteliste bleibst du auf dem Laufenden und profitierst als Erstes von unseren Aktionen.
            </p>

            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {BENEFITS.map(b => (
                <li key={b} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <span style={{
                    flexShrink: 0,
                    width: 20, height: 20, borderRadius: '50%',
                    background: 'rgba(128,96,176,0.12)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, color: '#8060b0', fontWeight: 700,
                    marginTop: 2,
                  }}>✓</span>
                  <span style={{ fontSize: 14, color: '#444', lineHeight: 1.6 }}>{b}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Rechte Seite — Formular */}
          <div style={{
            background: '#fff',
            borderRadius: 24,
            border: '1px solid #ede9f8',
            padding: '36px 32px',
            boxShadow: '0 4px 32px rgba(128,96,176,0.08)',
          }}>
            {status === 'success' ? (
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <div style={{
                  width: 52, height: 52, borderRadius: '50%',
                  background: 'rgba(128,96,176,0.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 16px', fontSize: 22, color: '#8060b0',
                }}>✓</div>
                <p style={{ color: '#111', fontWeight: 700, fontSize: 17, marginBottom: 10 }}>
                  Fast geschafft!
                </p>
                <p style={{ color: '#555', fontSize: 14, lineHeight: 1.7, marginBottom: 14 }}>
                  Wir haben dir eine Bestätigungs-Mail geschickt. Klick auf den Link darin, um deinen Platz zu sichern.
                </p>
                <div style={{
                  background: '#F9F7FF', borderRadius: 12,
                  padding: '12px 16px',
                  fontSize: 13, color: '#888', lineHeight: 1.6,
                }}>
                  Kein Mail? Schau kurz im Spam-Ordner nach. Die Mail kann auch ein paar Minuten brauchen.
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <p style={{ fontSize: 15, fontWeight: 700, color: '#111', marginBottom: 4 }}>
                  Auf die Warteliste eintragen
                </p>

                <input
                  className="wl-input"
                  type="text"
                  placeholder="Dein Vorname"
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  disabled={status === 'loading'}
                  autoComplete="given-name"
                  style={{
                    width: '100%', background: '#fff',
                    border: '1.5px solid #E5E7EB', borderRadius: 10,
                    padding: '12px 14px', fontSize: 14, color: '#111',
                    outline: 'none', fontFamily: 'inherit',
                    transition: 'border-color 0.15s, box-shadow 0.15s',
                  }}
                />

                <input
                  className="wl-input"
                  type="email"
                  required
                  placeholder="Deine E-Mail-Adresse"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  disabled={status === 'loading'}
                  autoComplete="email"
                  style={{
                    width: '100%', background: '#fff',
                    border: '1.5px solid #E5E7EB', borderRadius: 10,
                    padding: '12px 14px', fontSize: 14, color: '#111',
                    outline: 'none', fontFamily: 'inherit',
                    transition: 'border-color 0.15s, box-shadow 0.15s',
                  }}
                />

                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 9, cursor: 'pointer', marginTop: 2 }}>
                  <input
                    type="checkbox"
                    required
                    checked={agreed}
                    onChange={e => setAgreed(e.target.checked)}
                    style={{ marginTop: 3, flexShrink: 0, accentColor: '#8060b0' }}
                  />
                  <span style={{ fontSize: 12, color: '#888', lineHeight: 1.6 }}>
                    Ich bin damit einverstanden, per E-Mail über FinestSites informiert zu werden, und habe die{' '}
                    <a href="/datenschutz" target="_blank" rel="noopener noreferrer"
                      style={{ color: '#8060b0', textDecoration: 'underline' }}>
                      Datenschutzerklärung
                    </a>{' '}
                    gelesen.
                  </span>
                </label>

                {status === 'error' && (
                  <p style={{ color: '#DC2626', fontSize: 13, margin: 0 }}>{errorMsg}</p>
                )}

                <button
                  className="wl-submit"
                  type="submit"
                  disabled={status === 'loading' || !email.trim() || !agreed}
                  style={{
                    width: '100%',
                    background: (agreed && email.trim()) ? '#8060b0' : '#E5E7EB',
                    color: (agreed && email.trim()) ? '#fff' : '#aaa',
                    border: 'none', borderRadius: 10,
                    padding: '13px 24px',
                    fontSize: 14, fontWeight: 700,
                    cursor: (status === 'loading' || !email.trim() || !agreed) ? 'default' : 'pointer',
                    transition: 'background 0.2s, color 0.2s',
                    fontFamily: 'inherit',
                    marginTop: 2,
                  }}
                >
                  {status === 'loading' ? 'Einen Moment...' : 'Jetzt auf die Warteliste'}
                </button>

                <p style={{ fontSize: 11, color: '#bbb', textAlign: 'center', marginTop: 2 }}>
                  Kein Spam. Abmeldung jederzeit per Link möglich.
                </p>
              </form>
            )}
          </div>
        </div>

        {/* Mobile: stack vertically */}
        <style>{`
          @media (max-width: 767px) {
            #warteliste > div {
              grid-template-columns: 1fr !important;
              gap: 36px !important;
            }
          }
        `}</style>
      </section>
    </>
  )
}
