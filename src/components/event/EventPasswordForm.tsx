'use client'

import { useState } from 'react'

/**
 * Passwort festlegen auf der Danke-Seite (Schlüssel = Stripe-Session-ID), danach normale Anmeldung
 * über /api/auth/sign-in/email (wie die Login-Seite: roher fetch, zuverlässig auf iOS Safari) und
 * weiter in die App. Die Weiterleitung landet beim Onboarding (Benutzername), das die Middleware erzwingt.
 */
export default function EventPasswordForm({ sessionId, email }: { sessionId: string; email: string }) {
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password.length < 8) { setError('Bitte wähle ein Passwort mit mindestens 8 Zeichen.'); return }
    if (password !== repeat) { setError('Die beiden Passwörter sind nicht gleich. Bitte prüfe die Eingabe.'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/event/set-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, password }),
      })
      const data = await res.json().catch(() => ({})) as { ok?: boolean; error?: string; already?: boolean }
      if (!res.ok || !data.ok) {
        setError(data.error ?? 'Das hat nicht geklappt. Bitte versuche es noch einmal.')
        setLoading(false)
        return
      }
      setDone(true)
      // Anmelden und weiter in die App
      const login = await fetch('/api/auth/sign-in/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, rememberMe: true }),
        credentials: 'include',
      })
      if (login.ok) {
        window.location.href = '/sites'
      } else {
        window.location.href = `/login?callbackUrl=${encodeURIComponent('/sites')}`
      }
    } catch {
      setError('Keine Verbindung. Bitte prüfe dein Internet und versuche es noch einmal.')
      setLoading(false)
    }
  }

  if (done) return <span className="ev-ok" style={{ display: 'block', marginTop: 8 }}>Passwort gespeichert. Du wirst jetzt angemeldet …</span>

  return (
    <form onSubmit={submit} style={{ marginTop: 8 }}>
      <label className="ev-field"><span>Neues Passwort (mindestens 8 Zeichen)</span>
        <span className="ev-pw" style={{ display: 'block', fontWeight: 400 }}>
          <input type={show ? 'text' : 'password'} autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} maxLength={128} />
          <button type="button" onClick={() => setShow(s => !s)} aria-label={show ? 'Passwort verbergen' : 'Passwort anzeigen'}>{show ? 'Verbergen' : 'Anzeigen'}</button>
        </span>
      </label>
      <label className="ev-field"><span>Passwort noch einmal</span>
        <input type={show ? 'text' : 'password'} autoComplete="new-password" value={repeat} onChange={e => setRepeat(e.target.value)} required minLength={8} maxLength={128} />
      </label>
      {error && <div className="ev-err" role="alert">{error}</div>}
      <button type="submit" className="ev-btn" disabled={loading}>{loading ? 'Einen Moment …' : 'Passwort speichern und anmelden'}</button>
      <p className="ev-fine">Merke dir das Passwort gut oder schreib es dir auf.</p>
    </form>
  )
}
