'use client'
import ImageRulesHint from '@/components/editor/ImageRulesHint'
import { PaymentMethodsCard } from '@/components/dashboard/PaymentMethodsCard'

import { useState, useEffect, Suspense, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { authClient } from '@/lib/auth/client'
import { useRouter } from 'next/navigation'
import { PLAN_LIST, PLAN_LABELS, PLANS, COMMON_FEATURES, canUpgradeTo, getPlanMaxSites } from '@/lib/plans'
import { discountedTotal, formatEur } from '@/lib/billing/promo-duration'
import ImageCropModal from '@/components/ImageCropModal'
import InvoiceDetailsCard from '@/components/billing/InvoiceDetailsCard'
import TrackingSettings from '@/components/tracking/TrackingSettings'
import { EMAIL_CATEGORIES, type EmailCategory } from '@/lib/email/categories'
import AccountDeletionSection from '@/components/settings/AccountDeletionSection'

// ── Social media helpers ──────────────────────────────────────────────────────

const SOCIALS = [
  { key: 'instagram', label: 'Instagram', prefix: 'instagram.com/',   ph: 'deinname',  icon: <IgIcon /> },
  { key: 'tiktok',    label: 'TikTok',    prefix: 'tiktok.com/@',    ph: 'deinname',  icon: <TtIcon /> },
  { key: 'facebook',  label: 'Facebook',  prefix: 'facebook.com/',   ph: 'deinname',  icon: <FbIcon /> },
  { key: 'linkedin',  label: 'LinkedIn',  prefix: 'linkedin.com/in/', ph: 'dein-name', icon: <LiIcon /> },
  { key: 'youtube',   label: 'YouTube',   prefix: 'youtube.com/@',   ph: 'deinkanal', icon: <YtIcon /> },
] as const

function urlToUsername(url: string, prefix: string): string {
  if (!url) return ''
  return url
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./, '')
    .replace(new RegExp('^' + prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), '')
    .replace(/\/$/, '')
    .replace(/^@/, '')
}
function usernameToUrl(username: string, prefix: string): string {
  const u = username.trim().replace(/^@/, '')
  return u ? `https://${prefix}${u}` : ''
}

const COUNTRIES = [
  { code: '+49', flag: '🇩🇪', label: 'Deutschland' },
  { code: '+43', flag: '🇦🇹', label: 'Österreich' },
  { code: '+41', flag: '🇨🇭', label: 'Schweiz' },
  { code: '+1',  flag: '🇺🇸', label: 'USA / Kanada' },
  { code: '+44', flag: '🇬🇧', label: 'UK' },
  { code: '+33', flag: '🇫🇷', label: 'Frankreich' },
  { code: '+39', flag: '🇮🇹', label: 'Italien' },
  { code: '+34', flag: '🇪🇸', label: 'Spanien' },
  { code: '+31', flag: '🇳🇱', label: 'Niederlande' },
  { code: '+32', flag: '🇧🇪', label: 'Belgien' },
  { code: '+48', flag: '🇵🇱', label: 'Polen' },
  { code: '+90', flag: '🇹🇷', label: 'Türkei' },
  { code: '+7',  flag: '🇷🇺', label: 'Russland' },
  { code: '+380', flag: '🇺🇦', label: 'Ukraine' },
  { code: '+40', flag: '🇷🇴', label: 'Rumänien' },
  { code: '+30', flag: '🇬🇷', label: 'Griechenland' },
  { code: '+351', flag: '🇵🇹', label: 'Portugal' },
  { code: '+46', flag: '🇸🇪', label: 'Schweden' },
  { code: '+47', flag: '🇳🇴', label: 'Norwegen' },
  { code: '+45', flag: '🇩🇰', label: 'Dänemark' },
  { code: '+358', flag: '🇫🇮', label: 'Finnland' },
  { code: '+420', flag: '🇨🇿', label: 'Tschechien' },
  { code: '+36', flag: '🇭🇺', label: 'Ungarn' },
  { code: '+385', flag: '🇭🇷', label: 'Kroatien' },
  { code: '+371', flag: '🇱🇻', label: 'Lettland' },
  { code: '+370', flag: '🇱🇹', label: 'Litauen' },
  { code: '+372', flag: '🇪🇪', label: 'Estland' },
  { code: '+86', flag: '🇨🇳', label: 'China' },
  { code: '+81', flag: '🇯🇵', label: 'Japan' },
  { code: '+82', flag: '🇰🇷', label: 'Südkorea' },
  { code: '+91', flag: '🇮🇳', label: 'Indien' },
  { code: '+55', flag: '🇧🇷', label: 'Brasilien' },
  { code: '+52', flag: '🇲🇽', label: 'Mexiko' },
  { code: '+54', flag: '🇦🇷', label: 'Argentinien' },
  { code: '+27', flag: '🇿🇦', label: 'Südafrika' },
  { code: '+20', flag: '🇪🇬', label: 'Ägypten' },
  { code: '+966', flag: '🇸🇦', label: 'Saudi-Arabien' },
  { code: '+971', flag: '🇦🇪', label: 'VAE' },
  { code: '+972', flag: '🇮🇱', label: 'Israel' },
  { code: '+61', flag: '🇦🇺', label: 'Australien' },
  { code: '+64', flag: '🇳🇿', label: 'Neuseeland' },
  { code: 'other', flag: '🌐', label: 'Andere…' },
]

const COUNTRY_CODES = COUNTRIES.filter(c => c.code !== 'other')

function parsePhone(full: string): { code: string; number: string } {
  for (const c of COUNTRY_CODES) {
    if (full.startsWith(c.code + ' ') || full.startsWith(c.code)) {
      return { code: c.code, number: full.slice(c.code.length).trim() }
    }
  }
  const match = full.match(/^(\+\d{1,4})\s*(.*)$/)
  if (match) return { code: match[1], number: match[2] }
  return { code: '+49', number: full }
}

// ── Tabs ─────────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'profil',      label: 'Profil'       },
  { id: 'zahlung',     label: 'Zahlung & Plan' },
  { id: 'rechnungen',  label: 'Rechnungen'   },
  { id: 'werbung',     label: 'Werbung'      },
  { id: 'mails',       label: 'E-Mails'      },
  { id: 'sicherheit',  label: 'Konto & FAQ' },
] as const
type TabId = typeof TABS[number]['id']

// ── FAQ (dumbified — kurze Sätze, keine em-Dashes) ───────────────────────────

const FAQ = [
  [
    'Kann ich auf einen höheren Plan wechseln?',
    'Ja, jederzeit. Der Wechsel ist sofort aktiv. Du zahlst nur den Rest des Monats anteilig.',
  ],
  [
    'Was passiert, wenn ich kündige?',
    'Deine Seiten laufen noch bis zum Ende des bezahlten Zeitraums. Danach gehen sie offline.',
  ],
  [
    'Wie ändere ich meine Zahlungsmethode?',
    'Klicke auf "Stripe-Portal öffnen". Dort kannst du Karte oder Bankverbindung direkt ändern.',
  ],
  [
    'Kann ich auf einen kleineren Plan wechseln?',
    'Ja, zum Ende deiner bezahlten Laufzeit. Bis dahin bleibt alles wie bisher, danach läuft dein Abo im kleineren Tarif weiter – ohne Kündigung und ohne neue Buchung. Du findest es oben in der Tarifliste beim jeweiligen Tarif.',
  ],
  [
    'Wie lange dauert eine SEPA-Lastschrift?',
    'SEPA-Zahlungen dauern 2 bis 5 Werktage. Mit Kreditkarte geht es sofort.',
  ],
]

// ── Interfaces ───────────────────────────────────────────────────────────────

interface RecoveryInfo {
  failed_at: string
  grace_until: string | null
  hard_deadline: string
  sites_offline: boolean
  retry_processing: boolean
  pay_url: string | null
  amount_cents: number
}

interface PendingPlanChange {
  plan: string
  interval: 'monthly' | 'yearly'
  at: string | null
  keep_site_ids: string[]
}

interface SubscriptionInfo {
  status: string
  current_period_end: number
  cancel_at_period_end: boolean
  cancel_at: number | null
  plan: string
  billing_interval: string | null
  discount_percent: number | null
  discount_name: string | null
  discount_duration?: string | null
  recovery: RecoveryInfo | null
  /** Geplanter Wechsel nach unten zum Laufzeitende (null = keiner) */
  pending_change?: PendingPlanChange | null
}

interface PaidSite { id: string; title: string; url: string | null }

interface UserProfile {
  plan: string
  billing_interval: string | null
  subscription_status: string | null
  stripe_customer_id: string | null
  paid_sites_count: number
  email: string | null
  username: string | null
  first_name: string | null
  last_name: string | null
  phone: string | null
  website_url: string | null
  instagram: string | null
  facebook: string | null
  linkedin: string | null
  tiktok: string | null
  youtube: string | null
  profile_image_url: string | null
  team_partner_number: string | null
  nm_companies: string[]
}

interface Invoice {
  id: string
  number: string | null
  created: number
  amount_paid: number
  amount_due: number
  currency: string
  status: string
  hosted_invoice_url: string | null
  invoice_pdf: string | null
  period_start: number
  period_end: number
}

interface UpgradePreview {
  due_cents: number
  charge_cents: number
  credit_cents: number
  next_amount_cents: number
  renewal_date: number | null
  interval: 'monthly' | 'yearly'
  plan: string
  interval_change?: boolean
  referral_yearly_added?: boolean
}

