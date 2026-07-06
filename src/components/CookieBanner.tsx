'use client'

import { useState, useEffect } from 'react'

// ── Consent model ───────────────────────────────────────────────────────────
interface Consent {
  essential: true
  analytics: boolean
  decided: boolean
  version: string
  timestamp: number
}

const STORAGE_KEY = 'fs_cookie_consent'
const CONSENT_VERSION = '2026-07' // bump when categories change

function readConsent(): Consent | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Consent
    if (parsed.version !== CONSENT_VERSION) return null // re-ask on new version
    return parsed
  } catch {
    return null
  }
}

function writeConsent(analytics: boolean): void {
  const c: Consent = {
    essential: true,
    analytics,
    decided: true,
    version: CONSENT_VERSION,
    timestamp: Date.now(),
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(c))
  // Dispatch so other parts of the app can react (e.g. load analytics)
  window.dispatchEvent(new CustomEvent('fs:consentUpdated', { detail: c }))
}

// ── Toggle switch ───────────────────────────────────────────────────────────
function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange?: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange?.(!checked)}
      style={{
        position: 'relative',
        width: 44,
        height: 24,
        borderRadius: 100,
        border: 'none',
        background: checked ? '#8060b0' : '#D1D5DB',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'background 0.2s',
        flexShrink: 0,
        opacity: disabled ? 0.6 : 1,
        padding: 0,
      }}
    >
      <span style={{
        position: 'absolute',
        top: 3,
        left: checked ? 23 : 3,
        width: 18,
        height: 18,
        borderRadius: '50%',
        background: '#fff',
        boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
        transition: 'left 0.2s',
        display: 'block',
      }} />
    </button>
  )
}

