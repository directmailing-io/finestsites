'use client'

import React, { useState, useEffect, useCallback, useRef, use } from 'react'
import { useRouter } from 'next/navigation'
import ImageCropModal from '@/components/ImageCropModal'
import { RichTextField } from '@/components/editor/RichTextField'
import { usePlanQuota } from '@/components/dashboard/PlanQuotaContext'

// ─── Types ────────────────────────────────────────────────────────────────────

interface CardOption {
  value: string; label: string; description: string
  card_type: 'text' | 'image' | 'color'; image_url: string; color: string
  icon?: string
}

interface LoopSubField {
  key: string; label: string
  type: 'text' | 'textarea' | 'richtext' | 'image' | 'url' | 'email' | 'dropdown' | 'loop' | 'color' | 'date' | 'time' | 'card_select' | 'toggle' | 'date_multi' | 'range'
  required?: boolean; placeholder_text?: string
  max_length?: number | null; default_value?: string
  aspect_ratio?: string; options?: string[]
  card_options?: CardOption[]
  display_mode?: 'chips' | 'toggle'
  toggle_on_value?: string
  toggle_off_value?: string
  show_when?: { field: string; value: string | string[] }
  // for range:
  min?: number
  max?: number
  step?: number
  unit?: string
  // for nested loop:
  sub_fields?: LoopSubField[]
  min_items?: number
  max_items?: number
}

interface FieldSchema {
  key: string; label: string; type: string; required: boolean
  placeholder_text: string; default_value: string; max_length: number | null
  options: string[]; card_options: CardOption[]; section: string
  aspect_ratio?: string
  /** Enables AI compliance check (EU Health Claims Regulation) for richtext fields */
  compliance_check?: boolean
  display_mode?: 'chips' | 'toggle'
  toggle_on_value?: string
  toggle_off_value?: string
  show_when?: { field: string; value: string | string[] }
  // loop fields
  sub_fields?: LoopSubField[]
  min_items?: number
  max_items?: number
}

interface SiteData {
  id: string; status: string
  username: string | null
  custom_domain: string | null
  custom_domain_status: string | null
  templates: {
    id: string; title: string; domain: string
    r2_bundle_path: string | null
    placeholder_schema: { fields: FieldSchema[] }
  }
  data: Record<string, string>
}

// ─── Profile Pre-fill ────────────────────────────────────────────────────────

const PROFILE_KEY_MAP: Record<string, string[]> = {
  first_name:        ['vorname', 'first_name', 'firstname', 'name_vorname'],
  last_name:         ['nachname', 'last_name', 'lastname', 'name_nachname'],
  full_name:         ['vollstaendiger_name', 'full_name', 'vollname'],
  email:             ['email', 'e_mail', 'kontakt_email', 'mail'],
  phone:             ['telefon', 'phone', 'tel', 'telephone', 'handy', 'mobilnummer', 'whatsapp'],
  website_url:       ['website', 'webseite', 'website_url', 'homepage', 'url'],
  instagram:         ['instagram', 'instagram_url', 'instagram_link'],
  facebook:          ['facebook', 'facebook_url', 'facebook_link'],
  linkedin:          ['linkedin', 'linkedin_url', 'linkedin_link'],
  tiktok:            ['tiktok', 'tiktok_url', 'tiktok_link'],
  youtube:           ['youtube', 'youtube_url', 'youtube_link', 'youtube_kanal'],
  profile_image_url: ['profilbild', 'profile_image', 'avatar', 'foto', 'photo', 'bild'],
}

function getProfilePrefill(
  fieldKey: string,
  fieldType: string,
  profile: Record<string, string | null>,
): string | null {
  // Only prefill simple text/url/email/image fields
  if (['loop', 'card_select', 'dropdown', 'toggle', 'range', 'date', 'date_multi', 'time', 'color'].includes(fieldType)) return null

  const key = fieldKey.toLowerCase()

  for (const [profileField, patterns] of Object.entries(PROFILE_KEY_MAP)) {
    if (patterns.some(p => key === p || key.includes(p))) {
      // Special case: combine first + last name
      if (profileField === 'full_name') {
        const fn = profile.first_name?.trim() ?? ''
        const ln = profile.last_name?.trim() ?? ''
        if (fn || ln) return `${fn} ${ln}`.trim()
        return null
      }
      const val = profile[profileField]
      return val?.trim() || null
    }
  }
  return null
}

// ─── Domain Panel ─────────────────────────────────────────────────────────────

const DOMAIN_SECTION = '__domain__'

/** Maps internal schema section names to layman-friendly display labels. */
function displaySection(name: string): string {
  return name
    .replace(/^Sektionen$/i, 'Bereiche')
    .replace(/^Sektion$/i, 'Bereich')
    .replace(/^Sektion/g, 'Bereich')
}

/** Replaces 'Sektion' prefix in card/field labels. */
function displayLabel(label: string): string {
  return label.replace(/^Sektion/g, 'Bereich')
}


