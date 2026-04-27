import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users').select('*').eq('id', user.id).single()

  if (!profile?.username) redirect('/setup-username')

  const { data: sites } = await supabase
    .from('user_sites')
    .select('*, template:templates(title, domain, preview_images, is_free)')
    .eq('user_id', user.id)
    .neq('status', 'deleted')
    .order('created_at', { ascending: false })

  const activeSites = (sites ?? []).filter(s => s.status !== 'deleted')
  const hasSites = activeSites.length > 0

  // Unread submissions — only what matters
  let unreadCount = 0
  try {
    const admin = createAdminClient()
    if (activeSites.length > 0) {
      const siteIds = activeSites.map(s => s.id)
      const { count } = await admin
        .from('form_submissions')
        .select('*', { count: 'exact', head: true })
        .in('user_site_id', siteIds)
        .eq('is_spam', false)
        .is('archived_at', null)
        .is('read_at', null)
      unreadCount = count ?? 0
    }
  } catch { /* fail silently */ }

  const plan = profile?.plan ?? 'starter'
  const PLAN_LIMITS: Record<string, number> = { starter: 1, pro: 3, unlimited: Infinity }
  const planLimit = PLAN_LIMITS[plan] ?? 1
  const paidSites = activeSites.filter(s => !(s.template as any)?.is_free)
  const atLimit = planLimit !== Infinity && paidSites.length >= planLimit

  // Display name: use username but strip common platform handles cleanly
  const displayName = profile?.username ?? 'dort'

  return (
    <div className="max-w-2xl">

      {/* ── Greeting ──────────────────────────────────────────────── */}
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-gray-900">
          Hallo, {displayName}! 👋
        </h1>
        <p className="text-gray-400 mt-1.5 text-base">
          {hasSites ? 'Hier ist deine Webseite.' : 'Schön, dass du da bist.'}
        </p>
      </div>

      {/* ── How it works ──────────────────────────────────────────── */}
      <div className="mb-8 rounded-2xl p-5" style={{ background: '#F8F9FA', border: '1px solid #E5E7EB' }}>
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-4">So funktioniert FinestSites</p>
        <div className="flex flex-col sm:flex-row gap-4">
          {[
            {
              n: '1',
              title: 'Vorlage auswählen',
              desc: 'Wähle ein fertiges Design aus der Bibliothek — passend für dein Business.',
              color: '#E0F0FF',
              text: '#1D4ED8',
            },
            {
              n: '2',
              title: 'Daten eingeben',
              desc: 'Trage deinen Namen, Bilder und Texte ein — ganz ohne technisches Wissen.',
              color: '#FFF7E0',
              text: '#92400E',
            },
            {
              n: '3',
              title: 'Online stellen',
              desc: 'Ein Klick — und deine Webseite ist sofort im Internet sichtbar.',
              color: '#E0FFF0',
              text: '#065F46',
            },
          ].map(({ n, title, desc, color, text }) => (
            <div key={n} className="flex gap-3 flex-1">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 mt-0.5"
                style={{ background: color, color: text }}>
                {n}
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">{title}</p>
                <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── NEW SUBMISSIONS ALERT ─────────────────────────────────── */}
      {unreadCount > 0 && (
        <Link href="/submissions"
          className="flex items-center gap-4 p-5 rounded-2xl mb-6 transition-opacity hover:opacity-90"
          style={{ background: '#FFF3F0', border: '1.5px solid #F5C5B8' }}>
          <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: '#FFDDD8' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C0392B" strokeWidth="2">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
            </svg>
          </div>
          <div className="flex-1">
            <p className="font-semibold text-gray-900 text-base">
              {unreadCount === 1
                ? 'Du hast 1 neue Anfrage'
                : `Du hast ${unreadCount} neue Anfragen`}
            </p>
            <p className="text-sm text-gray-500 mt-0.5">Tippe hier, um sie zu lesen →</p>
          </div>
        </Link>
      )}

      {/* ── NO SITE YET ───────────────────────────────────────────── */}
      {!hasSites && (
        <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #E5E7EB' }}>
          {/* Colored top bar */}
          <div className="h-2" style={{ background: 'linear-gradient(90deg, #C07050, #E8A882)' }} />
          <div className="p-8 text-center">
            <div className="w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center"
              style={{ background: '#FFF8F3' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#C07050" strokeWidth="1.75">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <path d="M3 9h18M9 21V9"/>
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              Deine Webseite wartet auf dich
            </h2>
            <p className="text-gray-500 text-base leading-relaxed mb-8 max-w-sm mx-auto">
              Wähle eine fertige Vorlage und trage nur noch deine Daten ein.
              Ganz ohne technisches Wissen.
            </p>
            <Link href="/sites/library"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl text-white text-base font-semibold"
              style={{ background: '#C07050' }}>
              Vorlage auswählen
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </Link>
            {/* Simple steps */}
            <div className="mt-8 pt-8 border-t border-gray-100 grid grid-cols-3 gap-4 text-center">
              {[
                { n: '1', label: 'Vorlage wählen' },
                { n: '2', label: 'Daten eintragen' },
                { n: '3', label: 'Online stellen' },
              ].map(({ n, label }) => (
                <div key={n}>
                  <div className="w-8 h-8 rounded-full mx-auto mb-2 flex items-center justify-center text-sm font-bold"
                    style={{ background: '#FFF8F3', color: '#C07050' }}>
                    {n}
                  </div>
                  <p className="text-xs text-gray-500">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── SITE CARDS ────────────────────────────────────────────── */}
      {hasSites && (
        <div className="flex flex-col gap-4">
          {activeSites.map((site: any) => {
            const tpl = site.template
            const isPublished = site.status === 'published'
            const hasCustomDomain = site.custom_domain_status === 'active' && !!site.custom_domain
            const displayUrl = hasCustomDomain
              ? site.custom_domain
              : (profile.username && tpl?.domain ? `${profile.username}.${tpl.domain}` : null)
            const siteLink = displayUrl
              ? `https://${displayUrl}`
              : null

            return (
              <div key={site.id} className="rounded-2xl bg-white overflow-hidden"
                style={{ border: '1px solid #E5E7EB', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>

                {/* Status bar */}
                <div className="h-1.5"
                  style={{ background: isPublished ? '#5BAA7B' : '#D4B870' }} />

                <div className="p-6">
                  {/* Site name + status */}
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">
                        {tpl?.title ?? 'Meine Webseite'}
                      </h2>
                      {displayUrl && (
                        <p className="text-sm mt-1 font-mono" style={{ color: '#9CA3AF' }}>
                          {displayUrl}
                        </p>
                      )}
                    </div>
                    <span className="flex-shrink-0 flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-full mt-0.5"
                      style={{
                        background: isPublished ? '#ECFDF5' : '#FFFBEB',
                        color: isPublished ? '#065F46' : '#92400E',
                      }}>
                      <span className="w-2 h-2 rounded-full"
                        style={{ background: isPublished ? '#10B981' : '#F59E0B' }} />
                      {isPublished ? 'Online' : 'Entwurf'}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Link href={`/sites/${site.id}/edit`}
                      className="flex-1 flex items-center justify-center gap-2 py-3.5 px-5 rounded-xl text-white font-semibold text-base transition-opacity hover:opacity-90"
                      style={{ background: '#1a1a1a' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25">
                        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                      Webseite bearbeiten
                    </Link>
                    {isPublished && siteLink && (
                      <a href={siteLink} target="_blank" rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 py-3.5 px-5 rounded-xl font-semibold text-base transition-colors"
                        style={{ background: '#F3F4F6', color: '#374151' }}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25">
                          <circle cx="12" cy="12" r="10"/>
                          <line x1="2" y1="12" x2="22" y2="12"/>
                          <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/>
                        </svg>
                        Ansehen
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )
          })}

          {/* Add site CTA (only if below limit) */}
          {!atLimit && (
            <Link href="/sites/library"
              className="flex items-center justify-center gap-2 p-4 rounded-2xl text-sm font-medium transition-colors hover:bg-gray-50"
              style={{ border: '1.5px dashed #D1D5DB', color: '#6B7280' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 5v14M5 12h14" strokeLinecap="round"/>
              </svg>
              Weitere Webseite hinzufügen
            </Link>
          )}

          {/* At limit nudge */}
          {atLimit && plan !== 'unlimited' && (
            <Link href="/billing"
              className="flex items-center justify-between gap-4 p-5 rounded-2xl transition-opacity hover:opacity-90"
              style={{ background: '#FFFBEB', border: '1px solid #FDE68A' }}>
              <p className="text-sm font-medium text-amber-800">
                Du hast dein Limit erreicht — mit einem Upgrade kannst du mehr Webseiten erstellen.
              </p>
              <span className="flex-shrink-0 text-sm font-bold text-amber-700 whitespace-nowrap">
                Upgrade →
              </span>
            </Link>
          )}
        </div>
      )}

    </div>
  )
}
