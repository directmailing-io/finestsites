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
      await authClient.sendVerificationEmail({
        email,
        callbackURL: `${APP_URL}/onboarding/username`,
      })
      setSent(true)
      setCooldown(60)
    } catch {
      setError('Senden fehlgeschlagen. Bitte versuche es erneut.')
    } finally {
      setSending(false)
    }
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
        Bitte bestatige deine E-Mail
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
            E-Mail erneut gesendet. Bitte prufe deinen Posteingang.
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
        <strong>Keine E-Mail erhalten?</strong> Bitte prufe auch deinen Spam-Ordner. Manchmal landet die E-Mail dort.
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
