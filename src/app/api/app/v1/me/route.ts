/**
 * GET /api/app/v1/me — Profil, Ersteinrichtung, neutraler Konto-Status (keine Preise, kein Kauf).
 */
import { appError, appJson, requireAppUser } from '@/lib/app-api/http'
import { accountOffline, affiliateEligible, loadProfile, loadSites, quotaOf, siteStatus } from '@/lib/app-api/account'
import { getAppRuntimeSettings } from '@/lib/app-api/settings'
import { MeResponse } from '@/lib/contracts/app-v1/me'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const auth = await requireAppUser(req, 'me')
  if (auth.response) return auth.response

  const [profile, sites, settings] = await Promise.all([
    loadProfile(auth.user.id),
    loadSites(auth.user.id),
    getAppRuntimeSettings(),
  ])
  if (!profile) return appError('UNAUTHORIZED')

  const { planLabel, quota } = quotaOf(profile, sites)
  const partner = settings.features.partnerProgram && await affiliateEligible(profile)

  return appJson(MeResponse, {
    user: {
      id: profile.id,
      email: profile.email,
      username: profile.username,
      firstName: profile.firstName,
      lastName: profile.lastName,
      companyName: profile.companyName,
      teamPartnerNumber: profile.teamPartnerNumber,
      profileImageUrl: profile.profileImageUrl,
      emailVerified: profile.emailVerified,
      isInternal: profile.isInternal,
    },
    onboarding: {
      usernameSet: !!profile.username,
      consentGiven: !!profile.contentConsentAt,
      complete: !!profile.username && !!profile.contentConsentAt,
    },
    account: {
      sitesOnline: sites.filter(s => siteStatus(s, profile) === 'online').length,
      sitesTotal: sites.length,
      paymentIssue: !!profile.paymentFailedAt || accountOffline(profile),
      planLabel,
      quota,
    },
    features: { partnerProgram: partner },
  })
}
