'use client'

import { useState } from 'react'
import type { SerializedPromoCode } from './page'

interface CreateForm {
  code: string
  name: string
  discountType: 'percent' | 'fixed'
  amount: string
  plans: string[] // 'starter' | 'pro' | 'unlimited'
  duration: 'once' | 'forever' | 'repeating'
  durationMonths: string
  maxRedemptions: string
  expiresAt: string
  firstTimeOnly: boolean
}

const PLAN_OPTIONS = [
  { key: 'starter', label: 'Starter' },
  { key: 'pro', label: 'Pro' },
  { key: 'unlimited', label: 'Unlimited' },
]

const DURATION_LABELS: Record<string, string> = {
  once: 'Einmalig',
  forever: 'Dauerhaft',
  repeating: 'Wiederkehrend',
}

function formatDiscount(code: SerializedPromoCode): string {
  if (code.coupon.percent_off != null) return `${code.coupon.percent_off}%`
  if (code.coupon.amount_off != null) {
    return (code.coupon.amount_off / 100).toLocaleString('de-DE', { style: 'currency', currency: code.coupon.currency?.toUpperCase() ?? 'EUR' })
  }
  return '—'
}

function formatDuration(code: SerializedPromoCode): string {
  const d = code.coupon.duration
  if (d === 'once') return 'Einmalig'
  if (d === 'forever') return 'Dauerhaft'
  if (d === 'repeating' && code.coupon.duration_in_months) return `${code.coupon.duration_in_months} Monate`
  return d
}

function formatPlans(plans: string): string {
  if (!plans || plans === 'all') return 'Alle Tarife'
  return plans.split(',').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(', ')
}

