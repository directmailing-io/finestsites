'use client'

import { useId, useState } from 'react'
import {
  validateTaxProfile, TAX_CONSENT_TEXT, ENTREPRENEUR_CONFIRMATION_TEXT,
  type TaxStatus,
} from '@/lib/affiliate/tax'

export interface TaxProfileData {
  tax_status: TaxStatus
  full_name: string
  street: string
  zip: string
  city: string
  country: string
  tax_id: string
  entrepreneur_confirmed: boolean
  consent_at: string | null
  updated_at: string
}

export interface CreditNoteItem {
  id: string
  number: string
  date: string
  amount_cents: number
  ready: boolean
}

function euros(cents: number) {
  return (cents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const STATUS_OPTIONS: { key: TaxStatus; title: string; desc: string }[] = [
  {
    key: 'kleinunternehmer',
    title: 'Kleinunternehmer',
    desc: 'Du weist auf deinen Rechnungen keine Umsatzsteuer aus (§ 19 UStG).',
  },
  {
    key: 'regelbesteuert',
    title: 'Mit Umsatzsteuer',
    desc: 'Du berechnest Umsatzsteuer. Wir zahlen dir 19 % Umsatzsteuer zusätzlich aus.',
  },
]

/** Hinweis oben auf der Seite, solange Angaben fehlen. */
export function TaxProfileNotice() {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3.5 rounded-2xl mb-6"
      style={{ background: '#FFFBEB', border: '1px solid #FDE68A' }}>
      <p className="flex-1 text-sm font-medium" style={{ color: '#92400E' }}>
        Damit wir dir deine Provision auszahlen können, brauchen wir noch kurz deine Angaben für die Abrechnung.
      </p>
      <a href="#abrechnung"
        className="inline-flex items-center justify-center min-h-[44px] px-5 py-2 rounded-xl text-sm font-bold flex-shrink-0"
        style={{ background: '#1a1a1a', color: '#fff' }}>
        Jetzt ausfüllen
      </a>
    </div>
  )
}

export function TaxProfileSection({ profile, onSaved }: {
  profile: TaxProfileData | null
  onSaved: (p: TaxProfileData, complete: boolean) => void
}) {
  const [status, setStatus] = useState<TaxStatus | null>(profile?.tax_status ?? null)
  const [fullName, setFullName] = useState(profile?.full_name ?? '')
  const [street, setStreet] = useState(profile?.street ?? '')
  const [zip, setZip] = useState(profile?.zip ?? '')
  const [city, setCity] = useState(profile?.city ?? '')
  const [taxId, setTaxId] = useState(profile?.tax_id ?? '')
  const [entrepreneur, setEntrepreneur] = useState(false)
  const [consent, setConsent] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [editing, setEditing] = useState(!profile)

  async function save() {
    setMsg(null)
    const errs = validateTaxProfile({ taxStatus: status, fullName, street, zip, city, taxId })
    if (!status && !taxId.trim()) errs.taxId = 'Bitte gib deine Steuernummer oder USt-IdNr. ein.'
    if (!entrepreneur) errs.entrepreneurConfirmed = 'Bitte bestätige, dass du als Unternehmer handelst.'
    if (!consent) errs.consent = 'Bitte setze den Haken beim Einverständnis.'
    setErrors(errs)
    if (Object.keys(errs).length > 0) {
      setMsg({ type: 'error', text: 'Bitte schau dir die rot markierten Felder nochmal an.' })
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/affiliate/tax-profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tax_status: status, full_name: fullName, street, zip, city, tax_id: taxId,
          entrepreneur_confirmed: entrepreneur, consent,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErrors(data.errors ?? {})
        setMsg({ type: 'error', text: data.error ?? 'Speichern hat nicht geklappt. Versuch es bitte nochmal.' })
        return
      }
      onSaved(data.profile, data.complete)
      setMsg({ type: 'success', text: 'Gespeichert. Deine Angaben gelten ab der nächsten Auszahlung.' })
      setEditing(false)
      setEntrepreneur(false)
      setConsent(false)
    } catch {
      setMsg({ type: 'error', text: 'Keine Verbindung. Versuch es bitte gleich nochmal.' })
    } finally {
      setSaving(false)
    }
  }

  // ── Kurzansicht, wenn alles da ist ──────────────────────────────────────────
  if (profile && !editing) {
    const label = STATUS_OPTIONS.find(o => o.key === profile.tax_status)?.title ?? profile.tax_status
    return (
      <section id="abrechnung" className="rounded-3xl p-6 mb-5 scroll-mt-6" style={{ background: '#fff', border: '1.5px solid #E5E7EB' }}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: '#94A3B8' }}>Deine Angaben für die Abrechnung</p>
            <p className="text-sm font-bold text-gray-900">{profile.full_name}</p>
            <p className="text-sm text-gray-600">{profile.street}, {profile.zip} {profile.city}</p>
            <p className="text-sm text-gray-600 mt-1">{label} · {profile.tax_id}</p>
            {profile.consent_at && (
              <p className="text-xs mt-2" style={{ color: '#64748B' }}>Einverständnis zur Gutschrift am {fmtDate(profile.consent_at)}</p>
            )}
          </div>
          <button onClick={() => { setEditing(true); setMsg(null) }}
            className="min-h-[44px] text-sm font-semibold px-4 py-2 rounded-xl flex-shrink-0 transition-opacity hover:opacity-80"
            style={{ background: '#F3F4F6', color: '#374151' }}>
            Ändern
          </button>
        </div>
        {msg && <p className="text-sm mt-4 px-4 py-3 rounded-2xl" style={msgStyle(msg.type)}>{msg.text}</p>}
      </section>
    )
  }

  // ── Formular ────────────────────────────────────────────────────────────────
  return (
    <section id="abrechnung" className="rounded-3xl p-6 mb-5 scroll-mt-6" style={{ background: '#fff', border: '1.5px solid #E5E7EB' }}>
      <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#94A3B8' }}>Deine Angaben für die Abrechnung</p>
      <p className="text-sm text-gray-600 leading-relaxed mb-5">
        Für jede Auszahlung bekommst du von uns eine Gutschrift. Das ist wie eine Rechnung, die wir für dich schreiben. Du musst also selbst keine Rechnung stellen.
      </p>

      <p className="text-sm font-semibold text-gray-700 mb-2">Was trifft auf dich zu?</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-1">
        {STATUS_OPTIONS.map(o => {
          const active = status === o.key
          return (
            <button key={o.key} type="button" onClick={() => setStatus(o.key)} aria-pressed={active}
              className="text-left rounded-2xl p-4 transition-all"
              style={{ background: active ? '#F8FAFC' : '#fff', border: active ? '2px solid #1a1a1a' : '1.5px solid #E5E7EB', margin: active ? 0 : '0.5px' }}>
              <span className="flex items-center gap-2 mb-1">
                <span className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ border: active ? '5px solid #1a1a1a' : '1.5px solid #D1D5DB' }} />
                <span className="text-sm font-bold text-gray-900">{o.title}</span>
              </span>
              <span className="block text-xs text-gray-500 leading-relaxed pl-6">{o.desc}</span>
            </button>
          )
        })}
      </div>
      <FieldError text={errors.taxStatus} />

      <div className="grid grid-cols-1 gap-4 mt-4">
        <TextField label="Vollständiger Name oder Firmenname" value={fullName} onChange={setFullName} placeholder="z. B. Maria Muster" error={errors.fullName} autoComplete="name" />
        <TextField label="Straße und Hausnummer" value={street} onChange={setStreet} placeholder="z. B. Hauptstraße 12" error={errors.street} autoComplete="street-address" />
        <div className="grid grid-cols-[110px_1fr] gap-3">
          <TextField label="PLZ" value={zip} onChange={v => setZip(v.replace(/\D/g, '').slice(0, 5))} placeholder="97437" error={errors.zip} inputMode="numeric" autoComplete="postal-code" />
          <TextField label="Ort" value={city} onChange={setCity} placeholder="z. B. Haßfurt" error={errors.city} autoComplete="address-level2" />
        </div>
        <div className="flex flex-col gap-1.5">
          <p className="text-sm font-semibold text-gray-700">Land</p>
          <div className="w-full px-4 py-3 text-[15px] rounded-2xl" style={{ background: '#F8FAFC', border: '1.5px solid #E5E7EB', color: '#6B7280' }}>Deutschland</div>
        </div>
        <TextField label="Steuernummer oder USt-IdNr." value={taxId} onChange={setTaxId} placeholder="z. B. 123/456/78901" error={errors.taxId}
          hint="Steuernummer (z. B. 123/456/78901) oder USt-IdNr. (z. B. DE123456789). Steht auf deinem Steuerbescheid oder in Briefen vom Finanzamt." />
      </div>

      <div className="mt-5 space-y-3">
        <CheckRow checked={entrepreneur} onChange={setEntrepreneur} error={errors.entrepreneurConfirmed}>
          {ENTREPRENEUR_CONFIRMATION_TEXT}
        </CheckRow>
        <CheckRow checked={consent} onChange={setConsent} error={errors.consent}>
          {TAX_CONSENT_TEXT}
        </CheckRow>
      </div>

      <p className="text-xs mt-4 leading-relaxed" style={{ color: '#64748B' }}>
        Änderungen gelten ab der nächsten Auszahlung. Bereits erstellte Gutschriften bleiben, wie sie sind. Stimmt etwas an einer Gutschrift nicht, sag uns bitte innerhalb von 4 Wochen Bescheid.
      </p>

      {msg && <p className="text-sm mt-4 px-4 py-3 rounded-2xl" style={msgStyle(msg.type)}>{msg.text}</p>}

      <div className="flex flex-col sm:flex-row gap-2.5 mt-5">
        <button onClick={save} disabled={saving}
          className="flex-1 sm:flex-none flex items-center justify-center min-h-[48px] px-6 py-3 rounded-2xl text-sm font-bold transition-opacity hover:opacity-90"
          style={{ background: saving ? '#E5E7EB' : '#1a1a1a', color: saving ? '#9CA3AF' : '#fff', cursor: saving ? 'wait' : 'pointer' }}>
          {saving ? 'Wird gespeichert…' : 'Speichern'}
        </button>
        {profile && (
          <button onClick={() => { setEditing(false); setErrors({}); setMsg(null) }}
            className="flex-1 sm:flex-none min-h-[48px] px-6 py-3 rounded-2xl text-sm font-semibold"
            style={{ background: '#F3F4F6', color: '#374151' }}>
            Abbrechen
          </button>
        )}
      </div>
    </section>
  )
}

