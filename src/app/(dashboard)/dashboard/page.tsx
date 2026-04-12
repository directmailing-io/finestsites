import { createClient } from '@/lib/supabase/server'
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
    .select('*, template:templates(title, domain, preview_images)')
    .eq('user_id', user.id)
    .neq('status', 'deleted')

  const publishedCount = sites?.filter(s => s.status === 'published').length ?? 0
  const draftCount = sites?.filter(s => s.status === 'draft').length ?? 0

  const planLabels: Record<string, string> = { starter: 'Starter', pro: 'Pro', unlimited: 'Unlimited' }
  const planColors: Record<string, { bg: string; text: string; border: string }> = {
    starter: { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' },
    pro: { bg: '#F5F3FF', text: '#7C3AED', border: '#DDD6FE' },
    unlimited: { bg: '#F0FDF4', text: '#16A34A', border: '#BBF7D0' },
  }
  const planColor = planColors[profile?.plan ?? 'starter']

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">
          Hallo, {profile?.username} 👋
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
          Hier siehst du eine Übersicht deiner Websites.
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Aktive Seiten', value: publishedCount, color: '#F0FDF4', border: '#BBF7D0', text: '#16A34A' },
          { label: 'Entwürfe', value: draftCount, color: '#F5F3FF', border: '#DDD6FE', text: '#7C3AED' },
          { label: 'Gesamt', value: sites?.length ?? 0, color: '#EFF6FF', border: '#BFDBFE', text: '#1D4ED8' },
        ].map((stat) => (
          <div key={stat.label} className="p-6 rounded-[24px] bg-white flex flex-col gap-1"
            style={{ boxShadow: 'var(--shadow-card)', border: '1px solid var(--border)' }}>
            <div className="text-3xl font-bold" style={{ color: stat.text }}>{stat.value}</div>
            <div className="text-sm" style={{ color: 'var(--muted-foreground)' }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Plan Badge */}
      <div className="p-5 rounded-[24px] flex items-center justify-between mb-8"
        style={{ background: planColor.bg, border: `1px solid ${planColor.border}` }}>
        <div>
          <div className="text-sm font-medium" style={{ color: planColor.text }}>
            Dein Plan: {planLabels[profile?.plan ?? 'starter']}
          </div>
          <div className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
            {profile?.plan === 'starter' && 'Du kannst 1 Website aktivieren'}
            {profile?.plan === 'pro' && 'Du kannst 3 Websites aktivieren'}
            {profile?.plan === 'unlimited' && 'Du kannst unbegrenzt viele Websites aktivieren'}
          </div>
        </div>
        <Link href="/settings/billing"
          className="text-xs font-medium px-4 py-2 rounded-[12px] transition-all"
          style={{ background: '#1a1a1a', color: '#ffffff' }}>
          Upgrade
        </Link>
      </div>

      {/* Sites or Empty state */}
      {(!sites || sites.length === 0) ? (
        <div className="p-12 rounded-[24px] bg-white text-center"
          style={{ boxShadow: 'var(--shadow-card)', border: '1px solid var(--border)' }}>
          <div className="w-14 h-14 rounded-[20px] flex items-center justify-center mx-auto mb-4"
            style={{ background: '#F3F4F6' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="16"/>
              <line x1="8" y1="12" x2="16" y2="12"/>
            </svg>
          </div>
          <h3 className="font-semibold text-gray-900 mb-1">Noch keine Website</h3>
          <p className="text-sm mb-6" style={{ color: 'var(--muted-foreground)' }}>
            Wähle ein Template und erstelle deine erste Website.
          </p>
          <Link href="/sites/new"
            className="inline-flex items-center gap-2 px-6 py-3 text-sm font-medium text-white rounded-[16px]"
            style={{ background: '#1a1a1a', boxShadow: '0 4px 14px rgba(26,26,26,0.25)' }}>
            Erste Website erstellen
          </Link>
        </div>
      ) : (
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">Deine Websites</h2>
          <Link href="/sites/new"
            className="text-sm font-medium px-4 py-2 rounded-[14px] text-white"
            style={{ background: '#1a1a1a' }}>
            + Neue Website
          </Link>
        </div>
      )}
    </div>
  )
}
