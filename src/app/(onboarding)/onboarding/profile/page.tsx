'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import ImageCropModal from '@/components/ImageCropModal'

// ── Social platform config ────────────────────────────────────────────────────

const SOCIALS = [
  { key: 'instagram', label: 'Instagram',  prefix: 'instagram.com/',    ph: 'deinname',    icon: <IgIcon /> },
  { key: 'tiktok',    label: 'TikTok',     prefix: 'tiktok.com/@',      ph: 'deinname',    icon: <TtIcon /> },
  { key: 'facebook',  label: 'Facebook',   prefix: 'facebook.com/',     ph: 'deinname',    icon: <FbIcon /> },
  { key: 'linkedin',  label: 'LinkedIn',   prefix: 'linkedin.com/in/',  ph: 'dein-name',   icon: <LiIcon /> },
  { key: 'youtube',   label: 'YouTube',    prefix: 'youtube.com/@',     ph: 'deinkanal',   icon: <YtIcon /> },
] as const

function usernameToUrl(username: string, prefix: string): string {
  const u = username.trim().replace(/^@/, '')
  return u ? `https://${prefix}${u}` : ''
}

// ── Country codes ─────────────────────────────────────────────────────────────

const COUNTRIES = [
  { code: '+49', flag: '🇩🇪' }, { code: '+43', flag: '🇦🇹' }, { code: '+41', flag: '🇨🇭' },
  { code: '+1',  flag: '🇺🇸' }, { code: '+44', flag: '🇬🇧' }, { code: '+33', flag: '🇫🇷' },
  { code: '+39', flag: '🇮🇹' }, { code: '+34', flag: '🇪🇸' }, { code: '+31', flag: '🇳🇱' },
  { code: '+32', flag: '🇧🇪' }, { code: '+48', flag: '🇵🇱' }, { code: '+90', flag: '🇹🇷' },
  { code: '+7',  flag: '🇷🇺' }, { code: '+380', flag: '🇺🇦' }, { code: '+40', flag: '🇷🇴' },
  { code: '+30', flag: '🇬🇷' }, { code: '+351', flag: '🇵🇹' }, { code: '+46', flag: '🇸🇪' },
  { code: '+47', flag: '🇳🇴' }, { code: '+45', flag: '🇩🇰' }, { code: '+358', flag: '🇫🇮' },
  { code: '+420', flag: '🇨🇿' }, { code: '+36', flag: '🇭🇺' }, { code: '+385', flag: '🇭🇷' },
  { code: '+371', flag: '🇱🇻' }, { code: '+370', flag: '🇱🇹' }, { code: '+372', flag: '🇪🇪' },
  { code: '+86', flag: '🇨🇳' }, { code: '+81', flag: '🇯🇵' }, { code: '+82', flag: '🇰🇷' },
  { code: '+91', flag: '🇮🇳' }, { code: '+55', flag: '🇧🇷' }, { code: '+52', flag: '🇲🇽' },
  { code: '+54', flag: '🇦🇷' }, { code: '+27', flag: '🇿🇦' }, { code: '+20', flag: '🇪🇬' },
  { code: '+966', flag: '🇸🇦' }, { code: '+971', flag: '🇦🇪' }, { code: '+972', flag: '🇮🇱' },
  { code: '+61', flag: '🇦🇺' }, { code: '+64', flag: '🇳🇿' },
  { code: 'other', flag: '🌐' },
]
const COUNTRY_CODES_OB = COUNTRIES.filter(c => c.code !== 'other')

// ── Step indicator ────────────────────────────────────────────────────────────

function StepDot({ n, active, done, label }: { n: number; active?: boolean; done?: boolean; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold"
        style={{ background: done ? '#111827' : active ? '#111827' : '#E5E7EB', color: done || active ? '#fff' : '#9CA3AF' }}>
        {done
          ? <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2.5 7L5.5 10L11.5 4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/></svg>
          : n}
      </div>
      <span className="text-[10px] font-medium hidden sm:block" style={{ color: active ? '#111827' : '#9CA3AF' }}>{label}</span>
    </div>
  )
}

function StepLine() {
  return <div className="flex-1 h-px mx-1" style={{ background: '#E5E7EB', maxWidth: 48 }} />
}

// ── Main component ────────────────────────────────────────────────────────────