function fmtDate(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function recoveryHeadline(r: RecoveryInfo | null): string {
  if (!r) return 'Zahlung fehlgeschlagen.'
  if (r.sites_offline) return 'Zahlung fehlgeschlagen. Deine Seiten sind offline.'
  if (r.retry_processing) return 'Dein neuer Zahlungsversuch wird verarbeitet.'
  return `Zahlung fehlgeschlagen. Deine Seiten bleiben bis ${fmtDate(r.grace_until)} online.`
}

function recoveryBody(r: RecoveryInfo | null): string {
  if (!r) return 'Aktualisiere deine Zahlungsmethode. Sobald die Zahlung klappt, sind deine Seiten automatisch wieder live.'
  if (r.sites_offline) return `Sobald die Zahlung da ist, gehen deine Seiten automatisch wieder online. Bleibt sie bis ${fmtDate(r.hard_deadline)} aus, pausieren wir dein Konto.`
  if (r.retry_processing) return 'Per SEPA dauert die Bestätigung ein bis zwei Wochen. Deine Seiten bleiben so lange online. Mit Karte wäre es sofort erledigt.'
  return 'Mit Karte ist die Zahlung in Sekunden bestätigt. Oder hinterleg eine Karte als Ersatz, dann holen wir die Zahlung automatisch darüber nach.'
}

/** ISO-Zeitpunkt → „04. November 2026“ */
function fmtDateIso(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })
}

