'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

const STORAGE_KEY = 'fs_onboarding_dismissed'

const steps = [
  {
    num: '01',
    title: 'Vorlage wählen',
    desc: 'Such dir eine fertige Webseiten-Vorlage aus der Bibliothek. Für jede Branche.',
  },
  {
    num: '02',
    title: 'Personalisieren',
    desc: 'Trag deine Texte, Bilder und Kontaktdaten ein. Kein Code, keine Vorkenntnisse nötig.',
  },
  {
    num: '03',
    title: 'Veröffentlichen',
    desc: 'Einen Klick und deine Seite ist sofort online. Teile sie und gewinne neue Kunden.',
  },
]

export default function OnboardingBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const id = setTimeout(() => {
      if (!localStorage.getItem(STORAGE_KEY)) setVisible(true)
    }, 0)
    return () => clearTimeout(id)
  }, [])

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, '1')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="relative rounded-[20px] mb-6 overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #FFF8F3 0%, #FFF0E6 100%)',
        border: '1px solid #F5D9C8',
      }}>

      {/* Dismiss */}
      <button onClick={dismiss} aria-label="Ausblenden"
        className="absolute top-3.5 right-3.5 w-6 h-6 rounded-full flex items-center justify-center"
        style={{ background: 'rgba(180,100,60,0.1)', color: '#B4643C' }}>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M18 6 6 18M6 6l12 12"/>
        </svg>
      </button>

      <div className="p-5 pr-10">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#C07050' }}>
            So funktioniert FinestSites
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          {steps.map((step, i) => (
            <div key={i} className="flex gap-3">
              <span className="text-xl font-black flex-shrink-0 leading-none mt-0.5"
                style={{ color: '#F0C4A8' }}>
                {step.num}
              </span>
              <div>
                <p className="text-sm font-semibold mb-0.5" style={{ color: '#5C3020' }}>{step.title}</p>
                <p className="text-xs leading-relaxed" style={{ color: '#9A6050' }}>{step.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-4">
          <Link href="/sites/library"
            className="text-sm font-semibold px-4 py-2 rounded-[12px] text-white"
            style={{ background: '#C07050' }}>
            Zur Webseiten-Bibliothek →
          </Link>
          <button onClick={dismiss} className="text-xs font-medium" style={{ color: '#C07050', opacity: 0.7 }}>
            Nicht mehr anzeigen
          </button>
        </div>
      </div>
    </div>
  )
}
