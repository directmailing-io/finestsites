import { db } from '@/lib/db'
import { affiliateCommissions, users } from '@/lib/db/schema'
import { desc, eq, isNotNull } from 'drizzle-orm'
import { getStripe } from '@/lib/stripe/client'
import { AffiliateAdminActions } from './AffiliateAdminActions'
import { AffiliatePartnersPanel } from './AffiliatePartnersPanel'

function euros(cents: number) {
  return (cents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
}

const STATUS_META: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  pending:   { label: 'Ausstehend', bg: '#FFF7ED', text: '#C2410C', dot: '#F97316' },
  available: { label: 'Verfügbar',  bg: '#F0FDF4', text: '#15803D', dot: '#22C55E' },
  paid:      { label: 'Ausgezahlt', bg: '#EFF6FF', text: '#1D4ED8', dot: '#3B82F6' },
  reversed:  { label: 'Storniert',  bg: '#F9FAFB', text: '#6B7280', dot: '#D1D5DB' },
  failed:    { label: 'Fehler',     bg: '#FEF2F2', text: '#DC2626', dot: '#EF4444' },
}

export default async function AdminAffiliatePage() {
  // All commissions with referrer and referee info via join
  const referrerAlias = { id: users.id, username: users.username, email: users.email }
  const commissionsRaw = await db
    .select({
      id: affiliateCommissions.id,
      referrerId: affiliateCommissions.referrerId,
      refereeId: affiliateCommissions.refereeId,
      commissionAmount: affiliateCommissions.commissionAmount,
      grossAmount: affiliateCommissions.grossAmount,
      status: affiliateCommissions.status,
      createdAt: affiliateCommissions.createdAt,
      referrerUsername: users.username,
      referrerEmail: users.email,
    })
    .from(affiliateCommissions)
    .leftJoin(users, eq(users.id, affiliateCommissions.referrerId))
    .orderBy(desc(affiliateCommissions.createdAt))
    .limit(200)

  // We need referee info separately for the commissions display
  // Build a referee lookup by commission id
  const refereeRows = await db
    .select({
      commissionId: affiliateCommissions.id,
      refereeUsername: users.username,
    })
    .from(affiliateCommissions)
    .leftJoin(users, eq(users.id, affiliateCommissions.refereeId))
    .orderBy(desc(affiliateCommissions.createdAt))
    .limit(200)
  const refereeMap = new Map(refereeRows.map(r => [r.commissionId, r.refereeUsername]))

  const commissions = commissionsRaw.map(c => ({
    ...c,
    refereeUsername: refereeMap.get(c.id) ?? null,
  }))

  // Aggregate by referrer
  const referrerMap: Record<string, {
    username: string
    email: string
    referral_count: number
    pending: number
    available: number
    paid: number
    total: number
  }> = {}

  for (const c of commissions) {
    const username = c.referrerUsername
    const email = c.referrerEmail
    if (!username && !email) continue
    const key = username ?? email ?? ''
    if (!referrerMap[key]) {
      referrerMap[key] = { username: username ?? '', email: email ?? '', referral_count: 0, pending: 0, available: 0, paid: 0, total: 0 }
    }
    referrerMap[key].total += c.commissionAmount
    if (c.status === 'pending') referrerMap[key].pending += c.commissionAmount
    if (c.status === 'available') referrerMap[key].available += c.commissionAmount
    if (c.status === 'paid') referrerMap[key].paid += c.commissionAmount
  }

  // Count referred users per affiliate
  const referredUsers = await db
    .select({ referredByUsername: users.referredByUsername })
    .from(users)
    .where(isNotNull(users.referredByUsername))

  for (const u of referredUsers) {
    if (u.referredByUsername && referrerMap[u.referredByUsername]) {
      referrerMap[u.referredByUsername].referral_count++
    }
  }

  const referrers = Object.values(referrerMap).sort((a, b) => b.total - a.total)

  // ── Partner & zugeordnete Nutzer ──────────────────────────────────────────

  // All onboarded affiliate users
  const onboardedAffiliates = await db
    .select({ id: users.id, username: users.username, email: users.email, affiliateOnboarded: users.affiliateOnboarded })
    .from(users)
    .where(eq(users.affiliateOnboarded, true))

  // All users who have been referred by someone (includes plan, subscriptionStatus, createdAt)
  const allReferredUsers = await db
    .select({
      id: users.id,
      email: users.email,
      plan: users.plan,
      subscriptionStatus: users.subscriptionStatus,
      createdAt: users.createdAt,
      referredByUsername: users.referredByUsername,
    })
    .from(users)
    .where(isNotNull(users.referredByUsername))

  // Build partner map: username -> partner data
  const partnerMap = new Map<string, {
    id: string
    username: string | null
    email: string
    affiliateOnboarded: boolean
    referredUsers: Array<{
      id: string; email: string; plan: string; subscriptionStatus: string | null
      createdAt: string; commissionEarnedCents: number
    }>
    commissions: { pending: number; available: number; paid: number; total: number }
  }>()

  // Add onboarded affiliates first
  for (const aff of onboardedAffiliates) {
    const key = aff.username ?? aff.email
    partnerMap.set(key, {
      id: aff.id,
      username: aff.username,
      email: aff.email,
      affiliateOnboarded: true,
      referredUsers: [],
      commissions: { pending: 0, available: 0, paid: 0, total: 0 },
    })
  }

  // Add partners who appear as referredByUsername but might not be in partnerMap yet
  for (const u of allReferredUsers) {
    if (!u.referredByUsername) continue
    if (!partnerMap.has(u.referredByUsername)) {
      const partnerRow = await db.query.users.findFirst({
        where: eq(users.username, u.referredByUsername),
        columns: { id: true, username: true, email: true, affiliateOnboarded: true },
      })
      if (partnerRow) {
        partnerMap.set(u.referredByUsername, {
          id: partnerRow.id,
          username: partnerRow.username,
          email: partnerRow.email,
          affiliateOnboarded: partnerRow.affiliateOnboarded ?? false,
          referredUsers: [],
          commissions: { pending: 0, available: 0, paid: 0, total: 0 },
        })
      }
    }
    const partner = partnerMap.get(u.referredByUsername)
    if (partner) {
      partner.referredUsers.push({
        id: u.id,
        email: u.email,
        plan: u.plan ?? 'starter',
        subscriptionStatus: u.subscriptionStatus,
        createdAt: u.createdAt ? u.createdAt.toISOString() : new Date().toISOString(),
        commissionEarnedCents: 0, // filled below
      })
    }
  }

  // Aggregate commissions by referrer and referee
  const commissionsByReferrer = new Map<string, { pending: number; available: number; paid: number; total: number }>()
  const commissionsByReferee = new Map<string, number>() // refereeId -> total commission earned

  for (const c of commissionsRaw) {
    if (c.referrerId) {
      const existing = commissionsByReferrer.get(c.referrerId) ?? { pending: 0, available: 0, paid: 0, total: 0 }
      existing.total += c.commissionAmount
      if (c.status === 'pending') existing.pending += c.commissionAmount
      if (c.status === 'available') existing.available += c.commissionAmount
      if (c.status === 'paid') existing.paid += c.commissionAmount
      commissionsByReferrer.set(c.referrerId, existing)
    }
    if (c.refereeId) {
      commissionsByReferee.set(c.refereeId, (commissionsByReferee.get(c.refereeId) ?? 0) + c.commissionAmount)
    }
  }

  // Assign commission totals to each partner and their referred users
  for (const partner of partnerMap.values()) {
    partner.commissions = commissionsByReferrer.get(partner.id) ?? { pending: 0, available: 0, paid: 0, total: 0 }
    for (const u of partner.referredUsers) {
      u.commissionEarnedCents = commissionsByReferee.get(u.id) ?? 0
    }
  }

  const affiliatePartners = Array.from(partnerMap.values())
    .sort((a, b) => b.referredUsers.length - a.referredUsers.length || b.commissions.total - a.commissions.total)

  // Global stats
  const pendingCount    = commissions.filter(c => c.status === 'pending').length
  const availableCount  = commissions.filter(c => c.status === 'available').length
  const totalPending    = commissions.filter(c => c.status === 'pending' || c.status === 'available')
    .reduce((s, c) => s + c.commissionAmount, 0)
  const availableTotal  = commissions.filter(c => c.status === 'available')
    .reduce((s, c) => s + c.commissionAmount, 0)
  const totalPaid = commissions.filter(c => c.status === 'paid')
    .reduce((s, c) => s + c.commissionAmount, 0)
  const totalReferrals = referredUsers.length

  // Stripe platform balance
  let stripeBalanceCents = 0
  try {
    const balance = await getStripe().balance.retrieve()
    stripeBalanceCents = balance.available.find(b => b.currency === 'eur')?.amount ?? 0
  } catch { /* Stripe unavailable */ }

  return (
    <div style={{ maxWidth: 1100 }}>

      {/* ── Header ── */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Affiliate-Programm</h1>
        <p className="text-sm mt-1" style={{ color: '#94A3B8' }}>
          Übersicht aller Affiliates, Provisionen und Auszahlungen
        </p>
      </div>

      {/* ── Admin Actions ── */}
      <AffiliateAdminActions
        stripeBalanceCents={stripeBalanceCents}
        pendingCount={pendingCount}
        availableCount={availableCount}
        availableTotalCents={availableTotal}
      />

      {/* ── Global KPIs ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {[
          { label: 'Aktive Affiliates', value: referrers.length, bg: '#F0F7FF', border: '#BFDBFE', num: '#1D4ED8' },
          { label: 'Geworbene Nutzer', value: totalReferrals, bg: '#F5F3FF', border: '#DDD6FE', num: '#5B21B6' },
          { label: 'Ausstehend',       value: euros(totalPending), bg: '#FFFBF0', border: '#FDE68A', num: '#92400E' },
          { label: 'Gesamt ausgezahlt', value: euros(totalPaid),   bg: '#F0FAF2', border: '#BBF7D0', num: '#15803D' },
        ].map((card, i) => (
          <div key={i} className="p-4 rounded-[18px]"
            style={{ background: card.bg, border: `1px solid ${card.border}` }}>
            <p className="text-2xl font-black" style={{ color: card.num }}>{card.value}</p>
            <p className="text-xs font-semibold mt-1" style={{ color: card.num }}>{card.label}</p>
          </div>
        ))}
      </div>

      {/* ── Partner & zugeordnete Nutzer ── */}
      <div className="mb-8">
        <AffiliatePartnersPanel partners={affiliatePartners} />
      </div>

      {/* ── Affiliates Table ── */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Affiliates</h2>
        <div className="rounded-[20px] bg-white overflow-hidden"
          style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #F1F5F9' }}>
          <div className="grid px-6 py-3 text-[11px] font-semibold uppercase tracking-wide"
            style={{
              gridTemplateColumns: '2fr 80px 110px 110px 110px',
              background: '#F8FAFC', borderBottom: '1px solid #F1F5F9', color: '#94A3B8',
            }}>
            <span>Affiliate</span>
            <span className="text-center">Partner</span>
            <span className="text-right">Ausstehend</span>
            <span className="text-right">Verfügbar</span>
            <span className="text-right">Ausgezahlt</span>
          </div>
          {referrers.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-sm text-gray-500">Noch keine Affiliates</p>
            </div>
          ) : referrers.map((r, i) => (
            <div key={r.username}
              className="grid items-center px-6 py-3.5 text-sm"
              style={{
                gridTemplateColumns: '2fr 80px 110px 110px 110px',
                borderBottom: i < referrers.length - 1 ? '1px solid #F8FAFC' : 'none',
              }}>
              <div className="min-w-0">
                <p className="font-medium text-gray-900 text-sm truncate">@{r.username}</p>
                <p className="text-xs truncate" style={{ color: '#94A3B8' }}>{r.email}</p>
              </div>
              <span className="text-center">
                <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mx-auto"
                  style={{ background: '#EFF6FF', color: '#1D4ED8' }}>
                  {r.referral_count}
                </span>
              </span>
              <span className="text-xs font-mono text-right" style={{ color: r.pending > 0 ? '#C2410C' : '#94A3B8' }}>
                {euros(r.pending)}
              </span>
              <span className="text-xs font-mono text-right" style={{ color: r.available > 0 ? '#15803D' : '#94A3B8' }}>
                {euros(r.available)}
              </span>
              <span className="text-xs font-mono font-semibold text-right" style={{ color: '#15803D' }}>
                {euros(r.paid)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Recent Commissions ── */}
      <div>
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Letzte Provisionen</h2>
        <div className="rounded-[20px] bg-white overflow-hidden"
          style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #F1F5F9' }}>
          <div className="grid px-6 py-3 text-[11px] font-semibold uppercase tracking-wide"
            style={{
              gridTemplateColumns: '1.5fr 1.5fr 100px 100px 90px',
              background: '#F8FAFC', borderBottom: '1px solid #F1F5F9', color: '#94A3B8',
            }}>
            <span>Affiliate</span>
            <span>Geworbener User</span>
            <span className="text-right">Zahlung</span>
            <span className="text-right">Provision</span>
            <span className="text-right">Status</span>
          </div>
          {commissions.slice(0, 50).map((c, i) => {
            const meta = STATUS_META[c.status] ?? STATUS_META.pending
            return (
              <div key={c.id}
                className="grid items-center px-6 py-3.5 text-sm"
                style={{
                  gridTemplateColumns: '1.5fr 1.5fr 100px 100px 90px',
                  borderBottom: i < Math.min(commissions.length, 50) - 1 ? '1px solid #F8FAFC' : 'none',
                }}>
                <span className="text-xs font-mono font-medium text-gray-700 truncate">
                  @{c.referrerUsername ?? '—'}
                </span>
                <span className="text-xs text-gray-500 truncate">
                  @{c.refereeUsername ?? '—'}
                </span>
                <span className="text-xs font-mono text-right text-gray-700">{euros(c.grossAmount)}</span>
                <span className="text-xs font-mono font-semibold text-right" style={{ color: '#15803D' }}>
                  +{euros(c.commissionAmount)}
                </span>
                <span className="flex justify-end">
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1"
                    style={{ background: meta.bg, color: meta.text }}>
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: meta.dot }} />
                    {meta.label}
                  </span>
                </span>
              </div>
            )
          })}
          {commissions.length === 0 && (
            <div className="px-6 py-12 text-center">
              <p className="text-sm text-gray-500">Noch keine Provisionen erfasst</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
