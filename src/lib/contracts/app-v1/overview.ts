import { z } from 'zod'
import { NewsCard } from './news'
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
  /** Besucher der letzten 7 Tage (eindeutige Besucher, nur Seitenaufrufe). */
  visitors7d: z.number().int().nonnegative(),
  /** Veröffentlichte Seite mit Änderungen, die noch nicht online sind. */
  hasUnpublishedChanges: z.boolean(),
  publishedAt: IsoDateTime.nullable(),
  updatedAt: IsoDateTime,
})
export type SiteCard = z.infer<typeof SiteCard>

export const PeriodStats = z.object({
  visitors: z.number().int().nonnegative(),
  pageviews: z.number().int().nonnegative(),
  contacts: z.number().int().nonnegative(),
  leads: z.number().int().nonnegative(),
  /** Eingegangene Anfragen (Formulare, ohne Spam) – gleiche Quelle wie das Postfach. */
  submissions: z.number().int().nonnegative(),
})
export type PeriodStats = z.infer<typeof PeriodStats>

/** Neutraler Konto-Status (die App hat eigene Texte je Code, nie Zahlungs-/Kauf-Hinweise). */
export const AccountStatusCode = z.enum(['ok', 'no_sites', 'drafts_only', 'site_offline', 'account_notice'])
export type AccountStatusCode = z.infer<typeof AccountStatusCode>

/** „Zu erledigen“ – nur Codes, die Sätze stehen in der App. */
export const TodoCode = z.enum([
  'first_site',
  'unread_submissions',
  'unread_chats',
  'support_reply',
  'unpublished_changes',
  'complete_profile',
  'team_partner_missing',
  'tax_profile_missing',
  'domain_pending',
])
export type TodoCode = z.infer<typeof TodoCode>

export const Todo = z.object({
  id: z.string(),
  code: TodoCode,
  count: z.number().int().nonnegative().optional(),
  siteId: Uuid.optional(),
  siteTitle: z.string().optional(),
})
export type Todo = z.infer<typeof Todo>

/** GET /api/app/v1/overview */
export const OverviewResponse = z.object({
  sites: z.array(SiteCard),
  unread: z.object({
    submissions: z.number().int().nonnegative(),
    support: z.number().int().nonnegative(),
    notifications: z.number().int().nonnegative(),
    /** Ungelesene Besucher-Chat-Nachrichten (0, wenn der Chat für das Konto nicht freigeschaltet ist). */
    chat: z.number().int().nonnegative().default(0),
  }),
  /** last7 = letzte 7 Tage, prev7 = die 7 Tage davor (Vergleich „zur Vorwoche“), last30 = letzte 30 Tage. */
  stats: z.object({ last7: PeriodStats, prev7: PeriodStats, last30: PeriodStats }),
  accountStatus: z.object({
    code: AccountStatusCode,
    online: z.number().int().nonnegative(),
    offline: z.number().int().nonnegative(),
  }),
  todos: z.array(Todo),
  /** Neuigkeiten: ungelesene Anzahl + neueste, noch nicht weggewischte Neuigkeit für die Startkarte. */
  news: z.object({
    unread: z.number().int().nonnegative(),
    latest: NewsCard.nullable(),
  }).default({ unread: 0, latest: null }),
})
export type OverviewResponse = z.infer<typeof OverviewResponse>