export function CreditNotesSection({ items }: { items: CreditNoteItem[] }) {
  if (items.length === 0) return null
  return (
    <section className="rounded-3xl p-6 mb-5" style={{ background: '#fff', border: '1.5px solid #E5E7EB' }}>
      <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: '#94A3B8' }}>Deine Gutschriften</p>
      <div className="space-y-1">
        {items.map(n => (
          <div key={n.id} className="flex items-center gap-3 px-3 py-2.5 rounded-2xl hover:bg-gray-50">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-800 whitespace-nowrap">{n.number}</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {fmtDate(n.date)}<span className="sm:hidden"> · <span className="font-bold tabular-nums text-gray-900">{euros(n.amount_cents)}</span></span>
              </p>
            </div>
            <p className="hidden sm:block text-sm font-bold tabular-nums text-gray-900">{euros(n.amount_cents)}</p>
            <a href={`/api/affiliate/credit-notes/${n.id}?download=1`}
              className="inline-flex items-center min-h-[44px] text-sm font-semibold px-3.5 rounded-xl flex-shrink-0 transition-opacity hover:opacity-80"
              style={{ background: '#F3F4F6', color: '#374151' }}>
              Herunterladen
            </a>
          </div>
        ))}
      </div>
      <p className="text-xs mt-3 px-3 leading-relaxed" style={{ color: '#64748B' }}>
        Bitte prüfe jede Gutschrift. Stimmt etwas nicht, schreib uns innerhalb von 4 Wochen an hello@finestsites.io.
      </p>
    </section>
  )
}

