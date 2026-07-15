'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import NavBar from '@/app/_components/NavBar'
import Footer from '@/app/_components/Footer'

const ZOOM_LINK = 'https://us06web.zoom.us/j/8811338936?pwd=TktDYUNZYWY3eFZXbkdGSlQrV0pmdz09&omn=83712840373'
const EVENT_UTC = '2026-07-21T18:00:00Z' // 20:00 Uhr DE (CEST = UTC+2)

function useCountdown() {
  const target = new Date(EVENT_UTC)
  const [state, setState] = useState({ days: 0, hours: 0, minutes: 0, isLive: false, isPast: false })

  useEffect(() => {
    function tick() {
      const now = new Date()
      const diff = target.getTime() - now.getTime()
      if (diff <= 0) {
        const sinceStart = now.getTime() - target.getTime()
        setState({ days: 0, hours: 0, minutes: 0, isLive: sinceStart < 30 * 60 * 1000, isPast: sinceStart >= 30 * 60 * 1000 })
      } else {
        setState({
          days: Math.floor(diff / 864e5),
          hours: Math.floor((diff % 864e5) / 36e5),
          minutes: Math.floor((diff % 36e5) / 6e4),
          isLive: false,
          isPast: false,
        })
      }
    }
    tick()
    const id = setInterval(tick, 10000)
    return () => clearInterval(id)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return state
}

export default function WebinarPage() {
  const { days, hours, minutes, isLive } = useCountdown()

  const calDetails = encodeURIComponent(
    `Exklusiver Live-Call nur für ausgewählte Teams.\n\nZoom Link: ${ZOOM_LINK}\nMeeting-ID: 881 133 8936\nKenncode: 100`
  )
  const googleUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=FinestSites+PreLaunch+Call&dates=20260721T180000Z%2F20260721T183000Z&details=${calDetails}&location=Zoom`
  const outlookUrl = `https://outlook.live.com/calendar/0/action/compose?rru=addevent&startdt=2026-07-21T18%3A00%3A00Z&enddt=2026-07-21T18%3A30%3A00Z&subject=FinestSites+PreLaunch+Call&location=Zoom&body=${calDetails}`

  return (
    <div style={{
      fontFamily: '"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      background: '#fff',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <style>{`
        @font-face {
          font-family: 'Plus Jakarta Sans';
          src: url('/fonts/PlusJakartaSans-latin.woff2') format('woff2');
          font-weight: 400 700; font-style: normal; font-display: swap;
        }
        @font-face {
          font-family: 'Plein';
          src: url('/fonts/Plein-Regular.otf') format('opentype');
          font-weight: 400; font-display: swap;
        }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        a { text-decoration: none; }

        /* Nav helpers — same as main site */
        .fs-nav-links { display: flex; gap: 28px; align-items: center; }
        .fs-nav-actions { display: flex; gap: 8px; align-items: center; }
        .fs-hamburger { display: none !important; }

        /* Footer helpers — same as main site */
        .fs-footer-dark { background: #0f0f0f; color: #fff; padding: 64px 7vw 0; }
        .fs-footer-grid { max-width: 1060px; margin: 0 auto; display: grid; grid-template-columns: 1.6fr 1fr 1fr; gap: 56px; padding-bottom: 56px; }
        .fs-footer-bottom { max-width: 1060px; margin: 0 auto; padding: 24px 0 32px; border-top: 1px solid rgba(255,255,255,0.08); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px; }

        @keyframes livePulse {
          0%,100% { opacity:1; transform:scale(1); }
          50% { opacity:.35; transform:scale(.7); }
        }

        /* Mobile */
        @media (max-width: 767px) {
          .fs-nav-links { display: none; }
          .fs-nav-actions { display: none !important; }
          .fs-hamburger { display: flex !important; }

          .wbr-section { flex-direction: column !important; min-height: 0 !important; }
          .wbr-bg { display: none !important; }
          .wbr-bg-gradient { display: none !important; }
          .wbr-mobile-img {
            display: block !important;
            width: 100%;
            height: 62vw;
            max-height: 280px;
            background-image: url(/webinar-bg.png);
            background-size: cover;
            background-position: center top;
            position: relative;
            flex-shrink: 0;
            margin-top: 68px;
          }
          .wbr-mobile-img::after {
            content: '';
            position: absolute;
            bottom: 0; left: 0; right: 0;
            height: 60%;
            background: linear-gradient(to bottom, transparent, #f5f3f0);
          }
          .wbr-content { padding: 20px 22px 52px !important; max-width: 100% !important; min-height: 0 !important; }
          .wbr-countdown { gap: 8px !important; }
          .wbr-countdown-box { padding: 14px 18px !important; min-width: 72px !important; }
          .wbr-countdown-num { font-size: 28px !important; }
          .wbr-cal-row { gap: 6px !important; }
          .wbr-zoom-grid { grid-template-columns: 1fr !important; }

          .fs-footer-dark { padding: 48px 22px 0; }
          .fs-footer-grid { grid-template-columns: 1fr; gap: 36px; padding-bottom: 40px; }
          .fs-footer-bottom { flex-direction: column; align-items: flex-start; gap: 12px; }
        }
        @media (max-width: 479px) {
          .wbr-cal-row a { font-size: 12px !important; padding: 8px 11px !important; }
          .wbr-hero-h1 { font-size: 30px !important; }
        }
      `}</style>

      {/* ── NavBar (identisch zur Hauptseite) ── */}
      <NavBar />

      {/* ── Hero — exakt wie Hauptseite: heller Hintergrund, Bild rechts, Text links ── */}
      <section
        className="wbr-section"
        style={{
          flex: 1,
          width: '100%',
          minHeight: '100vh',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          overflow: 'hidden',
          background: '#f5f3f0', // exakt wie Hauptseite
        }}
      >
        {/* Hintergrundbild rechts — wie auf der Hauptseite */}
        <div
          className="wbr-bg"
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: 'url(/webinar-bg.png)',
            backgroundSize: 'cover',
            backgroundPosition: 'right center',
          }}
        />

        {/* Gradient von links weiß nach rechts transparent — exakt wie Hauptseite */}
        <div
          className="wbr-bg-gradient"
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(to right, #f5f3f0 28%, rgba(245,243,240,0.92) 40%, rgba(245,243,240,0.5) 58%, rgba(245,243,240,0.0) 72%)',
          }}
        />

        {/* Mobile: Bild oben */}
        <div className="wbr-mobile-img" style={{ display: 'none' }} />

        {/* Content — links ausgerichtet wie auf der Hauptseite */}
        <div
          className="wbr-content"
          style={{
            position: 'relative',
            zIndex: 2,
            padding: '130px 0 90px 7vw',
            maxWidth: '58vw',
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
          }}
        >
          {/* Eyebrow — wie "Für Network-Marketer" auf der Hauptseite */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 28 }}>
            {isLive ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                <span style={{
                  width: 8, height: 8, borderRadius: '50%', background: '#EF4444',
                  display: 'inline-block', animation: 'livePulse 1.1s ease-in-out infinite',
                }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: '#DC2626', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  Jetzt Live
                </span>
              </span>
            ) : (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22C55E', display: 'inline-block' }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: '#888', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  Exklusiv · Limitierte Plätze
                </span>
              </span>
            )}
          </div>

          {/* H1 — Plein, schwarzer Text, Lila für Akzentzeile, identisch zur Hauptseite */}
          <h1
            className="wbr-hero-h1"
            style={{
              fontFamily: '"Plein", sans-serif',
              fontSize: 'clamp(26px, 2.6vw, 42px)',
              fontWeight: 400,
              color: '#111',
              lineHeight: 1.1,
              letterSpacing: '-0.028em',
              marginBottom: 28,
            }}
          >
            Deine Webseite für Network Marketing.<br />
            <span style={{ color: '#8060b0' }}>Live in Minuten.</span><br />
            Nur für ausgewählte Teams.
          </h1>

          {/* Subtext */}
          <p style={{ fontSize: 16, color: '#555', lineHeight: 1.75, marginBottom: 10, maxWidth: 460 }}>
            30 Minuten. Nur für ausgewählte Teams von PM-International.
          </p>
          <p style={{ fontSize: 15, color: '#888', lineHeight: 1.75, marginBottom: 32, maxWidth: 460 }}>
            Wir stellen FinestSites live vor und du sicherst dir deinen Zugang noch vor dem offiziellen Launch.
          </p>

          {/* Datum */}
          <p style={{ fontSize: 12, fontWeight: 600, color: '#aaa', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16 }}>
            Di., 21. Juli 2026 · 20:00 Uhr
          </p>

          {/* Countdown — weiße Karten wie Feature-Cards auf der Hauptseite */}
          {!isLive && (
            <div className="wbr-countdown" style={{ display: 'flex', gap: 10, marginBottom: 36, flexWrap: 'wrap' }}>
              {[
                { v: days,    l: 'Tage' },
                { v: hours,   l: 'Stunden' },
                { v: minutes, l: 'Minuten' },
              ].map(({ v, l }) => (
                <div
                  key={l}
                  className="wbr-countdown-box"
                  style={{
                    textAlign: 'center',
                    background: '#fff',
                    border: '1px solid #E5E7EB',
                    borderRadius: 16,
                    padding: '16px 22px',
                    minWidth: 78,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                  }}
                >
                  <div
                    className="wbr-countdown-num"
                    style={{ color: '#111', fontSize: 32, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}
                  >
                    {String(v).padStart(2, '0')}
                  </div>
                  <div style={{ color: '#aaa', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 6 }}>
                    {l}
                  </div>
                </div>
              ))}
            </div>
          )}

          {isLive && (
            <div style={{
              marginBottom: 36, padding: '16px 20px',
              background: '#FEF2F2', border: '1px solid #FCA5A5',
              borderRadius: 16,
            }}>
              <div style={{ color: '#DC2626', fontWeight: 700, fontSize: 16, marginBottom: 4 }}>Der Call läuft gerade!</div>
              <div style={{ color: '#EF4444', fontSize: 14 }}>Tritt jetzt dem Zoom Meeting bei.</div>
            </div>
          )}

          {/* Zoom Card — wie Feature-Cards: weiß, saubere Border */}
          <div style={{
            background: '#fff',
            border: '1px solid #E5E7EB',
            borderRadius: 20,
            padding: '20px 22px',
            marginBottom: 20,
            boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
            maxWidth: 420,
          }}>
            {/* Zoom-Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 14 }}>
              <svg width="14" height="14" viewBox="0 0 32 32" fill="none" style={{ opacity: 0.35 }}>
                <rect width="32" height="32" rx="6" fill="#111"/>
                <path d="M6 11.5C6 10.12 7.12 9 8.5 9h11C20.88 9 22 10.12 22 11.5v9C22 21.88 20.88 23 19.5 23h-11C7.12 23 6 21.88 6 20.5v-9zM24 13l4-2.5v11L24 19v-6z" fill="#fff"/>
              </svg>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#bbb', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Zoom Meeting</span>
            </div>

            {/* Meeting-ID + Kenncode */}
            <div
              className="wbr-zoom-grid"
              style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}
            >
              {[{ label: 'Meeting-ID', value: '881 133 8936' }, { label: 'Kenncode', value: '100' }].map(({ label, value }) => (
                <div key={label}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#bbb', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>{label}</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#111', letterSpacing: '0.02em', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
                </div>
              ))}
            </div>

            {/* CTA — schwarzer Pill wie auf der Hauptseite */}
            <a
              href={ZOOM_LINK}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: '100%', padding: '13px 24px',
                background: isLive ? '#DC2626' : '#111',
                color: '#fff',
                borderRadius: 100,
                fontSize: 15, fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              {isLive ? 'Jetzt beitreten' : 'Zoom-Link öffnen'}
            </a>
          </div>

          {/* Kalender-Buttons — Outline-Pill wie sekundärer CTA auf der Hauptseite */}
          <div>
            <p style={{ fontSize: 12, fontWeight: 600, color: '#aaa', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>
              Termin eintragen
            </p>
            <div className="wbr-cal-row" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {([
                { label: 'Google Kalender', href: googleUrl },
                { label: 'Apple / iCal',   href: '/api/webinar/ical', download: true },
                { label: 'Outlook',         href: outlookUrl },
                { label: 'Andere (.ics)',   href: '/api/webinar/ical', download: true },
              ] as { label: string; href: string; download?: boolean }[]).map(({ label, href, download }) => (
                <a
                  key={label}
                  href={href}
                  {...(download ? { download: 'finestsites-webinar.ics' } : { target: '_blank', rel: 'noopener noreferrer' })}
                  style={{
                    display: 'inline-flex', alignItems: 'center',
                    padding: '10px 18px',
                    background: 'rgba(255,255,255,0.8)',
                    border: '1.5px solid rgba(0,0,0,0.12)',
                    borderRadius: 100,
                    color: '#111',
                    fontSize: 14, fontWeight: 500,
                    textDecoration: 'none',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {label}
                </a>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer (identisch zur Hauptseite) ── */}
      <Footer />
    </div>
  )
}
