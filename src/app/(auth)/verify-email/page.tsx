'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { authClient } from '@/lib/auth/client'
import Image from 'next/image'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.finestsites.io'

function VerifyEmailContent() {
  const searchParams = useSearchParams()
  const email = searchParams.get('email') ?? ''

  const [cooldown, setCooldown] = useState(0)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [alreadyVerified, setAlreadyVerified] = useState(false)
  const [checking, setChecking] = useState(true)

  // Check if the current session user is already verified
  useEffect(() => {
    let cancelled = false
    authClient.getSession().then(result => {
      if (cancelled) return
      if (result?.data?.user?.emailVerified) {
        setAlreadyVerified(true)
      }
      setChecking(false)
    }).catch(() => {
      if (!cancelled) setChecking(false)
    })
    return () => { cancelled = true }
  }, [])

  // Tick down the cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return
    const id = setInterval(() => setCooldown(c => Math.max(0, c - 1)), 1000)
    return () => clearInterval(id)
  }, [cooldown])

  async function handleResend() {
    if (!email || cooldown > 0 || sending) return
    setSending(true)
    setError('')
    try {
      const result = await authClient.sendVerificationEmail({
        email,
        callbackURL: `${APP_URL}/onboarding/username?verified=1`,
      })
      // BetterAuth returns an error object (not a thrown exception) for EMAIL_ALREADY_VERIFIED
      if ((result as { error?: { code?: string } })?.error?.code === 'EMAIL_ALREADY_VERIFIED') {
        setAlreadyVerified(true)
        return
      }
      setSent(true)
      setCooldown(60)
    } catch {
      setError('Senden fehlgeschlagen. Bitte versuche es erneut.')
    } finally {
      setSending(false)
    }
  }

  // Show nothing while checking session to avoid flash
  if (checking) {
    return (
      <div className="text-center py-8">
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          border: '2.5px solid #E5E7EB', borderTopColor: '#111827',
          animation: 'spin 0.8s linear infinite', margin: '0 auto',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  // User is already verified — show a friendly confirmation instead of the resend form
  if (alreadyVerified) {
    return (
      <div className="text-center">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ background: '#F0FDF4' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="1.5">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
          </div>
        </div>

        <h1 className="text-xl font-semibold text-gray-900 mb-2">
          E-Mail bereits bestätigt
        </h1>
        <p className="text-sm leading-relaxed mb-6" style={{ color: '#6B7280' }}>
          Deine E-Mail-Adresse ist bereits verifiziert. Du kannst direkt loslegen.
        </p>

        <Link
          href="/dashboard"
          className="block w-full py-3 text-sm font-semibold rounded-2xl text-center transition-all"
          style={{
            background: '#111827',
            color: '#fff',
            boxShadow: '0 4px 14px rgba(17,24,39,0.2)',
            textDecoration: 'none',
          }}
        >
          Zum Dashboard
        </Link>
      </div>
    )
  }

  return (
    <div className="text-center">
      {/* Mascot */}
      <div className="flex justify-center mb-6">
        <Image
          src="/mascot-email.png"
          alt="FinestSites Maskottchen mit Briefumschlag"
          width={120}
          height={120}
          priority
          style={{ objectFit: 'contain' }}
        />
      </div>

      <h1 className="text-xl font-semibold text-gray-900 mb-2">
        Bitte bestätige deine E-Mail
      </h1>
      <p className="text-sm leading-relaxed mb-1" style={{ color: '#6B7280' }}>
        Wir haben eine E-Mail an
      </p>
      {email && (
        <p className="text-sm font-semibold text-gray-900 mb-4 break-all">{email}</p>
      )}
      <p className="text-sm leading-relaxed mb-6" style={{ color: '#6B7280' }}>
        gesendet. Klicke auf den Link in der E-Mail, um deinen Account zu aktivieren.
      </p>

      {/* Resend section */}
      <div className="mb-6">
        {sent ? (
          <div className="px-4 py-3 rounded-2xl text-sm mb-3"
            style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', color: '#15803D' }}>
            E-Mail erneut gesendet. Bitte prüfe deinen Posteingang.
          </div>
        ) : null}

        {error && (
          <div className="px-4 py-3 rounded-2xl text-sm mb-3"
            style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C' }}>
            {error}
          </div>
        )}

        <button
          onClick={handleResend}
          disabled={sending || cooldown > 0}
          className="w-full py-3 text-sm font-semibold rounded-2xl transition-all"
          style={{
            background: (sending || cooldown > 0) ? '#F3F4F6' : '#111827',
            color: (sending || cooldown > 0) ? '#9CA3AF' : '#fff',
            cursor: (sending || cooldown > 0) ? 'not-allowed' : 'pointer',
            boxShadow: (sending || cooldown > 0) ? 'none' : '0 4px 14px rgba(17,24,39,0.2)',
          }}
        >
          {sending
            ? 'Wird gesendet...'
            : cooldown > 0
            ? `Erneut senden in ${cooldown}s`
            : 'E-Mail erneut senden'}
        </button>
      </div>

      {/* Spam hint */}
      <div className="px-4 py-3 rounded-xl text-xs text-left mb-5"
        style={{ background: '#FFF7ED', border: '1px solid #FED7AA', color: '#92400E' }}>
        <strong>Keine E-Mail erhalten?</strong> Bitte prüfe auch deinen Spam-Ordner. Manchmal landet die E-Mail dort.
      </div>

      {/* Back to login */}
      <p className="text-sm" style={{ color: '#6B7280' }}>
        Falsches Konto?{' '}
        <Link href="/login" className="font-medium text-gray-900 underline underline-offset-4">
          Zur Anmeldung
        </Link>
      </p>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailContent />
    </Suspense>
  )
}
