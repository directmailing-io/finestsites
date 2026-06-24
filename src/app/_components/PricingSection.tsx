'use client'

import { useState } from 'react'

const PLANS = [
  {
    key: 'starter',
    name: 'Starter',
    monthly: 20,
    yearly: 200,
    yearlyMonthly: Math.round(200 / 12),
    dailyCents: Math.round((20 / 30) * 100),
    premiumSites: '1 aktive Premium-Seite',
    value: '3.000 €',
    popular: false,
    cta: 'Jetzt starten',
  },
  {
    key: 'pro',
    name: 'Pro',
    monthly: 30,
    yearly: 300,
    yearlyMonthly: 25,
    dailyCents: 100,
    premiumSites: '3 aktive Premium-Seiten',
    value: '10.000 €',
    popular: true,
    cta: 'Pro wählen',
  },
  {
    key: 'unlimited',
    name: 'Unlimited',
    monthly: 50,
    yearly: 500,
    yearlyMonthly: Math.round(500 / 12),
    dailyCents: Math.round((50 / 30) * 100),
    premiumSites: 'Unbegrenzt Premium-Seiten',
    value: 'mehrere 10.000 €',
    popular: false,
    cta: 'Jetzt starten',
  },
]

const COMMON_FEATURES = [
  'Alle Templates inklusive',
  'DSGVO, Hosting & SSL-Verschlüsselung',
  'Kontaktformular für Interessenten',
  'Laufende Updates & Optimierungen',
  'Kein Design nötig, keine Texte ausdenken',
  'EU-Health-Claims-Check (KI)',
  'Deine eigene Webadresse',
]

