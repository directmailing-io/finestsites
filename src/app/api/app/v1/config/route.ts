/**
 * GET /api/app/v1/config — öffentlich (ohne Anmeldung): Mindest-/Neueste App-Version je Plattform,
 * Notschalter je Bereich, Wartungshinweis. Werte aus app_settings (src/lib/app-api/settings.ts).
 */
import { getClientIp, rateLimit } from '@/lib/security/request'
import { appError, appJson } from '@/lib/app-api/http'
import { getAppRuntimeSettings } from '@/lib/app-api/settings'
import { ConfigResponse } from '@/lib/contracts/app-v1/config'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  if (!rateLimit('app-config', getClientIp(req), 120, 60_000)) return appError('RATE_LIMITED')
  const s = await getAppRuntimeSettings()
  return appJson(ConfigResponse, {
    apiVersion: 1,
    platforms: s.platforms,
    features: s.features,
    maintenance: { active: !!s.maintenanceMessage, message: s.maintenanceMessage },
    links: {
      privacy: 'https://finestsites.io/datenschutz',
      terms: 'https://finestsites.io/agb',
      imprint: 'https://finestsites.io/impressum',
    },
    serverTime: new Date().toISOString(),
  }, { headers: { 'Cache-Control': 'public, max-age=60' } })
}
