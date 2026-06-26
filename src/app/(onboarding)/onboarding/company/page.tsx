'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { NM_COMPANIES } from '@/lib/constants/nm-companies'

function StepDot({ n, active, done, label }: { n: number; active?: boolean; done?: boolean; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold"
        style={{
          background: done ? '#111827' : active ? '#111827' : '#E5E7EB',
          color: done || active ? '#fff' : '#9CA3AF',
        }}
      >
        {done ? (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2.5 7L5.5 10L11.5 4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        ) : n}
      </div>
      <span className="text-[10px] font-medium hidden sm:block" style={{ color: active ? '#111827' : '#9CA3AF' }}>{label}</span>
    </div>
  )
}

function StepLine() {
  return <div className="flex-1 h-px mx-1" style={{ background: '#E5E7EB', maxWidth: 40 }} />
}

export default function OnboardingCompanyPage() {
  const router = useRouter()
  const [selected, setSelected] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  function toggle(company: string) {
    setSelected(prev =>
      prev.includes(company) ? prev.filter(c => c !== company) : [...prev, company]
    )
  }

  async function handleSave() {
    setLoading(true)
    await fetch('/api/onboarding/set-company', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nm_companies: selected }),
    }).catch(() => {})
    router.push('/onboarding/profile')
  }

  return (
    <div className="w-full max-w-md">
      {/* Step indicator */}
      <div className="flex items-center justify-center gap-1 mb-10">
        <StepDot n={1} done label="Account" />
        <StepLine />
        <StepDot n={2} done label="Plan" />
        <StepLine />
        <StepDot n={3} done label="Username" />
        <StepLine />
        <StepDot n={4} active label="Unternehmen" />
        <StepLine />
        <StepDot n={5} label="Profil" />
      </div>

      <div className="text-center mb-8">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-5"
          style={{ background: '#F5F0FB' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#8060b0" strokeWidth="1.5">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
        </div>
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">Für welches Unternehmen?</h1>
        <p className="text-sm leading-relaxed" style={{ color: '#6B7280' }}>
          Wähle dein Network-Marketing-Unternehmen aus. Wir zeigen dir dann die passenden Templates — du kannst auch mehrere wählen.
        </p>
      </div>

      <div className="flex flex-wrap gap-2.5 justify-center mb-6">
        {NM_COMPANIES.map(company => {
          const isActive = selected.includes(company)
          return (
            <button
              key={company}
              type="button"
              onClick={() => toggle(company)}
              className="px-4 py-2.5 rounded-2xl text-sm font-semibold transition-all"
              style={{
                background: isActive ? '#111827' : '#fff',
                color: isActive ? '#fff' : '#374151',
                border: isActive ? '1.5px solid #111827' : '1.5px solid #E5E7EB',
                boxShadow: isActive ? '0 4px 12px rgba(17,24,39,0.2)' : '0 1px 4px rgba(0,0,0,0.04)',
              }}
            >
              {company}
            </button>
          )
        })}
      </div>

      {selected.length > 0 && (
        <p className="text-center text-xs mb-6" style={{ color: '#9CA3AF' }}>
          {selected.length} ausgewählt · Du kannst das später in den Einstellungen ändern.
        </p>
      )}

      <div className="flex flex-col gap-3 mt-4">
        <button
          onClick={handleSave}
          disabled={loading}
          className="w-full py-3 text-sm font-semibold rounded-2xl transition-all"
          style={{
            background: loading ? '#E5E7EB' : '#111827',
            color: loading ? '#9CA3AF' : '#fff',
            cursor: loading ? 'not-allowed' : 'pointer',
            boxShadow: loading ? 'none' : '0 4px 14px rgba(17,24,39,0.2)',
          }}
        >
          {loading ? 'Wird gespeichert…' : selected.length > 0 ? 'Weiter →' : 'Überspringen →'}
        </button>
      </div>
    </div>
  )
}