export default function PricingSection() {
  const [yearly, setYearly] = useState(false)

  return (
    <section id="preise" style={{ background: '#fff', padding: '96px 7vw' }}>
      <div style={{ maxWidth: 980, margin: '0 auto' }}>
        <p style={{ fontSize: 11, fontWeight: 600, color: '#aaa', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16, textAlign: 'center' }}>Preise</p>
        <h2 style={{ fontFamily: '"Plein", sans-serif', fontSize: 'clamp(32px, 4.5vw, 52px)', fontWeight: 400, color: '#111', letterSpacing: '-0.025em', textAlign: 'center', marginBottom: 12, lineHeight: 1.1 }}>
          Kein Risiko. Jederzeit kündbar.
        </h2>
        <p style={{ textAlign: 'center', fontSize: 15, color: '#777', marginBottom: 32, maxWidth: 500, margin: '0 auto 32px' }}>
          Keine Mindestlaufzeit, kein Kleingedrucktes. Einfach loslegen, und wenn du nicht zufrieden bist, kannst du monatlich aufhören.
        </p>

        {/* ── Toggle ─────────────────────────────────────────────── */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 48 }}>
          <div style={{ display: 'inline-flex', background: '#f5f3f0', borderRadius: 100, padding: 4, gap: 2 }}>
            <button
              onClick={() => setYearly(false)}
              style={{
                padding: '9px 24px',
                borderRadius: 100,
                border: 'none',
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 600,
                background: !yearly ? '#fff' : 'transparent',
                color: !yearly ? '#111' : '#888',
                boxShadow: !yearly ? '0 1px 6px rgba(0,0,0,0.08)' : 'none',
                transition: 'all 0.2s',
                fontFamily: 'inherit',
              }}
            >
              Monatlich
            </button>
            <button
              onClick={() => setYearly(true)}
              style={{
                padding: '9px 24px',
                borderRadius: 100,
                border: 'none',
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 600,
                background: yearly ? '#fff' : 'transparent',
                color: yearly ? '#111' : '#888',
                boxShadow: yearly ? '0 1px 6px rgba(0,0,0,0.08)' : 'none',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontFamily: 'inherit',
              }}
            >
              Jährlich
              <span style={{ background: '#C8D8B8', color: '#2d5a1b', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 100 }}>
                2 Monate gratis
              </span>
            </button>
          </div>
        </div>

        {/* ── Plan Cards ─────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {PLANS.map((plan) => {
            const price = yearly ? plan.yearlyMonthly : plan.monthly
            const dailyEuros = (price / 30).toFixed(2).replace('.', ',')

            return (
              <div key={plan.key} style={{ position: plan.key === 'starter' ? 'relative' : undefined }}>
                {plan.key === 'starter' && (
                  <img
                    src="/mascot-v2.png"
                    alt=""
                    style={{
                      position: 'absolute',
                      right: '100%',
                      bottom: 0,
                      height: 220,
                      width: 'auto',
                      display: 'block',
                      pointerEvents: 'none',
                    }}
                  />
                )}
              <div style={{
                background: plan.popular ? '#1a2530' : '#fff',
                borderRadius: 24,
                padding: '36px 28px',
                border: plan.popular ? 'none' : '1px solid #ebebeb',
                position: 'relative',
                boxShadow: plan.popular ? '0 8px 40px rgba(26,37,48,0.18)' : 'none',
              }}>
                {plan.popular && (
                  <div style={{ position: 'absolute', top: -13, left: '50%', transform: 'translateX(-50%)', background: '#D4C5E2', color: '#4a3060', fontSize: 11, fontWeight: 700, padding: '4px 16px', borderRadius: 100, whiteSpace: 'nowrap' }}>
                    BELIEBTESTE WAHL
                  </div>
                )}

                {/* Value badge */}
                <div style={{
                  display: 'inline-block',
                  background: plan.popular ? 'rgba(255,255,255,0.1)' : '#F9F7FF',
                  border: `1px solid ${plan.popular ? 'rgba(255,255,255,0.15)' : '#e8e0f5'}`,
                  borderRadius: 100,
                  padding: '4px 12px',
                  fontSize: 11,
                  fontWeight: 600,
                  color: plan.popular ? 'rgba(255,255,255,0.55)' : '#8060b0',
                  marginBottom: 16,
                }}>
                  Webseiten-Wert: {plan.value}+
                </div>

                <p style={{ fontSize: 13, fontWeight: 600, color: plan.popular ? 'rgba(255,255,255,0.45)' : '#888', marginBottom: 12 }}>{plan.name}</p>

                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 4 }}>
                  <span style={{ fontFamily: '"Plein", sans-serif', fontSize: 50, fontWeight: 400, color: plan.popular ? '#fff' : '#111', letterSpacing: '-0.04em', lineHeight: 1 }}>€{price}</span>
                  <span style={{ fontSize: 13, color: plan.popular ? 'rgba(255,255,255,0.35)' : '#aaa' }}>/Monat</span>
                </div>

                {yearly && (
                  <p style={{ fontSize: 12, color: plan.popular ? 'rgba(255,255,255,0.3)' : '#bbb', marginBottom: 4 }}>
                    €{plan.yearly}/Jahr · du sparst €{(plan.monthly * 12) - plan.yearly}
                  </p>
                )}

                {/* Daily price */}
                <p style={{ fontSize: 12, color: plan.popular ? 'rgba(212,197,226,0.8)' : '#A070C0', fontWeight: 600, marginBottom: 20 }}>
                  ≈ {dailyEuros} € am Tag
                </p>

                {/* Premium sites */}
                <div style={{
                  background: plan.popular ? 'rgba(255,255,255,0.07)' : '#F9F7FF',
                  borderRadius: 10,
                  padding: '10px 14px',
                  marginBottom: 20,
                  fontSize: 13,
                  fontWeight: 600,
                  color: plan.popular ? '#fff' : '#111',
                }}>
                  {plan.premiumSites}
                  <div style={{ fontSize: 11, fontWeight: 400, color: plan.popular ? 'rgba(255,255,255,0.45)' : '#888', marginTop: 2 }}>
                    + unbegrenzt Standardseiten
                  </div>
                </div>

                {/* Features */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 28 }}>
                  {COMMON_FEATURES.map((f, fi) => (
                    <div key={fi} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={plan.popular ? '#D4C5E2' : '#16A34A'} strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 1 }}><polyline points="20 6 9 17 4 12" /></svg>
                      <span style={{ fontSize: 12.5, color: plan.popular ? 'rgba(255,255,255,0.6)' : '#555', lineHeight: 1.5 }}>{f}</span>
                    </div>
                  ))}
                </div>

                <a href="https://app.finestsites.io/register" style={{ display: 'block', textAlign: 'center', background: plan.popular ? '#D4C5E2' : '#111', color: plan.popular ? '#3a2060' : '#fff', padding: '13px 24px', borderRadius: 100, fontSize: 14, fontWeight: 600 }}>
                  {plan.cta}
                </a>
              </div>
              </div>
            )
          })}
        </div>

        {/* ── Bottom note ─────────────────────────────────────────── */}
        <div style={{ marginTop: 48, textAlign: 'center' }}>
          <p style={{ fontSize: 13, color: '#bbb', marginBottom: 32 }}>Alle Preise inkl. MwSt. · Monatlich kündbar · Keine versteckten Kosten</p>

          <div style={{ background: '#FDF9F0', border: '1px solid #EDCBA8', borderRadius: 24, overflow: 'hidden', maxWidth: 980, margin: '0 auto' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', alignItems: 'stretch' }}>
              {/* Text side */}
              <div style={{ padding: '40px 44px', textAlign: 'left', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#c8a07a', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 14 }}>Zum Vergleich</p>
                <h3 style={{ fontFamily: '"Plein", sans-serif', fontSize: 'clamp(22px, 2.4vw, 30px)', fontWeight: 400, color: '#111', lineHeight: 1.2, letterSpacing: '-0.02em', marginBottom: 18 }}>
                  2 Brötchen pro Tag.<br />Deine Website für immer.
                </h3>
                <p style={{ fontSize: 14.5, color: '#666', lineHeight: 1.75 }}>
                  Eine professionelle Website kostet bei einer Agentur typischerweise{' '}
                  <strong style={{ color: '#111' }}>3.000 bis 15.000 Euro</strong>, einmalig, ohne laufende Pflege oder Optimierung.
                  Du bekommst das und mehr für ungefähr <strong style={{ color: '#111' }}>2 Brötchen am Tag</strong> (wenn überhaupt).
                  Wer sein Network Business ernst meint, erkennt: Das ist keine Ausgabe. Das ist eine Investition.
                </p>
              </div>
              {/* Image side */}
              <div style={{ position: 'relative', minHeight: 280 }}>
                <img
                  src="/bakery.png"
                  alt="Mascot beim Bäcker"
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center left' }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
