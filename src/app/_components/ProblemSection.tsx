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
    line1: 'Du postest täglich.',
    line2: 'Aber keiner schreibt dir.',
    text: 'Dir schauen genug Leute zu. Schick sie auf deine Webseite. Die erklärt alles, und die Leute melden sich dann ganz von selbst.',
  },
  {
    img: '/problem-schick.png',
    line1: '"Schick mal was zu."',
    line2: 'Und du tippst dir die Finger wund.',
    text: 'Schick einfach den Link. Die Webseite erklärt alles. So, dass die Interessenten unbedingt mit dir sprechen wollen.',
  },
  {
    img: '/problem-target.png',
    line1: 'Du willst alle ansprechen.',
    line2: 'Keiner fühlt sich gemeint.',
    text: 'Mütter, Sportler, Berufstätige. Du bekommst für jede Zielgruppe eine eigene, überzeugende Seite.',
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

        <div style={{ textAlign: 'center', marginBottom: 52 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#aaa', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 18 }}>Das Problem</p>
          <h2 style={{
            fontFamily: '"Plein", sans-serif',
            fontSize: 'clamp(28px, 4vw, 46px)',
            fontWeight: 400, color: '#111',
            letterSpacing: '-0.025em', lineHeight: 1.15, margin: 0,
          }}>
            Kommt dir das bekannt vor?
          </h2>
        </div>

        <div
          ref={containerRef}
          className="fs-prob-grid"
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
              <div style={{ height: 200, overflow: 'hidden', flexShrink: 0 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.img}
                  alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top', display: 'block' }}
                />
              </div>

              {/* Red problem banner */}
              <div style={{
                background: '#C0392B',
                padding: '14px 20px',
              }}>
                <p style={{
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: 15,
                  lineHeight: 1.4,
                  margin: 0,
                  letterSpacing: '-0.01em',
                }}>
                  {p.line1}<br />{p.line2}
                </p>
              </div>

              {/* Explanation */}
              <div style={{ padding: '16px 20px 22px', flex: 1 }}>
                <p style={{ fontSize: 14, color: '#666', lineHeight: 1.65, margin: 0 }}>{p.text}</p>
              </div>
            </div>
          ))}
        </div>

        <p style={{ textAlign: 'center', fontSize: 15, color: '#bbb', marginTop: 48, fontWeight: 500, letterSpacing: '-0.01em' }}>
          FinestSites löst genau das.
        </p>
      </div>
    </section>
  )
}
