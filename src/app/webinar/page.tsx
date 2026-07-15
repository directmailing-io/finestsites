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
    <div style={{ fontFamily: '"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', background: '#fff', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <style>{`
        @font-face {
          font-family: 'Plus Jakarta Sans';
          src: url('/fonts/PlusJakartaSans-latin-ext.woff2') format('woff2');
          font-weight: 400 700; font-style: normal; font-display: swap;
        }
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
        @font-face {
          font-family: 'Plein';
          src: url('/fonts/Plein-Medium.otf') format('opentype');
          font-weight: 500; font-display: swap;
        }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        a { text-decoration: none; }
        /* same nav helpers as main site */
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
        .wbr-cal-btn:hover { background: rgba(0,0,0,0.07) !important; border-color: rgba(0,0,0,0.2) !important; }
        .wbr-zoom-btn:hover { background: #222 !important; }

        @media (max-width: 767px) {
          .fs-nav-links { display: none; }
          .fs-nav-actions { display: none !important; }
          .fs-hamburger { display: flex !important; }
          .wbr-hero { flex-direction: column !important; min-height: 0 !important; }
          .wbr-hero-img { height: 56vw !important; min-height: 0 !important; max-height: 260px; width: 100% !important; position: relative !important; top: 0 !important; right: 0 !important; flex-shrink: 0; }
          .wbr-hero-img img { object-position: center top !important; }
          .wbr-content { padding: 28px 22px 52px !important; max-width: 100% !important; }
          .wbr-countdown { gap: 8px !important; }
          .wbr-countdown-box { padding: 14px 16px !important; min-width: 66px !important; }
          .wbr-countdown-num { font-size: 28px !important; }
          .wbr-cal-row { gap: 6px !important; }
          .wbr-zoom-card-grid { grid-template-columns: 1fr !important; }
          .fs-footer-dark { padding: 48px 22px 0; }
          .fs-footer-grid { grid-template-columns: 1fr; gap: 36px; padding-bottom: 40px; }
          .fs-footer-bottom { flex-direction: column; align-items: flex-start; gap: 12px; }
        }
        @media (max-width: 479px) {
          .wbr-cal-row a { font-size: 12px !important; padding: 8px 10px !important; }
        }
      `}</style>

      {/* ── NavBar (exact same as main site) ── */}
      <NavBar />

      {/* ── Hero ── */}
      <section
        className="wbr-hero"
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'stretch',
          position: 'relative',
          background: '#0d0b14',
          paddingTop: 80, // clear fixed nav
        }}
      >
        {/* Background image — right half */}
        <div
          className="wbr-hero-img"
          style={{
            position: 'absolute',
            top: 0, right: 0,
            width: '52%',
            height: '100%',
          }}
        >
          <Image
            src="/webinar-bg.png"
            alt=""
            fill
            style={{ objectFit: 'cover', objectPosition: 'center' }}
            priority
          />
          {/* Fade gradient toward left so content is readable */}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(to right, #0d0b14 0%, rgba(13,11,20,0.55) 40%, rgba(13,11,20,0.0) 100%)',
          }} />
          {/* Subtle bottom fade */}
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            height: '30%',
            background: 'linear-gradient(to top, #0d0b14 0%, transparent 100%)',
          }} />
        </div>

        {/* Content */}
        <div
          className="wbr-content"
          style={{
            position: 'relative', zIndex: 2,
            maxWidth: 580,
            padding: '60px 7vw 80px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            minHeight: 'calc(100vh - 80px)',
          }}
        >
          {/* Badge */}
          <div style={{ marginBottom: 28 }}>
            {isLive ? (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.35)',
                borderRadius: 999, padding: '7px 16px',
              }}>
                <span style={{
                  width: 8, height: 8, borderRadius: '50%', background: '#EF4444',
                  display: 'inline-block', animation: 'livePulse 1.1s ease-in-out infinite',
                }} />
                <span style={{ color: '#FCA5A5', fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  Jetzt Live
                </span>
              </span>
            ) : (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                background: 'rgba(128,96,176,0.18)', border: '1px solid rgba(196,168,240,0.3)',
                borderRadius: 999, padding: '7px 16px',
              }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22C55E', display: 'inline-block' }} />
                <span style={{ color: '#c4a8f0', fontSize: 12, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase' }}>
                  Exklusiv · Limitierte Plätze
                </span>
              </span>
            )}
          </div>

          {/* Headline — Plein font like main site */}
          <h1 style={{
            fontFamily: '"Plein", sans-serif',
            fontSize: 'clamp(30px, 3.8vw, 52px)',
            fontWeight: 400,
            color: '#fff',
            lineHeight: 1.1,
            letterSpacing: '-0.028em',
            marginBottom: 18,
          }}>
            Deine Webseite für Network Marketing.{' '}
            <span style={{ color: '#8060b0' }}>Live in Minuten.</span>
          </h1>

          {/* Subtext */}
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 16, lineHeight: 1.7, marginBottom: 10, maxWidth: 460 }}>
            30 Minuten. Nur für ausgewählte Teams von PM-International. Limitierte Plätze.
          </p>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 15, lineHeight: 1.7, marginBottom: 36, maxWidth: 460 }}>
            Wir stellen FinestSites live vor und du sicherst dir deinen Zugang noch vor dem offiziellen Launch.
          </p>

          {/* Date */}
          <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16 }}>
            Di., 21. Juli 2026 · 20:00 Uhr
          </div>

          {/* Countdown */}
          {!isLive && (
            <div className="wbr-countdown" style={{ display: 'flex', gap: 10, marginBottom: 40, flexWrap: 'wrap' }}>
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
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 16,
                    padding: '16px 20px',
                    minWidth: 76,
                  }}
                >
                  <div
                    className="wbr-countdown-num"
                    style={{ color: '#fff', fontSize: 34, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}
                  >
                    {String(v).padStart(2, '0')}
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.32)', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 6 }}>
                    {l}
                  </div>
                </div>
              ))}
            </div>
          )}

          {isLive && (
            <div style={{
              marginBottom: 40, padding: '18px 22px',
              background: 'rgba(220,38,38,0.12)', border: '1px solid rgba(220,38,38,0.3)',
              borderRadius: 16,
            }}>
              <div style={{ color: '#FCA5A5', fontWeight: 700, fontSize: 17, marginBottom: 4 }}>Der Call läuft gerade!</div>
              <div style={{ color: 'rgba(252,165,165,0.6)', fontSize: 14 }}>Tritt jetzt dem Zoom Meeting bei.</div>
            </div>
          )}

          {/* Zoom card */}
          <div style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 20,
            padding: '18px 20px',
            marginBottom: 20,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
              {/* Zoom logo grey */}
              <svg width="14" height="14" viewBox="0 0 32 32" fill="none" style={{ opacity: 0.4 }}>
                <rect width="32" height="32" rx="6" fill="#fff"/>
                <path d="M6 11.5C6 10.12 7.12 9 8.5 9h11C20.88 9 22 10.12 22 11.5v9C22 21.88 20.88 23 19.5 23h-11C7.12 23 6 21.88 6 20.5v-9zM24 13l4-2.5v11L24 19v-6z" fill="#111"/>
              </svg>
              <span style={{ color: 'rgba(255,255,255,0.32)', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Zoom Meeting
              </span>
            </div>

            <div
              className="wbr-zoom-card-grid"
              style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}
            >
              {[{ label: 'Meeting-ID', value: '881 133 8936' }, { label: 'Kenncode', value: '100' }].map(({ label, value }) => (
                <div key={label}>
                  <div style={{ color: 'rgba(255,255,255,0.28)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>{label}</div>
                  <div style={{ color: 'rgba(255,255,255,0.82)', fontSize: 15, fontWeight: 600, letterSpacing: '0.04em', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
                </div>
              ))}
            </div>

            <a
              href={ZOOM_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="wbr-zoom-btn"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: '100%', padding: 13,
                background: isLive ? '#DC2626' : '#111',
                color: '#fff',
                borderRadius: 100,
                fontSize: 14, fontWeight: 600,
                textDecoration: 'none',
                transition: 'background .15s',
              }}
            >
              {isLive ? 'Jetzt beitreten' : 'Zoom-Link öffnen'}
            </a>
          </div>

          {/* Calendar */}
          <div>
            <div style={{ color: 'rgba(255,255,255,0.28)', fontSize: 11, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', marginBottom: 10 }}>
              Termin eintragen
            </div>
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
                  className="wbr-cal-btn"
                  style={{
                    display: 'inline-flex', alignItems: 'center',
                    padding: '9px 14px',
                    background: 'rgba(255,255,255,0.07)',
                    border: '1px solid rgba(255,255,255,0.13)',
                    borderRadius: 100,
                    color: 'rgba(255,255,255,0.65)',
                    fontSize: 13, fontWeight: 500,
                    textDecoration: 'none',
                    whiteSpace: 'nowrap',
                    transition: 'background .15s, border-color .15s',
                  }}
                >
                  {label}
                </a>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer (exact same as main site) ── */}
      <Footer />
    </div>
  )
}
