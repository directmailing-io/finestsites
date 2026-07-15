'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'

const ZOOM_LINK = 'https://us06web.zoom.us/j/8811338936?pwd=TktDYUNZYWY3eFZXbkdGSlQrV0pmdz09&omn=83712840373'
const EVENT_UTC = '2026-07-21T18:00:00Z' // 20:00 Uhr DE (CEST = UTC+2)
const EVENT_END_UTC = '20260721T183000Z'
const EVENT_START_CAL = '20260721T180000Z'

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

function CalBtn({ href, label, download }: { href: string; label: string; download?: boolean }) {
  return (
    <a
      href={href}
      {...(download ? { download: 'finestsites-webinar.ics' } : { target: '_blank', rel: 'noopener noreferrer' })}
      style={{
        display: 'inline-flex', alignItems: 'center',
        padding: '9px 15px',
        background: 'rgba(255,255,255,0.08)',
        border: '1px solid rgba(255,255,255,0.13)',
        borderRadius: '11px',
        color: 'rgba(255,255,255,0.72)',
        fontSize: '13px', fontWeight: 600,
        textDecoration: 'none',
        whiteSpace: 'nowrap',
        transition: 'background .15s, border-color .15s',
      }}
      onMouseEnter={e => {
        const el = e.currentTarget
        el.style.background = 'rgba(255,255,255,0.14)'
        el.style.borderColor = 'rgba(255,255,255,0.25)'
      }}
      onMouseLeave={e => {
        const el = e.currentTarget
        el.style.background = 'rgba(255,255,255,0.08)'
        el.style.borderColor = 'rgba(255,255,255,0.13)'
      }}
    >
      {label}
    </a>
  )
}

