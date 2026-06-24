'use client'

import { useEffect, useRef } from 'react'

const CARDS = [
  { img: '/features/5min-live.png',            title: 'In unter 5 Minuten live',        desc: 'Template wählen, Inhalte einfügen, fertig. Kein Designer, kein Technik-Stress.' },
  { img: '/features/kein-design.png',          title: 'Keine Texte, kein Design',        desc: 'Jede Vorlage ist professionell getextet, optimiert und rechtlich geprüft.' },
  { img: '/features/templates-verbessert.png', title: 'Laufend verbessert',              desc: 'Neue Funktionen, bessere Conversion, aktuelles Design. Automatisch.' },
  { img: '/features/kein-hosting.png',         title: 'Kein Hosting, kein DSGVO-Stress', desc: 'Hosting, Sicherheit, Datenschutz, Impressum. Alles inklusive.' },
]

// Uneven bounce config per card: different start-y, rotation and delay
const BOUNCE = [
  { y: 80,  rot: -4,  delay: 0    },
  { y: 110, rot:  3,  delay: 0.22 },
  { y: 60,  rot:  2,  delay: 0.10 },
  { y: 95,  rot: -3,  delay: 0.32 },
]

function loadScript(src: string): Promise<void> {
  return new Promise((resolve) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return }
    const s = document.createElement('script')
    s.src = src
    s.onload = () => resolve()
    document.head.appendChild(s)
  })
}

export default function FeatureCardsAnimated() {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const cards = Array.from(el.querySelectorAll<HTMLElement>('.fs-feature-card'))

    // Hide cards immediately (before GSAP loads)
    cards.forEach((c) => { c.style.opacity = '0' })

    async function animate() {
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js')
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js')

      const gsap = (window as any).gsap
      const ScrollTrigger = (window as any).ScrollTrigger
      if (!gsap) return

      gsap.registerPlugin(ScrollTrigger)

      cards.forEach((card, i) => {
        const b = BOUNCE[i]
        gsap.fromTo(
          card,
          { opacity: 0, y: b.y, rotation: b.rot, scale: 0.82 },
          {
            opacity: 1, y: 0, rotation: 0, scale: 1,
            duration: 1.05,
            delay: b.delay,
            ease: 'back.out(2.2)',
            scrollTrigger: {
              trigger: el,
              start: 'top 80%',
              once: true,
            },
          }
        )
      })
    }

    animate()
  }, [])

  return (
    <div ref={containerRef} className="fs-feature-grid">
      {CARDS.map((item, i) => (
        <div
          key={i}
          className="fs-feature-card"
          style={{
            background: '#F5F0FB',
            border: '1px solid #D4C5E2',
            borderRadius: 20,
            padding: '24px 16px 20px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            gap: 14,
          }}
        >
          <img
            src={item.img}
            alt=""
            style={{ width: 160, height: 160, objectFit: 'contain', display: 'block' }}
          />
          <div>
            <h4 style={{ fontSize: 14, fontWeight: 600, color: '#111', marginBottom: 6, lineHeight: 1.3 }}>{item.title}</h4>
            <p style={{ fontSize: 13, color: '#777', lineHeight: 1.6 }}>{item.desc}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
