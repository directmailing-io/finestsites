'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CONSENT_TEXTS, CONSENT_CURRENT_VERSION } from '@/lib/constants/consent'

const RULES = [
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
      </svg>
    ),
    title: 'Fotos und Bilder',
    text: 'Alle Bilder, die ich hochlade, darf ich verwenden. Ich habe die Rechte daran oder eine Erlaubnis des Inhabers.',
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 12l2 2 4-4"/><path d="M21 12c0 4.97-4.03 9-9 9S3 16.97 3 12 7.03 3 12 3s9 4.03 9 9z"/>
      </svg>
    ),
    title: 'Keine Heilsaussagen',
    text: 'Ich behaupte nicht, dass Produkte Krankheiten heilen, lindern oder verhindern. Das ist in Deutschland gesetzlich verboten (Heilmittelwerbegesetz).',
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
      </svg>
    ),
    title: 'Wahrheitsgemäße Texte',
    text: 'Alle Texte auf meiner Website sind korrekt und verstoßen nicht gegen geltende Gesetze.',
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
    ),
    title: 'Eigene Verantwortung',
    text: 'Ich übernehme die Verantwortung für meine Inhalte. FinestSites prüft Inhalte nach bestem Wissen, kann das aber nicht vollständig garantieren.',
  },
]

export default function ConsentPage() {
  const router = useRouter()
  const [checked, setChecked] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showFull, setShowFull] = useState(false)

  async function handleConfirm() {
    if (!checked) return
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/auth/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consent: true, version: CONSENT_CURRENT_VERSION }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string }
        setError(data.error ?? 'Ein Fehler ist aufgetreten. Bitte versuche es erneut.')
        setLoading(false)
        return
      }
      // Use hard navigation so middleware re-reads the fresh session from DB
      window.location.href = '/sites'
    } catch {
      setError('Ein Fehler ist aufgetreten. Bitte versuche es erneut.')
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-lg flex flex-col gap-6">

      {/* Header */}
      <div className="text-center flex flex-col items-center gap-4">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
          style={{ background: '#F0FDF4', border: '1px solid #DCFCE7' }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#15803D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            <polyline points="9 12 11 14 15 10"/>
          </svg>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Kurze Bestätigung</h1>
          <p className="mt-2 text-sm leading-relaxed" style={{ color: '#6B7280', maxWidth: 380, margin: '8px auto 0' }}>
            Bevor du loslegst, brauchen wir deine Bestätigung zu einem wichtigen Punkt.
            Das ist nur einmal nötig und dauert eine Minute.
          </p>
        </div>
      </div>

      {/* Rules */}
      <div className="bg-white rounded-[24px] flex flex-col divide-y"
        style={{ border: '1.5px solid #E5E7EB' }}>
        {RULES.map((rule, i) => (
          <div key={i} className="flex items-start gap-4 px-5 py-4">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
              style={{ background: '#F9FAFB', color: '#374151' }}>
              {rule.icon}
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">{rule.title}</p>
              <p className="text-sm mt-0.5 leading-snug" style={{ color: '#6B7280' }}>{rule.text}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Full legal text (collapsible) */}
      <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #E5E7EB' }}>
        <button
          type="button"
          onClick={() => setShowFull(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-left transition-colors"
          style={{ background: '#F9FAFB', color: '#374151' }}>
          <span className="flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
            </svg>
            Vollständigen Text lesen
          </span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            style={{ transform: showFull ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
            <path d="M6 9l6 6 6-6"/>
          </svg>
        </button>
        {showFull && (
          <pre className="px-4 py-4 text-xs leading-relaxed whitespace-pre-wrap"
            style={{ color: '#6B7280', fontFamily: 'inherit', background: '#fff', borderTop: '1px solid #F3F4F6' }}>
            {CONSENT_TEXTS[CONSENT_CURRENT_VERSION]}
          </pre>
        )}
      </div>

      {/* Checkbox + Submit */}
      <div className="bg-white rounded-[24px] px-5 py-5 flex flex-col gap-4"
        style={{ border: '1.5px solid #E5E7EB' }}>
        <label className="flex items-start gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={checked}
            onChange={e => setChecked(e.target.checked)}
            className="mt-0.5 flex-shrink-0 w-5 h-5 rounded cursor-pointer"
            style={{ accentColor: '#111827' }}
          />
          <span className="text-sm leading-snug" style={{ color: '#374151' }}>
            Ja, ich habe die vier Punkte oben gelesen und bestätige sie. Ich verstehe, dass ich die Verantwortung für meine Inhalte trage.
          </span>
        </label>

        {error && (
          <p className="text-sm px-4 py-2.5 rounded-xl" style={{ background: '#FEF2F2', color: '#DC2626' }}>{error}</p>
        )}

        <button
          onClick={handleConfirm}
          disabled={!checked || loading}
          className="w-full py-3.5 rounded-2xl text-sm font-bold text-white transition-all flex items-center justify-center gap-2"
          style={{
            background: checked && !loading ? '#111827' : '#D1D5DB',
            cursor: checked && !loading ? 'pointer' : 'not-allowed',
          }}>
          {loading && <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />}
          {loading ? 'Wird gespeichert…' : 'Bestätigen und loslegen'}
        </button>

        <p className="text-center text-xs" style={{ color: '#9CA3AF' }}>
          Diese Bestätigung wird mit Datum und deiner IP-Adresse gespeichert.
          Version {CONSENT_CURRENT_VERSION}.
        </p>
      </div>
    </div>
  )
}
