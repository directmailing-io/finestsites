/**
 * POST /api/app/v1/affiliate/payout — Auszahlung aufs Bankkonto selbst anstoßen (App).
 *
 * Gleiche Regeln wie /api/affiliate/payout (gemeinsame Auszahlungs-Engine src/lib/affiliate/payout.ts):
 * nur Auszahlungsart 'payout', verbundenes Auszahlungskonto, 10 € Minimum, eine Auszahlung im
 * Monat, Steuerprofil Pflicht, gleiche Ratenbegrenzung (gemeinsamer Zähler).
 *
 * Antwort immer als Code (PayoutResponse), die App hat eigene Texte. Das Plattform-Guthaben wird
 * nie offengelegt (wie im Web: knapp/unklar → 'processing'). Interne Konten (Apple-Demo) lösen nie
 * eine echte Auszahlung aus → 'unavailable'.
 */
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getRealUserFromRequest } from '@/lib/auth/server'
import { rateLimit } from '@/lib/security/request'
import { getStripe } from '@/lib/stripe/client'
import { releaseMaturedCommissions, processReferrerPayout, notifyAdminSingle, PAYOUT_MINIMUM_CENTS } from '@/lib/affiliate/payout'
import { appError, appJson } from '@/lib/app-api/http'
import { requireAffiliateUser } from '@/lib/app-api/affiliate'
import { PayoutResponse, type PayoutResultStatus } from '@/lib/contracts/app-v1/affiliate'

export const dynamic = 'force-dynamic'

function reply(status: PayoutResultStatus, amountCents: number | null = null, creditNoteNumber: string | null = null) {
  return appJson(PayoutResponse, { status, amountCents, minPayoutCents: PAYOUT_MINIMUM_CENTS, creditNoteNumber })
}

export async function POST(req: Request) {
  const a = await requireAffiliateUser(req, 'affiliate-payout', 10)
  if (a.response) return a.response
  const real = await getRealUserFromRequest(req).catch(() => null)
  if (!real || real.id !== a.user.id) return appError('NOT_SELF')
  if (a.profile.isInternal) return reply('unavailable')

  const profile = await db.query.users.findFirst({
    where: eq(users.id, a.user.id),
    columns: { id: true, email: true, username: true, stripeConnectId: true, affiliateOnboarded: true, affiliatePayoutMode: true },
  })
  if (!profile) return appError('UNAUTHORIZED')
  // Verrechnung läuft nur automatisch im Monatslauf – hier gibt es nichts anzustoßen
  if (profile.affiliatePayoutMode !== 'payout') return reply('mode_credit')
  if (!profile.stripeConnectId) return reply('no_connect')

  if (!rateLimit('affiliate-payout', a.user.id, 5, 10 * 60 * 1000)) return appError('RATE_LIMITED')

  await releaseMaturedCommissions(a.user.id)
  const result = await processReferrerPayout(getStripe(), profile)
  notifyAdminSingle(result).catch(() => {})

  switch (result.status) {
    case 'paid': return reply('paid', result.amount ?? null, result.creditNoteNumber ?? null)
    case 'skipped_no_commissions': return reply('nothing_to_pay')
    case 'skipped_below_minimum': return reply('below_minimum', result.amount ?? 0)
    case 'skipped_negative_balance': return reply('negative_balance')
    case 'skipped_already_paid_this_month': return reply('already_paid_this_month')
    case 'skipped_not_verified': return reply('not_verified')
    case 'skipped_no_connect': return reply('no_connect')
    case 'skipped_tax_profile_missing': return reply('tax_profile_missing')
    case 'skipped_insufficient_platform_balance':
    case 'unclear':
      return reply('processing')
    case 'failed':
    case 'error': {
      const insufficient = result.reason === 'insufficient_platform_balance' || (result.error ?? '').includes('insufficient funds')
      return reply(insufficient ? 'processing' : 'failed')
    }
    default:
      return reply('failed')
  }
}
