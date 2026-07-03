'use client'

import { useEffect, useRef } from 'react'

function loadScript(src: string): Promise<void> {
  return new Promise((resolve) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return }
    const s = document.createElement('script')
    s.src = src
    s.onload = () => resolve()
    document.head.appendChild(s)
  })
}

// ── Scene 1: Social stats ─────────────────────────────────────────────────────
function StatsScene() {
  return (
    <div style={{
      background: '#111C26',
      borderRadius: 14,
      padding: '18px 20px',
      border: '1px solid rgba(255,255,255,0.05)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#E1306C' }} />
          <span style={{ fontSize: 11, color: '#4A5568', fontWeight: 600 }}>Dein letzter Reel</span>
        </div>
        <span style={{ fontSize: 10, color: '#2D3A47' }}>vor 3 Std.</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 0 }}>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 34, fontWeight: 800, color: '#fff', letterSpacing: '-0.04em', margin: 0, lineHeight: 1 }}>2.847</p>
          <p style={{ fontSize: 11, color: '#3D5060', margin: '6px 0 0', fontWeight: 500 }}>Aufrufe</p>
        </div>
        <div style={{ width: 1, background: 'rgba(255,255,255,0.05)', margin: '0 20px', alignSelf: 'stretch' }} />
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 34, fontWeight: 800, color: '#EF4444', letterSpacing: '-0.04em', margin: 0, lineHeight: 1 }}>0</p>
          <p style={{ fontSize: 11, color: '#3D5060', margin: '6px 0 0', fontWeight: 500 }}>Anfragen</p>
        </div>
      </div>
    </div>
  )
}

// ── Scene 2: "Schick mir was zu" ──────────────────────────────────────────────
function ChatScene() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{
        alignSelf: 'flex-start',
        background: '#253040',
        borderRadius: '16px 16px 16px 4px',
        padding: '10px 14px',
        maxWidth: '86%',
      }}>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', margin: 0, lineHeight: 1.4 }}>
          &ldquo;Schick mir mal was zu...&rdquo; 🤔
        </p>
      </div>
      <div style={{
        alignSelf: 'flex-end',
        background: '#111C26',
        borderRadius: '16px 16px 4px 16px',
        padding: '11px 16px',
        border: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        gap: 5,
        alignItems: 'center',
      }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: '#2D3F4E' }} />
        ))}
      </div>
      <p style={{ fontSize: 11, color: '#2D3A47', margin: 0, alignSelf: 'flex-end', fontWeight: 500 }}>
        was schickst du eigentlich?
      </p>
    </div>
  )
}

