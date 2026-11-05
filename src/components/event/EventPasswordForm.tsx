'use client'

import { useEffect, useRef, useState } from 'react'
import { sanitizeUsername, isValidUsername, USERNAME_RULE_TEXT } from '@/lib/username'

/** Beispiel-Domain für die Vorschau der Webadresse (der Benutzername gilt für alle Vorlagen gleich) */
const PREVIEW_DOMAIN = 'dailyoptimal.de'

type Check = { state: 'idle' } | { state: 'checking' } | { state: 'ok' } | { state: 'bad'; text: string }

/**
 * Zugangsdaten auf der Danke-Seite: Vorname, Nachname, Benutzername, Passwort (Schlüssel = Stripe-Session-ID).
 * Der Benutzername wird wie im Onboarding als Webadresse vorgeschaut, live auf Verfügbarkeit geprüft
 * (/api/event/username-check) und lässt sich danach nicht mehr ändern. Danach normale Anmeldung über
 * /api/auth/sign-in/email (wie die Login-Seite: roher fetch, zuverlässig auf iOS Safari) und weiter in die App.
 */
export default function EventPasswordForm({ sessionId, email, firstName: initialFirstName }: { sessionId: string; email: string; firstName?: string }) {
  const [firstName, setFirstName] = useState(initialFirstName ?? '')
  const [lastName, setLastName] = useState('')
  const [username, setUsername] = useState(sanitizeUsername(initialFirstName ?? ''))
  const [usernameTouched, setUsernameTouched] = useState(false)
  const [check, setCheck] = useState<Check>({ state: 'idle' })
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const checkSeq = useRef(0)

  const cleanUsername = sanitizeUsername(username)

  // Live-Prüfung mit kurzer Verzögerung nach der letzten Eingabe; späte Antworten älterer Eingaben werden verworfen
  useEffect(() => {
    const seq = ++checkSeq.current
    if (!cleanUsername) { setCheck({ state: 'idle' }); return }
    if (!isValidUsername(cleanUsername)) { setCheck({ state: 'bad', text: USERNAME_RULE_TEXT }); return }
    setCheck({ state: 'checking' })
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/event/username-check?u=${encodeURIComponent(cleanUsername)}`)
        const data = await res.json().catch(() => ({})) as { available?: boolean; error?: string }
        if (seq !== checkSeq.current) return
        if (!res.ok) { setCheck({ state: 'idle' }); return } // Prüfung nicht möglich → der Server prüft beim Speichern erneut
        setCheck(data.available ? { state: 'ok' } : { state: 'bad', text: data.error ?? 'Dieser Benutzername ist nicht verfügbar.' })
      } catch {
        if (seq === checkSeq.current) setCheck({ state: 'idle' })
      }
    }, 400)
    return () => clearTimeout(t)
  }, [cleanUsername])

  // Vorschlag: vorname-nachname, solange die Person den Benutzernamen nicht selbst angefasst hat
  function suggest(fn: string, ln: string) {
    if (usernameTouched) return
    setUsername(sanitizeUsername([fn, ln].filter(Boolean).join('-')))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!firstName.trim()) { setError('Bitte gib deinen Vornamen ein.'); return }
    if (!isValidUsername(cleanUsername)) { setError(`Bitte prüfe den Benutzernamen. ${USERNAME_RULE_TEXT}`); return }
    if (check.state === 'bad') { setError(check.text); return }
    if (password.length < 8) { setError('Bitte wähle ein Passwort mit mindestens 8 Zeichen.'); return }
    if (password !== repeat) { setError('Die beiden Passwörter sind nicht gleich. Bitte prüfe die Eingabe.'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/event/set-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, password, username: cleanUsername, first_name: firstName.trim(), last_name: lastName.trim() }),
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

  const previewState = check.state === 'ok' ? 'ok' : check.state === 'bad' ? 'bad' : ''

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

      <label className="ev-field"><span>Benutzername = deine Webadresse</span>
        {/* Vorschau wie im Onboarding: Adresszeile eines Browsers */}
        <span className={`ev-url ${previewState}`} aria-hidden>
          <svg width="11" height="13" viewBox="0 0 9 11" fill="none"><rect x="0.5" y="4.5" width="8" height="6" rx="1.5" fill="currentColor" /><path d="M2.5 4.5V3a2 2 0 0 1 4 0v1.5" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round" /></svg>
          <span className="u"><b>{cleanUsername || 'dein-name'}</b>.{PREVIEW_DOMAIN}</span>
        </span>
        <input type="text" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} value={username}
          onChange={e => { setUsernameTouched(true); setUsername(e.target.value); setError('') }}
          onBlur={() => setUsername(cleanUsername)} required maxLength={30} placeholder="dein-name"
          aria-describedby="ev-username-status" />
        <small id="ev-username-status" className={`ev-hint ev-status ${previewState}`} role="status">
          {check.state === 'checking' && 'Wird geprüft …'}
          {check.state === 'ok' && `✓ ${cleanUsername}.${PREVIEW_DOMAIN} ist frei`}
          {check.state === 'bad' && `✗ ${check.text}`}
          {check.state === 'idle' && 'Nur Kleinbuchstaben a–z und Bindestrich, mindestens 3 Zeichen.'}
        </small>
        <small className="ev-hint ev-note">Der Benutzername ist der erste Teil deiner Webadresse, bei allen deinen Seiten gleich, und lässt sich nach dem Speichern <b>nicht mehr ändern</b>.</small>
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
      <button type="submit" className="ev-btn" disabled={loading || check.state === 'checking' || check.state === 'bad'}>{loading ? 'Einen Moment …' : 'Speichern und anmelden'}</button>
      <p className="ev-fine">Merke dir Benutzername und Passwort gut oder schreib sie dir auf.</p>
    </form>
  )
}