function DomainPanel({ siteId, subdomain, initialDomain, initialStatus }: {
  siteId: string
  subdomain: string
  initialDomain: string | null
  initialStatus: string | null
}) {
  const [domain, setDomain] = useState(initialDomain ?? '')
  const [status, setStatus] = useState<string | null>(initialStatus)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [fallbackHost, setFallbackHost] = useState('custom.finestsites.de')
  const [isApex, setIsApex] = useState(false)

  // Always re-fetch current domain state from DB when panel mounts
  useEffect(() => {
    fetch(`/api/sites/${siteId}/domain`)
      .then(r => r.json())
      .then(data => {
        if (data.custom_domain) setDomain(data.custom_domain)
        if (data.custom_domain_status !== undefined) setStatus(data.custom_domain_status)
        if (data.fallback_host) setFallbackHost(data.fallback_host)
        if (data.is_apex !== undefined) setIsApex(data.is_apex)
      })
      .catch(() => {})
  }, [siteId])

  // Extract just the host part (e.g. "www" from "www.example.com")
  const hostPart = domain ? domain.split('.')[0] : 'www'

  async function handleAdd() {
    if (!input.trim()) return
    setLoading(true); setError('')
    const res = await fetch(`/api/sites/${siteId}/domain`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: input.trim() }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Fehler'); setLoading(false); return }
    setDomain(data.custom_domain)
    setStatus('pending_dns')
    setIsApex(data.is_apex ?? false)
    setInput('')
    setLoading(false)
  }

  async function handleVerify() {
    setVerifying(true); setError('')
    const res = await fetch(`/api/sites/${siteId}/domain/verify`, { method: 'POST' })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Fehler'); setVerifying(false); return }
    setStatus(data.custom_domain_status)
    setVerifying(false)
  }

  async function handleRemove() {
    setRemoving(true); setError('')
    const res = await fetch(`/api/sites/${siteId}/domain`, { method: 'DELETE' })
    if (res.ok) { setDomain(''); setStatus(null) }
    else { const d = await res.json(); setError(d.error ?? 'Fehler') }
    setRemoving(false)
  }

  function copyFallback() {
    navigator.clipboard.writeText(fallbackHost)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // ── No domain yet ──────────────────────────────────────────────────────────
  if (!domain) {
    return (
      <div className="flex flex-col gap-5">
        {/* Hero card */}
        <div className="bg-white rounded-[20px] p-6"
          style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.05)', border: '1px solid #F0F0F0' }}>
          <div className="flex items-start gap-4 mb-5">
            <div className="w-10 h-10 rounded-[13px] flex items-center justify-center flex-shrink-0"
              style={{ background: '#EFF6FF' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
              </svg>
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 mb-1">Eigene Domain verbinden</h3>
              <p className="text-sm leading-relaxed" style={{ color: '#6B7280' }}>
                Statt <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded-md">{subdomain}</span> kannst du deine Website auch unter deiner eigenen Adresse erreichbar machen, z.B. <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded-md">www.meine-bäckerei.de</span>
              </p>
            </div>
          </div>

          {/* Input */}
          <div className="flex flex-col sm:flex-row gap-2.5">
            <input
              type="text"
              value={input}
              onChange={e => { setInput(e.target.value); setError('') }}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              placeholder="www.meine-domain.de"
              className="flex-1 text-sm rounded-[12px] px-4 outline-none"
              style={{ border: '1.5px solid #E5E7EB', background: '#FAFAFA', minHeight: '44px', padding: '11px 16px' }}
            />
            <button
              onClick={handleAdd}
              disabled={loading || !input.trim()}
              className="px-5 text-sm font-semibold text-white rounded-[12px] flex items-center justify-center gap-2 flex-shrink-0 transition-all"
              style={{
                background: input.trim() ? '#1a1a1a' : '#D1D5DB',
                cursor: input.trim() ? 'pointer' : 'not-allowed',
                opacity: loading ? 0.7 : 1,
                minHeight: '44px',
              }}>
              {loading
                ? <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                : 'Verbinden'}
            </button>
          </div>
          {error && <p className="mt-2.5 text-sm text-red-600">{error}</p>}
        </div>

        {/* Hint */}
        <div className="flex items-start gap-3 px-4 py-3.5 rounded-[14px]"
          style={{ background: '#F9FAFB', border: '1px solid #F0F0F0' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" className="flex-shrink-0 mt-0.5">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
          </svg>
          <p className="text-xs leading-relaxed" style={{ color: '#6B7280' }}>
            Funktioniert mit allen Anbietern: GoDaddy, Strato, all-inkl, IONOS, checkdomain, Namecheap und mehr. Du musst nur einen DNS-Eintrag setzen, wir erklären dir genau wie.
          </p>
        </div>
      </div>
    )
  }

  // ── Active ─────────────────────────────────────────────────────────────────
  if (status === 'active') {
    return (
      <div className="flex flex-col gap-4">
        {/* Success card */}
        <div className="bg-white rounded-[20px] p-6"
          style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.05)', border: '1px solid #F0F0F0' }}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: '#DCFCE7' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round">
                <path d="M20 6L9 17l-5-5"/>
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">Domain verbunden</p>
              <p className="text-xs" style={{ color: '#6B7280' }}>SSL-Zertifikat aktiv · HTTPS gesichert</p>
            </div>
          </div>
          <a href={`https://${domain}`} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-3 rounded-[12px] text-sm font-semibold transition-colors"
            style={{ background: '#F0FDF4', color: '#15803D', border: '1px solid #BBF7D0' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
            {domain}
          </a>
          {error && <p className="mt-2.5 text-sm text-red-600">{error}</p>}
          <button
            onClick={handleRemove}
            disabled={removing}
            className="mt-4 text-xs font-medium px-3 py-2 rounded-[10px] transition-colors"
            style={{ background: '#FEF2F2', color: '#DC2626' }}>
            {removing ? 'Wird entfernt…' : 'Domain entfernen'}
          </button>
        </div>
      </div>
    )
  }

  // ── Pending DNS / Pending SSL / Error ──────────────────────────────────────
  const isPendingDns = status === 'pending_dns'
  const isError = status === 'error'

  return (
    <div className="flex flex-col gap-4">
      {/* Status banner */}
      <div className="flex items-center gap-3 px-4 py-3 rounded-[14px]"
        style={{
          background: isError ? '#FEF2F2' : '#FFFBEB',
          border: `1px solid ${isError ? '#FECACA' : '#FDE68A'}`,
        }}>
        {isError ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" className="flex-shrink-0">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><circle cx="12" cy="16" r=".5" fill="#DC2626"/>
          </svg>
        ) : (
          <span className="w-4 h-4 rounded-full border-2 border-yellow-500/40 border-t-yellow-500 animate-spin flex-shrink-0" />
        )}
        <div className="min-w-0">
          <p className="text-sm font-semibold" style={{ color: isError ? '#DC2626' : '#92400E' }}>
            {isError ? 'Verbindung fehlgeschlagen' : isPendingDns ? 'Warte auf DNS-Eintrag' : 'SSL-Zertifikat wird ausgestellt…'}
          </p>
          <p className="text-xs truncate" style={{ color: isError ? '#B91C1C' : '#78350F' }}>
            {domain}
          </p>
        </div>
      </div>

      {/* Instructions */}
      {(isPendingDns || isError) && (
        <div className="bg-white rounded-[20px] p-6"
          style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.05)', border: '1px solid #F0F0F0' }}>
          <h3 className="text-sm font-bold text-gray-900 mb-4">
            So verbindest du deine Domain
          </h3>

          {/* Step 1 */}
          <div className="flex gap-3.5 mb-5">
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5"
              style={{ background: '#1a1a1a', color: 'white' }}>1</div>
            <div>
              <p className="text-sm font-semibold text-gray-900 mb-1">
                Logge dich bei deinem Domain-Anbieter ein
              </p>
              <p className="text-xs leading-relaxed" style={{ color: '#6B7280' }}>
                Öffne das DNS-Einstellungs-Menü (heißt je nach Anbieter &ldquo;DNS-Verwaltung&rdquo;, &ldquo;Zone Editor&rdquo; oder &ldquo;Nameserver&rdquo;).
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex gap-3.5 mb-5">
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5"
              style={{ background: '#1a1a1a', color: 'white' }}>2</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 mb-2">
                Erstelle diesen DNS-Eintrag
              </p>
              {isApex && (
                <p className="text-xs mb-2 px-3 py-2 rounded-[10px]" style={{ background: '#FFF7ED', color: '#92400E', border: '1px solid #FDE68A' }}>
                  Hinweis: Für Haupt-Domains ohne Präfix brauchst du einen <strong>ALIAS</strong>- oder <strong>ANAME</strong>-Eintrag. Nicht alle Anbieter unterstützen das. Falls es nicht klappt, empfehlen wir <strong>www.{domain}</strong> zu verwenden.
                </p>
              )}
              {/* DNS record box — scrollable on mobile */}
              <div className="rounded-[12px] overflow-hidden overflow-x-auto" style={{ border: '1.5px solid #E5E7EB' }}>
                <div style={{ minWidth: '320px' }}>
                  <div className="grid grid-cols-3 text-xs font-semibold uppercase tracking-wider px-3 py-2"
                    style={{ background: '#F8FAFC', color: '#9CA3AF', borderBottom: '1px solid #E5E7EB' }}>
                    <span>Typ</span><span>Name</span><span>Ziel (Wert)</span>
                  </div>
                  <div className="grid grid-cols-3 items-center px-3 py-3 gap-2 bg-white">
                    <span className="text-xs font-bold text-gray-700">{isApex ? 'ALIAS / ANAME' : 'CNAME'}</span>
                    <span className="text-xs font-mono text-gray-700 truncate">{isApex ? '@' : hostPart}</span>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-mono text-gray-700 truncate flex-1">{fallbackHost}</span>
                      <button onClick={copyFallback}
                        className="flex-shrink-0 flex items-center gap-1 text-xs px-2 py-1.5 rounded-[8px] font-medium transition-colors min-h-[32px]"
                        style={{ background: copied ? '#DCFCE7' : '#F3F4F6', color: copied ? '#16A34A' : '#374151' }}>
                        {copied ? (
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
                        ) : (
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                        )}
                        {copied ? 'Kopiert!' : 'Kopieren'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              <p className="mt-2 text-xs" style={{ color: '#9CA3AF' }}>
                Tipp: TTL kannst du auf &ldquo;Auto&rdquo; oder &ldquo;1 Stunde&rdquo; lassen.
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex gap-3.5">
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5"
              style={{ background: '#1a1a1a', color: 'white' }}>3</div>
            <div>
              <p className="text-sm font-semibold text-gray-900 mb-1">
                Warte kurz und klicke dann auf &ldquo;Prüfen&rdquo;
              </p>
              <p className="text-xs leading-relaxed" style={{ color: '#6B7280' }}>
                DNS-Einträge brauchen meist 5–30 Minuten, manchmal bis zu 24 Stunden. Das SSL-Zertifikat wird danach automatisch ausgestellt.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Not pending_dns: just waiting for SSL */}
      {!isPendingDns && !isError && (
        <div className="bg-white rounded-[20px] p-5 text-center"
          style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.05)', border: '1px solid #F0F0F0' }}>
          <p className="text-sm text-gray-600">DNS-Eintrag erkannt. Das SSL-Zertifikat wird gerade ausgestellt. Das dauert meist nur wenige Minuten.</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2.5">
        <button onClick={handleVerify} disabled={verifying}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white rounded-[12px] transition-all"
          style={{ background: '#1a1a1a', opacity: verifying ? 0.7 : 1 }}>
          {verifying
            ? <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
            : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>}
          {verifying ? 'Wird geprüft…' : 'Verbindung prüfen'}
        </button>
        <button onClick={handleRemove} disabled={removing}
          className="px-4 py-2.5 text-sm font-medium rounded-[12px] transition-colors"
          style={{ background: '#F9FAFB', color: '#6B7280', border: '1px solid #E5E7EB' }}>
          {removing ? 'Wird entfernt…' : 'Abbrechen'}
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}

// ─── Shared input style ───────────────────────────────────────────────────────

const INPUT = {
  background: '#FFFFFF', border: '1.5px solid #E5E7EB',
  borderRadius: '12px', padding: '11px 14px',
  fontSize: '14px', outline: 'none', width: '100%',
  minHeight: '44px',
}

const focusBorder = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
  (e.target.style.borderColor = '#1a1a1a')
const blurBorder  = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
  (e.target.style.borderColor = '#E5E7EB')

// ─── Card Select Field ────────────────────────────────────────────────────────

function CardSelectField({ field, value, onChange }: {
  field: FieldSchema; value: string; onChange: (v: string) => void
}) {
  const opts = field.card_options ?? []
  const [hovered, setHovered] = useState<{ opt: CardOption; rect: DOMRect } | null>(null)

  // ── iOS-style toggle (2 binary options, opt-in via display_mode) ──
  if (field.display_mode === 'toggle' && opts.length === 2) {
    const onOpt = opts.find(o => o.value === (field.toggle_on_value ?? opts[0].value)) ?? opts[0]
    const offOpt = opts.find(o => o.value === (field.toggle_off_value ?? opts[1].value)) ?? opts[1]
    const isOn = value === onOpt.value
    const active = isOn ? onOpt : offOpt
    return (
      <div className="flex items-center gap-3 px-3.5 py-2.5 rounded-md"
        style={{ background: '#FAFAFA', border: '1px solid #E5E7EB' }}>
        <button type="button" onClick={() => onChange(isOn ? offOpt.value : onOpt.value)}
          aria-pressed={isOn}
          className="flex-shrink-0 relative inline-flex items-center"
          style={{
            width: 44, height: 26, borderRadius: 999,
            background: isOn ? (onOpt.color || '#10B981') : '#D4D4D8',
            transition: 'background 0.2s ease',
            cursor: 'pointer', padding: 0, border: 0,
          }}>
          <span style={{
            position: 'absolute', top: 3, left: isOn ? 21 : 3,
            width: 20, height: 20, borderRadius: '50%',
            background: '#FFFFFF',
            boxShadow: '0 2px 4px rgba(0,0,0,0.18)',
            transition: 'left 0.2s ease',
          }} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold" style={{ color: '#1a1a1a' }}>{active.label}</div>
          {active.description && (
            <div className="text-xs" style={{ color: '#6B7280', marginTop: 1 }}>{active.description}</div>
          )}
        </div>
      </div>
    )
  }

  // Compact mode: when no option has an actual image preview, render slim
  // button-like chips instead of the large cards.
  const isCompact = opts.every(o => o.card_type !== 'image' || !o.image_url)

  const gridCls = isCompact ? (
    opts.length <= 2 ? 'grid-cols-2' :
    opts.length === 3 ? 'grid-cols-1 sm:grid-cols-3' :
    'grid-cols-1 sm:grid-cols-2'
  ) : (
    opts.length === 2 ? 'grid-cols-1 sm:grid-cols-2' :
    opts.length === 3 ? 'grid-cols-1 sm:grid-cols-3' :
    'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4'
  )

  function showPreview(opt: CardOption, e: React.MouseEvent<HTMLButtonElement>) {
    if (opt.card_type !== 'image' || !opt.image_url) return
    setHovered({ opt, rect: e.currentTarget.getBoundingClientRect() })
  }

  return (
    <div className={`grid ${isCompact ? 'gap-2' : 'gap-4'} ${gridCls}`} style={{ position: 'relative' }}>
      {opts.map(opt => {
        const selected = value === opt.value

        // ── Compact button-like chip (no image) ──────────────────────
        if (isCompact) {
          const hasIcon = !!opt.icon
          return (
            <button key={opt.value} type="button" onClick={() => onChange(opt.value)}
              className="group flex items-start gap-2.5 text-left px-3 py-2.5 transition-all"
              style={{
                border: `1.5px solid ${selected ? '#1a1a1a' : '#E5E7EB'}`,
                borderRadius: 4,
                background: selected ? '#FAFAFA' : '#fff',
                boxShadow: selected ? '0 0 0 3px rgba(26,26,26,0.05)' : 'none',
                cursor: 'pointer',
              }}>
              {hasIcon ? (
                <span className="flex items-center justify-center flex-shrink-0"
                  style={{
                    width: 28, height: 28, borderRadius: 4,
                    background: opt.color ? opt.color + '22' : '#F3F4F6',
                    marginTop: 1,
                  }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                    stroke={opt.color || '#1a1a1a'} strokeWidth="2.2"
                    strokeLinecap="round" strokeLinejoin="round">
                    <path d={opt.icon} />
                  </svg>
                </span>
              ) : opt.color ? (
                <span className="rounded-full flex-shrink-0"
                  style={{
                    width: 14, height: 14, marginTop: 4,
                    background: opt.color,
                    boxShadow: 'inset 0 0 0 1.5px rgba(255,255,255,0.7), 0 0 0 1px rgba(0,0,0,0.08)',
                  }} />
              ) : null}
              <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                <span className="text-sm font-semibold text-gray-900 leading-tight flex items-center gap-1.5">
                  <span className="truncate">{opt.label}</span>
                  {selected && (
                    <svg className="flex-shrink-0" width="13" height="13" viewBox="0 0 24 24"
                      fill="none" stroke="#1a1a1a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  )}
                </span>
                {opt.description && (
                  <span className="text-xs leading-snug" style={{ color: '#6B7280' }}>
                    {opt.description}
                  </span>
                )}
              </div>
            </button>
          )
        }

        const isImage = opt.card_type === 'image'
        const canZoom = isImage && !!opt.image_url
        return (
          <button key={opt.value} type="button" onClick={() => onChange(opt.value)}
            onMouseEnter={(e) => canZoom && showPreview(opt, e)}
            onMouseLeave={() => canZoom && setHovered(null)}
            className="group relative flex flex-col text-left rounded-2xl overflow-hidden transition-all"
            style={{
              border: `2px solid ${selected ? '#1a1a1a' : '#E5E7EB'}`,
              background: '#fff',
              boxShadow: selected
                ? '0 0 0 4px rgba(26,26,26,0.08), 0 6px 24px rgba(0,0,0,0.06)'
                : '0 1px 2px rgba(0,0,0,0.03)',
              transform: selected ? 'translateY(-1px)' : 'none',
              cursor: canZoom ? 'zoom-in' : 'pointer',
            }}>

            {/* Visual area */}
            {isImage && opt.image_url ? (
              <div className="relative w-full overflow-hidden" style={{ aspectRatio: '4 / 3', background: '#F8FAFC' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={opt.image_url} alt={opt.label}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.04]" />
                {/* Hover hint badge */}
                <div className="absolute bottom-2 right-2 px-2 py-1 rounded-full text-[10px] font-semibold flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                  style={{ background: 'rgba(15,23,42,0.85)', color: '#fff', backdropFilter: 'blur(8px)' }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <circle cx="11" cy="11" r="8"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>
                  </svg>
                  Vorschau
                </div>
              </div>
            ) : isImage ? (
              <div className="w-full flex items-center justify-center"
                style={{ aspectRatio: '4 / 3', background: '#F1F5F9' }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="1.5">
                  <rect x="3" y="3" width="18" height="18" rx="2"/>
                  <circle cx="8.5" cy="8.5" r="1.5"/>
                  <polyline points="21 15 16 10 5 21"/>
                </svg>
              </div>
            ) : opt.card_type === 'color' && opt.color ? (
              <div className="w-full flex items-center justify-center"
                style={{ aspectRatio: '4 / 3', background: opt.color }} />
            ) : (
              <div className="w-full flex items-center justify-center"
                style={{ aspectRatio: '4 / 3', background: '#F8FAFC' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                </svg>
              </div>
            )}

            {/* Label + description */}
            <div className="flex-1 flex flex-col gap-1.5 p-4 sm:p-5">
              <span className="text-base font-bold text-gray-900 leading-tight">
                {opt.label}
              </span>
              {opt.description && (
                <span className="text-sm leading-snug" style={{ color: '#6B7280' }}>
                  {opt.description}
                </span>
              )}
            </div>

            {/* Selected badge */}
            {selected && (
              <div className="absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center"
                style={{ background: '#1a1a1a', boxShadow: '0 2px 8px rgba(0,0,0,0.25)' }}>
                <svg width="12" height="10" viewBox="0 0 10 8" fill="none">
                  <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            )}
          </button>
        )
      })}

      {/* ── Floating hover preview ──────────────────────────────────────
          Shows the section image at large size next to the hovered card.
          Positioned with viewport-aware clamping so it never gets clipped. */}
      {hovered && hovered.opt.image_url && (() => {
        const PREVIEW_W = 520
        const PREVIEW_MAX_H = Math.min(620, window.innerHeight - 32)
        const r = hovered.rect
        // Try right side first; fall back to left; clamp to viewport
        const spaceRight = window.innerWidth - r.right - 24
        const spaceLeft = r.left - 24
        let left: number
        if (spaceRight >= PREVIEW_W) {
          left = r.right + 14
        } else if (spaceLeft >= PREVIEW_W) {
          left = r.left - PREVIEW_W - 14
        } else {
          // Center horizontally on viewport
          left = Math.max(16, (window.innerWidth - PREVIEW_W) / 2)
        }
        // Vertical: center on card, then clamp
        const cardCenterY = r.top + r.height / 2
        let top = Math.round(cardCenterY - PREVIEW_MAX_H / 2)
        top = Math.max(16, Math.min(window.innerHeight - PREVIEW_MAX_H - 16, top))
        return (
          <div className="pointer-events-none fixed z-50"
            style={{
              top, left, width: PREVIEW_W, maxHeight: PREVIEW_MAX_H,
              animation: 'cs-fade 0.15s ease-out',
            }}>
            <div className="bg-white rounded-2xl overflow-hidden flex flex-col"
              style={{
                maxHeight: PREVIEW_MAX_H,
                boxShadow: '0 32px 80px rgba(15,23,42,0.30), 0 12px 24px rgba(15,23,42,0.18)',
                border: '1px solid rgba(0,0,0,0.04)',
              }}>
              <div className="overflow-hidden flex-1" style={{ background: '#F8FAFC' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={hovered.opt.image_url} alt={hovered.opt.label}
                  className="w-full h-auto block" style={{ display: 'block' }} />
              </div>
              <div className="px-4 py-3 border-t" style={{ borderColor: '#F1F5F9' }}>
                <p className="text-sm font-bold text-gray-900 leading-tight">{hovered.opt.label}</p>
                {hovered.opt.description && (
                  <p className="text-xs leading-snug mt-1" style={{ color: '#6B7280' }}>
                    {hovered.opt.description}
                  </p>
                )}
              </div>
            </div>
            <style jsx>{`
              @keyframes cs-fade {
                from { opacity: 0; transform: scale(0.96); }
                to { opacity: 1; transform: scale(1); }
              }
            `}</style>
          </div>
        )
      })()}
    </div>
  )
}

// ─── Image Field ──────────────────────────────────────────────────────────────

function ImageField({ field, value, onChange }: {
  field: FieldSchema | LoopSubField; value: string; onChange: (v: string) => void
}) {
  const [cropSrc, setCropSrc] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const arStr = field.aspect_ratio ?? 'free'
  const arMap: Record<string, number | undefined> = {
    '1/1': 1, '4/3': 4/3, '16/9': 16/9, '3/2': 3/2, '9/16': 9/16
  }
  const aspectRatioNum = arMap[arStr]

  async function handleCropConfirm(blob: Blob) {
    if (cropSrc) URL.revokeObjectURL(cropSrc)
    setCropSrc(null); setUploading(true); setUploadError('')
    try {
      const fd = new FormData()
      fd.append('file', blob, 'image.jpg')
      const res = await fetch('/api/upload/image', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) { setUploadError(data.error ?? 'Upload fehlgeschlagen'); return }
      onChange(data.url)
    } catch { setUploadError('Upload fehlgeschlagen') }
    finally { setUploading(false) }
  }

  return (
    <div className="flex flex-col gap-3">
      {cropSrc && (
        <ImageCropModal imageUrl={cropSrc} aspectRatio={aspectRatioNum}
          onConfirm={handleCropConfirm}
          onCancel={() => { URL.revokeObjectURL(cropSrc); setCropSrc(null) }} />
      )}
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) setCropSrc(URL.createObjectURL(f)); e.target.value = '' }} />

      {value ? (
        <div className="flex flex-col gap-2">
          <div className="relative rounded-[16px] overflow-hidden bg-gray-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={value} alt="Hochgeladenes Bild" className="w-full object-cover rounded-[16px]"
              style={{ aspectRatio: arStr !== 'free' ? arStr : undefined, maxHeight: '240px' }} />
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-3 text-sm font-semibold rounded-[12px] min-h-[44px]"
              style={{ background: '#1a1a1a', color: 'white' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
              </svg>
              Ersetzen
            </button>
            <button type="button" onClick={() => onChange('')}
              className="px-4 py-3 text-sm font-semibold rounded-[12px] min-h-[44px]"
              style={{ background: '#FEF2F2', color: '#DC2626' }}>
              Entfernen
            </button>
          </div>
        </div>
      ) : (
        <div onClick={() => fileInputRef.current?.click()}
          className="flex flex-col items-center justify-center gap-3 rounded-[16px] cursor-pointer transition-all active:scale-[0.99] active:bg-gray-100"
          style={{ border: '2px dashed #D1D5DB', background: '#FAFAFA', minHeight: '160px', padding: '28px' }}>
          {uploading ? (
            <div className="w-7 h-7 rounded-full border-2 border-gray-300 border-t-gray-700 animate-spin" />
          ) : (
            <>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: '#F3F4F6' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="1.5">
                  <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-gray-700">Bild hochladen</p>
                <p className="text-xs text-gray-400 mt-0.5">Tippen um ein Foto auszuwählen</p>
                {arStr !== 'free' && (
                  <p className="text-xs font-medium mt-1.5 px-2.5 py-0.5 rounded-full inline-block" style={{ background: '#EFF6FF', color: '#2563EB' }}>
                    Format: {arStr}
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      )}
      {uploadError && <p className="text-xs text-red-500 font-medium">{uploadError}</p>}
    </div>
  )
}

// ─── Color Field ──────────────────────────────────────────────────────────────

function ColorField({ value, onChange, placeholder }: {
  value: string; onChange: (v: string) => void; placeholder?: string
}) {
  const trimmed = value.trim()
  const isValid = /^#?[0-9A-Fa-f]{6}$/.test(trimmed)
  const hex = isValid ? (trimmed.startsWith('#') ? trimmed : '#' + trimmed) : '#7C3AED'
  const presets = ['#7C3AED', '#FB7185', '#10B981', '#0EA5E9', '#F59E0B', '#EC4899', '#6366F1', '#EF4444', '#22D3EE', '#A855F7', '#84CC16', '#0B1020']
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <div
          style={{
            position: 'relative', width: 88, height: 56, flexShrink: 0,
            borderRadius: 14, overflow: 'hidden',
            border: '1.5px solid #E5E7EB',
            boxShadow: '0 2px 8px rgba(15, 23, 42, 0.06)',
          }}
        >
          <input
            type="color"
            value={hex}
            onChange={e => onChange(e.target.value.toUpperCase())}
            style={{
              position: 'absolute', inset: 0, width: '100%', height: '100%',
              opacity: 0, cursor: 'pointer', border: 0, padding: 0,
            }}
            aria-label="Farbwähler öffnen"
          />
          <div style={{ width: '100%', height: '100%', background: hex, pointerEvents: 'none' }} />
          <div style={{
            position: 'absolute', bottom: 6, right: 6,
            width: 22, height: 22, borderRadius: 7,
            background: 'rgba(255,255,255,0.92)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            pointerEvents: 'none',
            boxShadow: '0 1px 3px rgba(0,0,0,0.18)',
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m2 22 1-1h3l9-9"/>
              <path d="M3 21v-3l9-9"/>
              <path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l.4.4Z"/>
            </svg>
          </div>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <input
            type="text"
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder || '#7C3AED'}
            maxLength={9}
            style={{
              ...INPUT,
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              textTransform: 'uppercase',
              fontWeight: 600,
              letterSpacing: '0.04em',
            }}
            onFocus={focusBorder} onBlur={blurBorder}
          />
          <span style={{ fontSize: 11, color: '#9CA3AF', paddingLeft: 4 }}>
            Klick auf das Quadrat öffnet den Farbwähler. Oder Hex eintippen.
          </span>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {presets.map(p => {
          const isActive = value.toUpperCase() === p
          return (
            <button key={p} type="button"
              onClick={() => onChange(p)}
              title={p}
              aria-label={`Farbe ${p}`}
              style={{
                width: 32, height: 32, borderRadius: 10,
                background: p,
                border: isActive ? '2.5px solid #1a1a1a' : '2px solid transparent',
                boxShadow: isActive
                  ? `0 4px 12px ${p}66, inset 0 0 0 1px rgba(255,255,255,0.4)`
                  : '0 0 0 1px rgba(0,0,0,0.06), inset 0 0 0 1px rgba(255,255,255,0.25)',
                cursor: 'pointer', padding: 0,
                transition: 'transform 0.15s ease, box-shadow 0.15s ease',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1.08)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)' }}
            />
          )
        })}
      </div>
    </div>
  )
}

// ─── Loop Field ───────────────────────────────────────────────────────────────

function subToFieldSchema(sf: LoopSubField): FieldSchema {
  return {
    key: sf.key,
    label: sf.label,
    type: sf.type,
    required: sf.required ?? false,
    placeholder_text: sf.placeholder_text ?? '',
    default_value: sf.default_value ?? '',
    max_length: sf.max_length ?? null,
    options: sf.options ?? [],
    card_options: sf.card_options ?? [],
    section: '',
    aspect_ratio: sf.aspect_ratio,
    sub_fields: sf.sub_fields,
    min_items: sf.min_items,
    max_items: sf.max_items,
  }
}

function checkShowWhen(
  sf: LoopSubField,
  item: Record<string, string>,
  allFields?: LoopSubField[],
  seen: Set<string> = new Set(),
): boolean {
  if (!sf.show_when) return true
  if (seen.has(sf.key)) return true
  seen.add(sf.key)
  const { field, value } = sf.show_when
  // Cascading visibility: if the watched field itself is currently hidden,
  // this field should be hidden too — regardless of the stored value.
  if (allFields) {
    const parent = allFields.find(p => p.key === field)
    if (parent && parent.show_when && !checkShowWhen(parent, item, allFields, seen)) {
      return false
    }
  }
  const cur = (item[field] ?? '').trim()
  if (value === '__truthy__') return cur !== '' && cur !== 'false' && cur !== '0'
  if (Array.isArray(value)) return value.map(v => v.trim()).includes(cur)
  return cur === String(value).trim()
}

// ─── DateField (custom calendar popover) ──────────────────────────────────────
function DateField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const [view, setView] = useState(() => {
    const m = (value || '').match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
    const d = m ? new Date(+m[1], +m[2] - 1, 1) : new Date()
    return { y: d.getFullYear(), m: d.getMonth() }
  })

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const MONTHS_L = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember']
  const WD = ['Mo','Di','Mi','Do','Fr','Sa','So']
  const today = new Date(); today.setHours(0,0,0,0)
  const selected = value || ''
  const display = value
    ? (() => { const [y, mo, d] = value.split('-'); return `${d}.${mo}.${y}` })()
    : ''

  const firstOfMonth = new Date(view.y, view.m, 1)
  const firstWeekday = (firstOfMonth.getDay() + 6) % 7
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate()
  const prevMonthDays = new Date(view.y, view.m, 0).getDate()
  type Cell = { d: number; y: number; m: number; other: boolean }
  const cells: Cell[] = []
  for (let i = 0; i < firstWeekday; i++) cells.push({ d: prevMonthDays - firstWeekday + 1 + i, y: view.y, m: view.m - 1, other: true })
  for (let d = 1; d <= daysInMonth; d++) cells.push({ d, y: view.y, m: view.m, other: false })
  let next = 1; while (cells.length % 7 !== 0) { cells.push({ d: next++, y: view.y, m: view.m + 1, other: true }) }
  while (cells.length < 42) { cells.push({ d: next++, y: view.y, m: view.m + 1, other: true }) }

  function pick(c: Cell) {
    const dt = new Date(c.y, c.m, c.d)
    const iso = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`
    onChange(iso)
    setOpen(false)
  }

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen(o => !o)}
        className="flex items-center justify-between w-full text-left transition-colors"
        style={{ ...INPUT, cursor: 'pointer', borderRadius: 4 }}>
        <span style={{ color: display ? '#1a1a1a' : '#9CA3AF' }}>{display || 'Tag auswählen'}</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
        </svg>
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0,
          background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 12,
          boxShadow: '0 20px 50px rgba(0,0,0,0.12)', padding: 12,
          zIndex: 50, width: 320,
        }}>
          <div className="flex items-center justify-between mb-3 px-1">
            <button type="button" onClick={() => setView(v => v.m === 0 ? { y: v.y - 1, m: 11 } : { y: v.y, m: v.m - 1 })}
              className="p-1.5 rounded-md hover:bg-gray-100">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <div className="text-sm font-bold text-gray-900">{MONTHS_L[view.m]} {view.y}</div>
            <button type="button" onClick={() => setView(v => v.m === 11 ? { y: v.y + 1, m: 0 } : { y: v.y, m: v.m + 1 })}
              className="p-1.5 rounded-md hover:bg-gray-100">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>
          <div className="grid grid-cols-7 gap-0.5 mb-1">
            {WD.map(w => (
              <div key={w} className="text-[10px] font-semibold text-center py-1" style={{ color: '#9CA3AF', letterSpacing: '0.04em' }}>{w}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((c, i) => {
              const dt = new Date(c.y, c.m, c.d); dt.setHours(0,0,0,0)
              const iso = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`
              const isToday = dt.getTime() === today.getTime()
              const isSel = iso === selected
              return (
                <button key={i} type="button" onClick={() => pick(c)}
                  className="text-sm font-medium aspect-square flex items-center justify-center transition-all"
                  style={{
                    borderRadius: 8,
                    color: c.other ? '#D1D5DB' : isSel ? '#FFFFFF' : isToday ? '#1a1a1a' : '#374151',
                    background: isSel ? '#1a1a1a' : isToday ? '#F3F4F6' : 'transparent',
                    fontWeight: isSel || isToday ? 700 : 500,
                  }}>
                  {c.d}
                </button>
              )
            })}
          </div>
          <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: '1px solid #F3F4F6' }}>
            <button type="button" onClick={() => { onChange(''); setOpen(false) }}
              className="text-xs font-semibold text-gray-500 hover:text-gray-700 px-1">Löschen</button>
            <button type="button" onClick={() => {
              const dt = new Date(); dt.setHours(0,0,0,0)
              const iso = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`
              onChange(iso); setOpen(false)
            }} className="text-xs font-semibold px-3 py-1.5 rounded-md transition-colors"
              style={{ background: '#1a1a1a', color: '#fff' }}>Heute</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── MultiDateField (inline calendar, multi-select) ───────────────────────────
function MultiDateField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const dates = (() => {
    try {
      const parsed = JSON.parse(value || '[]')
      if (!Array.isArray(parsed)) return []
      return parsed.filter((d: unknown) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)).sort() as string[]
    } catch { return [] as string[] }
  })()

  const [view, setView] = useState(() => {
    const first = dates[0]
    const m = first?.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    const d = m ? new Date(+m[1], +m[2] - 1, 1) : new Date()
    return { y: d.getFullYear(), m: d.getMonth() }
  })

  const MONTHS_L = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember']
  const WD = ['Mo','Di','Mi','Do','Fr','Sa','So']
  const today = new Date(); today.setHours(0,0,0,0)

  const firstOfMonth = new Date(view.y, view.m, 1)
  const firstWeekday = (firstOfMonth.getDay() + 6) % 7
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate()
  const prevMonthDays = new Date(view.y, view.m, 0).getDate()
  type Cell = { d: number; y: number; m: number; other: boolean }
  const cells: Cell[] = []
  for (let i = 0; i < firstWeekday; i++) cells.push({ d: prevMonthDays - firstWeekday + 1 + i, y: view.y, m: view.m - 1, other: true })
  for (let d = 1; d <= daysInMonth; d++) cells.push({ d, y: view.y, m: view.m, other: false })
  let next = 1
  while (cells.length % 7 !== 0) { cells.push({ d: next++, y: view.y, m: view.m + 1, other: true }) }
  while (cells.length < 42) { cells.push({ d: next++, y: view.y, m: view.m + 1, other: true }) }

  function isoOf(c: Cell) {
    return `${c.y}-${String(c.m + 1).padStart(2, '0')}-${String(c.d).padStart(2, '0')}`
  }

  function toggle(iso: string) {
    const set = new Set(dates)
    if (set.has(iso)) set.delete(iso); else set.add(iso)
    onChange(JSON.stringify(Array.from(set).sort()))
  }

  function remove(iso: string) {
    onChange(JSON.stringify(dates.filter(d => d !== iso)))
  }

  function fmtChip(iso: string) {
    const [y, mo, d] = iso.split('-')
    return `${parseInt(d, 10)}. ${MONTHS_L[parseInt(mo, 10) - 1].slice(0, 3)} ${y}`
  }

  return (
    <div className="flex flex-col gap-3">
      <div style={{
        background: '#FFFFFF',
        border: '1px solid #E5E7EB',
        borderRadius: 14,
        padding: 14,
      }}>
        <div className="flex items-center justify-between mb-3 px-1">
          <button type="button" onClick={() => setView(v => v.m === 0 ? { y: v.y - 1, m: 11 } : { y: v.y, m: v.m - 1 })}
            className="p-1.5 rounded-md hover:bg-gray-100" aria-label="Vorheriger Monat">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <div className="text-sm font-bold text-gray-900">{MONTHS_L[view.m]} {view.y}</div>
          <button type="button" onClick={() => setView(v => v.m === 11 ? { y: v.y + 1, m: 0 } : { y: v.y, m: v.m + 1 })}
            className="p-1.5 rounded-md hover:bg-gray-100" aria-label="Nächster Monat">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>
        <div className="grid grid-cols-7 gap-0.5 mb-1">
          {WD.map(w => (
            <div key={w} className="text-[10px] font-semibold text-center py-1" style={{ color: '#9CA3AF', letterSpacing: '0.04em' }}>{w}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-0.5">
          {cells.map((c, i) => {
            const dt = new Date(c.y, c.m, c.d); dt.setHours(0,0,0,0)
            const iso = isoOf(c)
            const isToday = dt.getTime() === today.getTime()
            const isSelected = dates.includes(iso)
            return (
              <button key={i} type="button" onClick={() => toggle(iso)}
                className="text-sm font-medium aspect-square flex items-center justify-center transition-all"
                style={{
                  borderRadius: 8,
                  color: c.other ? '#D1D5DB' : isSelected ? '#FFFFFF' : isToday ? '#1a1a1a' : '#374151',
                  background: isSelected ? '#1a1a1a' : isToday ? '#F3F4F6' : 'transparent',
                  fontWeight: isSelected || isToday ? 700 : 500,
                }}>
                {c.d}
              </button>
            )
          })}
        </div>
        <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: '1px solid #F3F4F6' }}>
          <span className="text-xs text-gray-500">{dates.length} Termin{dates.length === 1 ? '' : 'e'} ausgewählt</span>
          {dates.length > 0 && (
            <button type="button" onClick={() => onChange(JSON.stringify([]))}
              className="text-xs font-semibold text-gray-500 hover:text-gray-700 px-1">Alle löschen</button>
          )}
        </div>
      </div>

      {dates.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {dates.map(iso => (
            <span key={iso} className="inline-flex items-center gap-1.5 text-xs font-semibold"
              style={{
                padding: '6px 8px 6px 12px',
                borderRadius: 999,
                background: '#1a1a1a',
                color: '#FFFFFF',
              }}>
              {fmtChip(iso)}
              <button type="button" onClick={() => remove(iso)}
                className="inline-flex items-center justify-center rounded-full"
                style={{ width: 16, height: 16, background: 'rgba(255,255,255,0.2)' }}
                aria-label={`${fmtChip(iso)} entfernen`}>
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function ToggleField({ field, value, onChange }: {
  field: { label: string; description?: string; toggle_on_value?: string; toggle_off_value?: string; placeholder_text?: string }
  value: string
  onChange: (v: string) => void
}) {
  const on = field.toggle_on_value ?? 'ja'
  const off = field.toggle_off_value ?? ''
  const isOn = value === on
  return (
    <div className="flex items-center gap-3 px-3.5 py-2.5"
      style={{ background: '#FAFAFA', border: '1px solid #E5E7EB', borderRadius: 4 }}>
      <button type="button" onClick={() => onChange(isOn ? off : on)}
        aria-pressed={isOn}
        className="flex-shrink-0 relative inline-flex items-center"
        style={{
          width: 44, height: 26, borderRadius: 999,
          background: isOn ? '#10B981' : '#D4D4D8',
          transition: 'background 0.2s ease',
          cursor: 'pointer', padding: 0, border: 0,
        }}>
        <span style={{
          position: 'absolute', top: 3, left: isOn ? 21 : 3,
          width: 20, height: 20, borderRadius: '50%',
          background: '#FFFFFF',
          boxShadow: '0 2px 4px rgba(0,0,0,0.18)',
          transition: 'left 0.2s ease',
        }} />
      </button>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold" style={{ color: '#1a1a1a' }}>{isOn ? 'Aktiv' : 'Aus'}</div>
        {field.placeholder_text && (
          <div className="text-xs" style={{ color: '#6B7280', marginTop: 1 }}>{field.placeholder_text}</div>
        )}
      </div>
    </div>
  )
}

function RangeField({ field, value, onChange }: {
  field: { min?: number; max?: number; step?: number; unit?: string; default_value?: string; placeholder_text?: string }
  value: string
  onChange: (v: string) => void
}) {
  const min = field.min ?? 0
  const max = field.max ?? 100
  const step = field.step ?? 1
  const unit = field.unit ?? ''
  const fallback = field.default_value ?? String(min)
  const raw = value !== undefined && value !== '' ? value : fallback
  const num = Number.isFinite(parseFloat(raw)) ? parseFloat(raw) : min
  const pct = Math.max(0, Math.min(1, (num - min) / (max - min || 1)))
  const display = step < 1
    ? num.toFixed(String(step).split('.')[1]?.length ?? 2).replace(/\.?0+$/, '')
    : String(num)
  return (
    <div style={{ background: '#FAFAFA', border: '1px solid #E5E7EB', borderRadius: 4, padding: '14px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
        <span style={{ fontSize: 13, color: '#6B7280' }}>{field.placeholder_text || ''}</span>
        <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace', fontSize: 14, fontWeight: 600, color: '#1a1a1a' }}>
          {display}{unit}
        </span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={num}
        onChange={e => onChange(e.target.value)}
        style={{
          width: '100%',
          appearance: 'none',
          height: 6,
          borderRadius: 999,
          background: `linear-gradient(to right, #1a1a1a 0%, #1a1a1a ${pct * 100}%, #E5E7EB ${pct * 100}%, #E5E7EB 100%)`,
          outline: 'none',
          cursor: 'pointer',
        }}
      />
      <style>{`
        input[type="range"]::-webkit-slider-thumb {
          appearance: none; width: 22px; height: 22px; border-radius: 50%;
          background: #FFFFFF; border: 2px solid #1a1a1a;
          box-shadow: 0 2px 6px rgba(0,0,0,0.15); cursor: pointer;
        }
        input[type="range"]::-moz-range-thumb {
          width: 22px; height: 22px; border-radius: 50%;
          background: #FFFFFF; border: 2px solid #1a1a1a;
          box-shadow: 0 2px 6px rgba(0,0,0,0.15); cursor: pointer;
        }
      `}</style>
    </div>
  )
}

function LoopField({ field, value, onChange, onItemFocus }: {
  field: FieldSchema; value: string; onChange: (v: string) => void
  onItemFocus?: (item: Record<string, string> | null, idx: number) => void
}) {
  const subFields = field.sub_fields ?? []
  const maxItems = field.max_items ?? 50

  const items: Record<string, string>[] = (() => {
    try { return JSON.parse(value || '[]') } catch { return [] }
  })()

  const [expandedIdx, setExpandedIdx] = useState<number | null>(items.length === 0 ? null : 0)

  // Notify parent which item is currently being edited (for preview sync)
  useEffect(() => {
    if (!onItemFocus) return
    if (expandedIdx === null) onItemFocus(null, -1)
    else onItemFocus(items[expandedIdx] ?? null, expandedIdx)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandedIdx, value])

  function save(next: Record<string, string>[]) {
    onChange(JSON.stringify(next))
  }

  function addItem() {
    const empty: Record<string, string> = {}
    for (const sf of subFields) empty[sf.key] = sf.default_value ?? ''
    const next = [...items, empty]
    save(next)
    setExpandedIdx(next.length - 1)
  }

  function removeItem(idx: number) {
    save(items.filter((_, i) => i !== idx))
    setExpandedIdx(prev => prev === idx ? null : prev !== null && prev > idx ? prev - 1 : prev)
  }

  function updateSubField(itemIdx: number, key: string, val: string) {
    save(items.map((item, i) => i === itemIdx ? { ...item, [key]: val } : item))
  }

  function moveItem(from: number, to: number) {
    if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return
    const next = items.slice()
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    save(next)
    setExpandedIdx(prev => prev === from ? to : prev === to ? from : prev)
  }

  // First text sub-field used as item label in the collapsed header
  const titleKey = subFields.find(sf => sf.type === 'text' || sf.type === 'textarea')?.key
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)

  return (
    <div className="flex flex-col gap-2">
      {items.length === 0 && (
        <div className="text-center py-8 rounded-[16px] text-sm text-gray-400"
          style={{ border: '2px dashed #E5E7EB' }}>
          Noch keine Einträge vorhanden.
        </div>
      )}

      {items.map((item, idx) => {
        const isOpen = expandedIdx === idx
        const title = (titleKey && item[titleKey]) ? item[titleKey] : `${field.label} ${idx + 1}`
        const isDragOver = dragOverIdx === idx && dragIdx !== null && dragIdx !== idx
        const isDragging = dragIdx === idx
        return (
          <div key={idx}
            draggable={items.length > 1}
            onDragStart={(e) => {
              setDragIdx(idx)
              try { e.dataTransfer.effectAllowed = 'move' } catch {}
              try { e.dataTransfer.setData('text/plain', String(idx)) } catch {}
            }}
            onDragOver={(e) => { e.preventDefault(); try { e.dataTransfer.dropEffect = 'move' } catch {}; if (dragOverIdx !== idx) setDragOverIdx(idx) }}
            onDragLeave={() => setDragOverIdx(prev => prev === idx ? null : prev)}
            onDrop={(e) => { e.preventDefault(); if (dragIdx !== null) moveItem(dragIdx, idx); setDragIdx(null); setDragOverIdx(null) }}
            onDragEnd={() => { setDragIdx(null); setDragOverIdx(null) }}
            className="rounded-[16px] overflow-hidden transition-all"
            style={{
              border: `1.5px solid ${isOpen ? '#1a1a1a' : isDragOver ? '#1a1a1a' : '#E5E7EB'}`,
              background: 'white',
              opacity: isDragging ? 0.45 : 1,
              boxShadow: isDragOver ? '0 0 0 3px rgba(26,26,26,0.06)' : 'none',
            }}>

            {/* Item header */}
            <div className="flex items-center justify-between px-4 py-3 cursor-pointer select-none"
              onClick={() => setExpandedIdx(isOpen ? null : idx)}>
              <div className="flex items-center gap-2.5 min-w-0">
                {items.length > 1 && (
                  <span className="flex items-center justify-center flex-shrink-0"
                    style={{ color: '#D1D5DB', cursor: 'grab', width: 16, height: 16 }}
                    onClick={e => e.stopPropagation()}
                    title="Zum Verschieben halten und ziehen">
                    <svg width="12" height="14" viewBox="0 0 12 14" fill="currentColor">
                      <circle cx="3" cy="3" r="1.3"/><circle cx="9" cy="3" r="1.3"/>
                      <circle cx="3" cy="7" r="1.3"/><circle cx="9" cy="7" r="1.3"/>
                      <circle cx="3" cy="11" r="1.3"/><circle cx="9" cy="11" r="1.3"/>
                    </svg>
                  </span>
                )}
                <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{ background: isOpen ? '#1a1a1a' : '#F3F4F6', color: isOpen ? 'white' : '#9CA3AF' }}>
                  {idx + 1}
                </span>
                <span className="text-sm font-semibold text-gray-800 truncate">{title}</span>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button type="button"
                  onClick={e => { e.stopPropagation(); removeItem(idx) }}
                  className="p-1.5 rounded-[8px] transition-all"
                  style={{ color: '#9CA3AF' }}
                  onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = '#DC2626')}
                  onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = '#9CA3AF')}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>
                  </svg>
                </button>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2"
                  style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}>
                  <path d="M6 9l6 6 6-6"/>
                </svg>
              </div>
            </div>

            {/* Sub-fields */}
            {isOpen && (
              <div className="px-4 pb-4 border-t flex flex-col gap-4" style={{ borderColor: '#F3F4F6' }}>
                {subFields.filter(sf => checkShowWhen(sf, item, subFields)).map(sf => (
                  <div key={sf.key} className="pt-3">
                    <label className="block text-sm font-semibold text-gray-800 mb-1.5">
                      {sf.label}
                      {sf.required && <span className="text-red-500 ml-1">*</span>}
                    </label>
                    {sf.type === 'loop' ? (
                      <LoopField
                        field={subToFieldSchema(sf)}
                        value={item[sf.key] ?? ''}
                        onChange={v => updateSubField(idx, sf.key, v)}
                      />
                    ) : sf.type === 'card_select' ? (
                      <CardSelectField
                        field={subToFieldSchema(sf)}
                        value={item[sf.key] ?? ''}
                        onChange={v => updateSubField(idx, sf.key, v)}
                      />
                    ) : sf.type === 'color' ? (
                      <ColorField
                        value={item[sf.key] ?? ''}
                        onChange={v => updateSubField(idx, sf.key, v)}
                        placeholder={sf.placeholder_text}
                      />
                    ) : sf.type === 'date' ? (
                      <DateField
                        value={item[sf.key] ?? ''}
                        onChange={v => updateSubField(idx, sf.key, v)}
                      />
                    ) : sf.type === 'date_multi' ? (
                      <MultiDateField
                        value={item[sf.key] ?? ''}
                        onChange={v => updateSubField(idx, sf.key, v)}
                      />
                    ) : sf.type === 'time' ? (
                      <input
                        type="time"
                        value={item[sf.key] ?? ''}
                        onChange={e => updateSubField(idx, sf.key, e.target.value)}
                        style={INPUT}
                        onFocus={focusBorder} onBlur={blurBorder}
                      />
                    ) : sf.type === 'toggle' ? (
                      <ToggleField field={sf} value={item[sf.key] ?? ''} onChange={v => updateSubField(idx, sf.key, v)} />
                    ) : sf.type === 'range' ? (
                      <RangeField field={sf} value={item[sf.key] ?? ''} onChange={v => updateSubField(idx, sf.key, v)} />
                    ) : sf.type === 'richtext' ? (
                      <RichTextField
                        value={item[sf.key] ?? ''}
                        onChange={v => updateSubField(idx, sf.key, v)}
                        placeholder={sf.placeholder_text || sf.label}
                        maxLength={sf.max_length}
                        complianceCheck={false}
                      />
                    ) : sf.type === 'image' ? (
                      <ImageField
                        field={sf}
                        value={item[sf.key] ?? ''}
                        onChange={v => updateSubField(idx, sf.key, v)}
                      />
                    ) : sf.type === 'textarea' ? (
                      <textarea
                        value={item[sf.key] ?? ''}
                        onChange={e => updateSubField(idx, sf.key, e.target.value)}
                        placeholder={sf.placeholder_text || sf.label}
                        rows={3}
                        maxLength={sf.max_length ?? undefined}
                        style={{ ...INPUT, resize: 'vertical' }}
                        onFocus={focusBorder} onBlur={blurBorder}
                      />
                    ) : sf.type === 'dropdown' ? (
                      <select
                        value={item[sf.key] ?? ''}
                        onChange={e => updateSubField(idx, sf.key, e.target.value)}
                        style={{ ...INPUT, cursor: 'pointer' }}
                        onFocus={focusBorder} onBlur={blurBorder}>
                        <option value="">— bitte wählen —</option>
                        {(sf.options ?? []).filter(Boolean).map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type={sf.type === 'email' ? 'email' : sf.type === 'url' ? 'url' : 'text'}
                        value={item[sf.key] ?? ''}
                        onChange={e => updateSubField(idx, sf.key, e.target.value)}
                        placeholder={sf.placeholder_text || sf.label}
                        maxLength={sf.max_length ?? undefined}
                        style={INPUT}
                        onFocus={focusBorder} onBlur={blurBorder}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}

      {items.length < maxItems && (
        <button type="button" onClick={addItem}
          className="flex items-center justify-center gap-2 py-3 text-sm font-semibold rounded-[16px] transition-all w-full mt-1"
          style={{ border: '1.5px dashed #D1D5DB', color: '#374151', background: 'transparent' }}
          onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = '#1a1a1a'; el.style.background = '#F9FAFB' }}
          onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = '#D1D5DB'; el.style.background = 'transparent' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          {field.label} hinzufügen
        </button>
      )}
    </div>
  )
}

// ─── Field Renderer ───────────────────────────────────────────────────────────

function FieldRenderer({ field, value, onChange, onItemFocus, complianceApprovedText, onComplianceApproved, onComplianceRevoked }: {
  field: FieldSchema; value: string; onChange: (v: string) => void
  onItemFocus?: (item: Record<string, string> | null, idx: number) => void
  complianceApprovedText?: string
  onComplianceApproved?: (approvedHtml: string) => void
  onComplianceRevoked?: () => void
}) {
  switch (field.type) {
    case 'textarea':
      return (
        <textarea value={value} onChange={e => onChange(e.target.value)}
          placeholder={field.placeholder_text || field.label}
          rows={4} maxLength={field.max_length ?? undefined}
          style={{ ...INPUT, resize: 'vertical' }}
          onFocus={focusBorder} onBlur={blurBorder} />
      )
    case 'richtext':
      return (
        <RichTextField
          value={value}
          onChange={onChange}
          placeholder={field.placeholder_text || field.label}
          maxLength={field.max_length}
          complianceCheck={field.compliance_check === true}
          complianceApproved={field.compliance_check ? !!complianceApprovedText : undefined}
          onComplianceApproved={field.compliance_check ? onComplianceApproved : undefined}
          onComplianceRevoked={field.compliance_check ? onComplianceRevoked : undefined}
        />
      )
    case 'image':
      return <ImageField field={field} value={value} onChange={onChange} />
    case 'dropdown':
      return (
        <select value={value} onChange={e => onChange(e.target.value)}
          style={{ ...INPUT, cursor: 'pointer' }}
          onFocus={focusBorder} onBlur={blurBorder}>
          <option value="">— bitte wählen —</option>
          {(field.options ?? []).filter(Boolean).map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      )
    case 'card_select':
      return <CardSelectField field={field} value={value} onChange={onChange} />
    case 'url':
      return (
        <input type="url" value={value} onChange={e => onChange(e.target.value)}
          placeholder={field.placeholder_text || 'https://'}
          maxLength={field.max_length ?? undefined}
          style={INPUT} onFocus={focusBorder} onBlur={blurBorder} />
      )
    case 'email':
      return (
        <input type="email" value={value} onChange={e => onChange(e.target.value)}
          placeholder={field.placeholder_text || 'name@beispiel.de'}
          maxLength={field.max_length ?? undefined}
          style={INPUT} onFocus={focusBorder} onBlur={blurBorder} />
      )
    case 'loop':
      return <LoopField field={field} value={value} onChange={onChange} onItemFocus={onItemFocus} />
    case 'color':
      return <ColorField value={value} onChange={onChange} placeholder={field.placeholder_text} />
    case 'date':
      return <DateField value={value} onChange={onChange} />
    case 'date_multi':
      return <MultiDateField value={value} onChange={onChange} />
    case 'time':
      return (
        <input type="time" value={value} onChange={e => onChange(e.target.value)}
          style={INPUT} onFocus={focusBorder} onBlur={blurBorder} />
      )
    case 'toggle':
      return <ToggleField field={field} value={value} onChange={onChange} />
    case 'range':
      return <RangeField field={field} value={value} onChange={onChange} />
    default:
      return (
        <input type="text" value={value} onChange={e => onChange(e.target.value)}
          placeholder={field.placeholder_text || field.label}
          maxLength={field.max_length ?? undefined}
          style={INPUT} onFocus={focusBorder} onBlur={blurBorder} />
      )
  }
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SiteEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const quota = usePlanQuota()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const [site, setSite] = useState<SiteData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [toggling, setToggling] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [publishedUrl, setPublishedUrl] = useState('')
  const [values, setValues] = useState<Record<string, string>>({})
  const [previewKey, setPreviewKey] = useState(0)
  const [previewHash, setPreviewHash] = useState<string>('')
  const lastAutosavedRef = useRef<string>('')
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [autosaveState, setAutosaveState] = useState<'idle' | 'pending' | 'saving' | 'saved' | 'error'>('idle')
  const [activeSection, setActiveSection] = useState<string | null>(null)
  const [deviceView, setDeviceView] = useState<'desktop' | 'tablet' | 'mobile'>(
    typeof window !== 'undefined' && window.innerWidth < 768 ? 'mobile' : 'desktop'
  )
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deletingSite, setDeletingSite] = useState(false)
  const [showPublishCelebration, setShowPublishCelebration] = useState(false)
  const [showFullPreview, setShowFullPreview] = useState(false)
  const [showLivePreview, setShowLivePreview] = useState(true)
  const [livePreviewDevice, setLivePreviewDevice] = useState<'mobile' | 'tablet' | 'desktop'>('desktop')
  const [livePreviewPanelW, setLivePreviewPanelW] = useState<number>(560)
  const [winW, setWinW] = useState(typeof window === 'undefined' ? 1440 : window.innerWidth)
  const [winH, setWinH] = useState(typeof window === 'undefined' ? 900 : window.innerHeight)
  useEffect(() => {
    // Restore saved panel width on mount
    try {
      const saved = localStorage.getItem('finestsites-preview-w')
      if (saved) {
        const n = parseInt(saved, 10)
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (!isNaN(n) && n >= 360) setLivePreviewPanelW(n)
      }
    } catch {}
    const onResize = () => { setWinW(window.innerWidth); setWinH(window.innerHeight) }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  // Clamp panel width to current screen size — leave at least 400px for the form
  useEffect(() => {
    const maxW = Math.max(400, winW - 400)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (livePreviewPanelW > maxW) setLivePreviewPanelW(maxW)
  }, [winW, livePreviewPanelW])
  const [hasChanges, setHasChanges] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    Promise.all([
      fetch(`/api/sites/${id}`).then(r => r.json()),
      fetch('/api/user/profile').then(r => r.json()).catch(() => ({})),
    ]).then(([data, userProfile]: [SiteData, Record<string, string | null>]) => {
        setSite(data)
        const fields = data.templates?.placeholder_schema?.fields ?? []
        const init: Record<string, string> = {}
        for (const f of fields) {
          // If the field has a saved value, use it.
          // If it's empty, try to pre-fill from the user's profile.
          const saved = data.data?.[f.key]
          if (saved) {
            init[f.key] = saved
          } else {
            init[f.key] = getProfilePrefill(f.key, f.type, userProfile) ?? f.default_value ?? ''
          }
        }
        // Restore compliance approval flags from DB (stored as fieldKey + '__chk').
        // The init loop above only processes schema fields, so we restore __chk
        // keys separately so the locked read-only view survives page reloads.
        for (const f of fields) {
          if ((f as any).compliance_check) {
            const chkKey = f.key + '__chk'
            if ((data.data as Record<string, string>)?.[chkKey]) {
              init[chkKey] = (data.data as Record<string, string>)[chkKey]
            }
          }
        }
        setValues(init)
        // Mark the initial-loaded state as already-saved so autosave doesn't
        // fire on the very first render.
        lastAutosavedRef.current = JSON.stringify(init)
        setLoading(false)
        const sections = [...new Set(fields.map(f => f.section || 'Allgemein').filter(Boolean))]
        if (sections.length > 0) setActiveSection(sections[0])
      })
      .catch(() => setLoading(false))
  }, [id])

  const updatePreview = useCallback((_vals: Record<string, string>) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setPreviewKey(k => k + 1), 600)
  }, [])

  function showToast(message: string, type: 'success' | 'error' = 'success') {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToast({ message, type })
    toastTimerRef.current = setTimeout(() => setToast(null), 3500)
  }

  // ── Live-preview iframe orchestration ─────────────────────────────────
  // Tracks data passed between iframe loads so the preview behaves smoothly:
  //  - pendingScrollSection: when a section toggle needed a reload (because the
  //    section wasn't in DOM), we scroll to it after the new load.
  //  - lastScrollYRef: captures the scroll position before any reload so we
  //    can restore it (instead of jumping to top on every edit).
  const [pendingScrollSection, setPendingScrollSection] = useState<{ key: string; mode: 'on' | 'off' } | null>(null)
  const livePreviewIframeRef = useRef<HTMLIFrameElement>(null)
  const lastScrollYRef = useRef<number>(0)
  const pendingReloadRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Listen for ACK from iframe. If a live update was handled, cancel the
  // pending fallback reload — we don't need to reload the iframe.
  useEffect(() => {
    function onMsg(ev: MessageEvent) {
      const d = ev?.data
      if (!d || typeof d !== 'object') return
      if (d.type === 'finestsites:updateFieldAck' && d.handled) {
        if (pendingReloadRef.current) {
          clearTimeout(pendingReloadRef.current)
          pendingReloadRef.current = null
        }
      }
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [])

  function handleChange(key: string, val: string) {
    const next = { ...values, [key]: val }
    setValues(next)
    setHasChanges(true)

    // ── Section-toggle fast path ─────────────────────────────────────────
    // Convention: any field starting with `zeige_` is a section toggle.
    // Try to animate the change inside the iframe WITHOUT reloading it.
    if (/^zeige_/.test(key)) {
      const iframe = livePreviewIframeRef.current
      let sectionInDom = false
      try {
        sectionInDom = !!iframe?.contentWindow?.document?.querySelector(`[data-section="${key}"]`)
      } catch { /* cross-origin or not ready */ }

      if (sectionInDom) {
        // Section currently rendered → live-animate, no reload
        iframe?.contentWindow?.postMessage(
          { type: 'finestsites:toggleSection', section: key, mode: val === 'ja' ? 'on' : 'off' },
          '*'
        )
        return
      }
      // Section not in DOM → need a reload; queue scroll for after-load
      setPendingScrollSection({ key, mode: val === 'ja' ? 'on' : 'off' })
      updatePreview(next)
      return
    }

    // ── Structural fields ALWAYS reload ─────────────────────────────────
    // Card-selects, colour pickers, ranges, toggles and image fields all
    // commonly drive `{{#if key=value}}` conditional <style> blocks or
    // inline CSS variables. The runtime's text-marker patcher cannot
    // re-apply those, so an in-place update would leave a half-styled DOM
    // (the bug where switching theme leaves the preview black). For these
    // we skip the live update and reload directly, with scroll preserved.
    const fieldDef = fields.find(f => f.key === key)
    const structural = fieldDef && ['card_select', 'color', 'toggle', 'range', 'image'].includes(fieldDef.type)
    if (structural) {
      try {
        const iframe = livePreviewIframeRef.current
        if (iframe?.contentWindow) lastScrollYRef.current = iframe.contentWindow.scrollY || 0
      } catch { /* cross-origin */ }
      updatePreview(next)
      return
    }

    // ── Generic edit: try LIVE patching first, fall back to reload ──────
    // The iframe runtime listens for `updateField` and patches DOM in-place.
    // It posts back an ACK with `handled: true` when it found markers and
    // applied the change. If it didn't (e.g. the field is inside a hidden
    // {{#if}} conditional), we fall back to a reload — but with scroll
    // position preserved so the user doesn't jump.
    try {
      const iframe = livePreviewIframeRef.current
      if (iframe?.contentWindow) {
        // Cancel any pending reload from previous changes — live updates make
        // the reload unnecessary for fields the runtime can handle.
        if (debounceRef.current) {
          clearTimeout(debounceRef.current)
          debounceRef.current = null
        }
        iframe.contentWindow.postMessage(
          { type: 'finestsites:updateField', key, value: val },
          '*'
        )
        // Schedule a fall-back reload in case the runtime can't handle this
        // field (i.e. it's currently inside a hidden conditional). The ACK
        // handler will cancel this if the live update succeeded.
        lastScrollYRef.current = iframe.contentWindow.scrollY || 0
        pendingReloadRef.current = setTimeout(() => {
          pendingReloadRef.current = null
          setPreviewKey(k => k + 1)
        }, 250)
        return
      }
    } catch { /* same-origin issue */ }
    // Iframe not ready — fall back to debounced reload.
    updatePreview(next)
  }

  // After preview iframe loads:
  //   1. If a section toggle wanted a scroll-to → send it
  //   2. Else if we captured a scrollY before reload → restore it
  function handleLivePreviewLoad() {
    const iframe = livePreviewIframeRef.current

    if (pendingScrollSection) {
      const target = pendingScrollSection
      setTimeout(() => {
        iframe?.contentWindow?.postMessage(
          { type: 'finestsites:scroll', section: target.key, mode: target.mode },
          '*'
        )
      }, 50)
      setPendingScrollSection(null)
      lastScrollYRef.current = 0
      return
    }

    if (lastScrollYRef.current > 0) {
      const y = lastScrollYRef.current
      lastScrollYRef.current = 0
      setTimeout(() => {
        iframe?.contentWindow?.postMessage(
          { type: 'finestsites:restoreScroll', y },
          '*'
        )
      }, 50)
    }
  }

  async function handleSave() {
    setSaving(true); setError('')
    const res = await fetch(`/api/sites/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    })
    if (!res.ok) {
      const d = await res.json()
      setError(d.error ?? 'Fehler beim Speichern.')
    } else {
      setSuccess('Gespeichert!')
      setTimeout(() => setSuccess(''), 2000)
    }
    setSaving(false)
  }

  async function handlePublish() {
    await fetch(`/api/sites/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    })
    setPublishing(true); setError('')
    const res = await fetch(`/api/sites/${id}/publish`, { method: 'POST' })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Fehler beim Veröffentlichen.')
      showToast(data.error ?? 'Fehler beim Veröffentlichen.', 'error')
    } else {
      setPublishedUrl(data.url)
      setSite(prev => prev ? { ...prev, status: 'published' } : prev)
      setHasChanges(false)
      setSuccess('Veröffentlicht!')
      setTimeout(() => setSuccess(''), 3000)
      showToast('Seite ist jetzt live!')
      setShowPublishCelebration(true)
      quota.refetch()
    }
    setPublishing(false)
  }

  async function handleUnpublish() {
    setToggling(true)
    await fetch(`/api/sites/${id}/publish`, { method: 'DELETE' })
    setSite(prev => prev ? { ...prev, status: 'draft' } : prev)
    setPublishedUrl('')
    setToggling(false)
    showToast('Seite wurde offline gestellt')
    quota.refetch()
  }

  async function handlePublishToggle() {
    setToggling(true)
    await fetch(`/api/sites/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    })
    const res = await fetch(`/api/sites/${id}/publish`, { method: 'POST' })
    const data = await res.json()
    if (!res.ok) {
      showToast(data.error ?? 'Fehler beim Veröffentlichen.', 'error')
    } else {
      setPublishedUrl(data.url)
      setSite(prev => prev ? { ...prev, status: 'published' } : prev)
      setHasChanges(false)
      showToast('Seite ist jetzt live!')
      quota.refetch()
    }
    setToggling(false)
  }

  async function handleDeleteSite() {
    setDeletingSite(true)
    const res = await fetch(`/api/sites/${id}`, { method: 'DELETE' })
    if (res.ok) {
      quota.refetch()
      router.push('/sites')
    } else {
      setDeletingSite(false); setShowDeleteModal(false); setError('Fehler beim Löschen.')
    }
  }

  // Soft-update iframe location.hash when previewHash changes
  // (avoids full iframe reload while navigating between overview ↔ event landing)
  useEffect(() => {
    const tryUpdate = () => {
      const ifr = livePreviewIframeRef.current
      const win = ifr?.contentWindow
      if (!win) return false
      try {
        const want = previewHash ? '#' + previewHash : ''
        if ((win.location.hash || '') !== want) {
          win.location.hash = previewHash
        }
        return true
      } catch { return false }
    }
    if (!tryUpdate()) {
      const tid = setTimeout(tryUpdate, 120)
      return () => clearTimeout(tid)
    }
  }, [previewHash])

  // Reset the focused event when the user switches away from the Events section
  useEffect(() => {
    if (activeSection !== 'Events') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPreviewHash('')
    }
  }, [activeSection])

  // ── Auto-save (debounced) — persists drafts to the server while the user
  //   edits, so the work survives a page refresh / browser close without
  //   needing an explicit "Speichern" click.
  useEffect(() => {
    if (loading || !site) return
    const serialized = JSON.stringify(values)
    if (serialized === lastAutosavedRef.current) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAutosaveState('pending')
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current)
    autosaveTimerRef.current = setTimeout(async () => {
      setAutosaveState('saving')
      try {
        const res = await fetch(`/api/sites/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: serialized,
        })
        if (res.ok) {
          lastAutosavedRef.current = serialized
          setAutosaveState('saved')
          setTimeout(() => {
            setAutosaveState(prev => prev === 'saved' ? 'idle' : prev)
          }, 2500)
        } else {
          setAutosaveState('error')
        }
      } catch {
        setAutosaveState('error')
      }
    }, 1200)
    return () => {
      if (autosaveTimerRef.current) { clearTimeout(autosaveTimerRef.current); autosaveTimerRef.current = null }
    }
  }, [values, loading, site, id])

  // Warn the user before leaving the page if there are unsaved changes
  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (autosaveState === 'pending' || autosaveState === 'saving') {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [autosaveState])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 rounded-full border-2 border-gray-200 border-t-gray-900 animate-spin" />
      </div>
    )
  }
  if (!site) return <div className="p-8 text-center text-gray-500">Website nicht gefunden.</div>

  const fields = site.templates?.placeholder_schema?.fields ?? []
  const sections = [...new Set(fields.map(f => f.section || 'Allgemein'))]
  // Add the virtual Domain section at the end of the sidebar
  const allSections = [...sections, DOMAIN_SECTION]
  const previewDataB64 = Buffer.from(JSON.stringify(values)).toString('base64')
  const previewUrl = `/api/preview/${id}?data=${encodeURIComponent(previewDataB64)}${previewHash ? '#' + encodeURIComponent(previewHash) : ''}`

  function getSectionCompletion(sec: string) {
    const sf = fields.filter(f => (f.section || 'Allgemein') === sec)
    const complete = sf.filter(f => f.required).every(f => !!values[f.key])
    return { complete, count: sf.length }
  }

  const isDomainSection = activeSection === DOMAIN_SECTION
  const activeIdx = activeSection ? sections.indexOf(activeSection) : 0
  const isFirst = activeIdx === 0
  const isLast  = activeIdx === sections.length - 1
  const isPublished = site.status === 'published'
  const missingRequiredFields = fields
    .filter(f => f.required)
    .filter(f => checkShowWhen(f as unknown as LoopSubField, values, fields as unknown as LoopSubField[]))
    .filter(f => !values[f.key])
  // Fields with compliance_check that haven't been approved.
  // Approval is stored as a truthy value in values[key + '__chk'].
  // When the user clicks "Bearbeiten" the parent clears this flag, requiring re-approval.
  const complianceBlockedFields = fields
    .filter(f => f.compliance_check === true)
    .filter(f => checkShowWhen(f as unknown as LoopSubField, values, fields as unknown as LoopSubField[]))
    .filter(f => !values[f.key + '__chk'])
  const allRequiredComplete = missingRequiredFields.length === 0 && complianceBlockedFields.length === 0

  // Top-level show_when: hide fields whose visibility depends on another field
  // whose current value doesn't match the gate. Cascades correctly via the
  // shared checkShowWhen helper (treats the global `values` map like a loop item).
  const sectionFields = fields
    .filter(f => !activeSection || (f.section || 'Allgemein') === activeSection || sections.length === 1)
    .filter(f => checkShowWhen(f as unknown as LoopSubField, values, fields as unknown as LoopSubField[]))
    .sort((a, b) => ((a as any).order ?? 0) - ((b as any).order ?? 0))

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: '#F8FAFC' }}>

      {/* ── Toast notification ── */}
      <div
        className="fixed top-4 right-4 z-[9999] pointer-events-none"
        style={{ transition: 'all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
        {toast && (
          <div
            className="flex items-center gap-2.5 px-4 py-3 rounded-[14px] shadow-lg pointer-events-auto"
            style={{
              background: toast.type === 'success' ? '#1a1a1a' : '#FEF2F2',
              color: toast.type === 'success' ? 'white' : '#DC2626',
              border: toast.type === 'error' ? '1px solid #FECACA' : 'none',
              animation: 'slideInToast 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
            }}>
            {toast.type === 'success' ? (
              <span className="relative flex h-2 w-2 flex-shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400" />
              </span>
            ) : (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/>
              </svg>
            )}
            <span className="text-xs font-semibold">{toast.message}</span>
          </div>
        )}
      </div>
      <style>{`@keyframes slideInToast { from { opacity: 0; transform: translateY(-8px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }`}</style>

      {/* ── Mobile Header ── */}
      <div className="lg:hidden flex-shrink-0 flex items-center gap-3 px-4 py-3 bg-white border-b"
        style={{ borderColor: '#E5E7EB' }}>
        <button onClick={() => router.push('/sites')}
          className="w-10 h-10 flex items-center justify-center rounded-2xl flex-shrink-0"
          style={{ background: '#F3F4F6' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-900 truncate leading-tight">{site.templates?.title}</p>
          <div className="flex items-center gap-1.5">
            <p className="text-xs truncate leading-tight" style={{ color: '#9CA3AF' }}>
              {site.username ? `${site.username}.${site.templates?.domain}` : site.templates?.domain}
            </p>
            {/* Autosave indicator — mobile */}
            {autosaveState !== 'idle' && (
              <span className="flex-shrink-0 text-[10px] font-medium"
                style={{
                  color:
                    autosaveState === 'saving' || autosaveState === 'pending' ? '#9CA3AF' :
                    autosaveState === 'saved' ? '#16A34A' :
                    '#DC2626',
                }}>
                {autosaveState === 'saving' || autosaveState === 'pending' ? '· speichert…' :
                 autosaveState === 'saved' ? '· gespeichert' : '· nicht gespeichert'}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={() => { setShowFullPreview(true); setPreviewKey(k => k + 1) }}
            className="w-10 h-10 flex items-center justify-center rounded-2xl"
            style={{ background: '#F3F4F6' }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
          </button>
          <button
            onClick={isPublished ? handleUnpublish : handlePublishToggle}
            disabled={toggling || (!isPublished && !allRequiredComplete)}
            className="flex items-center gap-2 px-3 py-2.5 rounded-2xl transition-all select-none"
            style={{ background: isPublished ? '#F0FDF4' : '#F3F4F6', opacity: toggling ? 0.6 : 1 }}>
            <div className="relative w-8 h-[18px] rounded-full flex-shrink-0 transition-colors duration-200"
              style={{ background: isPublished ? '#16A34A' : '#D1D5DB' }}>
              <div className="absolute top-0.5 w-[14px] h-[14px] rounded-full bg-white shadow-sm transition-transform duration-200"
                style={{ transform: isPublished ? 'translateX(14px)' : 'translateX(2px)' }} />
            </div>
            <span className="text-xs font-semibold" style={{ color: isPublished ? '#16A34A' : '#6B7280' }}>
              {isPublished ? 'Live' : 'Offline'}
            </span>
          </button>
        </div>
      </div>

      {/* ── Desktop Header ── */}
      <div className="hidden lg:flex flex-shrink-0 items-center justify-between gap-3 px-5 py-3 bg-white border-b"
        style={{ borderColor: '#E5E7EB' }}>

        {/* Left: back + title */}
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={() => router.push('/sites')}
            className="w-9 h-9 flex items-center justify-center rounded-[11px] flex-shrink-0"
            style={{ background: '#F3F4F6' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 5l-7 7 7 7"/>
            </svg>
          </button>
          <div className="min-w-0">
            <h1 className="text-sm font-bold text-gray-900 leading-tight truncate">{site.templates?.title}</h1>
            <p className="text-xs font-mono truncate" style={{ color: '#9CA3AF' }}>
              {site.username ? `${site.username}.${site.templates?.domain}` : site.templates?.domain}
            </p>
          </div>
          <span className="flex-shrink-0 text-xs px-2.5 py-1 rounded-full font-medium"
            style={{
              background: isPublished ? '#DCFCE7' : '#F3F4F6',
              color: isPublished ? '#16A34A' : '#6B7280',
            }}>
            {isPublished ? '● Live' : '○ Entwurf'}
          </span>

          {/* Autosave status — subtle, no interaction */}
          <span className="flex-shrink-0 hidden sm:inline-flex items-center gap-1.5 text-xs font-medium select-none"
            style={{
              color:
                autosaveState === 'saving' || autosaveState === 'pending' ? '#6B7280' :
                autosaveState === 'saved' ? '#16A34A' :
                autosaveState === 'error' ? '#DC2626' :
                '#9CA3AF',
              opacity: autosaveState === 'idle' ? 0 : 1,
              transition: 'opacity 0.2s ease, color 0.2s ease',
            }}
            aria-live="polite">
            {(autosaveState === 'saving' || autosaveState === 'pending') && (
              <>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="animate-spin">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                </svg>
                <span>Speichert…</span>
              </>
            )}
            {autosaveState === 'saved' && (
              <>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                <span>Gespeichert</span>
              </>
            )}
            {autosaveState === 'error' && (
              <>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <span>Nicht gespeichert</span>
              </>
            )}
          </span>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-2 flex-shrink-0">

          {/* Live-Preview Toggle — desktop only (XL+) */}
          <button onClick={() => setShowLivePreview(v => !v)}
            className="hidden xl:flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-[11px] transition-colors"
            style={{
              background: showLivePreview ? '#1a1a1a' : '#F3F4F6',
              color: showLivePreview ? 'white' : '#374151',
            }}
            title={showLivePreview ? 'Live-Vorschau ausblenden' : 'Live-Vorschau einblenden'}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="3" width="20" height="14" rx="2"/>
              <line x1="8" y1="21" x2="16" y2="21"/>
              <line x1="12" y1="17" x2="12" y2="21"/>
            </svg>
            <span>Live-Vorschau</span>
          </button>

          {/* Fullscreen Preview button — neutral grey */}
          <button onClick={() => { setShowFullPreview(true); setPreviewKey(k => k + 1) }}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-[11px] transition-colors"
            style={{ background: '#F3F4F6', color: '#374151' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
            <span className="hidden sm:inline">Vorschau</span>
          </button>

          {/* Publish / Änderungen live */}
          {isPublished ? (
            <button onClick={handlePublish} disabled={publishing || !hasChanges || !allRequiredComplete}
              className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-[11px] transition-all"
              style={{
                background: hasChanges && allRequiredComplete ? '#16A34A' : '#E5E7EB',
                color: hasChanges && allRequiredComplete ? 'white' : '#9CA3AF',
                opacity: publishing ? 0.7 : 1,
                cursor: hasChanges && allRequiredComplete ? 'pointer' : 'not-allowed',
              }}>
              {publishing
                ? <span className="w-3 h-3 rounded-full border-2 border-current/40 border-t-current animate-spin" />
                : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>}
              {publishing ? 'Bitte warten…' : 'Änderungen live'}
            </button>
          ) : (
            <button onClick={handlePublish} disabled={publishing || !allRequiredComplete}
              className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-[11px] text-white transition-all"
              style={{ background: allRequiredComplete ? '#1a1a1a' : '#9CA3AF', boxShadow: allRequiredComplete ? '0 4px 14px rgba(26,26,26,0.2)' : 'none', opacity: publishing ? 0.7 : 1, cursor: allRequiredComplete ? 'pointer' : 'not-allowed' }}>
              {publishing
                ? <span className="w-3 h-3 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                : null}
              {publishing ? 'Bitte warten…' : 'Veröffentlichen'}
            </button>
          )}

          {/* Online / Offline Toggle */}
          <button
            onClick={isPublished ? handleUnpublish : handlePublishToggle}
            disabled={toggling || (!isPublished && !allRequiredComplete)}
            aria-label={isPublished ? 'Seite offline stellen' : 'Seite online stellen'}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-[11px] transition-all select-none"
            style={{ background: isPublished ? '#F0FDF4' : '#F3F4F6', opacity: toggling ? 0.6 : 1 }}>
            {/* Toggle pill */}
            <div className="relative w-9 h-5 rounded-full flex-shrink-0 transition-colors duration-200"
              style={{ background: isPublished ? '#16A34A' : '#D1D5DB' }}>
              <div
                className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200"
                style={{ transform: isPublished ? 'translateX(18px)' : 'translateX(2px)' }} />
            </div>
            <span className="text-xs font-semibold hidden sm:block"
              style={{ color: isPublished ? '#16A34A' : '#6B7280' }}>
              {isPublished ? 'Online' : 'Offline'}
            </span>
          </button>

          {/* Delete — only visible when offline */}
          {!isPublished && (
            <button onClick={() => setShowDeleteModal(true)}
              className="w-9 h-9 flex items-center justify-center rounded-[11px] transition-colors"
              style={{ background: '#FEF2F2', color: '#DC2626' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 6h18M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2"/>
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* ── Banners ── */}
      {error && (
        <div className="flex-shrink-0 mx-4 mt-3 px-4 py-3 rounded-[12px] text-sm text-red-600"
          style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}>{error}</div>
      )}
      {publishedUrl && (
        <div className="flex-shrink-0 mx-4 mt-3 px-4 py-3 rounded-[12px] text-sm flex items-center justify-between gap-3"
          style={{ background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
          <span className="font-medium text-green-800">✓ Deine Website ist live!</span>
          <a href={publishedUrl} target="_blank" rel="noopener noreferrer"
            className="text-xs font-mono text-green-700 hover:underline truncate">{publishedUrl}</a>
        </div>
      )}

      {/* ── Mobile: horizontal section tabs ── */}
      {sections.length > 0 && (
        <div className="lg:hidden flex-shrink-0 overflow-x-auto scrollbar-none bg-white border-b"
          style={{ borderColor: '#E5E7EB', WebkitOverflowScrolling: 'touch' }}>
          <div className="flex gap-2 px-4 py-2 pb-2.5 min-w-max">
            {sections.map((sec) => {
              const isActive = activeSection === sec
              const { complete } = getSectionCompletion(sec)
              return (
                <button key={sec} type="button"
                  onClick={() => setActiveSection(sec)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold flex-shrink-0 transition-all min-h-[36px]"
                  style={{
                    background: isActive ? '#1a1a1a' : complete ? '#DCFCE7' : '#FFF7ED',
                    color: isActive ? 'white' : complete ? '#16A34A' : '#EA580C',
                  }}>
                  {!isActive && (complete ? (
                    <svg width="8" height="8" viewBox="0 0 10 8" fill="none">
                      <path d="M1 4L3.5 6.5L9 1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                    </svg>
                  ) : (
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                  ))}
                  {sec}
                </button>
              )
            })}
            {(() => {
              const isActive = activeSection === DOMAIN_SECTION
              const hasDomain = !!(site.custom_domain && site.custom_domain_status === 'active')
              return (
                <button type="button"
                  onClick={() => setActiveSection(DOMAIN_SECTION)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold flex-shrink-0 transition-all min-h-[36px]"
                  style={{
                    background: isActive ? '#1a1a1a' : hasDomain ? '#DCFCE7' : '#EFF6FF',
                    color: isActive ? 'white' : hasDomain ? '#16A34A' : '#3B82F6',
                  }}>
                  {hasDomain && !isActive && (
                    <svg width="8" height="8" viewBox="0 0 10 8" fill="none">
                      <path d="M1 4L3.5 6.5L9 1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                    </svg>
                  )}
                  Domain
                </button>
              )
            })()}
          </div>
        </div>
      )}

      {/* ── Two-column Body ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Left Sidebar: Section Navigation ── */}
        <aside className="hidden lg:flex flex-shrink-0 overflow-y-auto border-r flex-col gap-1 py-4 px-3"
            style={{
              width: '220px',
              borderColor: '#E5E7EB',
              background: 'white',
            }}>

            {sections.length > 0 && (
              <p className="text-xs font-semibold uppercase tracking-widest px-2 mb-2"
                style={{ color: '#9CA3AF' }}>
                Seitenbereiche
              </p>
            )}

            {sections.map((sec, idx) => {
              const { complete } = getSectionCompletion(sec)
              const isActive = activeSection === sec
              return (
                <button key={sec} type="button"
                  onClick={() => setActiveSection(sec)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-[12px] text-left transition-all w-full"
                  style={{
                    background: isActive ? '#1a1a1a' : 'transparent',
                    color: isActive ? 'white' : '#374151',
                  }}
                  onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = '#F3F4F6' }}
                  onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent' }}>

                  {/* Indicator */}
                  <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{
                      background: isActive ? 'rgba(255,255,255,0.2)' : complete ? '#DCFCE7' : '#FFF7ED',
                      color: isActive ? 'white' : complete ? '#16A34A' : '#EA580C',
                    }}>
                    {complete
                      ? <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
                      : <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                    }
                  </span>
                  <span className="text-sm font-medium truncate">{displaySection(sec)}</span>
                </button>
              )
            })}

            {/* Domain section button */}
            <div className="mt-1 pt-2" style={{ borderTop: '1px solid #F3F4F6' }}>
              {(() => {
                const isActive = activeSection === DOMAIN_SECTION
                const hasDomain = !!(site.custom_domain && site.custom_domain_status === 'active')
                return (
                  <button type="button"
                    onClick={() => setActiveSection(DOMAIN_SECTION)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-[12px] text-left transition-all w-full"
                    style={{ background: isActive ? '#1a1a1a' : 'transparent', color: isActive ? 'white' : '#374151' }}
                    onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = '#F3F4F6' }}
                    onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
                    <span className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ background: isActive ? 'rgba(255,255,255,0.2)' : hasDomain ? '#DCFCE7' : '#EFF6FF' }}>
                      {hasDomain ? (
                        <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke={isActive ? 'white' : '#16A34A'} strokeWidth="1.8" strokeLinecap="round"/></svg>
                      ) : (
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={isActive ? 'white' : '#3B82F6'} strokeWidth="2" strokeLinecap="round">
                          <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
                          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                        </svg>
                      )}
                    </span>
                    <span className="text-sm font-medium truncate">Domain</span>
                  </button>
                )
              })()}
            </div>

            {/* Separator + save */}
            <div className="mt-auto pt-4 border-t" style={{ borderColor: '#F3F4F6' }}>
              <button onClick={handleSave} disabled={saving}
                className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-[12px] transition-all"
                style={{ background: '#F3F4F6', color: '#374151' }}>
                {saving
                  ? <span className="w-3.5 h-3.5 rounded-full border-2 border-gray-300 border-t-gray-700 animate-spin" />
                  : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                }
                {saving ? 'Speichert…' : 'Speichern'}
              </button>
            </div>
        </aside>

        {/* ── Right: Form Content ── */}
        <main className="flex-1 flex flex-col overflow-hidden">
          <div id="editor-scroll" className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 py-4 sm:py-6 pb-28 lg:pb-6">

            {/* ── Domain section ── */}
            {isDomainSection && (
              <>
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-gray-900">Eigene Domain</h2>
                  <p className="text-sm mt-1" style={{ color: '#9CA3AF' }}>
                    Verbinde deine persönliche Web-Adresse
                  </p>
                </div>
                <DomainPanel
                  siteId={site.id}
                  subdomain={`${site.username ?? '...'}.${site.templates?.domain}`}
                  initialDomain={site.custom_domain ?? null}
                  initialStatus={site.custom_domain_status ?? null}
                />
              </>
            )}

            {/* Section heading */}
            {!isDomainSection && sections.length > 1 && activeSection && (
              <div className="mb-6">
                <p className="text-xs font-medium mb-1" style={{ color: '#9CA3AF' }}>
                  Schritt {activeIdx + 1} von {sections.length}
                </p>
                <h2 className="text-2xl font-bold text-gray-900">{displaySection(activeSection)}</h2>
                {/sektionen/i.test(activeSection) && (
                  <p className="text-sm mt-2 leading-relaxed" style={{ color: '#6B7280' }}>
                    Hier kannst du bestimmte Bereiche deiner Webseite <strong style={{ color: '#111' }}>ein- oder ausblenden</strong>. Was du ausblendest, sehen deine Besucher nicht.
                  </p>
                )}
              </div>
            )}

            {/* Fields */}
            {!isDomainSection && (
              <div className="flex flex-col gap-4">
                {fields.length === 0 && (
                  <div className="text-center py-16 text-sm text-gray-400 bg-white rounded-[20px]">
                    Dieses Template hat keine Felder.
                  </div>
                )}
                {/* Compliance-check richtext fields are kept mounted even when in a
                    different section so their locked/approved state survives
                    section navigation. All other fields unmount normally. */}
                {(() => {
                  const sectionKeySet = new Set(sectionFields.map(f => f.key))
                  // Hidden compliance fields: richtext + compliance_check, not in active section
                  const hiddenComplianceFields = fields.filter(
                    f => f.type === 'richtext' && f.compliance_check && !sectionKeySet.has(f.key)
                  )
                  return [...sectionFields, ...hiddenComplianceFields].map(field => {
                    const visible = sectionKeySet.has(field.key)
                    return (
                      <div key={field.key}
                        className={visible ? 'bg-white rounded-[20px] p-5' : ''}
                        style={visible
                          ? { boxShadow: '0 2px 8px rgba(0,0,0,0.05)', border: '1px solid #F0F0F0' }
                          : { display: 'none' }}>
                        {visible && (
                          <div className="mb-3">
                            <label className="text-base font-bold text-gray-900">
                              {field.label}
                              {field.required && <span className="text-red-500 ml-1">*</span>}
                            </label>
                            {field.type === 'loop' && (
                              <p className="text-xs text-gray-400 mt-0.5">
                                Wiederholbare Einträge, beliebig viele hinzufügen
                              </p>
                            )}
                            {field.placeholder_text && field.type !== 'loop' && (
                              <p className="text-sm text-gray-400 mt-0.5">{field.placeholder_text}</p>
                            )}
                          </div>
                        )}
                        <FieldRenderer
                          field={field}
                          value={values[field.key] ?? ''}
                          onChange={v => handleChange(field.key, v)}
                          complianceApprovedText={field.compliance_check ? (values[field.key + '__chk'] ?? '') : undefined}
                          onComplianceApproved={field.compliance_check ? (approvedHtml) => {
                            handleChange(field.key + '__chk', approvedHtml)
                            // Immediately persist to DB — don't rely on autosave timer
                            // so page reload also shows the locked view correctly
                            fetch(`/api/sites/${id}`, {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ [field.key + '__chk']: approvedHtml }),
                            }).catch(() => {})
                          } : undefined}
                          onComplianceRevoked={field.compliance_check ? () => handleChange(field.key + '__chk', '') : undefined}
                          onItemFocus={field.key === 'events'
                            ? (item, idx) => {
                                if (!item || idx < 0) { setPreviewHash(''); return }
                                const slug = item.kuerzel ? String(item.kuerzel).trim() : ''
                                // Synthetic identifier when the user has not given
                                // the event a slug yet — keeps the preview locked
                                // to the event landing in the iframe so per-event
                                // modus & accent show through immediately.
                                setPreviewHash(slug || `__pidx-${idx}__`)
                              }
                            : undefined}
                        />
                      </div>
                    )
                  })
                })()}
              </div>
            )}

            {/* Navigation buttons — desktop only */}
            {!isDomainSection && sections.length > 1 && (
              <div className="hidden lg:flex items-center justify-between mt-8 gap-3">
                {!isFirst ? (
                  <button
                    onClick={() => { setActiveSection(sections[activeIdx - 1]); document.getElementById('editor-scroll')?.scrollTo({ top: 0, behavior: 'smooth' }) }}
                    className="flex items-center gap-2 px-5 py-3 text-sm font-semibold rounded-[16px]"
                    style={{ background: 'white', color: '#374151', border: '1.5px solid #E5E7EB' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M19 12H5M12 5l-7 7 7 7"/>
                    </svg>
                    Zurück
                  </button>
                ) : <div />}

                {!isLast ? (
                  <button
                    onClick={async () => {
                      await handleSave()
                      setActiveSection(sections[activeIdx + 1])
                      document.getElementById('editor-scroll')?.scrollTo({ top: 0, behavior: 'smooth' })
                    }}
                    className="flex items-center gap-2 px-6 py-3 text-sm font-bold text-white rounded-[16px]"
                    style={{ background: '#1a1a1a', boxShadow: '0 4px 14px rgba(26,26,26,0.2)' }}>
                    Weiter
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M5 12h14M12 5l7 7-7 7"/>
                    </svg>
                  </button>
                ) : (
                  /* Last section: only allow publishing when all required fields are filled */
                  <div className="flex flex-col items-end gap-1.5">
                    {!allRequiredComplete && missingRequiredFields.length > 0 && (
                      <p className="text-xs text-right" style={{ color: '#EF4444', maxWidth: 260 }}>
                        Noch ausfüllen: {missingRequiredFields.map(f => f.label).join(', ')}
                      </p>
                    )}
                    {!allRequiredComplete && complianceBlockedFields.length > 0 && (
                      <p className="text-xs text-right" style={{ color: '#D97706', maxWidth: 260 }}>
                        Bitte EU-Health-Claims-Check durchführen: {complianceBlockedFields.map(f => f.label).join(', ')}
                      </p>
                    )}
                    <button onClick={handlePublish} disabled={publishing || !allRequiredComplete}
                      className="flex items-center gap-2 px-6 py-3 text-sm font-bold text-white rounded-[16px]"
                      style={{
                        background: allRequiredComplete ? (isPublished ? '#16A34A' : '#1a1a1a') : '#9CA3AF',
                        boxShadow: allRequiredComplete ? '0 4px 14px rgba(26,26,26,0.2)' : 'none',
                        opacity: publishing ? 0.7 : 1,
                        cursor: allRequiredComplete ? 'pointer' : 'not-allowed',
                      }}>
                      {publishing
                        ? <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                        : isPublished
                          ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
                          : null}
                      {publishing ? 'Bitte warten…' : isPublished ? 'Änderungen veröffentlichen' : '🚀 Jetzt veröffentlichen'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Single-section save — desktop only */}
            {!isDomainSection && sections.length <= 1 && (
              <div className="hidden lg:flex items-center gap-3 mt-8">
                <button onClick={handleSave} disabled={saving}
                  className="px-6 py-3 text-sm font-semibold rounded-[16px]"
                  style={{ background: '#F3F4F6', color: '#374151' }}>
                  {saving ? 'Speichert…' : 'Speichern'}
                </button>
                <button onClick={handlePublish} disabled={publishing || !allRequiredComplete}
                  className="flex items-center gap-2 px-6 py-3 text-sm font-bold text-white rounded-[16px]"
                  style={{ background: allRequiredComplete ? (isPublished ? '#16A34A' : '#1a1a1a') : '#9CA3AF', opacity: publishing ? 0.7 : 1, cursor: allRequiredComplete ? 'pointer' : 'not-allowed' }}>
                  {publishing ? 'Bitte warten…' : isPublished ? 'Änderungen live' : '🚀 Veröffentlichen'}
                </button>
              </div>
            )}

          </div>
          </div>{/* end editor-scroll */}

          {/* ── Mobile Bottom Action Bar ── */}
          <div className="lg:hidden flex-shrink-0 bg-white border-t flex items-center gap-3 px-4 pt-3 shadow-[0_-1px_0_0_#E5E7EB]"
            style={{ borderColor: '#E5E7EB', paddingBottom: 'max(env(safe-area-inset-bottom, 16px), 16px)' }}>

            {/* Zurück */}
            {!isDomainSection && sections.length > 1 && !isFirst && (
              <button
                onClick={() => {
                  setActiveSection(sections[activeIdx - 1])
                  document.getElementById('editor-scroll')?.scrollTo({ top: 0, behavior: 'smooth' })
                }}
                className="flex items-center justify-center gap-1.5 px-5 py-3.5 rounded-2xl text-sm font-semibold flex-shrink-0"
                style={{ background: '#F3F4F6', color: '#374151' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25">
                  <path d="M19 12H5M12 5l-7 7 7 7"/>
                </svg>
                Zurück
              </button>
            )}

            {/* Primary CTA */}
            <div className="flex-1">
              {isDomainSection ? (
                /* Domain: no primary action needed */
                <div />
              ) : sections.length <= 1 ? (
                /* Single section: Publish */
                <button onClick={handlePublish} disabled={publishing || !allRequiredComplete}
                  className="w-full flex items-center justify-center gap-2 py-3.5 text-sm font-bold text-white rounded-2xl"
                  style={{ background: allRequiredComplete ? (isPublished ? '#16A34A' : '#1a1a1a') : '#9CA3AF', opacity: publishing ? 0.7 : 1 }}>
                  {publishing ? <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> : null}
                  {publishing ? 'Bitte warten…' : isPublished ? '✓ Änderungen live stellen' : '🚀 Jetzt veröffentlichen'}
                </button>
              ) : !isLast ? (
                /* Not last: Weiter */
                <button
                  onClick={async () => {
                    await handleSave()
                    setActiveSection(sections[activeIdx + 1])
                    document.getElementById('editor-scroll')?.scrollTo({ top: 0, behavior: 'smooth' })
                  }}
                  disabled={saving}
                  className="w-full flex items-center justify-center gap-2 py-3.5 text-sm font-bold text-white rounded-2xl"
                  style={{ background: '#1a1a1a', boxShadow: '0 4px 14px rgba(26,26,26,0.2)', opacity: saving ? 0.7 : 1 }}>
                  {saving
                    ? <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    : <>
                        Weiter
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25">
                          <path d="M5 12h14M12 5l7 7-7 7"/>
                        </svg>
                      </>
                  }
                </button>
              ) : (
                /* Last section: Publish */
                <button onClick={handlePublish} disabled={publishing || !allRequiredComplete}
                  className="w-full flex items-center justify-center gap-2 py-3.5 text-sm font-bold text-white rounded-2xl"
                  style={{
                    background: allRequiredComplete ? (isPublished ? '#16A34A' : '#1a1a1a') : '#9CA3AF',
                    boxShadow: allRequiredComplete ? '0 4px 14px rgba(26,26,26,0.2)' : 'none',
                    opacity: publishing ? 0.7 : 1,
                  }}>
                  {publishing ? <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> : null}
                  {publishing ? 'Bitte warten…' : isPublished ? '✓ Änderungen live stellen' : '🚀 Jetzt veröffentlichen'}
                </button>
              )}
            </div>
          </div>
        </main>

        {/* ── Live-Preview Panel (XL+ only) ──
             - Iframe is rendered at the actual device viewport size (mobile/tablet/desktop)
               so the page's own scroll context works correctly. This is critical for
               GSAP ScrollTrigger / IntersectionObserver / position: sticky etc.
             - The user scrolls INSIDE the iframe (pointer-events: auto).
             - Iframe is visually scaled with CSS transform so the whole device fits
               in the panel without horizontal scrollbars. */}
        {showLivePreview && (() => {
          const PANEL_W = livePreviewPanelW
          const DEVICES: Record<'mobile' | 'tablet' | 'desktop', { w: number; h: number; label: string }> = {
            mobile:  { w: 390,  h: 844,  label: '390 × 844' },
            tablet:  { w: 820,  h: 1180, label: '820 × 1180' },
            desktop: { w: 1280, h: 800,  label: '1280 × 800' },
          }
          const dev = DEVICES[livePreviewDevice]
          // Scale only down (no upscaling beyond 100%) — leave 24px gutter on each side
          const scale = Math.min(1, (PANEL_W - 48) / dev.w)
          const scaledW = Math.round(dev.w * scale)
          // Iframe height: stretch to fill the panel's vertical viewport area
          // so we don't waste space below the rendered iframe.
          // Header(~52) + tabs(~44) + footer(~36) + padding(~24) ≈ 156px chrome.
          const availableH = Math.max(360, winH - 240)
          const iframeH = Math.max(dev.h, Math.round(availableH / scale))
          const scaledH = Math.round(iframeH * scale)

          const startDrag = (e: React.MouseEvent) => {
            e.preventDefault()
            const startX = e.clientX
            const startW = PANEL_W
            const onMove = (ev: MouseEvent) => {
              // Drag handle is on LEFT edge → moving left increases width
              const delta = startX - ev.clientX
              const minW = 360
              const maxW = Math.max(minW + 1, window.innerWidth - 360)
              const next = Math.max(minW, Math.min(maxW, startW + delta))
              setLivePreviewPanelW(next)
            }
            const onUp = () => {
              document.removeEventListener('mousemove', onMove)
              document.removeEventListener('mouseup', onUp)
              document.body.style.cursor = ''
              document.body.style.userSelect = ''
              try { localStorage.setItem('finestsites-preview-w', String(Math.round(PANEL_W))) } catch {}
            }
            document.body.style.cursor = 'col-resize'
            document.body.style.userSelect = 'none'
            document.addEventListener('mousemove', onMove)
            document.addEventListener('mouseup', onUp)
          }

          return (
            <aside
              className="hidden xl:flex flex-shrink-0 flex-col border-l overflow-hidden bg-white relative"
              style={{ width: PANEL_W, borderColor: '#E5E7EB' }}>

              {/* Drag handle on left edge — full-height, click+drag to resize */}
              <div
                onMouseDown={startDrag}
                onDoubleClick={() => {
                  // Double-click: toggle between compact and ~50%
                  const target = PANEL_W > 700
                    ? 560
                    : Math.max(700, Math.min(1100, Math.round(window.innerWidth * 0.5)))
                  setLivePreviewPanelW(target)
                  try { localStorage.setItem('finestsites-preview-w', String(target)) } catch {}
                }}
                title="Ziehen zum Vergrößern · Doppelklick zum Schnellumschalten"
                className="absolute top-0 left-0 bottom-0 z-20 group"
                style={{ width: 8, cursor: 'col-resize' }}>
                <div className="absolute inset-y-0 left-[3px] w-[2px] bg-transparent group-hover:bg-gray-300 transition-colors" />
                {/* Visual grip dots in middle on hover */}
                <div className="absolute top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  <div className="w-1 h-1 bg-gray-500 rounded-full mb-1" />
                  <div className="w-1 h-1 bg-gray-500 rounded-full mb-1" />
                  <div className="w-1 h-1 bg-gray-500 rounded-full" />
                </div>
              </div>

              {/* Preview header */}
              <div className="flex items-center justify-between px-4 py-3 flex-shrink-0 border-b"
                style={{ borderColor: '#E5E7EB', background: '#FAFAFA' }}>
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2 flex-shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                  </span>
                  <span className="text-xs font-bold text-gray-900">Live-Vorschau</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      const isWide = PANEL_W > 700
                      const target = isWide
                        ? 560
                        : Math.max(700, Math.min(1100, Math.round(window.innerWidth * 0.5)))
                      setLivePreviewPanelW(target)
                      try { localStorage.setItem('finestsites-preview-w', String(target)) } catch {}
                    }}
                    title={PANEL_W > 700 ? 'Schmaler stellen' : 'Breiter stellen (50% Screen)'}
                    className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-gray-200"
                    style={{ color: '#6B7280' }}>
                    {PANEL_W > 700 ? (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="9 14 4 14 4 19"/><polyline points="15 10 20 10 20 5"/>
                        <line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/>
                      </svg>
                    ) : (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/>
                        <line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>
                      </svg>
                    )}
                  </button>
                  <button
                    onClick={() => setPreviewKey(k => k + 1)}
                    title="Vorschau neu laden"
                    className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-gray-200"
                    style={{ color: '#6B7280' }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
                      <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
                    </svg>
                  </button>
                  <button
                    onClick={() => { setShowFullPreview(true); setPreviewKey(k => k + 1) }}
                    title="Vollbild öffnen"
                    className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-gray-200"
                    style={{ color: '#6B7280' }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 3h18v18H3z"/><path d="M9 9h6v6H9z"/>
                    </svg>
                  </button>
                  <button
                    onClick={() => setShowLivePreview(false)}
                    title="Vorschau ausblenden"
                    className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-gray-200"
                    style={{ color: '#6B7280' }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 6L6 18M6 6l12 12"/>
                    </svg>
                  </button>
                </div>
              </div>

              {/* Device toggle */}
              <div className="flex items-center justify-center gap-1 px-4 py-2.5 flex-shrink-0 border-b"
                style={{ borderColor: '#F1F5F9', background: '#FAFAFA' }}>
                {([
                  { key: 'mobile',  label: 'Mobile',  icon: (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12" y2="18"/>
                    </svg>
                  )},
                  { key: 'tablet',  label: 'Tablet',  icon: (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>
                    </svg>
                  )},
                  { key: 'desktop', label: 'Desktop', icon: (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
                    </svg>
                  )},
                ] as const).map(({ key, label, icon }) => {
                  const active = livePreviewDevice === key
                  return (
                    <button key={key}
                      onClick={() => setLivePreviewDevice(key)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors"
                      style={{
                        background: active ? '#1a1a1a' : 'transparent',
                        color: active ? 'white' : '#6B7280',
                      }}>
                      <span style={{ opacity: active ? 1 : 0.7 }}>{icon}</span>
                      {label}
                    </button>
                  )
                })}
              </div>

              {/* Scaled iframe viewport — internal scroll keeps GSAP working */}
              <div className="flex-1 overflow-auto flex items-start justify-center p-3"
                style={{ background: 'linear-gradient(180deg, #F1F5F9 0%, #E2E8F0 100%)' }}>
                <div style={{
                  width: scaledW,
                  height: scaledH,
                  position: 'relative',
                  borderRadius: livePreviewDevice === 'mobile' ? 28 : 8,
                  overflow: 'hidden',
                  background: 'white',
                  boxShadow: '0 4px 20px rgba(15,23,42,0.12), 0 1px 3px rgba(15,23,42,0.08)',
                }}>
                  <iframe
                    ref={livePreviewIframeRef}
                    key={`live-${previewKey}-${livePreviewDevice}`}
                    src={previewUrl}
                    onLoad={handleLivePreviewLoad}
                    style={{
                      width: dev.w,
                      height: iframeH,
                      border: 0,
                      background: 'white',
                      display: 'block',
                      transformOrigin: 'top left',
                      transform: `scale(${scale})`,
                    }}
                    title="Live preview"
                  />
                </div>
              </div>

              {/* Footer hint */}
              <div className="px-4 py-2.5 flex-shrink-0 border-t flex items-center justify-between text-[11px]"
                style={{ borderColor: '#E5E7EB', background: '#FAFAFA', color: '#9CA3AF' }}>
                <span>Aktualisiert sich beim Bearbeiten.</span>
                <span className="font-mono">{dev.label}</span>
              </div>
            </aside>
          )
        })()}
      </div>

      {/* Floating "show preview" pill when hidden */}
      {!showLivePreview && (
        <button
          onClick={() => setShowLivePreview(true)}
          className="hidden xl:flex items-center gap-2 fixed bottom-6 right-6 z-30 px-4 py-3 rounded-full font-semibold text-xs shadow-lg transition-all hover:scale-[1.03]"
          style={{ background: '#1a1a1a', color: 'white' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="2" y="3" width="20" height="14" rx="2"/>
            <line x1="8" y1="21" x2="16" y2="21"/>
            <line x1="12" y1="17" x2="12" y2="21"/>
          </svg>
          Live-Vorschau einblenden
        </button>
      )}

      {/* ── Fullscreen Preview ── */}
      {showFullPreview && (
        <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'rgba(0,0,0,0.92)' }}>
          <div className="flex items-center justify-between px-4 py-3 flex-shrink-0" style={{ background: '#1a1a1a' }}>
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-white">{site.templates?.title}</span>
              <div className="flex items-center gap-1 p-0.5 rounded-[10px]" style={{ background: 'rgba(255,255,255,0.1)' }}>
                {([
                  { key: 'desktop' as const, icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg> },
                  { key: 'tablet'  as const, icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="2" width="16" height="20" rx="2"/><circle cx="12" cy="18" r="1"/></svg> },
                  { key: 'mobile'  as const, icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="5" y="2" width="14" height="20" rx="2"/><circle cx="12" cy="18" r="1"/></svg> },
                ]).map(d => (
                  <button key={d.key} onClick={() => setDeviceView(d.key)}
                    className="p-1.5 rounded-[8px]"
                    style={{ background: deviceView === d.key ? 'rgba(255,255,255,0.2)' : 'transparent', color: 'white' }}>
                    {d.icon}
                  </button>
                ))}
              </div>
              <button onClick={() => setPreviewKey(k => k + 1)}
                className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-[8px]"
                style={{ background: 'rgba(255,255,255,0.1)', color: 'white' }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
                </svg>
                Neu laden
              </button>
            </div>
            <button onClick={() => setShowFullPreview(false)}
              className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-[12px] font-medium"
              style={{ background: 'rgba(255,255,255,0.12)', color: 'white' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
              Schließen
            </button>
          </div>
          {site.templates?.r2_bundle_path ? (() => {
            const FP_DEVICE_W = { desktop: 1280, tablet: 768, mobile: 390 } as const
            const fpTargetW = FP_DEVICE_W[deviceView]
            const fpAvailW = winW - 32 // 16px padding each side
            const fpScale = Math.min(1, fpAvailW / fpTargetW)
            const fpIframeH = 900
            const fpScaledW = Math.round(fpTargetW * fpScale)
            const fpScaledH = Math.round(fpIframeH * fpScale)
            return (
              <div className="flex-1 overflow-auto flex flex-col items-center py-5 gap-2 px-4">
                {fpScale < 0.98 && (
                  <span className="text-xs px-3 py-1 rounded-full flex-shrink-0"
                    style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }}>
                    {Math.round(fpScale * 100)}% · {fpTargetW}px
                  </span>
                )}
                <div style={{ width: fpScaledW, height: fpScaledH, position: 'relative', flexShrink: 0 }}>
                  <div style={{
                    width: fpTargetW,
                    transform: `scale(${fpScale})`,
                    transformOrigin: 'top left',
                    borderRadius: 12,
                    overflow: 'hidden',
                    background: 'white',
                    boxShadow: '0 8px 48px rgba(0,0,0,0.4)',
                  }}>
                    <iframe ref={iframeRef} key={previewKey} src={previewUrl}
                      style={{ width: fpTargetW, height: fpIframeH, border: 'none', display: 'block' }}
                      title="Website-Vorschau" sandbox="allow-scripts allow-forms allow-same-origin" />
                  </div>
                </div>
              </div>
            )
          })() : (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 text-white text-center py-20">
                <p className="text-lg font-semibold">Noch keine Vorschau verfügbar</p>
                <p className="text-sm opacity-60">Der Admin muss zuerst eine HTML-Datei hochladen.</p>
              </div>
            )}
        </div>
      )}

      {/* ── Delete Modal ── */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-[24px] p-6 flex flex-col gap-4 w-full max-w-sm"
            style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-[14px] flex items-center justify-center flex-shrink-0"
                style={{ background: '#FEF2F2' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2">
                  <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>
                </svg>
              </div>
              <h2 className="text-base font-semibold text-gray-900">Website löschen?</h2>
            </div>
            <p className="text-sm" style={{ color: '#6B7280' }}>Alle eingegebenen Inhalte gehen dauerhaft verloren.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 text-sm font-medium rounded-[12px]"
                style={{ background: '#F3F4F6', color: '#374151' }}>
                Abbrechen
              </button>
              <button onClick={handleDeleteSite} disabled={deletingSite}
                className="px-4 py-2 text-sm font-semibold text-white rounded-[12px] flex items-center gap-2"
                style={{ background: '#DC2626', opacity: deletingSite ? 0.7 : 1 }}>
                {deletingSite && <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />}
                Endgültig löschen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Publish Celebration Modal ── */}
      {showPublishCelebration && (() => {
        const confettiColors = ['#8060b0', '#22c55e', '#fbbf24', '#f472b6', '#60a5fa', '#f87171', '#34d399']
        const confettiPieces = Array.from({ length: 80 }, (_, i) => ({
          id: i,
          left: `${Math.random() * 100}%`,
          size: `${6 + Math.random() * 8}px`,
          color: confettiColors[Math.floor(Math.random() * confettiColors.length)],
          duration: `${2 + Math.random() * 2}s`,
          delay: `${Math.random() * 2}s`,
          rotation: `${Math.random() * 720}deg`,
          isCircle: Math.random() > 0.5,
        }))
        return <PublishCelebrationModal publishedUrl={publishedUrl} onClose={() => setShowPublishCelebration(false)} confettiPieces={confettiPieces} />
      })()}

    </div>
  )
}

function PublishCelebrationModal({ publishedUrl, onClose, confettiPieces }: {
  publishedUrl: string
  onClose: () => void
  confettiPieces: Array<{ id: number; left: string; size: string; color: string; duration: string; delay: string; rotation: string; isCircle: boolean }>
}) {
  const [urlCopied, setUrlCopied] = React.useState(false)
  return (
    <>
      <style>{`
        @keyframes confetti-fall {
          0%   { transform: translateY(-20px) rotate(0deg); opacity: 1; }
          80%  { opacity: 1; }
          100% { transform: translateY(110vh) rotate(var(--rot)); opacity: 0; }
        }
        @keyframes celebration-scale-in {
          0%   { opacity: 0; transform: scale(0.7) translateY(24px); }
          60%  { transform: scale(1.04) translateY(-4px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes check-pop {
          0%   { opacity: 0; transform: scale(0.4); }
          60%  { transform: scale(1.15); }
          100% { opacity: 1; transform: scale(1); }
        }
      `}</style>

      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '16px',
        }}
      >
        {/* Confetti pieces */}
        {confettiPieces.map(p => (
          <div
            key={p.id}
            style={{
              position: 'absolute',
              top: 0,
              left: p.left,
              width: p.size,
              height: p.size,
              background: p.color,
              borderRadius: p.isCircle ? '50%' : '2px',
              ['--rot' as string]: p.rotation,
              animation: `confetti-fall ${p.duration} ${p.delay} ease-in forwards`,
              pointerEvents: 'none',
            }}
          />
        ))}

        {/* Modal card */}
        <div
          onClick={e => e.stopPropagation()}
          style={{
            position: 'relative',
            width: '100%',
            maxWidth: '440px',
            background: '#fff',
            borderRadius: '24px',
            padding: '40px 32px 32px',
            boxShadow: '0 32px 80px rgba(0,0,0,0.28), 0 8px 24px rgba(0,0,0,0.12)',
            animation: 'celebration-scale-in 0.45s cubic-bezier(0.34,1.56,0.64,1) both',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          {/* Close button */}
          <button
            onClick={onClose}
            style={{
              position: 'absolute', top: '16px', right: '16px',
              width: '32px', height: '32px', borderRadius: '50%',
              background: '#F3F4F6', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#6B7280', fontSize: '16px', lineHeight: 1,
            }}
          >
            ✕
          </button>

          {/* Success icon */}
          <div style={{
            width: '64px', height: '64px', borderRadius: '50%',
            background: 'linear-gradient(135deg, #22c55e, #16a34a)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: '20px',
            boxShadow: '0 8px 24px rgba(34,197,94,0.35)',
            animation: 'check-pop 0.5s 0.2s cubic-bezier(0.34,1.56,0.64,1) both',
          }}>
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <path d="M8 16.5L13.5 22L24 11" stroke="white" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>

          {/* Headline */}
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#111', textAlign: 'center', marginBottom: '6px', lineHeight: 1.2 }}>
            Deine Webseite ist live! 🎉
          </div>

          {/* Subtext */}
          <div style={{ fontSize: '14px', color: '#6B7280', textAlign: 'center', marginBottom: '24px' }}>
            Teile deine Seite mit der Welt.
          </div>

          {/* URL box */}
          <div style={{
            width: '100%',
            background: '#F3F4F6',
            borderRadius: '12px',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '16px',
          }}>
            <span style={{
              flex: 1,
              fontFamily: 'monospace',
              fontSize: '13px',
              color: '#374151',
              wordBreak: 'break-all',
              overflowWrap: 'anywhere',
            }}>
              {publishedUrl}
            </span>
            <button
              onClick={() => {
                navigator.clipboard.writeText(publishedUrl)
                setUrlCopied(true)
                setTimeout(() => setUrlCopied(false), 2000)
              }}
              title="URL kopieren"
              style={{
                flexShrink: 0,
                width: '32px', height: '32px',
                borderRadius: '8px',
                background: urlCopied ? '#22c55e' : '#E5E7EB',
                border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background 0.2s',
                color: urlCopied ? 'white' : '#6B7280',
              }}
            >
              {urlCopied ? (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8.5L6.5 12L13 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <rect x="5" y="1" width="9" height="11" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M2 5v8a2 2 0 002 2h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              )}
            </button>
          </div>

          {/* QR Code */}
          <img
            src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(publishedUrl ?? '')}&format=png&margin=2`}
            alt="QR Code"
            width={160}
            height={160}
            style={{
              borderRadius: '12px',
              border: '1px solid #E5E7EB',
              marginBottom: '10px',
            }}
          />

          {/* QR helper text */}
          <div style={{ fontSize: '12px', color: '#9CA3AF', textAlign: 'center', marginBottom: '24px' }}>
            QR-Code scannen oder Link teilen
          </div>

          {/* Buttons */}
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <a
              href={publishedUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'block',
                width: '100%',
                padding: '14px',
                background: '#111',
                color: '#fff',
                borderRadius: '12px',
                fontWeight: 700,
                fontSize: '15px',
                textAlign: 'center',
                textDecoration: 'none',
                boxShadow: '0 4px 12px rgba(0,0,0,0.18)',
                transition: 'opacity 0.15s',
                boxSizing: 'border-box',
              }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
            >
              Webseite öffnen →
            </a>
            <button
              onClick={onClose}
              style={{
                width: '100%',
                padding: '12px',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: '#6B7280',
                fontSize: '14px',
                fontWeight: 500,
              }}
            >
              Schließen
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