function formatDate(ts: number | null): string {
  if (!ts) return '—'
  return new Date(ts * 1000).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const defaultForm: CreateForm = {
  code: '',
  name: '',
  discountType: 'percent',
  amount: '',
  plans: [],
  duration: 'once',
  durationMonths: '',
  maxRedemptions: '',
  expiresAt: '',
  firstTimeOnly: false,
}

export function CouponsClient({ initialCodes }: { initialCodes: SerializedPromoCode[] }) {
  const [codes, setCodes] = useState(initialCodes)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState<CreateForm>(defaultForm)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  async function handleToggle(id: string, currentActive: boolean) {
    setTogglingId(id)
    try {
      const res = await fetch(`/api/admin/coupons/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !currentActive }),
      })
      if (!res.ok) throw new Error('Fehler beim Aktualisieren')
      setCodes(prev => prev.map(c => c.id === id ? { ...c, active: !currentActive } : c))
    } catch {
      alert('Status konnte nicht geändert werden.')
    } finally {
      setTogglingId(null)
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreateError(null)
    if (!form.code.trim()) { setCreateError('Code ist erforderlich.'); return }
    if (!form.amount || Number(form.amount) <= 0) { setCreateError('Betrag muss größer als 0 sein.'); return }
    if (form.discountType === 'percent' && Number(form.amount) > 100) { setCreateError('Prozent darf maximal 100 sein.'); return }
    if (form.duration === 'repeating' && (!form.durationMonths || Number(form.durationMonths) < 1)) {
      setCreateError('Bitte Anzahl Monate angeben.'); return
    }

    setCreating(true)
    try {
      const res = await fetch('/api/admin/coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: form.code.trim().toUpperCase(),
          name: form.name.trim() || undefined,
          discountType: form.discountType,
          amount: Number(form.amount),
          plans: form.plans,
          duration: form.duration,
          durationMonths: form.durationMonths ? Number(form.durationMonths) : undefined,
          maxRedemptions: form.maxRedemptions ? Number(form.maxRedemptions) : undefined,
          expiresAt: form.expiresAt || undefined,
          firstTimeOnly: form.firstTimeOnly,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setCreateError(data.error ?? 'Fehler beim Erstellen.'); return }

      // Reload page data
      window.location.reload()
    } catch {
      setCreateError('Netzwerkfehler.')
    } finally {
      setCreating(false)
    }
  }

  function togglePlan(plan: string) {
    setForm(f => ({
      ...f,
      plans: f.plans.includes(plan) ? f.plans.filter(p => p !== plan) : [...f.plans, plan],
    }))
  }

  return (
    <div className="flex-1 p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Gutscheine</h1>
          <p className="text-sm text-gray-500 mt-1">Stripe Promotion Codes verwalten</p>
        </div>
        <button
          onClick={() => { setShowModal(true); setForm(defaultForm); setCreateError(null) }}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-[10px] transition-all hover:opacity-90"
          style={{ background: '#111' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Neuer Gutschein
        </button>
      </div>

      {/* Table */}
      <div style={{ border: '1px solid var(--border)', borderRadius: 16, background: '#fff', overflow: 'hidden' }}>
        {codes.length === 0 ? (
          <div className="py-16 text-center text-gray-400 text-sm">
            Noch keine Gutscheine angelegt.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: '#FAFAFA', borderBottom: '1px solid var(--border)' }}>
                <th className="text-left px-5 py-3 font-medium text-gray-500">Code</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500">Rabatt</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500">Tarife</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500">Dauer</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500">Eingelöst</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500">Gültig bis</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500">Neukunden</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {codes.map((pc, i) => (
                <tr key={pc.id} style={{ borderTop: i > 0 ? '1px solid var(--border)' : undefined }}>
                  <td className="px-5 py-3.5">
                    <span className="font-mono font-semibold text-gray-900">{pc.code}</span>
                    {pc.coupon.name && pc.coupon.name !== pc.code && (
                      <div className="text-xs text-gray-400 mt-0.5">{pc.coupon.name}</div>
                    )}
                  </td>
                  <td className="px-5 py-3.5 font-medium text-gray-900">{formatDiscount(pc)}</td>
                  <td className="px-5 py-3.5 text-gray-600">{formatPlans(pc.coupon.plans)}</td>
                  <td className="px-5 py-3.5 text-gray-600">{formatDuration(pc)}</td>
                  <td className="px-5 py-3.5 text-gray-600">
                    {pc.times_redeemed}{pc.max_redemptions ? ` / ${pc.max_redemptions}` : ''}
                  </td>
                  <td className="px-5 py-3.5 text-gray-600">{formatDate(pc.expires_at)}</td>
                  <td className="px-5 py-3.5">
                    {pc.first_time_only
                      ? <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">Ja</span>
                      : <span className="text-gray-400 text-xs">—</span>}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                      pc.active
                        ? 'bg-green-50 text-green-700'
                        : 'bg-gray-100 text-gray-500'
                    }`}>
                      {pc.active ? 'Aktiv' : 'Inaktiv'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <button
                      onClick={() => handleToggle(pc.id, pc.active)}
                      disabled={togglingId === pc.id}
                      className="text-xs px-3 py-1.5 rounded-[8px] font-medium transition-all disabled:opacity-50"
                      style={{
                        border: '1px solid var(--border)',
                        background: '#fff',
                        color: '#374151',
                      }}
                    >
                      {togglingId === pc.id ? '…' : pc.active ? 'Deaktivieren' : 'Aktivieren'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.4)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}
        >
          <div
            className="w-full max-w-lg max-h-[90vh] overflow-y-auto"
            style={{ background: '#fff', borderRadius: 20, padding: 32 }}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Neuer Gutschein</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <form onSubmit={handleCreate} className="flex flex-col gap-4">
              {/* Code */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Code *</label>
                <input
                  type="text"
                  value={form.code}
                  onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                  placeholder="z. B. SOMMER25"
                  className="w-full px-3 py-2 text-sm rounded-[10px] font-mono"
                  style={{ border: '1px solid var(--border)', outline: 'none' }}
                  required
                />
              </div>

              {/* Name (optional) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name <span className="text-gray-400 font-normal">(optional)</span></label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="z. B. Sommeraktion 2025"
                  className="w-full px-3 py-2 text-sm rounded-[10px]"
                  style={{ border: '1px solid var(--border)', outline: 'none' }}
                />
              </div>

              {/* Discount type + amount */}
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Rabatt-Typ *</label>
                  <select
                    value={form.discountType}
                    onChange={e => setForm(f => ({ ...f, discountType: e.target.value as any }))}
                    className="w-full px-3 py-2 text-sm rounded-[10px]"
                    style={{ border: '1px solid var(--border)', outline: 'none' }}
                  >
                    <option value="percent">Prozent (%)</option>
                    <option value="fixed">Festbetrag (€)</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Betrag * {form.discountType === 'percent' ? '(%)' : '(€)'}
                  </label>
                  <input
                    type="number"
                    value={form.amount}
                    onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                    placeholder={form.discountType === 'percent' ? '20' : '5.00'}
                    min="0.01"
                    step={form.discountType === 'percent' ? '1' : '0.01'}
                    max={form.discountType === 'percent' ? '100' : undefined}
                    className="w-full px-3 py-2 text-sm rounded-[10px]"
                    style={{ border: '1px solid var(--border)', outline: 'none' }}
                    required
                  />
                </div>
              </div>

              {/* Plans */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tarife <span className="text-gray-400 font-normal">(leer = alle)</span>
                </label>
                <div className="flex gap-2">
                  {PLAN_OPTIONS.map(p => (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => togglePlan(p.key)}
                      className="px-3 py-1.5 text-sm rounded-[8px] transition-all"
                      style={{
                        border: '1px solid',
                        borderColor: form.plans.includes(p.key) ? '#111' : 'var(--border)',
                        background: form.plans.includes(p.key) ? '#111' : '#fff',
                        color: form.plans.includes(p.key) ? '#fff' : '#374151',
                      }}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Duration */}
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Dauer *</label>
                  <select
                    value={form.duration}
                    onChange={e => setForm(f => ({ ...f, duration: e.target.value as any }))}
                    className="w-full px-3 py-2 text-sm rounded-[10px]"
                    style={{ border: '1px solid var(--border)', outline: 'none' }}
                  >
                    <option value="once">Einmalig (erste Rechnung)</option>
                    <option value="forever">Dauerhaft (immer)</option>
                    <option value="repeating">Wiederkehrend (X Monate)</option>
                  </select>
                </div>
                {form.duration === 'repeating' && (
                  <div className="w-28">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Monate *</label>
                    <input
                      type="number"
                      value={form.durationMonths}
                      onChange={e => setForm(f => ({ ...f, durationMonths: e.target.value }))}
                      placeholder="3"
                      min="1"
                      className="w-full px-3 py-2 text-sm rounded-[10px]"
                      style={{ border: '1px solid var(--border)', outline: 'none' }}
                    />
                  </div>
                )}
              </div>

              {/* Max redemptions + expiry */}
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Max. Einlösungen <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <input
                    type="number"
                    value={form.maxRedemptions}
                    onChange={e => setForm(f => ({ ...f, maxRedemptions: e.target.value }))}
                    placeholder="∞"
                    min="1"
                    className="w-full px-3 py-2 text-sm rounded-[10px]"
                    style={{ border: '1px solid var(--border)', outline: 'none' }}
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Gültig bis <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <input
                    type="date"
                    value={form.expiresAt}
                    onChange={e => setForm(f => ({ ...f, expiresAt: e.target.value }))}
                    className="w-full px-3 py-2 text-sm rounded-[10px]"
                    style={{ border: '1px solid var(--border)', outline: 'none' }}
                  />
                </div>
              </div>

              {/* First time only */}
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={form.firstTimeOnly}
                  onChange={e => setForm(f => ({ ...f, firstTimeOnly: e.target.checked }))}
                  className="w-4 h-4 rounded"
                />
                <span className="text-sm text-gray-700">Nur für Neukunden (kein aktives Abo)</span>
              </label>

              {createError && (
                <div className="text-sm text-red-600 px-3 py-2 rounded-[8px] bg-red-50">
                  {createError}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2.5 text-sm font-medium rounded-[10px] transition-all"
                  style={{ border: '1px solid var(--border)', background: '#fff', color: '#374151' }}
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-white rounded-[10px] transition-all disabled:opacity-50"
                  style={{ background: '#111' }}
                >
                  {creating ? 'Erstelle…' : 'Gutschein erstellen'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
