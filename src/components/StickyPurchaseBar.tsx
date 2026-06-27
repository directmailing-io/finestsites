'use client'

import { useEffect, useRef, useState } from 'react'

interface Props {
  templateTitle: string
  registerUrl: string
  heroRef?: React.RefObject<HTMLElement | null>
}

export default function StickyPurchaseBar({ templateTitle, registerUrl }: Props) {
  const [visible, setVisible] = useState(false)
  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return
    const obs = new IntersectionObserver(
      ([entry]) => setVisible(!entry.isIntersecting),
      { threshold: 0 }
    )
    obs.observe(sentinel)
    return () => obs.disconnect()
  }, [])

  return (
    <>
      {/* Sentinel: placed at bottom of hero so bar shows when hero leaves view */}
      <div ref={sentinelRef} style={{ height: 1, marginTop: -1 }} />

      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 200,
        background: 'rgba(255,255,255,0.95)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderTop: '1px solid rgba(0,0,0,0.07)',
        padding: '12px 7vw',
        paddingBottom: 'max(12px, calc(12px + env(safe-area-inset-bottom)))',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        boxShadow: '0 -4px 24px rgba(0,0,0,0.07)',
        transform: visible ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform 0.3s cubic-bezier(0.4,0,0.2,1)',
      }}>
        <div className="sticky-bar-title">
          <div style={{ fontSize: 12, color: '#aaa', marginBottom: 1 }}>Template</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#111', letterSpacing: '-0.02em' }}>{templateTitle}</div>
        </div>
        <div className="sticky-bar-inner" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span className="sticky-bar-price" style={{ fontSize: 13, color: '#999' }}>Ab 20 €/Monat</span>
          <a
            href={registerUrl}
            style={{
              background: '#111', color: '#fff',
              padding: '10px 22px', borderRadius: 100,
              fontSize: 14, fontWeight: 600,
              textDecoration: 'none', whiteSpace: 'nowrap',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#333')}
            onMouseLeave={e => (e.currentTarget.style.background = '#111')}
          >
            Jetzt starten →
          </a>
        </div>
      </div>

      <style>{`
        @media (max-width: 767px) {
          .sticky-bar-title { display: none; }
          .sticky-bar-price { display: none; }
          .sticky-bar-inner { justify-content: center !important; padding: 10px 20px !important; }
          .sticky-bar-inner a { flex: 1; text-align: center; }
        }
      `}</style>
    </>
  )
}
