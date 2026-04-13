import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'

const PLAN_LIMITS: Record<string, number> = { starter: 1, pro: 3, unlimited: Infinity }

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users').select('*').eq('id', user.id).single()

  if (!profile?.username) redirect('/setup-username')

  const admin = createAdminClient()

  const { data: sites } = await supabase
    .from('user_sites')
    .select('*, template:templates(title, domain, preview_images)')
    .eq('user_id', user.id)
    .neq('status', 'deleted')
    .order('created_at', { ascending: false })

  // Get all site IDs for submissions query
  const siteIds = (sites ?? []).map(s => s.id)

  // Fetch recent submissions (last 5) and total count
  const [{ data: recentSubmissions }, { count: totalSubmissions }] = await Promise.all([
    siteIds.length > 0
      ? admin
          .from('form_submissions')
          .select('id, form_name, data, created_at, read_at, user_site_id')
          .in('user_site_id', siteIds)
          .eq('is_spam', false)
          .is('archived_at', null)
          .order('created_at', { ascending: false })
          .limit(5)
      : { data: [] },
    siteIds.length > 0
      ? admin
          .from('form_submissions')
          .select('*', { count: 'exact', head: true })
          .in('user_site_id', siteIds)
          .eq('is_spam', false)
          .is('archived_at', null)
      : { count: 0 },
  ])

  const siteMap = Object.fromEntries(
    (sites ?? []).map(s => [s.id, s.template])
  )

  const publishedCount = (sites ?? []).filter(s => s.status === 'published').length

  const plan = profile?.plan ?? 'starter'
  const planLimit = PLAN_LIMITS[plan] ?? 1
  const planLabels: Record<string, string> = { starter: 'Starter', pro: 'Pro', unlimited: 'Unlimited' }

  const planHeroColors: Record<string, { bg: string; border: string; text: string; accent: string }> = {
    starter: { bg: '#EFF6FF', border: '#BFDBFE', text: '#1D4ED8', accent: '#3B82F6' },
    pro:     { bg: '#EDE9FE', border: '#C4B5FD', text: '#6D28D9', accent: '#7C3AED' },
    unlimited: { bg: '#ECFDF5', border: '#A7F3D0', text: '#059669', accent: '#10B981' },
  }
  const hero = planHeroColors[plan] ?? planHeroColors.starter

  // Use paid_sites_count for plan limit display
  const paidSites = (sites ?? []).filter(s => {
    const t = s.template
    return !t?.is_free
  })
  const paidSitesCount = paidSites.length
  const progressPct = planLimit === Infinity ? 0 : Math.min(100, (paidSitesCount / planLimit) * 100)
  const progressColor = paidSitesCount >= planLimit ? '#EF4444' : paidSitesCount / planLimit >= 0.75 ? '#F59E0B' : hero.accent

  const statusLabels: Record<string, string> = {
    active: 'Aktiv',
    trialing: 'Testphase',
    past_due: 'Zahlung offen',
    canceled: 'Gekündigt',
    incomplete: 'Ausstehend',
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  function getSubmissionPreview(data: Record<string, string>) {
    const values = Object.values(data).filter(v => v && typeof v === 'string')
    const first = values[0] ?? ''
    return first.length > 50 ? first.slice(0, 50) + '…' : first
  }

  return (
    <div className="max-w-4xl">
      {/* Greeting */}
      <h1 className="text-2xl font-semibold text-gray-900 mb-8">
        Hallo, {profile?.username}
      </h1>

      {/* Plan Hero Card */}
      <div className="p-6 rounded-[24px] mb-6"
        style={{ background: hero.bg, border: `1px solid ${hero.border}`, boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <div className="text-2xl font-bold mb-1" style={{ color: hero.text }}>
              {planLabels[plan]}
            </div>
            {profile?.subscription_status && (
              <span className="text-xs font-medium px-2.5 py-1 rounded-full inline-block"
                style={{ background: 'white', color: hero.text, border: `1px solid ${hero.border}` }}>
                {statusLabels[profile.subscription_status] ?? profile.subscription_status}
              </span>
            )}
          </div>
          {plan !== 'unlimited' && (
            <Link href="/billing"
              className="text-sm font-semibold px-4 py-2 rounded-[14px] flex-shrink-0"
              style={{ background: hero.text, color: 'white' }}>
              Upgrade
            </Link>
          )}
        </div>

        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium" style={{ color: hero.text }}>
            {paidSitesCount} von {planLimit === Infinity ? '∞' : planLimit} Webseiten genutzt
          </span>
        </div>
        <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.6)' }}>
          <div className="h-full rounded-full transition-all duration-500"
            style={{ width: planLimit === Infinity ? '0%' : `${progressPct}%`, background: progressColor }} />
        </div>
      </div>

      {/* Stats grid — 2 pastel cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        <div className="p-6 rounded-[24px] flex flex-col gap-1"
          style={{ background: '#ECFDF5', border: '1px solid #A7F3D0' }}>
          <div className="text-3xl font-bold" style={{ color: '#059669' }}>{publishedCount}</div>
          <div className="text-sm font-medium" style={{ color: '#047857' }}>Aktive Seiten</div>
        </div>
        <div className="p-6 rounded-[24px] flex flex-col gap-1"
          style={{ background: '#EDE9FE', border: '1px solid #C4B5FD' }}>
          <div className="text-3xl font-bold" style={{ color: '#6D28D9' }}>{totalSubmissions ?? 0}</div>
          <div className="text-sm font-medium" style={{ color: '#5B21B6' }}>Erhaltene Anfragen</div>
        </div>
      </div>

      {/* Recent submissions */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-semibold text-gray-900">Die letzten erhaltenen Anfragen</h2>
        <Link href="/submissions"
          className="text-sm font-medium px-3 py-1.5 rounded-[12px]"
          style={{ background: '#F3F4F6', color: '#374151' }}>
          Alle anzeigen
        </Link>
      </div>

      {!recentSubmissions || recentSubmissions.length === 0 ? (
        <div className="p-8 rounded-[24px] bg-white text-center mb-8"
          style={{ boxShadow: 'var(--shadow-card)', border: '1px solid var(--border)' }}>
          <div className="w-10 h-10 rounded-[14px] flex items-center justify-center mx-auto mb-3"
            style={{ background: '#F3F4F6' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.5">
              <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
              <rect x="9" y="3" width="6" height="4" rx="1"/>
              <path d="M9 12h6M9 16h4"/>
            </svg>
          </div>
          <p className="text-sm font-medium text-gray-700 mb-1">Noch keine Anfragen</p>
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
            Anfragen erscheinen hier, sobald Besucher deine Formulare ausfüllen.
          </p>
        </div>
      ) : (
        <div className="rounded-[20px] overflow-hidden mb-8 bg-white"
          style={{ boxShadow: 'var(--shadow-card)', border: '1px solid var(--border)' }}>
          {recentSubmissions.map((sub: any, i: number) => (
            <Link key={sub.id} href="/submissions"
              className="flex items-center gap-4 px-5 py-4 transition-all"
              style={{
                borderBottom: i < recentSubmissions.length - 1 ? '1px solid #F3F4F6' : 'none',
                background: !sub.read_at ? '#FAFAF9' : 'white',
              }}>
              <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
                style={{ background: !sub.read_at ? '#EDE9FE' : '#F3F4F6' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                  stroke={!sub.read_at ? '#6D28D9' : '#9CA3AF'} strokeWidth="2">
                  <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-semibold text-gray-700 truncate">
                    {siteMap[sub.user_site_id]?.title ?? 'Unbekannte Seite'}
                  </span>
                  {sub.form_name && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0"
                      style={{ background: '#F3F4F6', color: '#6B7280' }}>
                      {sub.form_name}
                    </span>
                  )}
                  {!sub.read_at && (
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#6D28D9' }} />
                  )}
                </div>
                <p className="text-xs truncate" style={{ color: '#6B7280' }}>
                  {getSubmissionPreview(sub.data as Record<string, string>)}
                </p>
              </div>
              <span className="text-[10px] flex-shrink-0" style={{ color: '#9CA3AF' }}>
                {formatDate(sub.created_at)}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
