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

const PROBLEMS = [
  {
    img: '/problem-reichweite.png',
    title: 'Du postest, alle schauen zu. Aber niemand meldet sich.',
    text: 'Reichweite allein bringt keine Kunden. Deine Webseite gibt Interessenten einen Grund, sich zu melden.',
  },
  {
    img: '/problem-schick.png',
    title: '"Schick mir mal was zu" \u2014 kein Problem.',
    text: 'Du schickst einfach den Link. Die Seite erklärt alles, du musst gar nichts mehr erklären.',
  },
  {
    img: '/problem-target.png',
    title: 'Mit einer Botschaft für alle erreichst du niemanden richtig.',
    text: 'Mütter, Sportler, Berufstätige. Jede Gruppe braucht ihre eigene Ansprache. Du hast für jede Zielgruppe eine eigene Seite.',
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
          { opacity: 0, y: 40, scale: 0.97 },
          {
            opacity: 1, y: 0, scale: 1,
            duration: 0.7,
            delay: i * 0.12,
            ease: 'power3.out',
            scrollTrigger: { trigger: el, start: 'top 78%', once: true },
          }
        )
      })
    }
    animate()
  }, [])

  return (
    <section style={{
      background: '#FAFAF8',
      padding: 'clamp(64px, 8vw, 96px) clamp(20px, 5vw, 48px)',
    }}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 52 }}>
          <p style={{
            fontSize: 11, fontWeight: 700,
            color: '#aaa',
            letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 18,
          }}>Das Problem</p>
          <h2 style={{
            fontFamily: '"Plein", sans-serif',
            fontSize: 'clamp(28px, 4vw, 46px)',
            fontWeight: 400, color: '#111',
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
            gap: 16,
          }}
        >
          {PROBLEMS.map((p, i) => (
            <div
              key={i}
              className="prob-card"
              style={{
                background: '#fff',
                borderRadius: 22,
                border: '1px solid #EBEBEB',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 2px 16px rgba(0,0,0,0.05)',
              }}
            >
              {/* Image */}
              <div style={{ height: 220, overflow: 'hidden' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.img}
                  alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top', display: 'block' }}
                />
              </div>

              {/* Text */}
              <div style={{ padding: '20px 22px 26px' }}>
                <h3 style={{
                  fontSize: 16, fontWeight: 700, color: '#111',
                  marginBottom: 8, letterSpacing: '-0.01em', lineHeight: 1.35,
                }}>{p.title}</h3>
                <p style={{
                  fontSize: 14, color: '#777',
                  lineHeight: 1.65, margin: 0,
                }}>{p.text}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Bridge to solution */}
        <p style={{
          textAlign: 'center', fontSize: 15,
          color: '#bbb',
          marginTop: 48, fontWeight: 500, letterSpacing: '-0.01em',
        }}>
          FinestSites löst genau das.
        </p>
      </div>
    </section>
  )
}