function fmtCents(cents: number) {
  return (cents / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

// ── Main component ────────────────────────────────────────────────────────────

function SettingsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // ── Tab state ──────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<TabId>('profil')

  // ── Password state ─────────────────────────────────────────────
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwLoading, setPwLoading] = useState(false)
  const [pwError, setPwError] = useState('')
  const [pwSuccess, setPwSuccess] = useState('')

  // ── Profile state ──────────────────────────────────────────────
  const [profileName, setProfileName] = useState({ first_name: '', last_name: '', company_name: '' })
  const [countryCode, setCountryCode] = useState('+49')
  const [customCountryCode, setCustomCountryCode] = useState('')
  const isCustomCode = countryCode === 'other'
  const [phoneNumber, setPhoneNumber] = useState('')
  const [socialUsernames, setSocialUsernames] = useState<Record<string, string>>({
    instagram: '', tiktok: '', facebook: '', linkedin: '', youtube: '',
  })
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null)
  const [cropSrc, setCropSrc] = useState<string | null>(null)
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const [teamPartnerNumber, setTeamPartnerNumber] = useState('')
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileSuccess, setProfileSuccess] = useState('')
  const [profileError, setProfileError] = useState('')
  const [avatarUploading, setAvatarUploading] = useState(false)

  // ── E-Mail-Benachrichtigungen (abbestellte Kategorien) ──────────
  const [emailOptOut, setEmailOptOut] = useState<EmailCategory[]>([])
  const [emailSaving, setEmailSaving] = useState(false)
  const [emailSuccess, setEmailSuccess] = useState('')

  // ── NM company preferences ─────────────────────────────────────
  const [nmSaving, setNmSaving] = useState(false)
  const [nmSuccess, setNmSuccess] = useState('')

  // ── Billing state ──────────────────────────────────────────────
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null)
  const [subLoading, setSubLoading] = useState(true)
  const [portalLoading, setPortalLoading] = useState(false)
  const [cancelLoading, setCancelLoading] = useState(false)
  const [cancelError, setCancelError] = useState('')
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [reactivateLoading, setReactivateLoading] = useState(false)

  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'yearly'>('monthly')
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null)
  const [upgradeTarget, setUpgradeTarget] = useState<string | null>(null)
  // Intervall des angefragten Upgrades (Wechsel ins Jahresabo kann vom Umschalter abweichen)
  const [upgradeInterval, setUpgradeInterval] = useState<'monthly' | 'yearly'>('monthly')
  // Modell C: Monatskunde mit Empfehlung → Hinweis aufs Jahresabo (10 % Partnerpreis)
  const [yearlySwitchHint, setYearlySwitchHint] = useState(false)
  const [upgradePreview, setUpgradePreview] = useState<UpgradePreview | null>(null)
  const [upgradePreviewError, setUpgradePreviewError] = useState('')
  const [upgradeLoading, setUpgradeLoading] = useState(false)
  // Wechsel nach unten zum Laufzeitende (src/lib/billing/plan-change.ts) – bewusst leise gehalten
  const [planChangeTarget, setPlanChangeTarget] = useState<string | null>(null)
  const [planChangeSites, setPlanChangeSites] = useState<PaidSite[] | null>(null)
  const [planChangeKeep, setPlanChangeKeep] = useState<string[]>([])
  const [planChangeLoading, setPlanChangeLoading] = useState(false)
  const [planChangeError, setPlanChangeError] = useState('')
  const [planChangeUndoLoading, setPlanChangeUndoLoading] = useState(false)
  const [toast, setToast] = useState('')

  // ── Invoices state ─────────────────────────────────────────────
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [invoicesLoading, setInvoicesLoading] = useState(true)

  // ── FAQ accordion state ────────────────────────────────────────
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  useEffect(() => {
    fetch('/api/billing/subscription')
      .then(r => r.json())
      .then(d => setSubscription(d.subscription ?? null))
      .finally(() => setSubLoading(false))

    fetch('/api/user/profile').then(r => r.json()).then(data => {
      setProfile(data)
      if (data.billing_interval) setBillingInterval(data.billing_interval)
      setProfileName({ first_name: data.first_name ?? '', last_name: data.last_name ?? '', company_name: data.company_name ?? '' })
      const parsed = parsePhone(data.phone ?? '')
      const knownCode = COUNTRY_CODES.find(c => c.code === parsed.code)
      if (knownCode) {
        setCountryCode(parsed.code)
      } else if (parsed.code.startsWith('+')) {
        setCountryCode('other')
        setCustomCountryCode(parsed.code)
      } else {
        setCountryCode('+49')
      }
      setPhoneNumber(parsed.number)
      setSocialUsernames({
        instagram: urlToUsername(data.instagram ?? '', 'instagram.com/'),
        tiktok:    urlToUsername(data.tiktok    ?? '', 'tiktok.com/@'),
        facebook:  urlToUsername(data.facebook  ?? '', 'facebook.com/'),
        linkedin:  urlToUsername(data.linkedin  ?? '', 'linkedin.com/in/'),
        youtube:   urlToUsername(data.youtube   ?? '', 'youtube.com/@'),
      })
      setProfileImageUrl(data.profile_image_url ?? null)
      setTeamPartnerNumber(data.team_partner_number ?? '')
      setEmailOptOut(Array.isArray(data.email_opt_out) ? data.email_opt_out : [])
    }).catch(() => {})

    fetch('/api/billing/invoices')
      .then(r => r.json())
      .then(d => setInvoices(Array.isArray(d.invoices) ? d.invoices : []))
      .catch(() => {})
      .finally(() => setInvoicesLoading(false))

    fetch('/api/billing/referral-offer', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => setYearlySwitchHint(!!d.yearly_switch_hint))
      .catch(() => {})
  }, [])

  useEffect(() => {
    const success = searchParams.get('success')
    const canceled = searchParams.get('canceled')
    const sessionId = searchParams.get('session_id')

    if (sessionId) {
      fetch(`/api/billing/verify-session?session_id=${encodeURIComponent(sessionId)}`)
        .then(r => r.json())
        .then(data => {
          if (data.ok) {
            fetch('/api/billing/subscription').then(r => r.json()).then(d => setSubscription(d.subscription ?? null))
            fetch('/api/user/profile').then(r => r.json()).then(d => {
              setProfile(d)
              if (d.billing_interval) setBillingInterval(d.billing_interval)
            })
          }
        })
        .catch(() => {})
    }

    // After checkout flow, land on Zahlung tab
    if (success === '1' || canceled === '1' || sessionId) {
      setActiveTab('zahlung')
    }
    // Direktlink aus E-Mails: /settings?tab=werbung
    // alter Link ?tab=unternehmen: der Tab ist im Profil aufgegangen
    const rawTab = searchParams.get('tab')
    const wanted = rawTab === 'unternehmen' ? 'profil' : rawTab === 'konto-loeschen' ? 'sicherheit' : rawTab
    if (wanted && TABS.some(t => t.id === wanted)) setActiveTab(wanted as TabId)

    if (success === '1') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setToast('Abonnement erfolgreich abgeschlossen!')
      const t = setTimeout(() => setToast(''), 4000)
      return () => clearTimeout(t)
    } else if (canceled === '1') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setToast('Checkout abgebrochen.')
      const t = setTimeout(() => setToast(''), 3000)
      return () => clearTimeout(t)
    }
  }, [searchParams])

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault()
    setPwError(''); setPwSuccess('')
    if (newPassword.length < 6) { setPwError('Das neue Passwort muss mindestens 6 Zeichen lang sein.'); return }
    if (newPassword !== confirmPassword) { setPwError('Die Passwörter stimmen nicht überein.'); return }
    setPwLoading(true)
    const { error } = await authClient.changePassword({
      currentPassword,
      newPassword,
      revokeOtherSessions: false,
    })
    if (error) {
      setPwError(error.message === 'Invalid password' ? 'Aktuelles Passwort ist falsch.' : (error.message ?? 'Fehler beim Ändern des Passworts.'))
    } else {
      setPwSuccess('Passwort erfolgreich geändert.')
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('')
      setTimeout(() => setPwSuccess(''), 4000)
    }
    setPwLoading(false)
  }

  async function handleProfileSave(e: React.FormEvent) {
    e.preventDefault()
    setProfileSaving(true); setProfileError(''); setProfileSuccess('')
    const effectiveCode = countryCode === 'other' ? customCountryCode.trim() : countryCode
    const phone = phoneNumber.trim() && effectiveCode ? `${effectiveCode} ${phoneNumber.trim()}` : ''
    const socialUrls: Record<string, string> = {}
    for (const s of SOCIALS) {
      socialUrls[s.key] = usernameToUrl(socialUsernames[s.key] ?? '', s.prefix)
    }
    const res = await fetch('/api/user/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...profileName, phone, ...socialUrls }),
    })
    const data = await res.json()
    if (data.error) {
      setProfileError(data.error)
    } else {
      setProfileSuccess('Profil gespeichert.')
      setTimeout(() => setProfileSuccess(''), 3000)
    }
    setProfileSaving(false)
  }

  async function handleEmailPrefsSave() {
    setEmailSaving(true); setEmailSuccess('')
    const res = await fetch('/api/user/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email_opt_out: emailOptOut }),
    })
    if (res.ok) {
      setEmailSuccess('Gespeichert.')
      setTimeout(() => setEmailSuccess(''), 3000)
    }
    setEmailSaving(false)
  }

  async function handleNmSave() {
    setNmSaving(true); setNmSuccess('')
    await fetch('/api/user/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ team_partner_number: teamPartnerNumber.trim() || null }),
    })
    setNmSuccess('Gespeichert.')
    setTimeout(() => setNmSuccess(''), 3000)
    setNmSaving(false)
  }

  function handleAvatarFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setCropSrc(URL.createObjectURL(file))
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
    if (data.url) setProfileImageUrl(data.url + '?t=' + Date.now())
    setAvatarUploading(false)
  }

  async function handlePortal() {
    setPortalLoading(true)
    const res = await fetch('/api/billing/portal', { method: 'POST' })
    const data = await res.json()
    if (data.url) router.push(data.url)
    else setPortalLoading(false)
  }

  async function handleCancelSubscription() {
    setCancelLoading(true); setCancelError('')
    const res = await fetch('/api/billing/subscription', { method: 'DELETE' })
    const data = await res.json()
    if (data.error) {
      setCancelError(data.error)
    } else {
      setSubscription(prev => prev ? { ...prev, cancel_at_period_end: true, cancel_at: data.current_period_end } : null)
      setShowCancelConfirm(false)
    }
    setCancelLoading(false)
  }

  async function handleReactivate() {
    setReactivateLoading(true)
    const res = await fetch('/api/billing/subscription', { method: 'PATCH' })
    const data = await res.json()
    if (data.error) {
      setToast(data.error)
      setTimeout(() => setToast(''), 4000)
    } else {
      setSubscription(prev => prev ? { ...prev, cancel_at_period_end: false, cancel_at: null } : null)
    }
    setReactivateLoading(false)
  }

  async function openPlanChange(plan: string) {
    setPlanChangeTarget(plan)
    setPlanChangeSites(null)
    setPlanChangeKeep([])
    setPlanChangeError('')
    try {
      const res = await fetch('/api/billing/plan-change')
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Fehler')
      const sites: PaidSite[] = data.sites ?? []
      setPlanChangeSites(sites)
      // Passt alles ins Limit, ist nichts zu wählen; sonst die älteste Seite vorschlagen
      const limit = getPlanMaxSites(plan)
      if (limit >= 0 && sites.length > limit) setPlanChangeKeep(sites.slice(0, limit).map(s => s.id))
    } catch (e) {
      setPlanChangeError(e instanceof Error && !/json|fetch|network|Fehler$/i.test(e.message) ? e.message : 'Die Webseiten konnten gerade nicht geladen werden. Bitte versuch es gleich noch einmal.')
    }
  }

  async function confirmPlanChange() {
    if (!planChangeTarget) return
    setPlanChangeLoading(true); setPlanChangeError('')
    const res = await fetch('/api/billing/plan-change', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: planChangeTarget, keepSiteIds: planChangeKeep }),
    })
    const data = await res.json().catch(() => null)
    if (!res.ok || !data?.pending_change) {
      setPlanChangeError(data?.error || 'Der Wechsel konnte gerade nicht eingeplant werden. Es wurde nichts geändert.')
    } else {
      setSubscription(prev => prev ? { ...prev, pending_change: data.pending_change } : prev)
      setPlanChangeTarget(null)
      setToast(`Eingeplant: ab dem ${fmtDateIso(data.pending_change.at)} läuft dein Abo im ${PLAN_LABELS[data.pending_change.plan] ?? data.pending_change.plan}-Tarif.`)
      setTimeout(() => setToast(''), 6000)
    }
    setPlanChangeLoading(false)
  }

  async function undoPlanChange() {
    setPlanChangeUndoLoading(true)
    const res = await fetch('/api/billing/plan-change', { method: 'DELETE' })
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      setToast(data?.error || 'Das hat gerade nicht geklappt. Bitte versuch es gleich noch einmal.')
    } else {
      setSubscription(prev => prev ? { ...prev, pending_change: null } : prev)
      setToast('Der Wechsel wurde zurückgezogen. Dein Tarif bleibt, wie er ist.')
    }
    setTimeout(() => setToast(''), 5000)
    setPlanChangeUndoLoading(false)
  }

  async function handleCheckout(plan: string, iv: 'monthly' | 'yearly' = billingInterval) {
    // Existing active subscription → show the exact prorated amount FIRST.
    // The actual upgrade only happens in confirmUpgrade() after the user confirms.
    if (subscription?.status === 'active') {
      setUpgradeTarget(plan)
      setUpgradeInterval(iv)
      setUpgradePreview(null)
      setUpgradePreviewError('')
      try {
        const res = await fetch('/api/billing/upgrade/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ plan, interval: iv }),
        })
        // Leere/kaputte Antwort (z. B. Zahlungsdienst nicht erreichbar) → nie die rohe JS-Fehlermeldung zeigen
        const data = await res.json().catch(() => null)
        if (!res.ok || !data || data.error) throw new Error(data?.error || 'Die Vorschau konnte gerade nicht geladen werden. Bitte versuch es gleich noch einmal.')
        setUpgradePreview(data)
      } catch (e) {
        setUpgradePreviewError(e instanceof Error && !/json|fetch|network/i.test(e.message) ? e.message : 'Die Vorschau konnte gerade nicht geladen werden. Bitte versuch es gleich noch einmal.')
      }
      return
    }

    // No active subscription → create new Stripe Checkout session
    setCheckoutLoading(plan)
    const res = await fetch('/api/billing/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan, interval: iv }),
    })
    const data = await res.json()
    if (data.url) router.push(data.url)
    else setCheckoutLoading(null)
  }

  // In-place upgrade with proration (pay only the difference). Discounts
  // (AKTION25, affiliate coupons) are preserved automatically by Stripe
  // because the upgrade route does NOT pass a discounts parameter.
  async function confirmUpgrade() {
    if (!upgradeTarget) return
    setUpgradeLoading(true)
    const res = await fetch('/api/billing/upgrade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: upgradeTarget, interval: upgradeInterval }),
    }).catch(() => null)
    const data = res ? await res.json().catch(() => null) : null
    if (!res || !data || data.error) {
      setUpgradePreviewError(data?.error || 'Der Wechsel hat gerade nicht geklappt. Es wurde nichts berechnet. Bitte versuch es gleich noch einmal.')
    } else {
      const amount = typeof data.invoice_total_cents === 'number' ? fmtCents(data.invoice_total_cents) : null
      setToast(
        amount
          ? data.invoice_status === 'paid'
            ? `Upgrade erfolgreich! Für die restlichen Tage wurden ${amount} berechnet.`
            : `Upgrade erfolgreich! ${amount} werden über deine Zahlungsmethode eingezogen.`
          : 'Plan erfolgreich geändert! Berechnet werden nur die anteiligen Kosten für die restlichen Tage.'
      )
      setTimeout(() => setToast(''), 8000)
      setUpgradeTarget(null)
      setUpgradePreview(null)
      if (upgradeInterval === 'yearly') setYearlySwitchHint(false)
      // Refresh subscription state to reflect new plan
      fetch('/api/billing/subscription')
        .then(r => r.json())
        .then(d => setSubscription(d.subscription ?? null))
      fetch('/api/user/profile').then(r => r.json()).then(d => {
        setProfile(d)
        if (d.billing_interval) setBillingInterval(d.billing_interval)
      })
    }
    setUpgradeLoading(false)
  }

  const periodEnd = subscription?.current_period_end
    ? new Date(subscription.current_period_end * 1000).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })
    : null

  const hasActiveSubscription = !!subscription && subscription.status === 'active'
  const pendingChange = subscription?.pending_change ?? null
  const pendingChangeDate = pendingChange?.at ? fmtDateIso(pendingChange.at) : periodEnd
  // Wechsel nach unten nur bei laufendem, nicht gekündigtem Abo ohne offene Zahlung
  const canScheduleDowngrade = hasActiveSubscription && !subscription?.cancel_at_period_end && subscription?.status !== 'past_due'
  const currentPlan: string | null = hasActiveSubscription
    ? (profile?.plan ?? subscription?.plan ?? null)
    : null
  const hasSubscription = !!profile?.stripe_customer_id
  // Aktuelles Intervall (für Upgrades: gleicher Tarif nur Monat → Jahr, Jahr → Monat nie)
  const currentInterval: 'monthly' | 'yearly' | null = hasActiveSubscription
    ? (profile?.billing_interval === 'yearly' ? 'yearly' : 'monthly')
    : null

  // ── Render ─────────────────────────────────────────────────────
  return (
    <div className="max-w-3xl mx-auto">

      {/* Image crop modal — always outside tabs */}
      {cropSrc && (
        <ImageCropModal
          imageUrl={cropSrc}
          aspectRatio={1}
          outputWidth={400}
          onConfirm={handleCropConfirm}
          onCancel={() => { if (cropSrc) URL.revokeObjectURL(cropSrc); setCropSrc(null) }}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 left-4 right-4 sm:left-auto sm:right-6 sm:top-6 z-50 px-5 py-3 rounded-2xl text-sm font-medium text-white text-center sm:text-left"
          style={{ background: '#1a1a1a', boxShadow: '0 8px 30px rgba(0,0,0,0.25)' }}>
          {toast}
        </div>
      )}

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">Einstellungen</h1>
        <p className="text-base mt-1.5" style={{ color: '#94A3B8' }}>
          Profil, Zahlung, E-Mails und Sicherheit.
        </p>
      </div>

      {/* ── Past-due banner — immer sichtbar, egal welcher Tab aktiv ist ── */}
      {subscription?.status === 'past_due' && (
        <div className="mb-6 rounded-3xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
          style={{ background: '#FEF2F2', border: '1.5px solid #FECACA' }}>
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-0.5">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold" style={{ color: '#991B1B' }}>
                {recoveryHeadline(subscription.recovery)}
              </p>
              <p className="text-sm mt-0.5" style={{ color: '#DC2626' }}>
                {recoveryBody(subscription.recovery)}
              </p>
            </div>
          </div>
          {subscription.recovery?.pay_url ? (
            <a
              href={subscription.recovery.pay_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-shrink-0 flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl transition-opacity hover:opacity-90"
              style={{ background: '#DC2626', color: '#fff', whiteSpace: 'nowrap' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"/></svg>
              Jetzt bezahlen
            </a>
          ) : (
            <button
              onClick={handlePortal}
              disabled={portalLoading}
              className="flex-shrink-0 flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl transition-opacity hover:opacity-90 disabled:opacity-70"
              style={{ background: '#DC2626', color: '#fff', whiteSpace: 'nowrap' }}
            >
              {portalLoading
                ? <Spinner />
                : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"/></svg>
              }
              Zahlungsmethode ändern
            </button>
          )}
        </div>
      )}

      {/* ── Tab-Leiste — Segmented Control ─────────────────────────────── */}
      <div className="-mx-4 sm:mx-0 mb-8 px-4 sm:px-0">
        {/* alle Tabs immer sichtbar: umbrechen statt seitlich scrollen (das hat viele irritiert) */}
        <div className="flex flex-wrap gap-1 p-1 rounded-2xl"
          style={{ background: '#ECEEF1' }}>
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex-1 px-3 sm:px-4 py-2.5 text-sm font-semibold rounded-xl whitespace-nowrap transition-all"
              style={{
                background: activeTab === tab.id ? '#111827' : 'transparent',
                color: activeTab === tab.id ? '#ffffff' : '#6B7280',
                boxShadow: activeTab === tab.id ? '0 1px 6px rgba(0,0,0,0.18)' : 'none',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════
          TAB: PROFIL
          ════════════════════════════════════════════════════════════════ */}
      {activeTab === 'profil' && (
        <div className="flex flex-col gap-10">
          <TabSection title="Mein Profil" subtitle="Diese Angaben werden beim Bearbeiten deiner Webseiten automatisch vorausgefüllt.">
            <form onSubmit={handleProfileSave} className="flex flex-col gap-7">

              {/* Avatar */}
              <div className="flex items-center gap-5">
                <div
                  className="relative flex-shrink-0 w-20 h-20 rounded-full overflow-hidden cursor-pointer group"
                  style={{ background: '#F1F5F9', border: '2px solid #E5E7EB' }}
                  onClick={() => avatarInputRef.current?.click()}
                >
                  {profileImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={profileImageUrl} alt="Profilbild" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="1.5">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                        <circle cx="12" cy="7" r="4"/>
                      </svg>
                    </div>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ background: 'rgba(0,0,0,0.4)' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
                      <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
                      <circle cx="12" cy="13" r="4"/>
                    </svg>
                  </div>
                  {avatarUploading && (
                    <div className="absolute inset-0 flex items-center justify-center rounded-full"
                      style={{ background: 'rgba(255,255,255,0.8)' }}>
                      <span className="w-5 h-5 rounded-full border-2 border-gray-300 border-t-gray-800 animate-spin" />
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={avatarUploading}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl transition-colors disabled:opacity-50"
                    style={{ background: '#F3F4F6', color: '#374151' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#E5E7EB')}
                    onMouseLeave={e => (e.currentTarget.style.background = '#F3F4F6')}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
                      <circle cx="12" cy="13" r="4"/>
                    </svg>
                    {profileImageUrl ? 'Foto ändern' : 'Foto hochladen'}
                  </button>
                  <p className="text-xs px-1" style={{ color: '#94A3B8' }}>JPG, PNG, WebP · max. 5 MB · wird zugeschnitten</p>
                  <div className="max-w-[340px]"><ImageRulesHint compact /></div>
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    onChange={handleAvatarFileSelect}
                  />
                </div>
              </div>

              {/* Account info (read-only) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-gray-700">E-Mail-Adresse</label>
                  <div className="px-4 py-3 rounded-2xl text-sm text-gray-500 select-all"
                    style={{ background: '#F9FAFB', border: '1.5px solid #E5E7EB' }}>
                    {profile?.email ?? '–'}
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-gray-700">Benutzername</label>
                  <div className="px-4 py-3 rounded-2xl text-sm text-gray-500 select-all"
                    style={{ background: '#F9FAFB', border: '1.5px solid #E5E7EB' }}>
                    {profile?.username ? `@${profile.username}` : '–'}
                  </div>
                </div>
              </div>

              {/* Name */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <ProfileField label="Vorname" value={profileName.first_name}
                  onChange={v => setProfileName(p => ({ ...p, first_name: v }))} placeholder="Max" />
                <ProfileField label="Nachname" value={profileName.last_name}
                  onChange={v => setProfileName(p => ({ ...p, last_name: v }))} placeholder="Mustermann" />
                <ProfileField label="Firma (freiwillig)" value={profileName.company_name}
                  onChange={v => setProfileName(p => ({ ...p, company_name: v }))}
                  placeholder="z. B. Mustermann & Müller GbR"
                  hint="Nur wenn du als Firma auftrittst. Steht dann im Impressum und in der Datenschutzerklärung aller deiner Webseiten." />
              </div>

              {/* Phone */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-gray-700">Telefon / WhatsApp</label>
                <div className="flex overflow-hidden rounded-2xl" style={{ border: '1.5px solid #E5E7EB' }}>
                  <select
                    value={countryCode}
                    onChange={e => { setCountryCode(e.target.value); if (e.target.value !== 'other') setCustomCountryCode('') }}
                    className="flex-shrink-0 px-3 py-3 text-sm outline-none"
                    style={{ background: '#FAFAFA', borderRight: '1px solid #F1F5F9', color: '#374151', minWidth: 80 }}
                  >
                    {COUNTRIES.map(c => (
                      <option key={c.code + c.label} value={c.code}>{c.flag} {c.code === 'other' ? 'Andere…' : c.code}</option>
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
                    className="flex-1 min-w-0 px-4 py-3 text-sm outline-none bg-white"
                    style={{ color: '#111827' }}
                    onFocus={e => (e.currentTarget.closest('div')!.style.borderColor = '#1a1a1a')}
                    onBlur={e => (e.currentTarget.closest('div')!.style.borderColor = '#E5E7EB')}
                  />
                </div>
              </div>

              {/* Social Media */}
              <div className="flex flex-col gap-2">
                <p className="text-sm font-semibold text-gray-700 mb-1">Social Media</p>
                {SOCIALS.map(s => (
                  <div key={s.key}
                    className="flex items-center overflow-hidden rounded-2xl transition-all"
                    style={{ border: '1.5px solid #E5E7EB', background: '#fff' }}
                    onFocusCapture={e => (e.currentTarget.style.borderColor = '#1a1a1a')}
                    onBlurCapture={e => (e.currentTarget.style.borderColor = '#E5E7EB')}
                  >
                    <div className="flex items-center gap-2 px-3 py-3 border-r flex-shrink-0"
                      style={{ borderColor: '#F1F5F9', background: '#FAFAFA', minWidth: 44 }}>
                      {s.icon}
                    </div>
                    <div className="px-2 py-3 text-xs flex-shrink-0"
                      style={{ color: '#9CA3AF', borderRight: '1px solid #F1F5F9', whiteSpace: 'nowrap', userSelect: 'none' }}>
                      {s.prefix}
                    </div>
                    <input
                      type="text"
                      value={socialUsernames[s.key] ?? ''}
                      onChange={e => setSocialUsernames(prev => ({ ...prev, [s.key]: e.target.value }))}
                      placeholder={s.ph}
                      autoComplete="off"
                      className="flex-1 min-w-0 px-3 py-3 text-sm outline-none bg-transparent"
                      style={{ color: '#111827' }}
                    />
                  </div>
                ))}
              </div>

              {profileError && (
                <p className="text-sm font-medium px-4 py-3 rounded-2xl"
                  style={{ background: '#FEF2F2', color: '#DC2626' }}>
                  {profileError}
                </p>
              )}
              {profileSuccess && (
                <p className="text-sm font-medium px-4 py-3 rounded-2xl flex items-center gap-2"
                  style={{ background: '#F0FDF4', color: '#15803D' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M20 6L9 17l-5-5"/>
                  </svg>
                  {profileSuccess}
                </p>
              )}

              <button type="submit" disabled={profileSaving}
                className="self-start flex items-center gap-2 px-5 py-3 text-sm font-bold text-white rounded-xl transition-opacity hover:opacity-90 disabled:opacity-70"
                style={{ background: '#1a1a1a' }}>
                {profileSaving && <Spinner />}
                Profil speichern
              </button>
            </form>
          </TabSection>

          <TabSection title="FitLine Teampartner-Nummer" subtitle="Wird automatisch in deine FitLine Shop-Links eingebaut.">
            <div className="w-full sm:max-w-md flex flex-col gap-3">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={teamPartnerNumber}
                onChange={e => setTeamPartnerNumber(e.target.value.replace(/\D/g, ''))}
                placeholder="z.B. 40237198"
                className="w-full px-4 py-3 text-[15px] rounded-2xl outline-none transition-all bg-white"
                style={{ border: '1.5px solid #E5E7EB' }}
                onFocus={e => (e.target.style.borderColor = '#1a1a1a')}
                onBlur={e => (e.target.style.borderColor = '#E5E7EB')}
              />
              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={handleNmSave}
                  disabled={nmSaving}
                  className="px-5 py-2.5 text-sm font-semibold rounded-2xl transition-all"
                  style={{ background: nmSaving ? '#E5E7EB' : '#111827', color: nmSaving ? '#9CA3AF' : '#fff' }}
                >
                  {nmSaving ? 'Wird gespeichert…' : 'Speichern'}
                </button>
                {nmSuccess && <span className="text-sm text-green-600">{nmSuccess}</span>}
              </div>
            </div>
          </TabSection>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          TAB: ZAHLUNG & PLAN
          ════════════════════════════════════════════════════════════════ */}
      {activeTab === 'zahlung' && (
        <div className="flex flex-col gap-10">

          {/* ── Zahlung verwalten — GANZ OBEN ── */}
          {hasSubscription && (
            <button
              onClick={handlePortal}
              disabled={portalLoading}
              className="flex items-center gap-4 px-5 py-4 rounded-2xl text-left transition-all"
              style={{ background: '#F8FAFC', border: '1.5px solid #E5E7EB' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#1a1a1a'; e.currentTarget.style.background = '#fff' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.background = '#F8FAFC' }}
            >
              <div className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: '#111827' }}>
                {portalLoading
                  ? <Spinner />
                  : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.75" strokeLinecap="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-900">Zahlung verwalten</p>
                <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>
                  Karte oder Bankverbindung ändern · Stripe-Portal öffnen
                </p>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" className="flex-shrink-0"><path d="M9 18l6-6-6-6"/></svg>
            </button>
          )}

          {hasSubscription && <PaymentMethodsCard />}

          {/* ── Plan wählen ── */}
          <TabSection title="Plan wählen" subtitle="Upgrade jederzeit. Wir verrechnen anteilig.">
            <>
                {/* Modell C: geworbener Monatskunde → Jahresabo mit 10 % Partnerpreis */}
                {yearlySwitchHint && currentPlan && currentInterval === 'monthly' && (
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5 px-4 py-4 rounded-2xl"
                    style={{ background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold" style={{ color: '#15803D' }}>
                        Wechsle ins Jahresabo: dauerhaft 10 % Rabatt
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: '#166534' }}>
                        Gleicher Tarif, du zahlst einmal im Jahr. Die 10 % gelten, solange dein Jahresabo läuft. Der ungenutzte Rest deines Monats wird angerechnet.
                      </p>
                    </div>
                    <button onClick={() => handleCheckout(currentPlan, 'yearly')}
                      className="flex-shrink-0 min-h-[44px] px-4 py-2.5 text-sm font-bold rounded-xl text-white transition-opacity hover:opacity-90"
                      style={{ background: '#15803D' }}>
                      Ins Jahresabo wechseln
                    </button>
                  </div>
                )}
                {/* Interval toggle */}
                <div className="flex items-center justify-between gap-3 mb-6">
                  <div className="inline-flex p-1 rounded-2xl" style={{ background: '#F1F5F9' }}>
                    <button
                      onClick={() => setBillingInterval('monthly')}
                      className="px-5 py-2 text-sm font-semibold rounded-xl transition-all"
                      style={{
                        background: billingInterval === 'monthly' ? '#fff' : 'transparent',
                        color: billingInterval === 'monthly' ? '#1a1a1a' : '#94A3B8',
                        boxShadow: billingInterval === 'monthly' ? '0 1px 4px rgba(0,0,0,0.06)' : 'none',
                      }}>
                      Monatlich
                    </button>
                    <button
                      onClick={() => setBillingInterval('yearly')}
                      className="px-5 py-2 text-sm font-semibold rounded-xl transition-all flex items-center gap-2"
                      style={{
                        background: billingInterval === 'yearly' ? '#fff' : 'transparent',
                        color: billingInterval === 'yearly' ? '#1a1a1a' : '#94A3B8',
                        boxShadow: billingInterval === 'yearly' ? '0 1px 4px rgba(0,0,0,0.06)' : 'none',
                      }}>
                      Jährlich
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                        style={{ background: '#DCFCE7', color: '#15803D' }}>
                        −17%
                      </span>
                    </button>
                  </div>
                  <p className="text-xs hidden sm:block" style={{ color: '#94A3B8' }}>
                    {billingInterval === 'monthly' ? 'Mindestlaufzeit 1 Monat' : 'spare 2 Monate'}
                  </p>
                </div>

                {/* Plan rows — horizontal list */}
                <div className="rounded-2xl overflow-hidden" style={{ border: '1.5px solid #E5E7EB' }}>
                  {PLAN_LIST.map((plan, idx) => {
                    const isUpgrade = canUpgradeTo(currentPlan, plan.key, currentInterval, billingInterval)
                    // Gleicher Tarif im Jahres-Umschalter für Monatskunden = Wechsel ins Jahresabo
                    const isIntervalSwitch = currentPlan === plan.key && isUpgrade
                    const isCurrent = currentPlan === plan.key && !isIntervalSwitch
                    const price = billingInterval === 'monthly' ? plan.monthly_eur : plan.yearly_eur
                    const unit = billingInterval === 'yearly' ? '/Jahr' : '/Mo.'
                    const isLower = !isCurrent && !isUpgrade
                    const isLast = idx === PLAN_LIST.length - 1
                    return (
                      <div key={plan.key}
                        className="flex items-center gap-4 sm:gap-6 px-5 py-5"
                        style={{
                          borderBottom: isLast ? 'none' : '1px solid #F1F5F9',
                          background: isCurrent ? 'rgba(124,58,237,0.03)' : plan.popular ? 'rgba(124,58,237,0.015)' : '#fff',
                        }}>

                        {/* Name + sites */}
                        <div className="w-28 sm:w-36 flex-shrink-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-sm font-bold text-gray-900">{plan.name}</span>
                            {plan.popular && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none"
                                style={{ background: '#7C3AED', color: '#fff' }}>
                                Beliebt
                              </span>
                            )}
                            {isCurrent && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none"
                                style={{ background: '#EDE9FE', color: '#7C3AED' }}>
                                Aktuell
                              </span>
                            )}
                          </div>
                          <p className="text-xs mt-0.5 leading-snug" style={{ color: '#64748B' }}>
                            {plan.sites_label}
                          </p>
                        </div>

                        {/* Price */}
                        <div className="flex-1 min-w-0">
                          {isCurrent && subscription?.discount_percent === 100 ? (
                            <>
                              <div className="flex items-baseline gap-1.5">
                                <span className="text-2xl font-bold tracking-tight text-gray-900">€0</span>
                                <span className="text-xs line-through" style={{ color: '#CBD5E1' }}>
                                  €{price}
                                </span>
                                <span className="text-xs ml-0.5" style={{ color: '#94A3B8' }}>{unit}</span>
                              </div>
                              <p className="text-[11px]" style={{ color: '#15803D' }}>100% Rabatt aktiv</p>
                            </>
                          ) : isCurrent && subscription?.discount_percent != null ? (
                            <>
                              <div className="flex items-baseline gap-1.5">
                                <span className="text-2xl font-bold tracking-tight text-gray-900">
                                  €{formatEur(discountedTotal(price, { percent_off: subscription.discount_percent }))}
                                </span>
                                <span className="text-xs line-through" style={{ color: '#CBD5E1' }}>
                                  €{price}
                                </span>
                                <span className="text-xs ml-0.5" style={{ color: '#94A3B8' }}>{unit}</span>
                              </div>
                              <p className="text-[11px]" style={{ color: '#15803D' }}>
                                -{subscription.discount_percent}% Rabatt{subscription.discount_duration === 'once' ? ' auf die erste Rechnung' : ' aktiv'}
                              </p>
                            </>
                          ) : (
                            <>
                              <div className="flex items-baseline gap-0.5">
                                <span className="text-2xl font-bold tracking-tight text-gray-900">
                                  €{price}
                                </span>
                                <span className="text-xs ml-0.5" style={{ color: '#94A3B8' }}>{unit}</span>
                              </div>
                              {billingInterval === 'yearly' ? (
                                <p className="text-[11px]" style={{ color: '#15803D' }}>
                                  spare €{plan.monthly_eur * 12 - price} gegenüber monatlich
                                </p>
                              ) : (
                                <p className="text-[11px]" style={{ color: '#94A3B8' }}>inkl. MwSt.</p>
                              )}
                            </>
                          )}
                        </div>

                        {/* CTA */}
                        <div className="flex-shrink-0">
                          {isCurrent ? (
                            <div className="text-xs font-semibold px-3 py-2 rounded-xl text-center"
                              style={{ background: 'rgba(124,58,237,0.08)', color: '#7C3AED' }}>
                              Aktuell
                            </div>
                          ) : isLower ? (
                            pendingChange?.plan === plan.key ? (
                              <div className="text-xs font-semibold px-3 py-2 rounded-xl text-center whitespace-nowrap"
                                style={{ background: '#FFF7ED', color: '#C2410C' }}>
                                Ab {pendingChangeDate}
                              </div>
                            ) : canScheduleDowngrade && !pendingChange && currentInterval === billingInterval ? (
                              <button onClick={() => openPlanChange(plan.key)}
                                className="text-xs font-medium px-2 py-2 rounded-xl text-right transition-colors whitespace-nowrap"
                                style={{ color: '#94A3B8' }}
                                onMouseEnter={e => (e.currentTarget.style.color = '#374151')}
                                onMouseLeave={e => (e.currentTarget.style.color = '#94A3B8')}>
                                Zum Laufzeitende wechseln
                              </button>
                            ) : (
                              <div className="text-xs font-medium px-3 py-2 rounded-xl text-center hidden sm:block" style={{ color: '#CBD5E1' }}>
                                {pendingChange ? 'Wechsel geplant' : 'Nur zum Laufzeitende'}
                              </div>
                            )
                          ) : (
                            <button onClick={() => handleCheckout(plan.key)} disabled={checkoutLoading === plan.key}
                              className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-bold rounded-xl transition-opacity hover:opacity-90 disabled:opacity-70 text-white whitespace-nowrap"
                              style={{ background: plan.popular ? '#7C3AED' : '#1a1a1a' }}>
                              {checkoutLoading === plan.key ? <Spinner /> : null}
                              {isIntervalSwitch ? 'Jährlich zahlen' : hasSubscription ? 'Upgraden' : 'Wählen'}
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Common features — once, below plans */}
                <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 px-1">
                  {COMMON_FEATURES.map(f => (
                    <div key={f} className="flex items-center gap-1.5">
                      <svg className="flex-shrink-0" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
                      <span className="text-xs" style={{ color: '#64748B' }}>{f}</span>
                    </div>
                  ))}
                </div>
            </>
          </TabSection>

          {/* ── Aktuelles Abonnement ── */}
          <TabSection title="Abonnement" subtitle="Dein aktueller Tarif auf einen Blick.">
            {subLoading ? (
              <div className="h-20 rounded-2xl bg-gray-100 animate-pulse" />
            ) : subscription ? (
              <div className="rounded-2xl p-5 sm:p-6"
                style={{
                  background: subscription.status === 'past_due' ? '#FEF2F2'
                    : subscription.cancel_at_period_end ? '#FFF7ED'
                    : '#F0FDF4',
                  border: subscription.status === 'past_due' ? '1px solid #FECACA'
                    : subscription.cancel_at_period_end ? '1px solid #FED7AA'
                    : '1px solid #BBF7D0',
                }}>
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  <span className="text-base font-bold text-gray-900">
                    {PLAN_LABELS[subscription.plan] ?? subscription.plan}
                  </span>
                  {subscription.billing_interval && (
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full"
                      style={{ background: 'rgba(255,255,255,0.65)', color: '#374151' }}>
                      {subscription.billing_interval === 'year' || subscription.billing_interval === 'yearly' ? 'Jährlich' : 'Monatlich'}
                    </span>
                  )}
                  {subscription.status === 'past_due' ? (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                      style={{ background: '#FEE2E2', color: '#DC2626' }}>
                      Zahlung fehlgeschlagen
                    </span>
                  ) : (
                    <StatusBadge cancelling={subscription.cancel_at_period_end}>
                      {subscription.cancel_at_period_end ? 'Wird beendet' : 'Aktiv'}
                    </StatusBadge>
                  )}
                  {subscription.discount_percent != null && (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                      style={{ background: '#F0FDF4', color: '#15803D', border: '1px solid #BBF7D0' }}>
                      {subscription.discount_percent === 100
                        ? 'Kostenlos (100% Rabatt)'
                        : `-${subscription.discount_percent}% Rabatt`}
                      {subscription.discount_name ? ` · ${subscription.discount_name}` : ''}
                    </span>
                  )}
                </div>

                {subscription.status === 'past_due' ? (
                  <p className="text-sm" style={{ color: '#DC2626' }}>
                    {recoveryBody(subscription.recovery)}
                  </p>
                ) : subscription.cancel_at_period_end ? (
                  <div>
                    <p className="text-sm" style={{ color: '#C2410C' }}>
                      Dein Abo läuft am <strong>{periodEnd}</strong> aus. Danach werden Premium-Webseiten deaktiviert.
                    </p>
                    <button onClick={handleReactivate} disabled={reactivateLoading}
                      className="mt-4 flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl transition-opacity hover:opacity-90 disabled:opacity-70"
                      style={{ background: '#15803D', color: '#fff' }}>
                      {reactivateLoading ? <Spinner /> : null}
                      Kündigung zurückziehen
                    </button>
                  </div>
                ) : pendingChange ? (
                  <div>
                    <p className="text-sm" style={{ color: '#15803D' }}>
                      Nächste Abrechnung am <strong>{periodEnd}</strong>.
                    </p>
                    <p className="text-sm mt-2" style={{ color: '#374151' }}>
                      Ab dem <strong>{pendingChangeDate}</strong> läuft dein Abo im <strong>{PLAN_LABELS[pendingChange.plan] ?? pendingChange.plan}</strong>-Tarif weiter
                      {PLANS[pendingChange.plan as keyof typeof PLANS] ? ` (€${pendingChange.interval === 'yearly' ? PLANS[pendingChange.plan as keyof typeof PLANS].yearly_eur : PLANS[pendingChange.plan as keyof typeof PLANS].monthly_eur}${pendingChange.interval === 'yearly' ? ' pro Jahr' : ' pro Monat'})` : ''}. Bis dahin bleibt alles wie bisher.
                    </p>
                    <button onClick={undoPlanChange} disabled={planChangeUndoLoading}
                      className="mt-3 text-sm underline underline-offset-2 transition-colors disabled:opacity-60"
                      style={{ color: '#6B7280' }}
                      onMouseEnter={e => (e.currentTarget.style.color = '#374151')}
                      onMouseLeave={e => (e.currentTarget.style.color = '#6B7280')}>
                      {planChangeUndoLoading ? 'Bitte warten…' : 'Wechsel zurückziehen'}
                    </button>
                  </div>
                ) : (
                  <p className="text-sm" style={{ color: '#15803D' }}>
                    Nächste Abrechnung am <strong>{periodEnd}</strong>.
                  </p>
                )}
              </div>
            ) : (
              <div className="rounded-2xl p-5 sm:p-6" style={{ background: '#F8FAFC', border: '1px solid #E5E7EB' }}>
                <p className="text-sm font-semibold text-gray-900 mb-1">Kein aktives Abonnement</p>
                <p className="text-sm" style={{ color: '#64748B' }}>
                  Wähle oben einen Tarif, um Premium-Webseiten zu veröffentlichen.
                </p>
              </div>
            )}
          </TabSection>

          {/* ── Kündigung — dezenter Link ganz unten ── */}
          {subscription && !subscription.cancel_at_period_end && subscription.status !== 'past_due' && (
            <div className="pb-2 flex items-center justify-center gap-2">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" className="flex-shrink-0"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
              <button
                onClick={() => setShowCancelConfirm(true)}
                className="text-sm underline underline-offset-2 transition-colors"
                style={{ color: '#6B7280' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#374151')}
                onMouseLeave={e => (e.currentTarget.style.color = '#6B7280')}
              >
                Abonnement kündigen
              </button>
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          TAB: RECHNUNGEN
          ════════════════════════════════════════════════════════════════ */}
      {activeTab === 'rechnungen' && (
        <div className="flex flex-col gap-10">
          <TabSection title="Rechnungen" subtitle="PDFs für deine Buchhaltung. Direkt zum Download.">
            {invoicesLoading ? (
              <div className="flex flex-col gap-2">
                {[1, 2, 3].map(i => <div key={i} className="h-16 rounded-2xl bg-gray-100 animate-pulse" />)}
              </div>
            ) : invoices.length === 0 ? (
              <div className="rounded-3xl p-6 sm:p-7" style={{ background: '#F8FAFC' }}>
                <p className="text-sm font-medium text-gray-700">Noch keine Rechnungen</p>
                <p className="text-sm mt-1" style={{ color: '#94A3B8' }}>
                  Rechnungen erscheinen hier, sobald deine erste Zahlung verbucht ist.
                </p>
              </div>
            ) : (
              <div className="flex flex-col">
                {invoices.map((inv, i) => {
                  const date = new Date(inv.created * 1000).toLocaleDateString('de-DE', {
                    day: '2-digit', month: 'short', year: 'numeric',
                  })
                  const amount = (inv.amount_paid > 0 ? inv.amount_paid : inv.amount_due) / 100
                  const amountStr = amount.toLocaleString('de-DE', { style: 'currency', currency: inv.currency.toUpperCase() })
                  const statusLabel: Record<string, { text: string; bg: string; color: string }> = {
                    paid:          { text: 'Bezahlt',        bg: '#ECFDF5', color: '#15803D' },
                    open:          { text: 'Offen',          bg: '#FFF7ED', color: '#B45309' },
                    uncollectible: { text: 'Uneinbringlich', bg: '#FEF2F2', color: '#B91C1C' },
                    void:          { text: 'Storniert',      bg: '#F3F4F6', color: '#6B7280' },
                  }
                  const s = statusLabel[inv.status ?? 'paid'] ?? statusLabel.paid
                  const isLast = i === invoices.length - 1

                  return (
                    <div key={inv.id}
                      className="flex items-center gap-3 px-3 py-4 rounded-2xl transition-colors hover:bg-gray-50"
                      style={{ borderBottom: isLast ? 'none' : '1px solid #F1F5F9' }}>
                      <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ background: '#F1F5F9' }}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2">
                          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                          <polyline points="14 2 14 8 20 8"/>
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-gray-900 truncate">
                            {inv.number ?? `Rechnung ${inv.id.slice(-8)}`}
                          </p>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                            style={{ background: s.bg, color: s.color }}>
                            {s.text}
                          </span>
                        </div>
                        <p className="text-xs mt-0.5 break-words" style={{ color: '#94A3B8' }}>
                          {date} · {amountStr} inkl. MwSt.
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {inv.invoice_pdf && (
                          <a href={inv.invoice_pdf} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl transition-colors"
                            style={{ background: '#1a1a1a', color: '#fff' }}
                            onMouseEnter={e => (e.currentTarget.style.background = '#333')}
                            onMouseLeave={e => (e.currentTarget.style.background = '#1a1a1a')}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
                            </svg>
                            PDF
                          </a>
                        )}
                        {inv.hosted_invoice_url && (
                          <a href={inv.hosted_invoice_url} target="_blank" rel="noopener noreferrer"
                            className="hidden sm:flex items-center justify-center w-9 h-9 rounded-xl transition-colors"
                            style={{ background: '#F3F4F6', color: '#374151' }}
                            onMouseEnter={e => (e.currentTarget.style.background = '#E5E7EB')}
                            onMouseLeave={e => (e.currentTarget.style.background = '#F3F4F6')}
                            title="Online ansehen">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"/>
                            </svg>
                          </a>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </TabSection>

          {hasSubscription && (
            <TabSection title="Rechnung auf deine Firma?" subtitle="Freiwillig. Du kannst beides leer lassen.">
              <InvoiceDetailsCard />
            </TabSection>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          TAB: WERBUNG & TRACKING
          ════════════════════════════════════════════════════════════════ */}
      {activeTab === 'werbung' && (
        <div className="flex flex-col gap-10">
          <TabSection title="Werbung & Tracking" subtitle="Für Anzeigen bei Meta, Google und TikTok. Nur nötig, wenn du Werbung schaltest.">
            <TrackingSettings />
          </TabSection>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          TAB: E-MAILS (welche Mail-Arten der Nutzer bekommen will)
          ════════════════════════════════════════════════════════════════ */}
      {activeTab === 'mails' && (
        <div className="flex flex-col gap-10">
          <TabSection title="E-Mails von FinestSites" subtitle="Du entscheidest, welche Mails du von uns bekommst. Von Anfang an ist alles an.">
            <div className="flex flex-col gap-3">
              {EMAIL_CATEGORIES.map(cat => {
                const on = cat.locked || !emailOptOut.includes(cat.key)
                return (
                  <div key={cat.key} className="flex items-start justify-between gap-4 p-4 sm:p-5 rounded-2xl bg-white"
                    style={{ border: '1.5px solid #E5E7EB' }}>
                    <div className="min-w-0">
                      <p className="text-[15px] font-semibold text-gray-900 flex items-center gap-2">
                        {cat.label}
                        {cat.locked && (
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: '#F3F4F6', color: '#6B7280' }}>Immer an</span>
                        )}
                      </p>
                      <p className="text-sm mt-1" style={{ color: '#6B7280' }}>{cat.description}</p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={on}
                      aria-label={cat.label}
                      disabled={cat.locked}
                      onClick={() => setEmailOptOut(prev => prev.includes(cat.key) ? prev.filter(k => k !== cat.key) : [...prev, cat.key])}
                      className="relative flex-shrink-0 w-12 h-7 rounded-full transition-colors disabled:opacity-60 disabled:cursor-not-allowed mt-0.5"
                      style={{ background: on ? '#16A34A' : '#D1D5DB' }}>
                      <span className="absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-all" style={{ left: on ? 22 : 2 }} />
                    </button>
                  </div>
                )
              })}
            </div>
            <div className="flex items-center gap-3 pt-5">
              <button
                type="button"
                onClick={handleEmailPrefsSave}
                disabled={emailSaving}
                className="px-5 py-2.5 text-sm font-semibold rounded-2xl transition-all"
                style={{ background: emailSaving ? '#E5E7EB' : '#111827', color: emailSaving ? '#9CA3AF' : '#fff' }}
              >
                {emailSaving ? 'Wird gespeichert…' : 'Speichern'}
              </button>
              {emailSuccess && <span className="text-sm text-green-600">{emailSuccess}</span>}
            </div>
            <p className="text-xs mt-4 px-1" style={{ color: '#94A3B8' }}>
              Mails zu Konto und Zahlung kommen immer, weil sie zu deinem Vertrag gehören. Alles andere kannst du hier oder unten in jeder Mail abbestellen.
            </p>
          </TabSection>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          TAB: PASSWORT & FAQ
          ════════════════════════════════════════════════════════════════ */}
      {activeTab === 'sicherheit' && (
        <div className="flex flex-col gap-10">

          <TabSection title="Passwort ändern" subtitle="Wähle ein starkes Passwort mit mindestens 6 Zeichen.">
            <form onSubmit={handlePasswordChange} className="w-full sm:max-w-md flex flex-col gap-4">
              <Field
                label="Aktuelles Passwort"
                value={currentPassword}
                onChange={setCurrentPassword}
                type="password"
                placeholder="••••••••"
              />
              <Field
                label="Neues Passwort"
                value={newPassword}
                onChange={setNewPassword}
                type="password"
                placeholder="Mindestens 6 Zeichen"
              />
              <Field
                label="Neues Passwort bestätigen"
                value={confirmPassword}
                onChange={setConfirmPassword}
                type="password"
                placeholder="••••••••"
              />

              {pwError && (
                <p className="text-sm font-medium px-4 py-3 rounded-2xl"
                  style={{ background: '#FEF2F2', color: '#DC2626' }}>
                  {pwError}
                </p>
              )}
              {pwSuccess && (
                <p className="text-sm font-medium px-4 py-3 rounded-2xl flex items-center gap-2"
                  style={{ background: '#F0FDF4', color: '#15803D' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M20 6L9 17l-5-5"/>
                  </svg>
                  {pwSuccess}
                </p>
              )}

              <button type="submit" disabled={pwLoading}
                className="self-start flex items-center gap-2 px-5 py-3 text-sm font-bold text-white rounded-xl transition-opacity hover:opacity-90 disabled:opacity-70 mt-1"
                style={{ background: '#1a1a1a' }}>
                {pwLoading && <Spinner />}
                Passwort ändern
              </button>
            </form>
          </TabSection>

          <div id="konto-loeschen">
            <TabSection title="Konto löschen" subtitle="Löscht dein Konto mit allen Seiten und Anfragen, nach 14 Tagen Bedenkzeit.">
              <AccountDeletionSection />
            </TabSection>
          </div>

          <TabSection title="Häufige Fragen" subtitle="Schnelle Antworten auf die wichtigsten Fragen.">
            <div className="flex flex-col">
              {FAQ.map(([q, a], i) => {
                const open = openFaq === i
                return (
                  <div key={i} style={{ borderBottom: i < FAQ.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
                    <button onClick={() => setOpenFaq(open ? null : i)}
                      className="w-full flex items-center justify-between gap-4 py-5 text-left transition-colors hover:bg-gray-50 px-1 rounded-xl"
                      aria-expanded={open}>
                      <span className="text-[15px] font-semibold text-gray-900">{q}</span>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2"
                        style={{ flexShrink: 0, transform: open ? 'rotate(45deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                        <path d="M12 5v14M5 12h14" strokeLinecap="round"/>
                      </svg>
                    </button>
                    {open && (
                      <p className="text-sm pb-5 px-1 leading-relaxed" style={{ color: '#64748B' }}>
                        {a}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          </TabSection>
        </div>
      )}

      {/* ── Cancel confirmation modal ───────────────────────────────────────── */}
      {upgradeTarget && (() => {
        const renewalDateStr = upgradePreview?.renewal_date
          ? new Date(upgradePreview.renewal_date * 1000).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })
          : null
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)' }}>
            <div className="bg-white rounded-3xl p-7 max-w-md w-full flex flex-col gap-5"
              style={{ boxShadow: '0 24px 64px rgba(0,0,0,0.20)' }}>
              <div>
                <h3 className="font-bold text-gray-900 text-lg tracking-tight">
                  {upgradeTarget === currentPlan && upgradeInterval === 'yearly'
                    ? `Wechsel ins Jahresabo (${PLAN_LABELS[upgradeTarget] ?? upgradeTarget})`
                    : `Upgrade auf ${PLAN_LABELS[upgradeTarget] ?? upgradeTarget}${upgradeInterval !== currentInterval ? ' (jährlich)' : ''}`}
                </h3>
                <p className="text-sm mt-1.5 leading-relaxed" style={{ color: '#64748B' }}>
                  {upgradeInterval !== currentInterval
                    ? 'Dein Jahresabo beginnt heute. Der ungenutzte Rest deines laufenden Monats wird angerechnet.'
                    : 'Du zahlst jetzt nur die Differenz für die restlichen Tage deines aktuellen Abrechnungszeitraums.'}
                </p>
                {upgradePreview?.referral_yearly_added && (
                  <p className="text-sm mt-2 font-semibold" style={{ color: '#15803D' }}>
                    Mit 10 % Rabatt, solange dein Jahresabo läuft.
                  </p>
                )}
              </div>

              {upgradePreviewError ? (
                <p className="text-sm font-medium px-4 py-3 rounded-2xl"
                  style={{ background: '#FEF2F2', color: '#DC2626' }}>
                  {upgradePreviewError}
                </p>
              ) : !upgradePreview ? (
                <div className="h-32 rounded-2xl bg-gray-100 animate-pulse" />
              ) : (
                <>
                  <div className="rounded-2xl p-5" style={{ background: '#F8FAFC', border: '1px solid #E5E7EB' }}>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-sm font-semibold text-gray-900">Heute fällig</span>
                      <span className="text-2xl font-bold tracking-tight text-gray-900">
                        {fmtCents(upgradePreview.due_cents)}
                      </span>
                    </div>
                    <div className="mt-3 pt-3 flex flex-col gap-1.5" style={{ borderTop: '1px solid #E5E7EB' }}>
                      <div className="flex justify-between gap-3 text-xs" style={{ color: '#64748B' }}>
                        <span>{upgradePreview.interval_change ? 'Jahresabo' : 'Neuer Tarif, anteilig'}{renewalDateStr ? ` bis zum ${renewalDateStr}` : ''}</span>
                        <span className="flex-shrink-0">{fmtCents(upgradePreview.charge_cents)}</span>
                      </div>
                      {upgradePreview.credit_cents < 0 && (
                        <div className="flex justify-between gap-3 text-xs" style={{ color: '#15803D' }}>
                          <span>Gutschrift für ungenutzte Zeit im alten Tarif</span>
                          <span className="flex-shrink-0">−{fmtCents(-upgradePreview.credit_cents)}</span>
                        </div>
                      )}
                      <p className="text-[11px] mt-1" style={{ color: '#94A3B8' }}>
                        Inkl. MwSt. Dein Rabatt ist bereits eingerechnet.
                      </p>
                    </div>
                  </div>
                  {renewalDateStr && (
                    <p className="text-sm leading-relaxed" style={{ color: '#64748B' }}>
                      Ab dem <strong className="text-gray-900">{renewalDateStr}</strong> zahlst du dann regulär{' '}
                      <strong className="text-gray-900">{fmtCents(upgradePreview.next_amount_cents)}</strong>
                      {upgradePreview.interval === 'yearly' ? ' pro Jahr' : ' pro Monat'}.
                    </p>
                  )}
                </>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => { setUpgradeTarget(null); setUpgradePreview(null); setUpgradePreviewError('') }}
                  disabled={upgradeLoading}
                  className="flex-1 px-4 py-3 text-sm font-semibold rounded-xl transition-colors hover:bg-gray-200 disabled:opacity-60"
                  style={{ background: '#F3F4F6', color: '#374151' }}>
                  Abbrechen
                </button>
                <button
                  onClick={confirmUpgrade}
                  disabled={upgradeLoading || !upgradePreview || !!upgradePreviewError}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold text-white rounded-xl transition-opacity hover:opacity-90 disabled:opacity-60"
                  style={{ background: '#7C3AED' }}>
                  {upgradeLoading && <Spinner />}
                  {upgradePreview
                    ? `Für ${fmtCents(upgradePreview.due_cents)} ${upgradeTarget === currentPlan ? 'wechseln' : 'upgraden'}`
                    : upgradeTarget === currentPlan ? 'Jetzt wechseln' : 'Jetzt upgraden'}
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {planChangeTarget && (() => {
        const target = PLANS[planChangeTarget as keyof typeof PLANS]
        const limit = getPlanMaxSites(planChangeTarget)
        const sites = planChangeSites ?? []
        const mustChoose = limit >= 0 && sites.length > limit
        const price = target ? (currentInterval === 'yearly' ? target.yearly_eur : target.monthly_eur) : null
        const unit = currentInterval === 'yearly' ? 'pro Jahr' : 'pro Monat'
        const toggleKeep = (id: string) => setPlanChangeKeep(prev => {
          if (prev.includes(id)) return prev.filter(x => x !== id)
          if (limit === 1) return [id]
          return prev.length >= limit ? prev : [...prev, id]
        })
        const ready = !!planChangeSites && (!mustChoose || planChangeKeep.length === limit)
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)' }}>
            <div className="bg-white rounded-3xl p-7 max-w-md w-full flex flex-col gap-5"
              style={{ boxShadow: '0 24px 64px rgba(0,0,0,0.20)' }}>
              <div>
                <h3 className="font-bold text-gray-900 text-lg tracking-tight">
                  Wechsel zu {target?.name ?? planChangeTarget} zum Laufzeitende
                </h3>
                <p className="text-sm mt-1.5 leading-relaxed" style={{ color: '#64748B' }}>
                  Bis zum <strong className="text-gray-900">{periodEnd}</strong> bleibt alles wie bisher. Ab dann läuft dein Abo im {target?.name ?? planChangeTarget}-Tarif weiter
                  {price != null ? <> und kostet <strong className="text-gray-900">€{price} {unit}</strong></> : null}. Keine Kündigung, keine neue Buchung, keine Zwischenrechnung.
                </p>
              </div>

              {planChangeError ? (
                <p className="text-sm font-medium px-4 py-3 rounded-2xl" style={{ background: '#FEF2F2', color: '#DC2626' }}>
                  {planChangeError}
                </p>
              ) : !planChangeSites ? (
                <div className="h-24 rounded-2xl bg-gray-100 animate-pulse" />
              ) : mustChoose ? (
                <div className="rounded-2xl p-4" style={{ background: '#F8FAFC', border: '1px solid #E5E7EB' }}>
                  <p className="text-sm font-semibold text-gray-900">
                    {limit === 1 ? 'Welche Webseite soll online bleiben?' : `Welche ${limit} Webseiten sollen online bleiben?`}
                  </p>
                  <p className="text-xs mt-1 mb-3" style={{ color: '#64748B' }}>
                    Der {target?.name}-Tarif erlaubt {limit === 1 ? 'eine aktive Premium-Webseite' : `${limit} aktive Premium-Webseiten`}. Die anderen gehen am {periodEnd} offline und bleiben als Entwurf gespeichert.
                  </p>
                  <div className="flex flex-col gap-2">
                    {sites.map(site => {
                      const on = planChangeKeep.includes(site.id)
                      return (
                        <label key={site.id} className="flex items-start gap-3 rounded-xl px-3 py-2.5 cursor-pointer transition-colors"
                          style={{ background: on ? '#fff' : 'transparent', border: on ? '1px solid #111827' : '1px solid #E5E7EB' }}>
                          <input type={limit === 1 ? 'radio' : 'checkbox'} name="keep-site" checked={on} onChange={() => toggleKeep(site.id)} className="mt-0.5" />
                          <span className="min-w-0">
                            <span className="block text-sm font-medium text-gray-900">{site.title}</span>
                            {site.url && <span className="block text-xs truncate" style={{ color: '#94A3B8' }}>{site.url.replace(/^https:\/\//, '')}</span>}
                          </span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <p className="text-sm leading-relaxed" style={{ color: '#64748B' }}>
                  Deine {sites.length === 1 ? 'Webseite bleibt' : 'Webseiten bleiben'} online – {sites.length === 0 ? 'du hast aktuell keine veröffentlichte Premium-Webseite.' : `${sites.length === 1 ? 'sie passt' : 'sie passen'} in den ${target?.name}-Tarif.`}
                </p>
              )}

              <p className="text-xs leading-relaxed" style={{ color: '#94A3B8' }}>
                Du kannst den Wechsel bis zum {periodEnd} jederzeit zurückziehen. Ein Upgrade geht danach weiterhin sofort.
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => { setPlanChangeTarget(null); setPlanChangeError('') }}
                  disabled={planChangeLoading}
                  className="flex-1 px-4 py-3 text-sm font-semibold rounded-xl transition-colors hover:bg-gray-200 disabled:opacity-60"
                  style={{ background: '#F3F4F6', color: '#374151' }}>
                  Abbrechen
                </button>
                <button
                  onClick={confirmPlanChange}
                  disabled={planChangeLoading || !ready}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold text-white rounded-xl transition-opacity hover:opacity-90 disabled:opacity-60"
                  style={{ background: '#111827' }}>
                  {planChangeLoading && <Spinner />}
                  Wechsel einplanen
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {showCancelConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)' }}>
          <div className="bg-white rounded-3xl p-7 max-w-md w-full flex flex-col gap-5"
            style={{ boxShadow: '0 24px 64px rgba(0,0,0,0.20)' }}>
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{ background: '#FEF2F2' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="1.75">
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-gray-900 text-lg tracking-tight">Abonnement kündigen?</h3>
                <p className="text-sm mt-1.5 leading-relaxed" style={{ color: '#64748B' }}>
                  Dein Abonnement bleibt bis zum <strong className="text-gray-900">{periodEnd}</strong> aktiv.
                  Danach werden aktive Premium-Webseiten deaktiviert.
                </p>
              </div>
            </div>

            {cancelError && (
              <p className="text-sm font-medium px-4 py-3 rounded-2xl"
                style={{ background: '#FEF2F2', color: '#DC2626' }}>
                {cancelError}
              </p>
            )}

            <div className="flex gap-3">
              <button onClick={() => { setShowCancelConfirm(false); setCancelError('') }}
                className="flex-1 px-4 py-3 text-sm font-semibold rounded-xl transition-colors hover:bg-gray-200"
                style={{ background: '#F3F4F6', color: '#374151' }}>
                Behalten
              </button>
              <button onClick={handleCancelSubscription} disabled={cancelLoading}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold text-white rounded-xl transition-colors disabled:opacity-70"
                style={{ background: '#DC2626' }}
                onMouseEnter={e => { if (!cancelLoading) (e.currentTarget as HTMLElement).style.background = '#B91C1C' }}
                onMouseLeave={e => { if (!cancelLoading) (e.currentTarget as HTMLElement).style.background = '#DC2626' }}>
                {cancelLoading && <Spinner />}
                Kündigen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function TabSection({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-5">
        <h2 className="text-lg sm:text-xl font-bold text-gray-900 tracking-tight">{title}</h2>
        {subtitle && <p className="text-sm mt-1" style={{ color: '#94A3B8' }}>{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}

function StatusBadge({ cancelling, children }: { cancelling: boolean; children: React.ReactNode }) {
  return (
    <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1.5"
      style={{
        background: cancelling ? '#FED7AA' : '#BBF7D0',
        color: cancelling ? '#9A3412' : '#14532D',
      }}>
      <span className="w-1.5 h-1.5 rounded-full"
        style={{ background: cancelling ? '#EA580C' : '#16A34A' }} />
      {children}
    </span>
  )
}

function Field({
  label, value, onChange, type = 'text', placeholder,
}: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-semibold text-gray-700">{label}</label>
      <input
        type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} required
        className="w-full px-4 py-3 text-[15px] rounded-2xl outline-none transition-all bg-white"
        style={{ border: '1.5px solid #E5E7EB' }}
        onFocus={e => (e.target.style.borderColor = '#1a1a1a')}
        onBlur={e => (e.target.style.borderColor = '#E5E7EB')}
      />
    </div>
  )
}

function ProfileField({
  label, value, onChange, placeholder, hint,
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; hint?: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-semibold text-gray-700">{label}</label>
      <input
        type="text" value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-4 py-3 text-[15px] rounded-2xl outline-none transition-all bg-white"
        style={{ border: '1.5px solid #E5E7EB' }}
        onFocus={e => (e.target.style.borderColor = '#1a1a1a')}
        onBlur={e => (e.target.style.borderColor = '#E5E7EB')}
      />
    {hint && <p className="text-xs px-1" style={{ color: '#94A3B8' }}>{hint}</p>}
    </div>
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

function CheckIconForPlan({ popular }: { popular?: boolean }) {
  return (
    <svg className="flex-shrink-0 mt-0.5" width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke={popular ? '#7C3AED' : '#16A34A'} strokeWidth="2.5">
      <path d="M20 6L9 17l-5-5"/>
    </svg>
  )
}

function Spinner() {
  return (
    <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
  )
}

// ── Page entry with Suspense ──────────────────────────────────────────────────

export default function SettingsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 rounded-full border-2 border-gray-200 border-t-gray-900 animate-spin" />
      </div>
    }>
      <SettingsContent />
    </Suspense>
  )
}
