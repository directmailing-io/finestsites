'use client'

import { useEffect, useState } from 'react'

/**
 * Freiwillige Rechnungsangaben (Firma + USt-IdNr.) für künftige Rechnungen.
 * Erscheint nur, wenn es bereits ein Stripe-Kundenkonto gibt.
 */
export default function InvoiceDetailsCard() {
  const [available, setAvailable] = useState(false)
  const [company, setCompany] = useState('')
  const [vatId, setVatId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch('/api/billing/invoice-details')
      .then(r => r.json())
      .then(d => {
        if (!d?.available) return
        setAvailable(true)
        setCompany(d.company ?? '')
        setVatId(d.vatId ?? '')
      })
      .catch(() => {})
  }, [])

  if (!available) return null

  async function handleSave() {
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const res = await fetch('/api/billing/invoice-details', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company, vatId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'Speichern hat nicht geklappt. Bitte versuche es noch einmal.')
        return
      }
      setCompany(data.company ?? '')
      setVatId(data.vatId ?? '')
      setSaved(true)
    } catch {
      setError('Speichern hat nicht geklappt. Bitte versuche es noch einmal.')
    } finally {
      setSaving(false)
    }
  }

  const inputClass = 'w-full px-4 py-3 text-[15px] rounded-2xl outline-none transition-all bg-white'

  return (
    <div className="rounded-3xl p-5 sm:p-7 flex flex-col gap-4" style={{ background: '#F8FAFC' }}>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="invoice-company" className="text-sm font-semibold text-gray-700">Firmenname</label>
        <input
          id="invoice-company"
          type="text"
          value={company}
          maxLength={140}
          onChange={e => { setCompany(e.target.value); setSaved(false) }}
          placeholder="z. B. Müller Vertrieb"
          autoComplete="organization"
          className={inputClass}
          style={{ border: '1.5px solid #E5E7EB' }}
          onFocus={e => (e.target.style.borderColor = '#1a1a1a')}
          onBlur={e => (e.target.style.borderColor = '#E5E7EB')}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="invoice-vat" className="text-sm font-semibold text-gray-700">
          USt-IdNr. <span className="font-normal" style={{ color: '#94A3B8' }}>(nur falls vorhanden)</span>
        </label>
        <input
          id="invoice-vat"
          type="text"
          value={vatId}
          maxLength={20}
          onChange={e => { setVatId(e.target.value); setSaved(false); setError(null) }}
          placeholder="DE123456789"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          className={inputClass}
          style={{ border: `1.5px solid ${error ? '#DC2626' : '#E5E7EB'}` }}
          onFocus={e => { if (!error) e.target.style.borderColor = '#1a1a1a' }}
          onBlur={e => { if (!error) e.target.style.borderColor = '#E5E7EB' }}
        />
        <p className="text-[13px] px-1" style={{ color: '#64748B' }}>
          Beginnt mit <strong>DE</strong>. Nicht deine Steuernummer.
        </p>
      </div>

      {error && (
        <p role="alert" className="text-sm font-medium rounded-2xl px-4 py-3" style={{ background: '#FEF2F2', color: '#B91C1C' }}>
          {error}
        </p>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="text-[15px] font-semibold px-6 py-3 rounded-2xl transition-opacity disabled:opacity-60"
          style={{ background: '#1a1a1a', color: '#fff' }}>
          {saving ? 'Wird gespeichert …' : 'Speichern'}
        </button>
        {saved && (
          <span role="status" className="text-sm font-semibold" style={{ color: '#15803D' }}>
            Gespeichert. Steht ab der nächsten Rechnung drauf.
          </span>
        )}
      </div>
    </div>
  )
}
