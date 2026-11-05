'use client'

import { useState } from 'react'
import { sanitizeUsername } from '@/lib/username'

/**
 * Zugangsdaten auf der Danke-Seite: Vorname, Nachname, Benutzername, Passwort (Schlüssel = Stripe-Session-ID).
 * Danach normale Anmeldung über /api/auth/sign-in/email (wie die Login-Seite: roher fetch, zuverlässig auf
 * iOS Safari) und weiter in die App. Benutzername wird hier gesetzt, das Onboarding fragt ihn nicht mehr.
 */
export default function EventPasswordForm({ sessionId, email, firstName: initialFirstName }: { sessionId: string; email: string; firstName?: string }) {
  const [firstName, setFirstName] = useState(initialFirstName ?? '')
  const [lastName, setLastName] = useState('')
  const [username, setUsername] = useState(sanitizeUsername(initialFirstName ?? ''))
  const [usernameTouched, setUsernameTouched] = useState(false)
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  // Vorschlag: vorname-nachname, solange die Person den Benutzernamen nicht selbst angefasst hat
  function suggest(fn: string, ln: string) {
    if (usernameTouched) return
    setUsername(sanitizeUsername([fn, ln].filter(Boolean).join('-')))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!firstName.trim()) { setError('Bitte gib deinen Vornamen ein.'); return }
    if (sanitizeUsername(username).length < 3) { setError('Bitte wähle einen Benutzernamen mit mindestens 3 Buchstaben.'); return }
    if (password.length < 8) { setError('Bitte wähle ein Passwort mit mindestens 8 Zeichen.'); return }
    if (password !== repeat) { setError('Die beiden Passwörter sind nicht gleich. Bitte prüfe die Eingabe.'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/event/set-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, password, username: sanitizeUsername(username), first_name: firstName.trim(), last_name: lastName.trim() }),
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

  if (done) return <span className="ev-ok" style={{ display: 'block', marginTop: 8 }}>Gespeichert. Du wirst jetzt angemeldet …</span>

  const cleanUsername = sanitizeUsername(username)

  return (
    <form onSubmit={submit} style={{ marginTop: 8 }}>
      <div className="ev-row">
        <label className="ev-field"><span>Vorname</span>
          <input type="text" autoComplete="given-name" value={firstName} onChange={e => { setFirstName(e.target.value); suggest(e.target.value, lastName) }} required maxLength={60} />
        </label>
        <label className="ev-field"><span>Nachname</span>
          <input type="text" autoComplete="family-name" value={lastName} onChange={e => { setLastName(e.target.value); suggest(firstName, e.target.value) }} maxLength={60} />
        </label>
      </div>
      <label className="ev-field"><span>Benutzername</span>
        <input type="text" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} value={username}
          onChange={e => { setUsernameTouched(true); setUsername(e.target.value) }}
          onBlur={() => setUsername(cleanUsername)} required maxLength={30} />
        <small className="ev-hint">Nur Kleinbuchstaben und Bindestrich. Daraus wird deine Webadresse, zum Beispiel <b>{cleanUsername || 'sabine-mueller'}</b>.dailyoptimal.de</small>
      </label>
      <label className="ev-field"><span>Passwort (mindestens 8 Zeichen)</span>
        <span className="ev-pw" style={{ display: 'block', fontWeight: 400 }}>
          <input type={show ? 'text' : 'password'} autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} maxLength={128} />
          <button type="button" onClick={() => setShow(s => !s)} aria-label={show ? 'Passwort verbergen' : 'Passwort anzeigen'}>{show ? 'Verbergen' : 'Anzeigen'}</button>
        </span>
      </label>
      <label className="ev-field"><span>Passwort noch einmal</span>
        <input type={show ? 'text' : 'password'} autoComplete="new-password" value={repeat} onChange={e => setRepeat(e.target.value)} required minLength={8} maxLength={128} />
      </label>
      {error && <div className="ev-err" role="alert">{error}</div>}
      <button type="submit" className="ev-btn" disabled={loading}>{loading ? 'Einen Moment …' : 'Speichern und anmelden'}</button>
      <p className="ev-fine">Merke dir Benutzername und Passwort gut oder schreib sie dir auf.</p>
    </form>
  )
}
