'use client'

import { useState, useEffect } from 'react'
import NavBar from '@/app/_components/NavBar'
import Footer from '@/app/_components/Footer'

const ZOOM_LINK = 'https://us06web.zoom.us/j/8811338936?pwd=TktDYUNZYWY3eFZXbkdGSlQrV0pmdz09&omn=83712840373'
const EVENT_UTC = '2026-07-21T18:00:00Z'

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
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(ZOOM_LINK)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      window.open(ZOOM_LINK, '_blank')
    }
  }

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

        /* Sticky bottom bar */
        .wbr-sticky {
          position: fixed; bottom: 0; left: 0; right: 0; z-index: 100;
          background: rgba(255,255,255,0.97);
          backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
          border-top: 1px solid rgba(0,0,0,0.09);
          box-shadow: 0 -8px 40px rgba(0,0,0,0.10);
        }
        .wbr-sticky-inner {
          max-width: 1120px; margin: 0 auto;
          padding: 14px 7vw;
          display: flex; align-items: center; justify-content: space-between; gap: 20px;
        }
        .wbr-sticky-info { display: flex; flex-direction: column; gap: 3px; }
        .wbr-sticky-btns { display: flex; gap: 10px; align-items: center; flex-shrink: 0; }

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
            padding: 24px 20px 40px;
          }
          .wbr-h1 { font-size: 26px !important; }
          .wbr-countdown { gap: 10px; }
          .wbr-countdown-box { padding: 18px 22px; min-width: 82px; }
          .wbr-countdown-num { font-size: 36px !important; }
          .wbr-cal-row { gap: 7px; }
          .wbr-cal-row a { font-size: 13px !important; padding: 10px 14px !important; }

          .wbr-sticky-inner { padding: 12px 18px; flex-direction: column; gap: 10px; align-items: stretch; }
          .wbr-sticky-info { gap: 2px; }
          .wbr-sticky-btns { flex-direction: row; }
          .wbr-sticky-btns a, .wbr-sticky-btns button { flex: 1; justify-content: center; }
          .wbr-sticky-meta { display: none !important; }
        }
        @media (max-width: 420px) {
          .wbr-h1 { font-size: 22px !important; }
          .wbr-cal-row { flex-direction: column; }
          .wbr-cal-row a { width: 100%; justify-content: center; }
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
                <span style={{ fontSize: 12, fontWeight: 700, color: '#555', letterSpacing: '0.09em', textTransform: 'uppercase' }}>
                  Nur für ausgewählte Teams
                </span>
              </span>
            )}
          </div>

          {/* H1 */}
          <h1 className="wbr-h1">
            Du siehst FinestSites als Erste/r<br />
            <span style={{ color: '#8060b0' }}>und erstellst deine eigene FitLine-Webseite kinderleicht.</span>
          </h1>

          {/* Body */}
          <p style={{ fontSize: 16, color: '#444', lineHeight: 1.75, marginBottom: 10, maxWidth: 460 }}>
            In diesem Zoom-Call wird FinestSites zum ersten Mal vorgestellt, noch vor dem richtigen Launch.
          </p>
          <p style={{ fontSize: 16, color: '#6040a0', fontWeight: 600, lineHeight: 1.7, marginBottom: 32, maxWidth: 460 }}>
            Du kannst dir also noch vor all den anderen einen Zugang sichern.
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
              marginBottom: 28, padding: '14px 18px',
              background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 14,
            }}>
              <div style={{ color: '#DC2626', fontWeight: 700, fontSize: 15, marginBottom: 3 }}>Der Call läuft gerade!</div>
              <div style={{ color: '#EF4444', fontSize: 13 }}>Tritt jetzt dem Zoom Meeting bei.</div>
            </div>
          )}

          {/* Kalender */}
          <div style={{ paddingBottom: 100 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#bbb', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>
              Termin eintragen, damit du es nicht vergisst
            </p>
            <div className="wbr-cal-row">
              {([
                { label: 'Google Kalender', href: googleUrl },
                { label: 'Apple / iCal',    href: '/api/webinar/ical', download: true },
                { label: 'Outlook',          href: outlookUrl },
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

      {/* Sticky bottom bar */}
      <div className="wbr-sticky">
        <div className="wbr-sticky-inner">

          {/* Info */}
          <div className="wbr-sticky-info">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="13" height="13" viewBox="0 0 32 32" fill="none" style={{ opacity: 0.4, flexShrink: 0 }}>
                <rect width="32" height="32" rx="6" fill="#111"/>
                <path d="M6 11.5C6 10.12 7.12 9 8.5 9h11C20.88 9 22 10.12 22 11.5v9C22 21.88 20.88 23 19.5 23h-11C7.12 23 6 21.88 6 20.5v-9zM24 13l4-2.5v11L24 19v-6z" fill="#fff"/>
              </svg>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#999', letterSpacing: '0.09em', textTransform: 'uppercase' }}>
                Zoom-Call · Di. 21. Juli · 20:00 Uhr
              </span>
            </div>
            <div className="wbr-sticky-meta" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <span style={{ fontSize: 13, color: '#555' }}>
                Meeting-ID: <strong style={{ color: '#111' }}>881 133 8936</strong>
              </span>
              <span style={{ fontSize: 13, color: '#555' }}>
                Kenncode: <strong style={{ color: '#111' }}>100</strong>
              </span>
            </div>
          </div>

          {/* Buttons */}
          <div className="wbr-sticky-btns">
            <button
              onClick={handleCopy}
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                padding: '13px 20px',
                background: copied ? '#F0FDF4' : 'transparent',
                border: `1.5px solid ${copied ? '#86EFAC' : 'rgba(0,0,0,0.15)'}`,
                borderRadius: 100,
                color: copied ? '#15803D' : '#111',
                fontSize: 14, fontWeight: 600,
                cursor: 'pointer', whiteSpace: 'nowrap',
                transition: 'all 0.2s',
              }}
            >
              {copied ? 'Link kopiert!' : 'Zoom-Link kopieren'}
            </button>
            <a
              href={ZOOM_LINK}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                padding: '13px 24px',
                background: isLive ? '#DC2626' : '#111',
                color: '#fff', borderRadius: 100,
                fontSize: 14, fontWeight: 600,
                textDecoration: 'none', whiteSpace: 'nowrap',
                boxShadow: isLive ? '0 4px 16px rgba(220,38,38,0.3)' : '0 4px 16px rgba(0,0,0,0.18)',
              }}
            >
              {isLive ? 'Jetzt beitreten' : 'Zum Zoom-Meeting'}
            </a>
          </div>

        </div>
      </div>
    </div>
  )
}
