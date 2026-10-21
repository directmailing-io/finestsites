/**
 * Gemeinsamer Einstieg aller Partnerprogramm-Routen der App (/api/app/v1/affiliate/*):
 * Anmeldung + Limit je Nutzer, Notschalter, Berechtigung (wie GET /api/app/v1/affiliate).
 */
import { appError, requireAppUser, type AppUser } from './http'
import { affiliateEligible, loadProfile, type AppProfile } from './account'
import { getAppRuntimeSettings } from './settings'

export async function requireAffiliateUser(
  req: Request,
  bucket: string,
  limit = 60,
  windowMs = 60_000,
): Promise<{ user: AppUser; profile: AppProfile; response?: never } | { user?: never; profile?: never; response: Response }> {
  const auth = await requireAppUser(req, bucket, limit, windowMs)
  if (auth.response) return { response: auth.response }
  if (!(await getAppRuntimeSettings()).features.partnerProgram) return { response: appError('FEATURE_DISABLED') }
  const profile = await loadProfile(auth.user.id)
  if (!profile) return { response: appError('UNAUTHORIZED') }
  if (!profile.username || !(await affiliateEligible(profile))) return { response: appError('AFFILIATE_NOT_AVAILABLE') }
  return { user: auth.user, profile }
}
