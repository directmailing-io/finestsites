'use client'

import { useState } from 'react'

const NAV_LINKS = [
  { label: 'Was ist FinestSites?', href: '#was-ist' },
  { label: 'Templates',            href: '#templates' },
  { label: 'Preise',               href: '#preise' },
]

export default function NavBar() {
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)

  return (
    <div style={{ padding: '20px 24px 0', position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100 }}>
      {/* ── Pill nav ── */}
      <nav style={{
        background: '#fff',
        borderRadius: 100,
        padding: '10px 14px 10px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 2px 24px rgba(0,0,0,0.07)',
        maxWidth: 1200,
        margin: '0 auto',
      }}>
        <img src="/logos/logo-black.svg" alt="FinestSites" style={{ height: 22, display: 'block' }} />

        {/* Desktop: nav links */}
        <div className="fs-nav-links">
          {NAV_LINKS.map(l => (
            <a key={l.href} href={l.href} style={{ color: '#555', fontSize: 14, fontWeight: 500, textDecoration: 'none' }}>{l.label}</a>
          ))}
        </div>

        {/* Desktop: action buttons */}
        <div className="fs-nav-actions" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <a href="https://app.finestsites.io/login" style={{ color: '#111', fontSize: 14, fontWeight: 500, padding: '8px 18px', borderRadius: 100, border: '1.5px solid rgba(0,0,0,0.12)', textDecoration: 'none' }}>Anmelden</a>
          <a href="https://app.finestsites.io/register" style={{ background: '#111', color: '#fff', fontSize: 14, fontWeight: 600, padding: '9px 20px', borderRadius: 100, textDecoration: 'none' }}>Jetzt starten</a>
        </div>

        {/* Mobile: hamburger */}
        <button
          className="fs-hamburger"
          onClick={() => setOpen(o => !o)}
          aria-label={open ? 'Menü schließen' : 'Menü öffnen'}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px 8px', flexDirection: 'column', gap: 5, display: 'none' }}
        >
          <span style={{
            display: 'block', width: 22, height: 2, background: '#111', borderRadius: 2,
            transition: 'transform 0.22s ease',
            transform: open ? 'translateY(7px) rotate(45deg)' : 'none',
          }} />
          <span style={{
            display: 'block', width: 22, height: 2, background: '#111', borderRadius: 2,
            transition: 'opacity 0.15s ease',
            opacity: open ? 0 : 1,
          }} />
          <span style={{
            display: 'block', width: 22, height: 2, background: '#111', borderRadius: 2,
            transition: 'transform 0.22s ease',
            transform: open ? 'translateY(-7px) rotate(-45deg)' : 'none',
          }} />
        </button>
      </nav>

      {/* ── Mobile dropdown ── */}
      <div style={{
        maxHeight: open ? 400 : 0,
        overflow: 'hidden',
        transition: 'max-height 0.3s ease',
        maxWidth: 1200,
        margin: '0 auto',
      }}>
        <div style={{
          background: '#fff',
          borderRadius: 20,
          marginTop: 8,
          padding: '8px 20px 20px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
        }}>
          {NAV_LINKS.map((l, i) => (
            <a
              key={l.href}
              href={l.href}
              onClick={close}
              style={{
                display: 'block',
                fontSize: 16,
                color: '#222',
                fontWeight: 500,
                padding: '14px 4px',
                borderBottom: i < NAV_LINKS.length - 1 ? '1px solid #f0f0f0' : 'none',
                textDecoration: 'none',
              }}
            >
              {l.label}
            </a>
          ))}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
            <a
              href="https://app.finestsites.io/login"
              onClick={close}
              style={{ display: 'block', textAlign: 'center', color: '#111', fontSize: 15, fontWeight: 500, padding: '13px', borderRadius: 100, border: '1.5px solid rgba(0,0,0,0.15)', textDecoration: 'none' }}
            >
              Anmelden
            </a>
            <a
              href="https://app.finestsites.io/register"
              onClick={close}
              style={{ display: 'block', textAlign: 'center', background: '#111', color: '#fff', fontSize: 15, fontWeight: 600, padding: '14px', borderRadius: 100, textDecoration: 'none' }}
            >
              Jetzt starten →
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
