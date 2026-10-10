'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getTemplateIntentCookie, clearTemplateIntentCookie, isValidTemplateId } from '@/lib/cookies/template-intent'
import { downloadQrPng, copyText } from '@/lib/utils/qr-download'

// ── Types ───────────────────────────────────────────────────────────────────

interface Site {
  id: string
  template_id: string
  status: 'draft' | 'published' | 'deactivated' | 'deleted'
  created_at: string
  username: string | null
  custom_domain: string | null
  custom_domain_status: string | null
  unread_submissions?: number
  has_unpublished_changes?: boolean
  templates: {
    title: string
    domain: string
    preview_images?: string[] | null
  } | null
}

// ── SiteCard ────────────────────────────────────────────────────────────────
// One website = one clearly outlined card: preview, name, status, address and
// labelled buttons. Nothing relies on "tap the picture" — the picture is only a bonus.

const STATUS_META = {
  published:   { label: 'Online',  bg: '#DCFCE7', color: '#15803D', dot: '#16A34A' },
  draft:       { label: 'Entwurf', bg: '#F1F5F9', color: '#475569', dot: '#94A3B8' },
  deactivated: { label: 'Offline', bg: '#FEF2F2', color: '#B91C1C', dot: '#DC2626' },
} as const

function SiteCard({ site, onDeleted }: { site: Site; onDeleted: (id: string) => void }) {
  const isPublished = site.status === 'published'
  const isDraft = site.status === 'draft'
  const meta = STATUS_META[site.status as keyof typeof STATUS_META] ?? STATUS_META.draft
  const domain = site.templates?.domain
  const username = site.username
  const hasCustomDomain = site.custom_domain_status === 'active' && !!site.custom_domain
  const displayUrl = hasCustomDomain
    ? site.custom_domain!
    : (domain && username ? `${username}.${domain}` : null)
  const siteUrl = isPublished && displayUrl ? `https://${displayUrl}` : null
  const preview = site.templates?.preview_images?.[0]
    ?? (siteUrl ? `https://image.thum.io/get/width/800/crop/500/${siteUrl}` : null)
  const editHref = `/sites/${site.id}/edit`
  const title = site.templates?.title ?? 'Meine Webseite'

  // Share actions for live sites: copy the link, download the QR code
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const [qrBusy, setQrBusy] = useState(false)
  // Drafts can be removed again (two-step, so nothing is deleted by accident)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleCopyLink() {
    if (!siteUrl) return
    setCopyState(await copyText(siteUrl) ? 'copied' : 'failed')
    setTimeout(() => setCopyState('idle'), 2500)
  }

  async function handleQrDownload() {
    if (!siteUrl || qrBusy) return
    setQrBusy(true)
    try { await downloadQrPng(siteUrl) } catch { /* nothing to clean up */ } finally { setQrBusy(false) }
  }

  async function handleDelete() {
    if (deleting) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/sites/${site.id}`, { method: 'DELETE' })
      if (res.ok) { onDeleted(site.id); return }
    } catch { /* fall through */ }
    setDeleting(false)
    setConfirmDelete(false)
  }

  const secondaryBtn = 'flex-[1_1_150px] flex items-center justify-center gap-2 min-h-12 px-3 py-2 rounded-2xl text-sm font-semibold leading-tight whitespace-nowrap transition-colors'

  return (
    <article className="flex flex-col rounded-3xl overflow-hidden bg-white"
      style={{ border: '1.5px solid #E2E8F0', boxShadow: '0 2px 12px rgba(15,23,42,0.06)' }}>

      {/* Preview — full picture in its own format (16:10), never cropped */}
      <Link href={editHref} aria-label={`${title} bearbeiten`}
        className="block relative bg-gray-100" style={{ aspectRatio: '16 / 10', borderBottom: '1px solid #E2E8F0' }}>
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" className="absolute inset-0 w-full h-full"
            style={{ objectFit: 'cover', objectPosition: 'top center' }} />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center"
            style={{ background: 'linear-gradient(160deg, #FAFAFA 0%, #F1F5F9 100%)' }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10"/>
              <line x1="2" y1="12" x2="22" y2="12"/>
              <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/>
            </svg>
          </div>
        )}
        {(site.unread_submissions ?? 0) > 0 && (
          <span className="absolute top-3 left-3 text-xs font-bold px-2.5 py-1 rounded-full text-white"
            style={{ background: '#EF4444', boxShadow: '0 2px 8px rgba(239,68,68,0.4)' }}>
            {site.unread_submissions} neue Anfrage{site.unread_submissions === 1 ? '' : 'n'}
          </span>
        )}
      </Link>

      <div className="flex flex-col gap-3 p-4 sm:p-5">
        {/* Name + status */}
        <div>
          <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full mb-2"
            style={{ background: meta.bg, color: meta.color }}>
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: meta.dot }} />
            {meta.label}
          </span>
          {site.status === 'published' && site.has_unpublished_changes && (
            <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full mb-2 ml-1.5"
              style={{ background: '#FFF7ED', color: '#9A3412' }} title="Gespeicherte Änderungen, die noch nicht online sind">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#D97706' }} />
              Änderungen nicht online
            </span>
          )}
          <h3 className="text-lg font-bold text-gray-900 leading-snug">{title}</h3>
          {displayUrl && (
            <p className="text-sm mt-0.5 break-all" style={{ color: hasCustomDomain ? '#15803D' : '#64748B' }}>
              {displayUrl}
            </p>
          )}
          {isDraft && (
            <p className="text-sm mt-1.5" style={{ color: '#64748B' }}>Noch nicht online. Nur du siehst diese Seite.</p>
          )}
          {site.status === 'deactivated' && (
            <p className="text-sm mt-1.5" style={{ color: '#B91C1C' }}>Diese Seite ist gerade nicht erreichbar.</p>
          )}
        </div>

        {/* Main action — always the same, always a real button */}
        <Link href={editHref}
          className="flex items-center justify-center gap-2 w-full min-h-12 px-4 rounded-2xl text-[15px] font-bold text-white transition-transform active:scale-[0.98]"
          style={{ background: '#111827' }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>
          </svg>
          {isDraft ? 'Weiter bearbeiten' : 'Bearbeiten'}
        </Link>

        {/* Live site: view + share */}
        {siteUrl && (
          <div className="flex flex-wrap gap-2">
            <a href={siteUrl} target="_blank" rel="noopener noreferrer" className={secondaryBtn}
              style={{ background: '#F1F5F9', color: '#111827' }}>
              <svg className="flex-shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
              Seite ansehen
            </a>
            <button type="button" onClick={handleCopyLink} className={secondaryBtn}
              style={copyState === 'copied' ? { background: '#DCFCE7', color: '#15803D' } : { background: '#F1F5F9', color: '#111827' }}>
              {copyState === 'copied' ? (
                <svg className="flex-shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
              ) : (
                <svg className="flex-shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                </svg>
              )}
              <span aria-live="polite">
                {copyState === 'copied' ? 'Link kopiert' : copyState === 'failed' ? 'Kopieren fehlgeschlagen' : 'Link kopieren'}
              </span>
            </button>
            <button type="button" onClick={handleQrDownload} disabled={qrBusy} className={secondaryBtn}
              style={{ background: '#F1F5F9', color: '#111827', opacity: qrBusy ? 0.6 : 1 }}>
              <svg className="flex-shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>
                <path d="M14 14h3v3h-3zM20 14v.01M14 20v.01M17 20h4v-3"/>
              </svg>
              <span>{qrBusy ? 'Wird erstellt…' : 'QR-Code speichern'}</span>
            </button>
          </div>
        )}

        {/* Draft: can be removed again */}
        {isDraft && (
          confirmDelete ? (
            <div className="flex flex-col gap-2 rounded-2xl p-3" style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}>
              <p className="text-sm font-semibold" style={{ color: '#991B1B' }}>Diesen Entwurf wirklich löschen?</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={handleDelete} disabled={deleting}
                  className="flex-[1_1_120px] min-h-11 px-3 rounded-xl text-sm font-bold text-white"
                  style={{ background: '#DC2626', opacity: deleting ? 0.6 : 1 }}>
                  {deleting ? 'Wird gelöscht…' : 'Ja, löschen'}
                </button>
                <button type="button" onClick={() => setConfirmDelete(false)} disabled={deleting}
                  className="flex-[1_1_120px] min-h-11 px-3 rounded-xl text-sm font-semibold"
                  style={{ background: '#fff', color: '#111827', border: '1px solid #E5E7EB' }}>
                  Abbrechen
                </button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirmDelete(true)}
              className="self-center min-h-11 px-3 text-sm font-medium underline underline-offset-4"
              style={{ color: '#64748B' }}>
              Entwurf löschen
            </button>
          )
        )}
      </div>
    </article>
  )
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function SitesPage() {
  const router = useRouter()
  const [sites, setSites] = useState<Site[]>([])
  const [username, setUsername] = useState<string>('')
  const [firstName, setFirstName] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [autoCreating, setAutoCreating] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 10000) // 10s timeout

    Promise.all([
      fetch('/api/sites', { signal: controller.signal }).then(r => r.json()),
      fetch('/api/user/profile', { signal: controller.signal }).then(r => r.json()),
    ]).then(([sitesData, profile]) => {
      clearTimeout(timer)
      const loadedSites = Array.isArray(sitesData) ? sitesData : []
      setSites(loadedSites)
      setUsername(profile?.username ?? '')
      setFirstName(profile?.first_name ?? '')
      setLoading(false)

      // Check for template intent cookie — auto-create site if present
      const intentId = getTemplateIntentCookie()
      if (intentId && isValidTemplateId(intentId)) {
        clearTemplateIntentCookie() // Clear immediately to prevent double-creation
        setAutoCreating(true)
        fetch('/api/sites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ template_id: intentId }),
        })
          .then(r => r.json())
          .then(data => {
            if (data.id) {
              router.push(`/sites/${data.id}/edit`)
            } else {
              setAutoCreating(false)
            }
          })
          .catch(() => setAutoCreating(false))
      }
    }).catch(() => { clearTimeout(timer); setLoading(false) })

    return () => { controller.abort(); clearTimeout(timer) }
  }, [router])

  const hasSites = sites.length > 0
  const liveSites = sites.filter(s => s.status === 'published')
  const offlineSites = sites.filter(s => s.status === 'deactivated')
  const draftSites = sites.filter(s => s.status !== 'published' && s.status !== 'deactivated')
  const removeSite = (id: string) => setSites(prev => prev.filter(s => s.id !== id))

  // Greeting follows the clock (and keeps following it while the page stays open)
  const [hour, setHour] = useState<number | null>(null)
  useEffect(() => {
    const update = () => setHour(new Date().getHours())
    update()
    const timer = window.setInterval(update, 60_000)
    return () => window.clearInterval(timer)
  }, [])

  function getGreeting() {
    const time = hour === null ? 'Hallo'
      : hour >= 5 && hour < 11 ? 'Guten Morgen'
      : hour >= 11 && hour < 18 ? 'Guten Tag'
      : hour >= 18 && hour < 23 ? 'Guten Abend'
      : 'Hallo'
    const name = firstName || username
    return name ? `${time}, ${name}` : time
  }

  const GRID = 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 sm:gap-6'
  const newSiteButton = (
    <Link
      href="/sites/new"
      className="flex items-center justify-center gap-3 w-full sm:w-auto sm:inline-flex min-h-14 px-7 rounded-2xl font-bold text-base transition-all active:scale-[0.98]"
      style={{ background: '#7C3AED', color: '#fff', boxShadow: '0 6px 20px rgba(124,58,237,0.28)' }}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.75" strokeLinecap="round">
        <path d="M12 5v14M5 12h14"/>
      </svg>
      Neue Webseite erstellen
    </Link>
  )

  return (
    <>
    {autoCreating && (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5"
        style={{ background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(12px)' }}>
        <div className="w-16 h-16 rounded-3xl flex items-center justify-center"
          style={{ background: '#F5F0FB' }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="1.5">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <line x1="3" y1="9" x2="21" y2="9"/>
            <line x1="9" y1="9" x2="9" y2="21"/>
          </svg>
        </div>
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-1">Dein Template wird eingerichtet…</h2>
          <p className="text-sm" style={{ color: '#9CA3AF' }}>Gleich geht es los!</p>
        </div>
        <div className="flex gap-1.5">
          {[0, 1, 2].map(i => (
            <div key={i} className="w-2 h-2 rounded-full animate-bounce"
              style={{ background: '#7C3AED', animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
      </div>
    )}
    <div className="max-w-7xl mx-auto">

      {/* ── Greeting + the one main action, right at the top ── */}
      <div className="mb-8 sm:mb-10">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
          {loading ? '\u00A0' : getGreeting()}
        </h1>
        <p className="text-base mt-1.5 mb-5" style={{ color: '#64748B' }}>
          {loading ? '\u00A0' : hasSites
            ? 'Hier findest du deine Webseiten.'
            : 'Du hast noch keine Webseite. Leg jetzt deine erste an.'}
        </p>
        {!loading && newSiteButton}
      </div>

      {loading && (
        <div className={GRID}>
          {[1, 2].map(i => (
            <div key={i} className="animate-pulse rounded-3xl overflow-hidden bg-white" style={{ border: '1.5px solid #E2E8F0' }}>
              <div className="bg-gray-100" style={{ aspectRatio: '16 / 10' }} />
              <div className="p-5 flex flex-col gap-3">
                <div className="h-4 rounded-full bg-gray-100 w-2/3" />
                <div className="h-3 rounded-full bg-gray-100 w-1/2" />
                <div className="h-12 rounded-2xl bg-gray-100 w-full" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Live sites ── */}
      {!loading && liveSites.length > 0 && (
        <section className="mb-10">
          <h2 className="text-xl font-bold text-gray-900">Online</h2>
          <p className="text-sm mt-0.5 mb-4" style={{ color: '#64748B' }}>
            {liveSites.length === 1 ? 'Diese Webseite ist veröffentlicht und für alle sichtbar.' : 'Diese Webseiten sind veröffentlicht und für alle sichtbar.'}
          </p>
          <div className={GRID}>
            {liveSites.map(site => <SiteCard key={site.id} site={site} onDeleted={removeSite} />)}
          </div>
        </section>
      )}

      {/* ── Sites taken offline (open payment) ── */}
      {!loading && offlineSites.length > 0 && (
        <section className="mb-10">
          <h2 className="text-xl font-bold text-gray-900">Offline</h2>
          <p className="text-sm mt-0.5 mb-4" style={{ color: '#64748B' }}>
            Diese Webseiten sind gerade nicht erreichbar. Schau unter „Einstellungen“ nach deiner Zahlung.
          </p>
          <div className={GRID}>
            {offlineSites.map(site => <SiteCard key={site.id} site={site} onDeleted={removeSite} />)}
          </div>
        </section>
      )}

      {/* ── Drafts ── */}
      {!loading && draftSites.length > 0 && (
        <section className="mb-10">
          <h2 className="text-xl font-bold text-gray-900">Entwürfe</h2>
          <p className="text-sm mt-0.5 mb-4" style={{ color: '#64748B' }}>
            Angefangen, aber noch nicht veröffentlicht. Nur du siehst sie.
          </p>
          <div className={GRID}>
            {draftSites.map(site => <SiteCard key={site.id} site={site} onDeleted={removeSite} />)}
          </div>
        </section>
      )}

      {/* ── Second chance to find the main action, after the list ── */}
      {!loading && hasSites && (
        <Link href="/sites/new"
          className="flex flex-col items-center justify-center gap-1.5 w-full rounded-3xl px-5 py-7 text-center transition-colors"
          style={{ border: '2px dashed #C4B5FD', background: '#FAF7FF' }}>
          <span className="flex items-center justify-center w-11 h-11 rounded-full" style={{ background: '#7C3AED', color: '#fff' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.75" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
          </span>
          <span className="text-base font-bold text-gray-900 mt-1">Noch eine Webseite erstellen</span>
          <span className="text-sm" style={{ color: '#64748B' }}>Such dir eine weitere Vorlage aus.</span>
        </Link>
      )}

    </div>
    </>
  )
}