// ── Banner view ─────────────────────────────────────────────────────────────
function BannerView({ onAll, onEssential, onSettings }: {
  onAll: () => void
  onEssential: () => void
  onSettings: () => void
}) {
  return (
    <div style={{ padding: '24px 24px 20px' }}>
      {/* Title */}
      <p style={{
        fontSize: 18,
        fontWeight: 800,
        color: '#111',
        marginBottom: 10,
        letterSpacing: '-0.02em',
        lineHeight: 1.25,
      }}>
        Darf&apos;s ein Cookie sein?
      </p>

      {/* Body */}
      <p style={{
        fontSize: 13,
        color: '#555',
        lineHeight: 1.7,
        marginBottom: 20,
      }}>
        Wir verwenden technisch notwendige Cookies, die den Betrieb dieser Seite ermöglichen
        (z. B. Anmeldung, Sicherheit). Optionale Analyse-Cookies helfen uns,
        FinestSites weiterzuentwickeln.
      </p>

      {/* Settings link */}
      <button
        onClick={onSettings}
        style={{
          background: 'none',
          border: 'none',
          padding: 0,
          fontSize: 12,
          fontWeight: 600,
          color: '#8060b0',
          cursor: 'pointer',
          marginBottom: 16,
          textDecoration: 'underline',
          textDecorationColor: 'rgba(128,96,176,0.3)',
          fontFamily: 'inherit',
        }}
      >
        Einstellungen anpassen
      </button>

      {/* Action buttons — equal prominence, DSGVO-konform */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <button
          onClick={onEssential}
          style={{
            padding: '12px 16px',
            borderRadius: 12,
            border: '1.5px solid #D1D5DB',
            background: '#fff',
            color: '#374151',
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: 'inherit',
            transition: 'border-color 0.15s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#9CA3AF' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#D1D5DB' }}
        >
          Nur Notwendige
        </button>
        <button
          onClick={onAll}
          style={{
            padding: '12px 16px',
            borderRadius: 12,
            border: '1.5px solid #8060b0',
            background: 'linear-gradient(135deg, #8060b0, #9d7ecc)',
            color: '#fff',
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: 'inherit',
            boxShadow: '0 2px 12px rgba(128,96,176,0.3)',
          }}
        >
          Alle akzeptieren
        </button>
      </div>

      {/* Legal footnote */}
      <p style={{ fontSize: 11, color: '#bbb', marginTop: 14, lineHeight: 1.5 }}>
        Weitere Infos in unserer{' '}
        <a href="/datenschutz" style={{ color: '#bbb', textDecoration: 'underline' }}>Datenschutzerklärung</a>
        {' '}und den{' '}
        <a href="/agb" style={{ color: '#bbb', textDecoration: 'underline' }}>AGB</a>.
        {' '}Gemäß DSGVO &amp; TTDSG § 25.
      </p>
    </div>
  )
}

// ── Settings view ───────────────────────────────────────────────────────────
function SettingsView({ analytics, onChange, onSave, onBack }: {
  analytics: boolean
  onChange: (v: boolean) => void
  onSave: () => void
  onBack: () => void
}) {
  const categories = [
    {
      id: 'essential',
      label: 'Notwendig',
      description: 'Ermöglichen grundlegende Funktionen wie Anmeldung, Sicherheit (CSRF) und Speicherung deiner Cookie-Präferenz. Nicht deaktivierbar.',
      enabled: true,
      disabled: true,
    },
    {
      id: 'analytics',
      label: 'Analyse',
      description: 'Helfen uns zu verstehen, wie Besucher die Seite nutzen (z. B. aufgerufene Seiten, Verweildauer). Keine Weitergabe an Dritte.',
      enabled: analytics,
      disabled: false,
    },
  ]

  return (
    <div style={{ padding: '24px 24px 20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <button
          onClick={onBack}
          style={{
            background: '#F3F4F6',
            border: 'none',
            borderRadius: 8,
            width: 32,
            height: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            flexShrink: 0,
          }}
          aria-label="Zurück"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5 8L10 13" stroke="#374151" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <p style={{ fontSize: 16, fontWeight: 800, color: '#111', letterSpacing: '-0.02em', margin: 0 }}>
          Cookie-Einstellungen
        </p>
      </div>

      {/* Categories */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1, marginBottom: 20 }}>
        {categories.map((cat, i) => (
          <div
            key={cat.id}
            style={{
              background: '#F9FAFB',
              borderRadius: i === 0 ? '10px 10px 0 0' : i === categories.length - 1 ? '0 0 10px 10px' : 0,
              border: '1px solid #E5E7EB',
              borderTop: i === 0 ? '1px solid #E5E7EB' : 'none',
              padding: '14px 16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#111' }}>{cat.label}</span>
              <Toggle
                checked={cat.enabled}
                onChange={cat.id === 'analytics' ? onChange : undefined}
                disabled={cat.disabled}
              />
            </div>
            <p style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.6, margin: 0 }}>
              {cat.description}
            </p>
          </div>
        ))}
      </div>

      {/* Save */}
      <button
        onClick={onSave}
        style={{
          width: '100%',
          padding: '13px 16px',
          borderRadius: 12,
          border: '1.5px solid #8060b0',
          background: 'linear-gradient(135deg, #8060b0, #9d7ecc)',
          color: '#fff',
          fontSize: 14,
          fontWeight: 700,
          cursor: 'pointer',
          fontFamily: 'inherit',
          boxShadow: '0 2px 12px rgba(128,96,176,0.3)',
        }}
      >
        Auswahl speichern
      </button>
    </div>
  )
}

// ── Main component ──────────────────────────────────────────────────────────
export default function CookieBanner() {
  // Lazy initializer avoids setState-in-effect lint error
  const [visible, setVisible] = useState(() => {
    if (typeof window === 'undefined') return false
    return !readConsent()
  })
  const [animated, setAnimated] = useState(false)
  const [view, setView] = useState<'banner' | 'settings'>('banner')
  const [analyticsVal, setAnalyticsVal] = useState(false)

  useEffect(() => {
    // Trigger slide-up animation on initial mount if visible
    if (visible) {
      const t = setTimeout(() => setAnimated(true), 50)
      return () => clearTimeout(t)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    // Re-open via footer link
    function handleOpen() {
      const c = readConsent()
      setAnalyticsVal(c?.analytics ?? false)
      setView('banner')
      setVisible(true)
      setTimeout(() => setAnimated(true), 50)
    }
    window.addEventListener('fs:openCookieSettings', handleOpen)
    return () => window.removeEventListener('fs:openCookieSettings', handleOpen)
  }, [])

  function dismiss(analytics: boolean) {
    writeConsent(analytics)
    setAnimated(false)
    setTimeout(() => setVisible(false), 350)
  }

  if (!visible) return null

  return (
    <>
      {/* Scoped keyframes */}
      <style>{`
        @keyframes fs-cookie-fadeIn { from { opacity: 0 } to { opacity: 1 } }
      `}</style>

      {/* Backdrop (very subtle, just a bit of shadow on the page) */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9998,
          pointerEvents: 'none',
          background: 'linear-gradient(to top, rgba(0,0,0,0.08) 0%, transparent 40%)',
          animation: 'fs-cookie-fadeIn 0.3s ease',
        }}
      />

      {/* Banner wrapper */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 9999,
          display: 'flex',
          justifyContent: 'center',
          padding: '0 16px 20px',
          pointerEvents: 'none',
        }}
      >
        {/* Positioning container — mascot pokes above */}
        <div style={{
          position: 'relative',
          maxWidth: 460,
          width: '100%',
          pointerEvents: 'all',
        }}>

          {/* Mascot — peeks above the card */}
          <div style={{
            position: 'absolute',
            top: -96,
            right: 24,
            width: 108,
            height: 108,
            zIndex: 2,
            transform: animated ? 'translateY(0) rotate(-4deg)' : 'translateY(40px) rotate(-4deg)',
            transition: 'transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
            transitionDelay: '0.1s',
          }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/mascot-cookie.png"
              alt=""
              aria-hidden="true"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                filter: 'drop-shadow(0 6px 20px rgba(0,0,0,0.22))',
              }}
            />
          </div>

          {/* Card */}
          <div style={{
            background: '#fff',
            borderRadius: 20,
            boxShadow: '0 8px 40px rgba(0,0,0,0.15), 0 2px 8px rgba(0,0,0,0.06)',
            border: '1px solid rgba(0,0,0,0.07)',
            overflow: 'hidden',
            transform: animated ? 'translateY(0)' : 'translateY(100%)',
            transition: 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}>
            {/* Purple top accent stripe */}
            <div style={{ height: 3, background: 'linear-gradient(90deg, #8060b0, #c084fc, #8060b0)', backgroundSize: '200%' }} />

            {view === 'banner' ? (
              <BannerView
                onAll={() => dismiss(true)}
                onEssential={() => dismiss(false)}
                onSettings={() => setView('settings')}
              />
            ) : (
              <SettingsView
                analytics={analyticsVal}
                onChange={setAnalyticsVal}
                onSave={() => dismiss(analyticsVal)}
                onBack={() => setView('banner')}
              />
            )}
          </div>
        </div>
      </div>
    </>
  )
}