export default function OnboardingProfilePage() {
  const router = useRouter()

  // Avatar
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [cropSrc, setCropSrc] = useState<string | null>(null)

  // Social media
  const [socials, setSocials] = useState<Record<string, string>>({
    instagram: '', tiktok: '', facebook: '', linkedin: '', youtube: '',
  })

  // Phone
  const [countryCode, setCountryCode] = useState('+49')
  const [customCountryCode, setCustomCountryCode] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const isCustomCode = countryCode === 'other'

  const [saving, setSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    setCropSrc(url)
    e.target.value = ''
  }

  async function handleCropConfirm(blob: Blob) {
    if (cropSrc) URL.revokeObjectURL(cropSrc)
    setCropSrc(null)
    setAvatarUploading(true)
    const file = new File([blob], 'avatar.jpg', { type: 'image/jpeg' })
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/user/profile/avatar', { method: 'POST', body: fd })
    const data = await res.json()
    if (data.url) setAvatarUrl(data.url + '?t=' + Date.now())
    setAvatarUploading(false)
  }

  function handleCropCancel() {
    if (cropSrc) URL.revokeObjectURL(cropSrc)
    setCropSrc(null)
  }

  async function handleSave() {
    setSaving(true)
    const effectiveCode = countryCode === 'other' ? customCountryCode.trim() : countryCode
    const phone = phoneNumber.trim() && effectiveCode ? `${effectiveCode} ${phoneNumber.trim()}` : ''
    const body: Record<string, string> = { phone }
    for (const s of SOCIALS) {
      body[s.key] = usernameToUrl(socials[s.key] ?? '', s.prefix)
    }
    await fetch('/api/user/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setSaving(false)
    router.push('/sites')
  }

  async function handleSkip() {
    router.push('/sites')
  }

  return (
    <>
      {cropSrc && (
        <ImageCropModal
          imageUrl={cropSrc}
          aspectRatio={1}
          outputWidth={400}
          onConfirm={handleCropConfirm}
          onCancel={handleCropCancel}
        />
      )}

      <div className="w-full max-w-sm">
        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-10">
          <StepDot n={1} done label="Account" />
          <StepLine />
          <StepDot n={2} done label="Plan" />
          <StepLine />
          <StepDot n={3} done label="Username" />
          <StepLine />
          <StepDot n={4} active label="Profil" />
        </div>

        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">Profil vervollständigen</h1>
          <p className="text-sm leading-relaxed" style={{ color: '#6B7280' }}>
            Diese Angaben werden beim Erstellen deiner Webseiten automatisch vorausgefüllt.<br />
            Du kannst diesen Schritt auch überspringen.
          </p>
        </div>

        <div className="flex flex-col gap-6">

          {/* ── Avatar ── */}
          <div className="flex flex-col items-center gap-3">
            <div
              className="relative w-24 h-24 rounded-full overflow-hidden cursor-pointer group"
              style={{ background: '#F1F5F9', border: '2px solid #E5E7EB' }}
              onClick={() => fileInputRef.current?.click()}
            >
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt="Profilbild" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="1.25">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                  </svg>
                </div>
              )}
              {/* Hover overlay */}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ background: 'rgba(0,0,0,0.4)' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
                  <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
              </div>
              {avatarUploading && (
                <div className="absolute inset-0 flex items-center justify-center"
                  style={{ background: 'rgba(255,255,255,0.8)' }}>
                  <span className="w-6 h-6 rounded-full border-2 border-gray-300 border-t-gray-900 animate-spin" />
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-xs font-medium transition-colors"
              style={{ color: '#6B7280' }}
            >
              {avatarUrl ? 'Foto ändern' : 'Foto hochladen'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={handleFileChange}
            />
          </div>

          {/* ── Social Media ── */}
          <div className="flex flex-col gap-2">
            <p className="text-sm font-semibold text-gray-700 mb-1">Social Media <span className="font-normal text-gray-400">(optional)</span></p>
            {SOCIALS.map(s => (
              <div key={s.key}
                className="flex items-center overflow-hidden rounded-2xl"
                style={{ border: '1.5px solid #E5E7EB', background: '#fff' }}>
                <div className="flex items-center gap-2 px-3 py-2.5 border-r flex-shrink-0"
                  style={{ borderColor: '#F1F5F9', background: '#FAFAFA', minWidth: 40 }}>
                  {s.icon}
                </div>
                <div className="px-2 py-2.5 text-xs flex-shrink-0"
                  style={{ color: '#9CA3AF', borderRight: '1px solid #F1F5F9', whiteSpace: 'nowrap' }}>
                  {s.prefix}
                </div>
                <input
                  type="text"
                  value={socials[s.key] ?? ''}
                  onChange={e => setSocials(prev => ({ ...prev, [s.key]: e.target.value }))}
                  placeholder={s.ph}
                  autoComplete="off"
                  className="flex-1 min-w-0 px-3 py-2.5 text-sm outline-none bg-transparent"
                  style={{ color: '#111827' }}
                />
              </div>
            ))}
          </div>

          {/* ── Phone ── */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-gray-700">
              Telefon / WhatsApp <span className="font-normal text-gray-400">(optional)</span>
            </label>
            <div className="flex overflow-hidden rounded-2xl" style={{ border: '1.5px solid #E5E7EB' }}>
              <select
                value={countryCode}
                onChange={e => { setCountryCode(e.target.value); if (e.target.value !== 'other') setCustomCountryCode('') }}
                className="flex-shrink-0 px-3 py-3 text-sm outline-none"
                style={{ background: '#FAFAFA', borderRight: '1px solid #F1F5F9', color: '#374151', minWidth: 80 }}
              >
                {COUNTRIES.map(c => (
                  <option key={c.code} value={c.code}>{c.flag} {c.code === 'other' ? 'Andere…' : c.code}</option>
                ))}
              </select>
              {isCustomCode && (
                <input
                  type="text"
                  value={customCountryCode}
                  onChange={e => setCustomCountryCode(e.target.value)}
                  placeholder="+XX"
                  className="flex-shrink-0 px-2 py-3 text-sm outline-none"
                  style={{ background: '#FAFAFA', borderRight: '1px solid #F1F5F9', color: '#374151', width: 64 }}
                />
              )}
              <input
                type="tel"
                value={phoneNumber}
                onChange={e => setPhoneNumber(e.target.value)}
                placeholder="151 12345678"
                className="flex-1 min-w-0 px-3 py-3 text-sm outline-none bg-white"
                style={{ color: '#111827' }}
              />
            </div>
          </div>

          {/* ── Buttons ── */}
          <div className="flex flex-col gap-3 pt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full py-3 text-sm font-semibold rounded-2xl transition-all"
              style={{
                background: saving ? '#E5E7EB' : '#111827',
                color: saving ? '#9CA3AF' : '#fff',
                boxShadow: saving ? 'none' : '0 4px 14px rgba(17,24,39,0.2)',
              }}
            >
              {saving ? 'Wird gespeichert…' : 'Speichern & Loslegen →'}
            </button>
            <button
              onClick={handleSkip}
              type="button"
              className="w-full py-2.5 text-sm font-medium rounded-2xl transition-colors"
              style={{ color: '#9CA3AF' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#6B7280')}
              onMouseLeave={e => (e.currentTarget.style.color = '#9CA3AF')}
            >
              Überspringen
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

// ── Platform icons ────────────────────────────────────────────────────────────

function IgIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#C13584" strokeWidth="2" strokeLinecap="round">
      <rect x="2" y="2" width="20" height="20" rx="5"/>
      <circle cx="12" cy="12" r="5"/>
      <circle cx="17.5" cy="6.5" r="1" fill="#C13584" stroke="none"/>
    </svg>
  )
}
function TtIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="#000">
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.26 6.26 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.95a8.16 8.16 0 004.77 1.52V7.02a4.85 4.85 0 01-1-.33z"/>
    </svg>
  )
}
function FbIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="#1877F2">
      <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073c0 6.03 4.388 11.027 10.125 11.927v-8.437H7.078v-3.49h3.047V9.428c0-3.007 1.792-4.67 4.533-4.67 1.312 0 2.686.234 2.686.234v2.953H15.83c-1.491 0-1.956.93-1.956 1.886v2.25h3.328l-.532 3.49h-2.796v8.437C19.612 23.1 24 18.103 24 12.073z"/>
    </svg>
  )
}
function LiIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="#0A66C2">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
    </svg>
  )
}
function YtIcon() {
  return (
    <svg width="18" height="14" viewBox="0 0 24 17" fill="#FF0000">
      <path d="M23.495 2.632A3.008 3.008 0 0021.38.516C19.505 0 12 0 12 0S4.495 0 2.62.516A3.008 3.008 0 00.505 2.632C0 4.506 0 8.407 0 8.407s0 3.9.505 5.774a3.008 3.008 0 002.115 2.116C4.495 16.814 12 16.814 12 16.814s7.505 0 9.38-.517a3.008 3.008 0 002.115-2.116C24 12.307 24 8.407 24 8.407s0-3.901-.505-5.775zm-13.956 9.33V5.45l6.272 3.257-6.272 3.256z"/>
    </svg>
  )
}
