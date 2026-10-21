import { z } from 'zod'
import { SemVer, IsoDateTime } from './common'

export const PlatformVersions = z.object({
  minSupported: SemVer,
  latest: SemVer,
})

export const AppFeatures = z.object({
  partnerProgram: z.boolean(),
  push: z.boolean(),
  editor: z.boolean(),
  support: z.boolean(),
  submissions: z.boolean(),
})
export type AppFeatures = z.infer<typeof AppFeatures>

/** GET /api/app/v1/config (öffentlich, ohne Anmeldung) */
export const ConfigResponse = z.object({
  apiVersion: z.literal(1),
  platforms: z.object({ ios: PlatformVersions, android: PlatformVersions }),
  features: AppFeatures,
  maintenance: z.object({ active: z.boolean(), message: z.string().nullable() }),
  links: z.object({
    privacy: z.string().url(),
    terms: z.string().url(),
    imprint: z.string().url(),
  }),
  serverTime: IsoDateTime,
})
export type ConfigResponse = z.infer<typeof ConfigResponse>