// ── Kleine Bausteine ──────────────────────────────────────────────────────────

function msgStyle(type: 'success' | 'error'): React.CSSProperties {
  return type === 'success'
    ? { background: '#F0FDF4', border: '1px solid #BBF7D0', color: '#15803D' }
    : { background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B' }
}

function FieldError({ text }: { text?: string }) {
  if (!text) return null
  return <p className="text-xs px-1 mt-1" style={{ color: '#DC2626' }}>{text}</p>
}

function TextField({ label, value, onChange, placeholder, error, hint, inputMode, autoComplete }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; error?: string; hint?: string
  inputMode?: 'numeric' | 'text'; autoComplete?: string
}) {
  const id = useId()
  const border = error ? '#FCA5A5' : '#E5E7EB'
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold text-gray-700">{label}</label>
      <input
        id={id} aria-describedby={hint && !error ? `${id}-hint` : undefined}
        type="text" value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} inputMode={inputMode} autoComplete={autoComplete}
        className="w-full px-4 py-3 text-[15px] rounded-2xl outline-none transition-all bg-white"
        style={{ border: `1.5px solid ${border}` }}
        onFocus={e => (e.target.style.borderColor = '#1a1a1a')}
        onBlur={e => (e.target.style.borderColor = border)}
        aria-invalid={!!error}
      />
      {error ? <FieldError text={error} /> : hint && <p id={`${id}-hint`} className="text-xs px-1 leading-relaxed" style={{ color: '#64748B' }}>{hint}</p>}
    </div>
  )
}

function CheckRow({ checked, onChange, error, children }: {
  checked: boolean; onChange: (v: boolean) => void; error?: string; children: React.ReactNode
}) {
  return (
    <div>
      <label className="flex items-start gap-3 cursor-pointer rounded-2xl p-3.5"
        style={{ background: '#F8FAFC', border: `1.5px solid ${error ? '#FCA5A5' : '#F1F5F9'}` }}>
        <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)}
          className="mt-0.5 w-5 h-5 flex-shrink-0 accent-black cursor-pointer" />
        <span className="text-sm text-gray-700 leading-relaxed">{children}</span>
      </label>
      <FieldError text={error} />
    </div>
  )
}
