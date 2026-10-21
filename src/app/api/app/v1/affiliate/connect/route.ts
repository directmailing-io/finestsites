/**
 * POST /api/app/v1/affiliate/connect — frischer Stripe-Connect-Einrichtungslink für die App.
 * Rückwege zeigen auf /api/app/v1/affiliate/connect/return mit signiertem State (kein Cookie nötig).
 * Adressen immer aus NEXT_PUBLIC_APP_URL, nie aus dem Origin der Anfrage.
 */
import { appError, appJson, appUrl, requireAppUser } from '@/lib/app-api/http'
import { affiliateEligible, loadProfile } from '@/lib/app-api/account'
import { getAppRuntimeSettings } from '@/lib/app-api/settings'
import { AffiliateConnectResponse } from '@/lib/contracts/app-v1/affiliate'
import { ensureConnectAccount, signConnectState } from '@/lib/affiliate/connect-app'
import { getStripe } from '@/lib/stripe/client'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const auth = await requireAppUser(req, 'affiliate-connect', 10)
  if (auth.response) return auth.response
  if (!(await getAppRuntimeSettings()).features.partnerProgram) return appError('FEATURE_DISABLED')

  const profile = await loadProfile(auth.user.id)
  if (!profile) return appError('UNAUTHORIZED')
  if (!profile.username || !(await affiliateEligible(profile))) return appError('AFFILIATE_NOT_AVAILABLE')
  // Interne Konten (Apple-Demo) lösen nie eine echte Stripe-Einrichtung aus
  if (profile.isInternal) return appError('CONNECT_UNAVAILABLE')

  try {
    const accountId = await ensureConnectAccount(auth.user.id)
    const state = signConnectState(auth.user.id, accountId)
    const back = `${appUrl()}/api/app/v1/affiliate/connect/return?state=${encodeURIComponent(state)}`
    const link = await getStripe().accountLinks.create({
      account: accountId,
      refresh_url: `${back}&refresh=1`,
      return_url: back,
      type: 'account_onboarding',
    })
    return appJson(AffiliateConnectResponse, { url: link.url, callbackScheme: 'finestsites' })
  } catch (err) {
    console.error('[app/affiliate/connect] failed:', err instanceof Error ? err.message : err)
    return appError('CONNECT_UNAVAILABLE')
  }
}
