import { createClient } from '@/lib/supabase/server'
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

  const { data: sites } = await supabase
    .from('user_sites')
    .select('*, template:templates(title, domain, preview_images)')
    .eq('user_id', user.id)
    .neq('status', 'deleted')
    .order('created_at', { ascending: false })

  const { count: templateCount } = await supabase
    .from('templates')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'published')

  const publishedCount = sites?.filter(s => s.status === 'published').length ?? 0
  const totalSites = sites?.length ?? 0
  const recentSites = sites?.slice(0, 3) ?? []

  const plan = profile?.plan ?? 'starter'
  const planLimit = PLAN_LIMITS[plan] ?? 1
  const planLabels: Record<string, string> = { starter: 'Starter', pro: 'Pro', unlimited: 'Unlimited' }

  const planHeroColors: Record<string, { bg: string; border: string; text: string; accent: string }> = {
    starter: { bg: '#EFF6FF', border: '#BFDBFE', text: '#1D4ED8', accent: '#3B82F6' },
    pro:     { bg: '#F5F3FF', border: '#DDD6FE', text: '#7C3AED', accent: '#8B5CF6' },
    unlimited: { bg: '#F0FDF4', border: '#BBF7D0', text: '#16A34A', accent: '#22C55E' },
  }
  const hero = planHeroColors[plan] ?? planHeroColors.starter

  const progressPct = planLimit === Infinity ? 0 : Math.min(100, (totalSites / planLimit) * 100)
  const progressColor = totalSites >= planLimit ? '#EF4444' : totalSites / planLimit >= 0.75 ? '#F59E0B' : hero.accent

  const statusLabels: Record<string, string> = {
    active: 'Aktiv',
    trialing: 'Testphase',
    past_due: 'Zahlung offen',
    canceled: 'Gekündigt',
    incomplete: 'Ausstehend',
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
            {totalSites} von {planLimit === Infinity ? '∞' : planLimit} Webseiten genutzt
          </span>
        </div>
        <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.6)' }}>
          <div className="h-full rounded-full transition-all duration-500"
            style={{ width: planLimit === Infinity ? '0%' : `${progressPct}%`, background: progressColor }} />
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="p-6 rounded-[24px] bg-white flex flex-col gap-1"
          style={{ boxShadow: 'var(--shadow-card)', border: '1px solid var(--border)' }}>
          <div className="text-3xl font-bold" style={{ color: '#16A34A' }}>{publishedCount}</div>
          <div className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Aktive Seiten</div>
        </div>
        <div className="p-6 rounded-[24px] bg-white flex flex-col gap-1"
          style={{ boxShadow: 'var(--shadow-card)', border: '1px solid var(--border)' }}>
          <div className="text-3xl font-bold" style={{ color: '#2563EB' }}>{templateCount ?? 0}</div>
          <div className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Verfügbare Templates</div>
        </div>
        <div className="p-6 rounded-[24px] bg-white flex flex-col gap-1"
          style={{ boxShadow: 'var(--shadow-card)', border: '1px solid var(--border)' }}>
          <div className="text-3xl font-bold" style={{ color: '#7C3AED' }}>{totalSites}</div>
          <div className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Erstellte Seiten gesamt</div>
        </div>
      </div>

      {/* Recent sites */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-semibold text-gray-900">Zuletzt erstellt</h2>
        <Link href="/sites"
          className="text-sm font-medium px-3 py-1.5 rounded-[12px]"
          style={{ background: '#F3F4F6', color: '#374151' }}>
          Alle anzeigen
        </Link>
      </div>

      {recentSites.length === 0 ? (
        <div className="p-10 rounded-[24px] bg-white text-center"
          style={{ boxShadow: 'var(--shadow-card)', border: '1px solid var(--border)' }}>
          <div className="w-12 h-12 rounded-[16px] flex items-center justify-center mx-auto mb-3"
            style={{ background: '#F3F4F6' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="16"/>
              <line x1="8" y1="12" x2="16" y2="12"/>
            </svg>
          </div>
          <p className="text-sm font-medium text-gray-700 mb-1">Noch keine Website</p>
          <p className="text-sm mb-5" style={{ color: 'var(--muted-foreground)' }}>
            Wähle ein Template und erstelle deine erste Website.
          </p>
          <Link href="/sites/new"
            className="inline-flex items-center gap-2 px-6 py-3 text-sm font-medium text-white rounded-[16px]"
            style={{ background: '#1a1a1a', boxShadow: '0 4px 14px rgba(26,26,26,0.25)' }}>
            Erste Website erstellen
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {recentSites.map((site: any) => (
            <Link key={site.id} href={`/sites/${site.id}/edit`}
              className="flex items-center justify-between p-4 rounded-[18px] bg-white transition-all"
              style={{ boxShadow: 'var(--shadow-card)', border: '1px solid var(--border)' }}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-[12px] flex items-center justify-center flex-shrink-0"
                  style={{ background: '#F3F4F6' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.5">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="2" y1="12" x2="22" y2="12"/>
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900 leading-tight">
                    {site.template?.title ?? 'Website'}
                  </p>
                  {site.username && (
                    <p className="text-xs font-mono mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                      {site.username}.{site.template?.domain}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs px-2.5 py-0.5 rounded-full"
                  style={{
                    background: site.status === 'published' ? '#F0FDF4' : '#F3F4F6',
                    color: site.status === 'published' ? '#16A34A' : '#6B7280',
                  }}>
                  {site.status === 'published' ? '● Live' : '○ Entwurf'}
                </span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2">
                  <path d="M9 18l6-6-6-6"/>
                </svg>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