export default function WebinarPage() {
  const { days, hours, minutes, isLive, isPast } = useCountdown()

  const calDetails = encodeURIComponent(
    `Exklusiver Live-Call nur für ausgewählte Teams.\n\nZoom Link: ${ZOOM_LINK}\nMeeting-ID: 881 133 8936\nKenncode: 100`
  )

  const googleUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=FinestSites+PreLaunch+Call&dates=${EVENT_START_CAL}%2F${EVENT_END_UTC}&details=${calDetails}&location=Zoom`
  const outlookUrl = `https://outlook.live.com/calendar/0/action/compose?rru=addevent&startdt=2026-07-21T18%3A00%3A00Z&enddt=2026-07-21T18%3A30%3A00Z&subject=FinestSites+PreLaunch+Call&location=Zoom&body=${calDetails}`

  return (
    <>
      <style>{`
        @keyframes livePulse {
          0%,100% { opacity:1; transform:scale(1); }
          50% { opacity:.4; transform:scale(.75); }
        }
        * { box-sizing: border-box; }
        body { margin: 0; }
        @media (max-width: 600px) {
          .webinar-main { padding: 24px 20px 56px !important; }
          .webinar-headline { font-size: 28px !important; }
          .countdown-grid { gap: 8px !important; }
          .countdown-box { padding: 14px 16px !important; min-width: 66px !important; }
          .countdown-num { font-size: 28px !important; }
          .cal-row { gap: 6px !important; }
        }
      `}</style>

      <div style={{ position: 'relative', minHeight: '100svh', background: '#080810', fontFamily: 'var(--font-geist-sans), -apple-system, BlinkMacSystemFont, sans-serif' }}>

        {/* Background image */}
        <Image
          src="/webinar-bg.png"
          alt=""
          fill
          style={{ objectFit: 'cover', objectPosition: 'center right' }}
          priority
        />

        {/* Overlay: dark left, lighter right so mascot shows */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(100deg, rgba(4,4,12,0.93) 0%, rgba(4,4,12,0.82) 42%, rgba(4,4,12,0.52) 68%, rgba(4,4,12,0.28) 100%)',
        }} />

        {/* UI */}
        <div style={{ position: 'relative', zIndex: 1, minHeight: '100svh', display: 'flex', flexDirection: 'column' }}>

          {/* Nav */}
          <nav style={{ padding: '18px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ color: '#fff', fontWeight: 800, fontSize: '17px', letterSpacing: '-0.025em' }}>
              FinestSites
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', opacity: 0.38 }}>
              <svg width="15" height="15" viewBox="0 0 32 32" fill="none">
                <rect width="32" height="32" rx="6" fill="#fff"/>
                <path d="M6 11.5C6 10.12 7.12 9 8.5 9h11C20.88 9 22 10.12 22 11.5v9C22 21.88 20.88 23 19.5 23h-11C7.12 23 6 21.88 6 20.5v-9zM24 13l4-2.5v11L24 19v-6z" fill="#111"/>
              </svg>
              <span style={{ color: '#9CA3AF', fontSize: '12px', fontWeight: 500 }}>via Zoom</span>
            </div>
          </nav>

          {/* Main content */}
          <main
            className="webinar-main"
            style={{ flex: 1, display: 'flex', alignItems: 'center', padding: '32px 40px 72px' }}
          >
            <div style={{ width: '100%', maxWidth: '520px' }}>

              {/* Status badge */}
              <div style={{ marginBottom: '26px' }}>
                {isLive ? (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: '8px',
                    background: 'rgba(220,38,38,0.18)', border: '1px solid rgba(220,38,38,0.4)',
                    borderRadius: '999px', padding: '7px 16px',
                  }}>
                    <span style={{
                      width: '8px', height: '8px', borderRadius: '50%', background: '#EF4444',
                      display: 'inline-block', animation: 'livePulse 1.1s ease-in-out infinite',
                    }} />
                    <span style={{ color: '#FCA5A5', fontSize: '12px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                      Jetzt Live
                    </span>
                  </span>
                ) : (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: '8px',
                    background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.13)',
                    borderRadius: '999px', padding: '7px 16px',
                  }}>
                    <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#22C55E', display: 'inline-block' }} />
                    <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: '12px', fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase' }}>
                      Exklusiv · Limitierte Plätze
                    </span>
                  </span>
                )}
              </div>

              {/* Headline */}
              <h1
                className="webinar-headline"
                style={{ margin: '0 0 16px', color: '#fff', fontSize: 'clamp(28px, 4vw, 48px)', fontWeight: 800, lineHeight: 1.1, letterSpacing: '-0.03em' }}
              >
                Deine Webseite für Network Marketing.{' '}
                <span style={{ color: 'rgba(255,255,255,0.42)' }}>Fertig in Minuten.</span>
              </h1>

              {/* Subtext */}
              <p style={{ margin: '0 0 34px', color: 'rgba(255,255,255,0.57)', fontSize: '16px', lineHeight: 1.65, maxWidth: '460px' }}>
                30 Minuten. Nur für ausgewählte Teams von PM-International. Wir zeigen dir FinestSites live und du sicherst dir deinen Zugang noch vor dem offiziellen Launch.
              </p>

              {/* Date */}
              <div style={{ color: 'rgba(255,255,255,0.38)', fontSize: '12px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '16px' }}>
                Di., 21. Juli 2026 · 20:00 Uhr (Deutschland)
              </div>

              {/* Countdown */}
              {!isLive && !isPast && (
                <div
                  className="countdown-grid"
                  style={{ display: 'flex', gap: '10px', marginBottom: '36px', flexWrap: 'wrap' }}
                >
                  {[
                    { v: days,    l: 'Tage' },
                    { v: hours,   l: 'Stunden' },
                    { v: minutes, l: 'Minuten' },
                  ].map(({ v, l }) => (
                    <div
                      key={l}
                      className="countdown-box"
                      style={{
                        textAlign: 'center',
                        background: 'rgba(255,255,255,0.07)',
                        backdropFilter: 'blur(20px)',
                        WebkitBackdropFilter: 'blur(20px)',
                        border: '1px solid rgba(255,255,255,0.11)',
                        borderRadius: '18px',
                        padding: '16px 22px',
                        minWidth: '78px',
                      }}
                    >
                      <div
                        className="countdown-num"
                        style={{ color: '#fff', fontSize: '34px', fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}
                      >
                        {String(v).padStart(2, '0')}
                      </div>
                      <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: '6px' }}>
                        {l}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {isLive && (
                <div style={{
                  marginBottom: '36px', padding: '18px 22px',
                  background: 'rgba(220,38,38,0.14)', border: '1px solid rgba(220,38,38,0.32)',
                  borderRadius: '18px',
                }}>
                  <div style={{ color: '#FCA5A5', fontWeight: 700, fontSize: '17px', marginBottom: '4px' }}>
                    Der Call läuft gerade!
                  </div>
                  <div style={{ color: 'rgba(252,165,165,0.6)', fontSize: '14px' }}>
                    Tritt jetzt dem Zoom Meeting bei.
                  </div>
                </div>
              )}

              {/* Zoom card */}
              <div style={{
                background: 'rgba(255,255,255,0.05)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '20px',
                padding: '18px 20px',
                marginBottom: '18px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '14px' }}>
                  <svg width="13" height="13" viewBox="0 0 32 32" fill="none" style={{ opacity: 0.4 }}>
                    <rect width="32" height="32" rx="6" fill="#fff"/>
                    <path d="M6 11.5C6 10.12 7.12 9 8.5 9h11C20.88 9 22 10.12 22 11.5v9C22 21.88 20.88 23 19.5 23h-11C7.12 23 6 21.88 6 20.5v-9zM24 13l4-2.5v11L24 19v-6z" fill="#111"/>
                  </svg>
                  <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    Zoom Meeting
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
                  {[{ label: 'Meeting-ID', value: '881 133 8936' }, { label: 'Kenncode', value: '100' }].map(({ label, value }) => (
                    <div key={label}>
                      <div style={{ color: 'rgba(255,255,255,0.28)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '3px' }}>{label}</div>
                      <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '15px', fontWeight: 600, fontFamily: 'var(--font-geist-mono), monospace', letterSpacing: '0.03em' }}>{value}</div>
                    </div>
                  ))}
                </div>

                <a
                  href={ZOOM_LINK}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: '100%', padding: '13px',
                    background: isLive ? '#DC2626' : 'rgba(255,255,255,0.11)',
                    color: '#fff',
                    borderRadius: '13px',
                    fontSize: '14px', fontWeight: 700,
                    textDecoration: 'none',
                    border: isLive ? 'none' : '1px solid rgba(255,255,255,0.17)',
                    transition: 'opacity .15s',
                  }}
                >
                  {isLive ? 'Jetzt beitreten' : 'Zoom-Link öffnen'}
                </a>
              </div>

              {/* Calendar row */}
              <div>
                <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', marginBottom: '10px' }}>
                  Termin eintragen
                </div>
                <div className="cal-row" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  <CalBtn href={googleUrl} label="Google Kalender" />
                  <CalBtn href="/api/webinar/ical" label="Apple / iCal" download />
                  <CalBtn href={outlookUrl} label="Outlook" />
                  <CalBtn href="/api/webinar/ical" label="Andere (.ics)" download />
                </div>
              </div>

            </div>
          </main>
        </div>
      </div>
    </>
  )
}

function CalBtn({ href, label, download }: { href: string; label: string; download?: boolean }) {
  return (
    <a
      href={href}
      {...(download ? { download: 'finestsites-webinar.ics' } : { target: '_blank', rel: 'noopener noreferrer' })}
      style={{
        display: 'inline-flex', alignItems: 'center',
        padding: '9px 14px',
        background: 'rgba(255,255,255,0.08)',
        border: '1px solid rgba(255,255,255,0.13)',
        borderRadius: '11px',
        color: 'rgba(255,255,255,0.7)',
        fontSize: '13px', fontWeight: 600,
        textDecoration: 'none',
        whiteSpace: 'nowrap',
        transition: 'background .15s, border-color .15s',
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLAnchorElement
        el.style.background = 'rgba(255,255,255,0.14)'
        el.style.borderColor = 'rgba(255,255,255,0.25)'
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLAnchorElement
        el.style.background = 'rgba(255,255,255,0.08)'
        el.style.borderColor = 'rgba(255,255,255,0.13)'
      }}
    >
      {label}
    </a>
  )
}
