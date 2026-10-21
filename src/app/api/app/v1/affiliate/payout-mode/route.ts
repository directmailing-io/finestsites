/**
 * GET /api/app/v1/affiliate/payout-mode — Auszahlungsart: 'credit' („Mit meinem Konto verrechnen“)
 *     oder 'payout' („Aufs Bankkonto auszahlen“).
 * PUT /api/app/v1/affiliate/payout-mode { mode } — umstellen (nur der Partner selbst, nicht der
 *     Support im „Anmelden als“-Modus; gleiche Regeln und Limits wie /api/affiliate/payout-mode).
 *
 * Bewusst ohne Abo-Status und ohne Kundenguthaben (Web-Felder subscription_active,
 * customer_credit_cents) – in der App gibt es keinen Bezug zu Tarif oder Zahlung.
 */
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getRealUserFromRequest } from '@/lib/auth/server'
import { rateLimit } from '@/lib/security/request'
import { appError, appJson, readJson } from '@/lib/app-api/http'
import { requireAffiliateUser } from '@/lib/app-api/affiliate'
import { PayoutModeResponse, UpdatePayoutModeRequest } from '@/lib/contracts/app-v1/affiliate'

export const dynamic = 'force-dynamic'

async function state(userId: string) {
  return db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { affiliatePayoutMode: true, stripeConnectId: true, affiliateOnboarded: true },
  })
}

function toBody(s: NonNullable<Awaited<ReturnType<typeof state>>>, canChange: boolean) {
  return {
    mode: s.affiliatePayoutMode === 'payout' ? 'payout' as const : 'credit' as const,
    canChange,
    connectStatus: !s.stripeConnectId ? 'none' as const : s.affiliateOnboarded ? 'ready' as const : 'pending' as const,
  }
}

export async function GET(req: Request) {
  const a = await requireAffiliateUser(req, 'affiliate-payout-mode', 60)
  if (a.response) return a.response
  const s = await state(a.user.id)
  if (!s) return appError('UNAUTHORIZED')
  const real = await getRealUserFromRequest(req).catch(() => null)
  return appJson(PayoutModeResponse, toBody(s, !!real && real.id === a.user.id))
}

export async function PUT(req: Request) {
  const a = await requireAffiliateUser(req, 'affiliate-payout-mode-put', 30)
  if (a.response) return a.response
  const real = await getRealUserFromRequest(req).catch(() => null)
  if (!real || real.id !== a.user.id) return appError('NOT_SELF')
  // Gleiches Limit wie im Web (10 Änderungen in 10 Minuten, gemeinsamer Zähler)
  if (!rateLimit('payout-mode-put', a.user.id, 10, 10 * 60_000)) return appError('RATE_LIMITED')

  const body = await readJson(req, UpdatePayoutModeRequest)
  if (body.response) return body.response

  await db.update(users).set({ affiliatePayoutMode: body.data.mode, updatedAt: new Date() }).where(eq(users.id, a.user.id))
  const s = await state(a.user.id)
  if (!s) return appError('UNAUTHORIZED')
  return appJson(PayoutModeResponse, toBody(s, true))
}
