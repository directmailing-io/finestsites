/**
 * Neutraler Konto-Status für die App (keine Preise, kein Kauf-Hinweis).
 * Gleiche Regeln wie Web: Kontingent = veröffentlichte Nicht-Gratis-Seiten (siehe
 * /api/user/profile und /api/sites/[id]/publish), online/offline nach shouldBeOffline().
 */
import { db } from '@/lib/db'
import { users, userSites, templates, affiliateCommissions, affiliatePayouts } from '@/lib/db/schema'
import { and, eq, ne, sql } from 'drizzle-orm'
import { shouldBeOffline } from '@/lib/billing/payment-recovery'
import { PLANS, type PlanKey } from '@/lib/plans'
import { appUrl } from './http'

export const PAYING_STATUSES = ['active', 'trialing', 'past_due'] as const

export function hasRunningSubscription(status: string | null | undefined): boolean {
  return (PAYING_STATUSES as readonly string[]).includes(status ?? '')
}

export async function loadProfile(userId: string) {
  return db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: {
      id: true, email: true, username: true, firstName: true, lastName: true, companyName: true,
      teamPartnerNumber: true, profileImageUrl: true, emailVerified: true, isInternal: true, isAdmin: true,
      plan: true, subscriptionStatus: true, paymentFailedAt: true, paymentGraceUntil: true,
      paymentRetryProcessingAt: true, deactivatedAt: true, contentConsentAt: true,
      phone: true, instagram: true, tiktok: true, facebook: true, linkedin: true, youtube: true, emailOptOut: true,
    },
  })
}
export type AppProfile = NonNullable<Awaited<ReturnType<typeof loadProfile>>>

export async function loadSites(userId: string) {
  return db.select({
    id: userSites.id,
    status: userSites.status,
    publishedAt: userSites.publishedAt,
    updatedAt: userSites.updatedAt,
    customDomain: userSites.customDomain,
    customDomainStatus: userSites.customDomainStatus,
    publishedData: userSites.publishedData,
    templateTitle: templates.title,
    templateDomain: templates.domain,
    templateIsFree: templates.isFree,
    previewImages: templates.previewImages,
    thumbUrl: userSites.thumbUrl,
  })
    .from(userSites)
    .innerJoin(templates, eq(templates.id, userSites.templateId))
    .where(and(eq(userSites.userId, userId), ne(userSites.status, 'deleted')))
    .orderBy(sql`${userSites.updatedAt} desc`)
}
export type AppSiteRow = Awaited<ReturnType<typeof loadSites>>[number]

export function accountOffline(p: AppProfile): boolean {
  return !!p.deactivatedAt || shouldBeOffline(p)
}

export function siteStatus(site: AppSiteRow, p: AppProfile): 'online' | 'offline' | 'draft' {
  if (site.status === 'published') return accountOffline(p) ? 'offline' : 'online'
  if (site.status === 'deactivated') return 'offline'
  return 'draft'
}

export function siteUrl(site: AppSiteRow, username: string | null): string | null {
  if (site.customDomain && site.customDomainStatus === 'active') return `https://${site.customDomain}`
  if (!username) return null
  return `https://${username}.${site.templateDomain}`
}

export function domainInfo(site: AppSiteRow): { name: string; status: 'active' | 'pending' | 'error' } | null {
  if (!site.customDomain) return null
  const s = site.customDomainStatus
  return { name: site.customDomain, status: s === 'active' ? 'active' : s === 'error' ? 'error' : 'pending' }
}

export function thumbnailOf(site: AppSiteRow): string | null {
  if (site.thumbUrl) return site.thumbUrl // echtes Bild der veröffentlichten Seite (scripts/site-thumbnails.ts)
  const imgs = Array.isArray(site.previewImages) ? site.previewImages : []
  const first = imgs.find((x): x is string => typeof x === 'string' && x.length > 0)
  if (!first) return null
  return first.startsWith('/') ? `${appUrl()}${first}` : first
}

/** Kontingent und Tarif-Name (nur zur Anzeige). Ohne laufenden Tarif: null. */
export function quotaOf(p: AppProfile, sites: AppSiteRow[]): { planLabel: string | null; quota: { used: number; limit: number | null } | null } {
  if (!hasRunningSubscription(p.subscriptionStatus)) return { planLabel: null, quota: null }
  const def = PLANS[p.plan as PlanKey]
  const used = sites.filter(s => s.status === 'published' && !s.templateIsFree).length
  if (!def) return { planLabel: null, quota: { used, limit: null } } // z. B. Alt-Tarif 'secret' = unbegrenzt
  return { planLabel: def.name, quota: { used, limit: def.max_sites < 0 ? null : def.max_sites } }
}

/**
 * Darf das Konto das Partnerprogramm sehen? Konten ohne Tarif sehen den Bereich nicht
 * (Plan „Partnerprogramm in der App“). Wer schon Provisionen/Auszahlungen hat, behält den Zugang
 * (Gutschriften müssen abrufbar bleiben).
 */
export async function affiliateEligible(p: AppProfile): Promise<boolean> {
  if (p.isAdmin || hasRunningSubscription(p.subscriptionStatus)) return true
  const [c] = await db.select({ n: sql<number>`count(*)::int` }).from(affiliateCommissions).where(eq(affiliateCommissions.referrerId, p.id))
  if (Number(c?.n ?? 0) > 0) return true
  const [po] = await db.select({ n: sql<number>`count(*)::int` }).from(affiliatePayouts).where(eq(affiliatePayouts.referrerId, p.id))
  return Number(po?.n ?? 0) > 0
}
