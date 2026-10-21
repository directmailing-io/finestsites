/**
 * GET /api/app/v1/affiliate — Partnerprogramm, neutrale App-Fassung.
 *
 * Gleiche Daten wie /api/affiliate/stats, aber (Apple 3.1.1/3.1.3(f)):
 *   - keine Tarifnamen, keine Abrechnungsintervalle, keine Rabatte für Empfohlene
 *   - Empfehlungen nur „aktiv“ / „pausiert“, Name = Vorname oder maskierte E-Mail
 *   - kein „aktives Abo“-Hinweis; Konten ohne Berechtigung bekommen AFFILIATE_NOT_AVAILABLE
 *     (die App blendet den Bereich dann aus)
 *   - nie Plattform-Finanzdaten
 */
import { db } from '@/lib/db'
import { affiliateCommissions, affiliatePayouts, affiliateTaxProfiles, users } from '@/lib/db/schema'
import { desc, eq } from 'drizzle-orm'
import { appError, appJson, requireAppUser, toIso } from '@/lib/app-api/http'
import { affiliateEligible, hasRunningSubscription, loadProfile } from '@/lib/app-api/account'
import { getAppRuntimeSettings } from '@/lib/app-api/settings'
import { AffiliateResponse } from '@/lib/contracts/app-v1/affiliate'
import { refereeDisplayName } from '@/lib/affiliate/mask'
import { isTaxProfileComplete } from '@/lib/affiliate/tax'
import { syncConnectStatus } from '@/lib/affiliate/connect-status'
import { PAYOUT_MINIMUM_CENTS } from '@/lib/affiliate/payout'
import { getStripe } from '@/lib/stripe/client'

export const dynamic = 'force-dynamic'

const COMMISSION_PERCENT = 10
const HOLD_DAYS = 14

export async function GET(req: Request) {
  const auth = await requireAppUser(req, 'affiliate', 60)
  if (auth.response) return auth.response
  const userId = auth.user.id

  const settings = await getAppRuntimeSettings()
  if (!settings.features.partnerProgram) return appError('FEATURE_DISABLED')

  const profile = await loadProfile(userId)
  if (!profile) return appError('UNAUTHORIZED')
  if (!profile.username || !(await affiliateEligible(profile))) return appError('AFFILIATE_NOT_AVAILABLE')

  const extra = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { stripeConnectId: true, affiliateOnboarded: true, affiliatePayoutMode: true },
  })

  const [commissions, payouts, referred, taxProfile] = await Promise.all([
    db.select().from(affiliateCommissions).where(eq(affiliateCommissions.referrerId, userId))
      .orderBy(desc(affiliateCommissions.createdAt)).limit(500).catch(() => []),
    db.select().from(affiliatePayouts).where(eq(affiliatePayouts.referrerId, userId))
      .orderBy(desc(affiliatePayouts.createdAt)).limit(240).catch(() => []),
    db.select({ email: users.email, firstName: users.firstName, subscriptionStatus: users.subscriptionStatus, createdAt: users.createdAt })
      .from(users).where(eq(users.referredByUsername, profile.username))
      .orderBy(desc(users.createdAt)).limit(500).catch(() => []),
    db.query.affiliateTaxProfiles.findFirst({ where: eq(affiliateTaxProfiles.userId, userId) }).catch(() => undefined),
  ])

  const now = Date.now()
  let availableCents = 0, pendingCents = 0, paidCents = 0
  const commissionItems = commissions.map(c => {
    const due = c.availableAt.getTime() <= now
    let status: 'pending' | 'available' | 'paid' | 'reversed'
    if (c.status === 'paid') status = 'paid'
    // 'cancelled' = storniert vor Auszahlung (reversal.ts); Ausgleichsbuchungen sind negative pending/available-Zeilen
    else if (c.status === 'cancelled' || c.status === 'reversed') status = 'reversed'
    else if (c.status === 'available' || c.status === 'processing' || (c.status === 'pending' && due)) status = 'available'
    else status = 'pending'
    if (status === 'paid') paidCents += c.commissionAmount
    else if (status === 'available') availableCents += c.commissionAmount
    else if (status === 'pending') pendingCents += c.commissionAmount
    return {
      id: c.id,
      amountCents: c.commissionAmount,
      status,
      createdAt: toIso(c.createdAt)!,
      availableAt: toIso(c.availableAt)!,
      paidAt: toIso(c.paidAt),
    }
  })

  // Auszahlungskonto (Stripe Connect): Status abgleichen wie /api/affiliate/stats
  let connectStatus: 'none' | 'pending' | 'ready' = 'none'
  let bankLast4: string | null = null
  if (extra?.stripeConnectId) {
    let onboarded = extra.affiliateOnboarded ?? false
    const synced = await syncConnectStatus(userId, extra.stripeConnectId, { current: extra.affiliateOnboarded })
    if (synced !== null) onboarded = synced
    connectStatus = onboarded ? 'ready' : 'pending'
    if (onboarded) {
      await getStripe().accounts.listExternalAccounts(extra.stripeConnectId, { object: 'bank_account', limit: 1 })
        .then(a => { const b = a.data[0] as { last4?: string } | undefined; bankLast4 = b?.last4 ?? null })
        .catch(() => {})
    }
  }

  const referrals = referred.map(r => ({
    displayName: refereeDisplayName(r.firstName, r.email),
    status: hasRunningSubscription(r.subscriptionStatus) ? 'active' as const : 'paused' as const,
    joinedAt: toIso(r.createdAt)!,
  }))

  return appJson(AffiliateResponse, {
    link: `https://finestsites.io/?ref=${encodeURIComponent(profile.username)}`,
    code: profile.username,
    texts: {
      title: 'Partnerprogramm',
      description: `Du erhältst ${COMMISSION_PERCENT} % Provision auf die Zahlungen deiner Empfehlungen, solange sie dabei sind.`,
      holdInfo: `Provisionen sind nach ${HOLD_DAYS} Tagen verfügbar.`,
    },
    commissionPercent: COMMISSION_PERCENT,
    earnings: { currency: 'EUR', availableCents, pendingCents, paidCents },
    payout: {
      mode: extra?.affiliatePayoutMode === 'payout' ? 'payout' : 'credit',
      connectStatus,
      bankLast4,
      minPayoutCents: PAYOUT_MINIMUM_CENTS,
    },
    taxProfileComplete: isTaxProfileComplete(taxProfile ?? null),
    history: {
      commissions: commissionItems,
      payouts: payouts.map(p => ({
        id: p.id,
        amountCents: p.grossAmount ?? p.totalAmount,
        method: p.payoutMethod === 'credit' ? 'credit' as const : 'transfer' as const,
        status: p.status === 'paid' ? 'paid' as const : p.status === 'failed' ? 'failed' as const : 'processing' as const,
        paidAt: toIso(p.paidAt),
        creditNote: p.creditNoteNumber ? { id: p.id, number: p.creditNoteNumber, ready: p.creditNoteStatus === 'created' } : null,
      })),
    },
    referrals: {
      count: referrals.length,
      active: referrals.filter(r => r.status === 'active').length,
      paused: referrals.filter(r => r.status === 'paused').length,
      items: referrals,
    },
  })
}
