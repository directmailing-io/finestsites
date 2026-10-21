import { z } from 'zod'
import { Uuid, IsoDateTime } from './common'

export const SiteStatus = z.enum(['online', 'offline', 'draft'])
export const DomainStatus = z.enum(['active', 'pending', 'error'])

export const SiteCard = z.object({
  id: Uuid,
  title: z.string(),
  status: SiteStatus,
  /** Öffentliche Adresse (eigene Domain, falls aktiv); null ohne Benutzername. */
  url: z.string().url().nullable(),
  domain: z.object({ name: z.string(), status: DomainStatus }).nullable(),
  thumbnailUrl: z.string().nullable(),
  unreadSubmissions: z.number().int().nonnegative(),
  publishedAt: IsoDateTime.nullable(),
  updatedAt: IsoDateTime,
})
export type SiteCard = z.infer<typeof SiteCard>

export const PeriodStats = z.object({
  visitors: z.number().int().nonnegative(),
  pageviews: z.number().int().nonnegative(),
  contacts: z.number().int().nonnegative(),
  leads: z.number().int().nonnegative(),
})
export type PeriodStats = z.infer<typeof PeriodStats>

/** GET /api/app/v1/overview */
export const OverviewResponse = z.object({
  sites: z.array(SiteCard),
  unread: z.object({
    submissions: z.number().int().nonnegative(),
    support: z.number().int().nonnegative(),
    notifications: z.number().int().nonnegative(),
  }),
  stats: z.object({ last7: PeriodStats, last30: PeriodStats }),
})
export type OverviewResponse = z.infer<typeof OverviewResponse>
