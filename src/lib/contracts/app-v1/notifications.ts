import { z } from 'zod'
import { Uuid, IsoDateTime } from './common'

export const AppNotification = z.object({
  id: Uuid,
  type: z.string(),
  title: z.string(),
  message: z.string(),
  data: z.record(z.string(), z.unknown()),
  readAt: IsoDateTime.nullable(),
  createdAt: IsoDateTime,
})
export type AppNotification = z.infer<typeof AppNotification>

/** GET /api/app/v1/notifications?limit=&before= */
export const NotificationsQuery = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  before: IsoDateTime.optional(),
})

export const NotificationsResponse = z.object({
  items: z.array(AppNotification),
  unreadCount: z.number().int().nonnegative(),
  /** `before`-Wert für die nächste Seite, null = Ende. */
  nextCursor: IsoDateTime.nullable(),
})

/** POST /api/app/v1/notifications/read – entweder ids ODER all:true */
export const MarkReadRequest = z.union([
  z.object({ ids: z.array(Uuid).min(1).max(100) }).strict(),
  z.object({ all: z.literal(true) }).strict(),
])

export const MarkReadResponse = z.object({
  updated: z.number().int().nonnegative(),
  unreadCount: z.number().int().nonnegative(),
})