// ── Scene 3: Generic targeting ────────────────────────────────────────────────
function TargetScene() {
  const groups = [
    { emoji: '👩', label: 'Mütter' },
    { emoji: '🏋️', label: 'Sportler' },
    { emoji: '💼', label: 'Berufstätige' },
  ]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{
        background: '#253040',
        borderRadius: 10,
        padding: '8px 14px',
        textAlign: 'center',
      }}>
        <p style={{ fontSize: 12, color: '#4A5568', margin: 0, fontStyle: 'italic' }}>
          "Schau dir unser Produkt an!"
        </p>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        {groups.map((g, i) => (
          <div key={i} style={{
            flex: 1,
            background: '#111C26',
            borderRadius: 12,
            padding: '10px 4px',
            border: '1px solid rgba(255,255,255,0.04)',
            textAlign: 'center',
          }}>
            <span style={{ fontSize: 18 }}>{g.emoji}</span>
            <p style={{ fontSize: 10, color: '#2D3A47', margin: '4px 0 0', fontWeight: 600 }}>{g.label}</p>
            <p style={{ fontSize: 16, margin: '6px 0 0' }}>😐</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

const PROBLEMS = [
  {
    num: '01',
    accent: '#EF4444',
    title: 'Reichweite ohne Wirkung',
    text: 'Du postest, die Leute schauen. Aber niemand schreibt.',
  },
  {
    num: '02',
    accent: '#3B82F6',
    title: '"Schick mir mal was zu"',
    text: 'Jetzt schickst du einfach den Link. Die Seite erklärt alles.',
  },
  {
    num: '03',
    accent: '#A78BFA',
    title: 'Eine Botschaft für alle',
    text: 'Mütter, Sportler, Berufstätige. Jede Zielgruppe braucht ihre eigene Seite.',
  },
]

export default function ProblemSection() {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const cards = Array.from(el.querySelectorAll<HTMLElement>('.prob-card'))
    cards.forEach(c => { c.style.opacity = '0' })

    async function animate() {
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js')
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js')
      const gsap = (window as unknown as { gsap: unknown }).gsap as {
        registerPlugin: (p: unknown) => void
        fromTo: (el: Element, from: Record<string, unknown>, to: Record<string, unknown>) => void
      }
      const ScrollTrigger = (window as unknown as { ScrollTrigger: unknown }).ScrollTrigger
      if (!gsap) return
      gsap.registerPlugin(ScrollTrigger)
      cards.forEach((card, i) => {
        gsap.fromTo(
          card,
          { opacity: 0, y: 48, scale: 0.96 },
          {
            opacity: 1, y: 0, scale: 1,
            duration: 0.85,
            delay: i * 0.14,
            ease: 'power3.out',
            scrollTrigger: { trigger: el, start: 'top 78%', once: true },
          }
        )
      })
    }
    animate()
  }, [])

  const scenes = [<StatsScene key={0} />, <ChatScene key={1} />, <TargetScene key={2} />]

  return (
    <section style={{
      background: '#0F1A24',
      padding: 'clamp(64px, 8vw, 96px) clamp(20px, 5vw, 48px)',
    }}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 52 }}>
          <p style={{
            fontSize: 11, fontWeight: 700,
            color: 'rgba(255,255,255,0.18)',
            letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 18,
          }}>Das Problem</p>
          <h2 style={{
            fontFamily: '"Plein", sans-serif',
            fontSize: 'clamp(28px, 4vw, 46px)',
            fontWeight: 400, color: '#fff',
            letterSpacing: '-0.025em', lineHeight: 1.15,
            margin: 0,
          }}>
            Kommt dir das bekannt vor?
          </h2>
        </div>

        {/* Problem cards */}
        <div
          ref={containerRef}
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 14,
          }}
        >
          {PROBLEMS.map((p, i) => (
            <div
              key={i}
              className="prob-card"
              style={{
                background: '#1A2530',
                borderRadius: 22,
                padding: '24px',
                border: '1px solid rgba(255,255,255,0.055)',
                display: 'flex',
                flexDirection: 'column',
                gap: 22,
              }}
            >
              {/* Illustrated scene */}
              <div>{scenes[i]}</div>

              {/* Text */}
              <div>
                <p style={{
                  fontSize: 11, fontWeight: 700,
                  color: p.accent,
                  letterSpacing: '0.1em', textTransform: 'uppercase',
                  marginBottom: 8, opacity: 0.75,
                }}>{p.num}</p>
                <h3 style={{
                  fontSize: 17, fontWeight: 700, color: '#fff',
                  marginBottom: 8, letterSpacing: '-0.01em', lineHeight: 1.3,
                }}>{p.title}</h3>
                <p style={{
                  fontSize: 14, color: 'rgba(255,255,255,0.38)',
                  lineHeight: 1.6, margin: 0,
                }}>{p.text}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Bridge to solution */}
        <p style={{
          textAlign: 'center', fontSize: 15,
          color: 'rgba(255,255,255,0.2)',
          marginTop: 52, fontWeight: 500, letterSpacing: '-0.01em',
        }}>
          FinestSites löst genau das.
        </p>
      </div>
    </section>
  )
}
