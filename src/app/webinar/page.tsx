'use client'

import { useState, useEffect } from 'react'
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
      background: '#f5f3f0',
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

        .fs-nav-links { display: flex; gap: 28px; align-items: center; }
        .fs-nav-actions { display: flex; gap: 8px; align-items: center; }
        .fs-hamburger { display: none !important; }
        .fs-footer-dark { background: #0f0f0f; color: #fff; padding: 64px 7vw 0; }
        .fs-footer-grid { max-width: 1060px; margin: 0 auto; display: grid; grid-template-columns: 1.6fr 1fr 1fr; gap: 56px; padding-bottom: 56px; }
        .fs-footer-bottom { max-width: 1060px; margin: 0 auto; padding: 24px 0 32px; border-top: 1px solid rgba(255,255,255,0.08); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px; }

        @keyframes livePulse {
          0%,100% { opacity:1; transform:scale(1); }
          50% { opacity:.35; transform:scale(.7); }
        }

        /* ── Desktop ── */
        .wbr-layout {
          display: flex;
          align-items: stretch;
          min-height: calc(100vh - 72px);
          position: relative;
          overflow: hidden;
        }
        .wbr-img-col {
          position: absolute;
          inset: 0;
          background-image: url(/webinar-bg.png);
          background-size: cover;
          background-position: right center;
        }
        .wbr-img-gradient {
          position: absolute;
          inset: 0;
          background: linear-gradient(to right, #f5f3f0 32%, rgba(245,243,240,0.93) 44%, rgba(245,243,240,0.45) 62%, rgba(245,243,240,0) 75%);
        }
        .wbr-content {
          position: relative;
          z-index: 2;
          padding: 80px 0 80px 7vw;
          width: 56vw;
          max-width: 680px;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }
        .wbr-mobile-img { display: none; }

        .wbr-h1 {
          font-family: 'Plein', sans-serif;
          font-size: clamp(28px, 2.8vw, 46px);
          font-weight: 400;
          color: #111;
          line-height: 1.08;
          letter-spacing: -0.03em;
          margin-bottom: 24px;
        }
        .wbr-countdown { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 32px; }
        .wbr-countdown-box {
          text-align: center;
          background: #fff;
          border: 1px solid #E5E7EB;
          border-radius: 16px;
          padding: 16px 20px;
          min-width: 76px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.06);
        }
        .wbr-countdown-num {
          color: #111; font-size: 32px; font-weight: 800;
          letter-spacing: -0.04em; line-height: 1;
          font-variant-numeric: tabular-nums;
        }
        .wbr-cal-row { display: flex; flex-wrap: wrap; gap: 8px; }
        .wbr-zoom-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; }

        /* ── Mobile ── */
        @media (max-width: 767px) {
          .fs-nav-links { display: none; }
          .fs-nav-actions { display: none !important; }
          .fs-hamburger { display: flex !important; }
          .fs-footer-dark { padding: 48px 22px 0; }
          .fs-footer-grid { grid-template-columns: 1fr; gap: 36px; padding-bottom: 40px; }
          .fs-footer-bottom { flex-direction: column; align-items: flex-start; gap: 12px; }

          .wbr-layout { flex-direction: column; min-height: 0; }
          .wbr-img-col { display: none; }
          .wbr-img-gradient { display: none; }
          .wbr-mobile-img {
            display: block;
            width: 100%;
            height: 56vw;
            max-height: 260px;
            background-image: url(/webinar-bg.png);
            background-size: cover;
            background-position: center top;
            position: relative;
            margin-top: 68px;
            flex-shrink: 0;
          }
          .wbr-mobile-img::after {
            content: '';
            position: absolute;
            bottom: 0; left: 0; right: 0;
            height: 55%;
            background: linear-gradient(to bottom, transparent, #f5f3f0);
          }
          .wbr-content {
            width: 100%;
            max-width: 100%;
            padding: 24px 20px 56px;
          }
          .wbr-h1 { font-size: 28px !important; }
          .wbr-countdown { gap: 8px; }
          .wbr-countdown-box { padding: 12px 16px; min-width: 68px; }
          .wbr-countdown-num { font-size: 26px !important; }
          .wbr-zoom-grid { grid-template-columns: 1fr 1fr; }
          .wbr-cal-row { gap: 7px; }
          .wbr-cal-row a { font-size: 13px !important; padding: 10px 14px !important; }
        }
        @media (max-width: 420px) {
          .wbr-h1 { font-size: 24px !important; }
          .wbr-cal-row { flex-direction: column; }
          .wbr-cal-row a { width: 100%; justify-content: center; }
          .wbr-zoom-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      <NavBar />

      <div className="wbr-layout">
        <div className="wbr-img-col" />
        <div className="wbr-img-gradient" />
        <div className="wbr-mobile-img" />

        <div className="wbr-content">

          {/* Eyebrow */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 22 }}>
            {isLive ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                <span style={{
                  width: 8, height: 8, borderRadius: '50%', background: '#EF4444',
                  display: 'inline-block', animation: 'livePulse 1.1s ease-in-out infinite',
                }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: '#DC2626', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  Jetzt Live
                </span>
              </span>
            ) : (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22C55E', display: 'inline-block', flexShrink: 0 }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: '#555', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  Nur für ausgewählte PM-International Partner
                </span>
              </span>
            )}
          </div>

          {/* H1 */}
          <h1 className="wbr-h1">
            Du siehst FinestSites als Erster.<br />
            Deine eigene Website.<br />
            <span style={{ color: '#8060b0' }}>In Minuten fertig. Ganz ohne Technik.</span>
          </h1>

          {/* Body */}
          <p style={{ fontSize: 16, color: '#444', lineHeight: 1.7, marginBottom: 8, maxWidth: 460 }}>
            Wir zeigen dir live, wie das geht. 30 Minuten Zoom. Kostenlos.
          </p>

          {/* FOMO */}
          <p style={{ fontSize: 15, color: '#6040a0', fontWeight: 600, lineHeight: 1.6, marginBottom: 28, maxWidth: 460 }}>
            Wer dabei ist, bekommt als Erster Zugang und ein Startangebot, das es danach so nicht gibt.
          </p>

          {/* Datum */}
          <p style={{ fontSize: 12, fontWeight: 700, color: '#999', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 14 }}>
            Di., 21. Juli 2026 · 20:00 Uhr · 30 Minuten
          </p>

          {/* Countdown */}
          {!isLive && (
            <div className="wbr-countdown">
              {[
                { v: days,    l: 'Tage' },
                { v: hours,   l: 'Stunden' },
                { v: minutes, l: 'Minuten' },
              ].map(({ v, l }) => (
                <div key={l} className="wbr-countdown-box">
                  <div className="wbr-countdown-num">{String(v).padStart(2, '0')}</div>
                  <div style={{ color: '#bbb', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 5 }}>{l}</div>
                </div>
              ))}
            </div>
          )}

          {isLive && (
            <div style={{
              marginBottom: 32, padding: '16px 20px',
              background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 16,
            }}>
              <div style={{ color: '#DC2626', fontWeight: 700, fontSize: 16, marginBottom: 4 }}>Der Call läuft gerade!</div>
              <div style={{ color: '#EF4444', fontSize: 14 }}>Tritt jetzt dem Zoom Meeting bei.</div>
            </div>
          )}

          {/* Zoom Card */}
          <div style={{
            background: '#fff', border: '1px solid #E5E7EB', borderRadius: 20,
            padding: '20px 22px', marginBottom: 20,
            boxShadow: '0 2px 12px rgba(0,0,0,0.06)', maxWidth: 440,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 14 }}>
              <svg width="14" height="14" viewBox="0 0 32 32" fill="none" style={{ opacity: 0.35 }}>
                <rect width="32" height="32" rx="6" fill="#111"/>
                <path d="M6 11.5C6 10.12 7.12 9 8.5 9h11C20.88 9 22 10.12 22 11.5v9C22 21.88 20.88 23 19.5 23h-11C7.12 23 6 21.88 6 20.5v-9zM24 13l4-2.5v11L24 19v-6z" fill="#fff"/>
              </svg>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#bbb', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Zoom Meeting · Di. 21. Juli · 20:00 Uhr</span>
            </div>

            <div className="wbr-zoom-grid">
              {[{ label: 'Meeting-ID', value: '881 133 8936' }, { label: 'Kenncode', value: '100' }].map(({ label, value }) => (
                <div key={label}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#bbb', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>{label}</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#111', letterSpacing: '0.02em', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
                </div>
              ))}
            </div>

            <a
              href={ZOOM_LINK}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: '100%', padding: '14px 24px',
                background: isLive ? '#DC2626' : '#111',
                color: '#fff', borderRadius: 100,
                fontSize: 15, fontWeight: 600, textDecoration: 'none',
              }}
            >
              {isLive ? 'Jetzt beitreten' : 'Zoom-Link speichern'}
            </a>
          </div>

          {/* Kalender */}
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#bbb', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>
              Termin in Kalender eintragen — damit du es nicht vergisst
            </p>
            <div className="wbr-cal-row">
              {([
                { label: 'Google Kalender', href: googleUrl },
                { label: 'Apple / iCal',   href: '/api/webinar/ical', download: true },
                { label: 'Outlook',         href: outlookUrl },
              ] as { label: string; href: string; download?: boolean }[]).map(({ label, href, download }) => (
                <a
                  key={label}
                  href={href}
                  {...(download ? { download: 'finestsites-webinar.ics' } : { target: '_blank', rel: 'noopener noreferrer' })}
                  style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    padding: '11px 18px',
                    background: 'rgba(255,255,255,0.85)',
                    border: '1.5px solid rgba(0,0,0,0.12)',
                    borderRadius: 100,
                    color: '#111', fontSize: 14, fontWeight: 500,
                    textDecoration: 'none', whiteSpace: 'nowrap',
                  }}
                >
                  {label}
                </a>
              ))}
            </div>
          </div>

        </div>
      </div>

      <Footer />
    </div>
  )
}
