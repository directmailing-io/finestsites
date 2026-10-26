/**
 * Neuigkeiten (Ankündigungen von FinestSites) – reine Fachlogik über Drizzle, keine HTTP-Details.
 * Spezifikation: docs/news/spec.md. Formen aus src/lib/contracts/app-v1/news.ts (Web und App identisch).
 *
 * Sichtbar für Nutzer: status = 'published' und Audience-Treffer (all oder plan:<users.plan>).
 * Gelesen/Knopf/Weggewischt liegen je Nutzer in news_reads (Upsert).
 * Push beim Veröffentlichen: Kategorie 'news', ohne Postfach-Eintrag (inbox: false); höchstens eine
 * Veröffentlichung mit Push je Kalendertag (Europe/Berlin).
 */
import { db } from '@/lib/db'
import { newsPosts, newsReads, pushDevices, users, type NewsPost } from '@/lib/db/schema'
import { and, desc, eq, isNotNull, isNull, or, sql } from 'drizzle-orm'
import { enqueuePush, type EnqueueResult } from '@/lib/push/enqueue'
import type { NewsCard, NewsCta, NewsItem } from '@/lib/contracts/app-v1/news'
import { NewsCtaKind } from '@/lib/contracts/app-v1/news'
import type { NewsAdminInput, NewsAudience } from './admin-schema'

export type NewsStatus = 'draft' | 'published' | 'archived'
export type UserCtx = { plan: string | null | undefined }

/** Fachlicher Fehler mit festem Code, HTTP-Status und deutscher Meldung (Routen geben ihn 1:1 weiter). */
export class NewsError extends Error {
  constructor(public readonly code: string, public readonly status: number, message: string) {
    super(message)
    this.name = 'NewsError'
  }
}

export const NEWS_LIST_LIMIT = 50

/* ── Hilfen ─────────────────────────────────────────────────────────────────────────────────── */

const toIso = (d: Date | string | null | undefined): string | null =>
  d == null ? null : (d instanceof Date ? d : new Date(d)).toISOString()

/** Kalendertag in Europe/Berlin als YYYY-MM-DD. */
export function berlinDay(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(d)
}

/** Audience-Treffer für einen Tarif (users.plan). */
export function audienceMatches(audience: string, plan: string | null | undefined): boolean {
  return audience === 'all' || (!!plan && audience === `plan:${plan}`)
}

/** Tarif eines Nutzers (users.plan), null wenn unbekannt. */
export async function userPlan(userId: string): Promise<string | null> {
  const [row] = await db.select({ plan: users.plan }).from(users).where(eq(users.id, userId)).limit(1)
  return row?.plan ?? null
}

/** SQL-Bedingung „für diesen Tarif sichtbar“ (veröffentlicht + Audience). */
function visibleFor(plan: string | null | undefined) {
  const audience = plan ? or(eq(newsPosts.audience, 'all'), eq(newsPosts.audience, `plan:${plan}`)) : eq(newsPosts.audience, 'all')
  return and(eq(newsPosts.status, 'published'), isNotNull(newsPosts.publishedAt), audience)
}

function ctaOf(p: Pick<NewsPost, 'ctaLabel' | 'ctaKind' | 'ctaUrl'>): NewsCta | null {
  const kind = NewsCtaKind.safeParse(p.ctaKind)
  if (!p.ctaLabel || !kind.success) return null
  return { label: p.ctaLabel, kind: kind.data, url: kind.data === 'url' ? p.ctaUrl ?? null : null }
}

type ReadCols = { readAt: Date | null; dismissedAt: Date | null }

function toItem(p: NewsPost, r: Partial<ReadCols> | null | undefined): NewsItem {
  return {
    id: p.id,
    title: p.title,
    summary: p.pushBody,
    body: p.body,
    cta: ctaOf(p),
    publishedAt: toIso(p.publishedAt) ?? toIso(p.createdAt)!,
    readAt: toIso(r?.readAt),
    dismissedAt: toIso(r?.dismissedAt),
  }
}

function toCard(p: NewsPost): NewsCard {
  return { id: p.id, title: p.title, summary: p.pushBody, publishedAt: toIso(p.publishedAt) ?? toIso(p.createdAt)! }
}

/** Beitrag + Lese-Zeile des Nutzers (LEFT JOIN) – Grundform für Liste, Detail und Aktionen. */
function selectWithReads(userId: string) {
  return db.select({
    post: newsPosts,
    readAt: newsReads.readAt,
    dismissedAt: newsReads.dismissedAt,
  }).from(newsPosts)
    .leftJoin(newsReads, and(eq(newsReads.newsId, newsPosts.id), eq(newsReads.userId, userId)))
}

/* ── Nutzer ─────────────────────────────────────────────────────────────────────────────────── */

export async function unreadCountFor(userId: string, ctx: UserCtx): Promise<number> {
  const [row] = await db.select({ n: sql<number>`count(*)::int`.mapWith(Number) })
    .from(newsPosts)
    .leftJoin(newsReads, and(eq(newsReads.newsId, newsPosts.id), eq(newsReads.userId, userId)))
    .where(and(visibleFor(ctx.plan), isNull(newsReads.readAt)))
  return row?.n ?? 0
}

export async function listForUser(userId: string, ctx: UserCtx): Promise<{ items: NewsItem[]; unreadCount: number }> {
  const [rows, unreadCount] = await Promise.all([
    selectWithReads(userId)
      .where(visibleFor(ctx.plan))
      .orderBy(desc(newsPosts.publishedAt), desc(newsPosts.createdAt))
      .limit(NEWS_LIST_LIMIT),
    unreadCountFor(userId, ctx),
  ])
  return { items: rows.map(r => toItem(r.post, r)), unreadCount }
}

/** null auch bei falscher Audience oder nicht veröffentlicht. */
export async function getForUser(userId: string, newsId: string, ctx: UserCtx): Promise<NewsItem | null> {
  const [row] = await selectWithReads(userId).where(and(eq(newsPosts.id, newsId), visibleFor(ctx.plan))).limit(1)
  return row ? toItem(row.post, row) : null
}

type ReadField = 'readAt' | 'ctaClickedAt' | 'dismissedAt'

/** Upsert in news_reads; ein schon gesetzter Zeitstempel bleibt erhalten. Null, wenn die Neuigkeit nicht sichtbar ist. */
async function touchRead(userId: string, newsId: string, ctx: UserCtx, field: ReadField): Promise<{ item: NewsItem; unreadCount: number } | null> {
  const visible = await getForUser(userId, newsId, ctx)
  if (!visible) return null
  const now = new Date()
  const column = { readAt: newsReads.readAt, ctaClickedAt: newsReads.ctaClickedAt, dismissedAt: newsReads.dismissedAt }[field]
  await db.insert(newsReads)
    .values({ newsId, userId, [field]: now })
    .onConflictDoUpdate({
      target: [newsReads.newsId, newsReads.userId],
      set: { [field]: sql`coalesce(${column}, ${now.toISOString()}::timestamptz)` },
    })
  const [item, unreadCount] = await Promise.all([getForUser(userId, newsId, ctx), unreadCountFor(userId, ctx)])
  return { item: item!, unreadCount }
}

export const markRead = (userId: string, newsId: string, ctx: UserCtx) => touchRead(userId, newsId, ctx, 'readAt')
export const markCtaClicked = (userId: string, newsId: string, ctx: UserCtx) => touchRead(userId, newsId, ctx, 'ctaClickedAt')
export const dismiss = (userId: string, newsId: string, ctx: UserCtx) => touchRead(userId, newsId, ctx, 'dismissedAt')

/** Für /overview und die Startkarte: Ungelesen-Zähler + neueste weder gelesene noch weggewischte Neuigkeit. */
export async function overviewFor(userId: string, ctx: UserCtx): Promise<{ unread: number; latest: NewsCard | null }> {
  const [unread, [latest]] = await Promise.all([
    unreadCountFor(userId, ctx),
    selectWithReads(userId)
      .where(and(visibleFor(ctx.plan), isNull(newsReads.readAt), isNull(newsReads.dismissedAt)))
      .orderBy(desc(newsPosts.publishedAt), desc(newsPosts.createdAt))
      .limit(1),
  ])
  return { unread, latest: latest ? toCard(latest.post) : null }
}

/* ── Admin ──────────────────────────────────────────────────────────────────────────────────── */

export type AdminNewsItem = {
  id: string
  status: NewsStatus
  title: string
  pushTitle: string
  pushBody: string
  body: string
  ctaLabel: string | null
  ctaKind: NewsCta['kind'] | null
  ctaUrl: string | null
  audience: NewsAudience
  publishedAt: string | null
  pushSentAt: string | null
  pushQueued: number
  readCount: number
  ctaCount: number
  dismissedCount: number
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

function toAdmin(p: NewsPost, s: { readCount: number; ctaCount: number; dismissedCount: number }): AdminNewsItem {
  const kind = NewsCtaKind.safeParse(p.ctaKind)
  return {
    id: p.id,
    status: p.status as NewsStatus,
    title: p.title,
    pushTitle: p.pushTitle,
    pushBody: p.pushBody,
    body: p.body,
    ctaLabel: p.ctaLabel ?? null,
    ctaKind: kind.success ? kind.data : null,
    ctaUrl: p.ctaUrl ?? null,
    audience: p.audience as NewsAudience,
    publishedAt: toIso(p.publishedAt),
    pushSentAt: toIso(p.pushSentAt),
    pushQueued: p.pushQueued,
    readCount: s.readCount,
    ctaCount: s.ctaCount,
    dismissedCount: s.dismissedCount,
    createdBy: p.createdBy ?? null,
    createdAt: toIso(p.createdAt)!,
    updatedAt: toIso(p.updatedAt)!,
  }
}

const statsSelect = {
  post: newsPosts,
  readCount: sql<number>`count(${newsReads.readAt})::int`.mapWith(Number),
  ctaCount: sql<number>`count(${newsReads.ctaClickedAt})::int`.mapWith(Number),
  dismissedCount: sql<number>`count(${newsReads.dismissedAt})::int`.mapWith(Number),
}

/** Alle Neuigkeiten mit Statistik (neueste zuerst: veröffentlichte nach published_at, sonst created_at). */
export async function listAdmin(): Promise<AdminNewsItem[]> {
  const rows = await db.select(statsSelect)
    .from(newsPosts)
    .leftJoin(newsReads, eq(newsReads.newsId, newsPosts.id))
    .groupBy(newsPosts.id)
    .orderBy(desc(sql`coalesce(${newsPosts.publishedAt}, ${newsPosts.createdAt})`), desc(newsPosts.createdAt))
  return rows.map(r => toAdmin(r.post, r))
}

export async function getAdmin(id: string): Promise<AdminNewsItem | null> {
  const [row] = await db.select(statsSelect)
    .from(newsPosts)
    .leftJoin(newsReads, eq(newsReads.newsId, newsPosts.id))
    .where(eq(newsPosts.id, id))
    .groupBy(newsPosts.id)
    .limit(1)
  return row ? toAdmin(row.post, row) : null
}

async function loadPost(id: string): Promise<NewsPost> {
  const [p] = await db.select().from(newsPosts).where(eq(newsPosts.id, id)).limit(1)
  if (!p) throw new NewsError('NOT_FOUND', 404, 'Neuigkeit nicht gefunden.')
  return p
}

export async function createDraft(input: NewsAdminInput, adminId: string): Promise<AdminNewsItem> {
  const [p] = await db.insert(newsPosts).values({
    status: 'draft',
    title: input.title,
    pushTitle: input.pushTitle,
    pushBody: input.pushBody,
    body: input.body,
    ctaLabel: input.ctaLabel,
    ctaKind: input.ctaKind,
    ctaUrl: input.ctaUrl,
    audience: input.audience,
    createdBy: adminId,
  }).returning()
  return (await getAdmin(p.id))!
}

/**
 * Entwurf oder veröffentlichte Neuigkeit ändern. Nach einem Push bleiben pushTitle/pushBody fest
 * (die Mitteilung ist schon draußen); archivierte Neuigkeiten sind unveränderlich.
 */
export async function updateDraft(id: string, input: NewsAdminInput): Promise<AdminNewsItem> {
  const p = await loadPost(id)
  if (p.status === 'archived') throw new NewsError('NEWS_ARCHIVED', 409, 'Archivierte Neuigkeiten können nicht mehr bearbeitet werden.')
  const pushLocked = !!p.pushSentAt
  await db.update(newsPosts).set({
    title: input.title,
    pushTitle: pushLocked ? p.pushTitle : input.pushTitle,
    pushBody: pushLocked ? p.pushBody : input.pushBody,
    body: input.body,
    ctaLabel: input.ctaLabel,
    ctaKind: input.ctaKind,
    ctaUrl: input.ctaUrl,
    // Empfänger nach dem Veröffentlichen nicht mehr ändern (Push ging an die ursprüngliche Audience)
    audience: p.status === 'published' ? p.audience : input.audience,
    updatedAt: new Date(),
  }).where(eq(newsPosts.id, id))
  return (await getAdmin(id))!
}

/** Empfänger für den Push: aktives Gerät + Audience + keine laufende Löschanfrage. */
async function recipientsFor(audience: string): Promise<{ userIds: string[]; devices: number }> {
  const audienceCond = audience === 'all' ? sql`true` : sql`${users.plan} = ${audience.replace(/^plan:/, '')}`
  const rows = await db.select({
    userId: users.id,
    devices: sql<number>`count(${pushDevices.id})::int`.mapWith(Number),
  }).from(users)
    .innerJoin(pushDevices, and(eq(pushDevices.userId, users.id), eq(pushDevices.enabled, true)))
    .where(and(isNull(users.deletionRequestedAt), audienceCond))
    .groupBy(users.id)
  return { userIds: rows.map(r => r.userId), devices: rows.reduce((n, r) => n + r.devices, 0) }
}

/** Für den Dialog „An alle senden“: Reichweite jetzt. */
export async function recipientPreview(id: string): Promise<{ users: number; devices: number }> {
  const p = await loadPost(id)
  const r = await recipientsFor(p.audience)
  return { users: r.userIds.length, devices: r.devices }
}

function pushPayload(p: NewsPost) {
  return {
    category: 'news' as const,
    type: 'news',
    title: p.pushTitle,
    body: p.pushBody,
    data: { url: `finestsites://news/${p.id}`, newsId: p.id },
    inbox: false as const,
  }
}

/**
 * Veröffentlichen (nur Entwürfe). Mit Push: Tageslimit prüfen (409 NEWS_PUSH_LIMIT), je Empfänger eine
 * Mitteilung einreihen, push_sent_at + push_queued setzen. Ohne Push: nur sichtbar schalten.
 */
export async function publish(id: string, opts: { push: boolean }, adminId: string): Promise<AdminNewsItem> {
  const now = new Date()
  const post = await db.transaction(async (tx) => {
    // Zwei Admins gleichzeitig → nacheinander (Tageslimit sicher)
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('news-publish'))`)
    const [p] = await tx.select().from(newsPosts).where(eq(newsPosts.id, id)).limit(1)
    if (!p) throw new NewsError('NOT_FOUND', 404, 'Neuigkeit nicht gefunden.')
    if (p.status !== 'draft') {
      throw new NewsError('NEWS_NOT_DRAFT', 409, p.status === 'published' ? 'Diese Neuigkeit ist bereits veröffentlicht.' : 'Archivierte Neuigkeiten können nicht veröffentlicht werden.')
    }
    if (opts.push) {
      const rows = await tx.select({ at: newsPosts.pushSentAt }).from(newsPosts)
        .where(and(isNotNull(newsPosts.pushSentAt), sql`${newsPosts.pushSentAt} > now() - interval '2 days'`))
      const today = berlinDay(now)
      if (rows.some(r => r.at && berlinDay(r.at) === today)) {
        throw new NewsError('NEWS_PUSH_LIMIT', 409, 'Heute wurde bereits eine Neuigkeit mit Push-Mitteilung veröffentlicht. Höchstens eine am Tag – veröffentliche ohne Push oder morgen wieder mit Push.')
      }
    }
    const [updated] = await tx.update(newsPosts).set({
      status: 'published',
      publishedAt: now,
      ...(opts.push ? { pushSentAt: now, pushQueued: 0 } : {}),
      updatedAt: now,
    }).where(eq(newsPosts.id, id)).returning()
    return updated
  })

  if (opts.push) {
    const { userIds } = await recipientsFor(post.audience)
    const payload = pushPayload(post)
    let queued = 0
    for (const userId of userIds) {
      const r = await enqueuePush({ userId, ...payload, collapseKey: 'news' })
      if (r === 'queued') queued++
    }
    await db.update(newsPosts).set({ pushQueued: queued, updatedAt: new Date() }).where(eq(newsPosts.id, id))
    console.log(`[news] veröffentlicht mit Push: ${id} durch ${adminId} – ${queued}/${userIds.length} eingereiht`)
  } else {
    console.log(`[news] veröffentlicht ohne Push: ${id} durch ${adminId}`)
  }
  return (await getAdmin(id))!
}

/** Veröffentlichte Neuigkeit verstecken (sofort in Web und App). */
export async function archive(id: string): Promise<AdminNewsItem> {
  const p = await loadPost(id)
  if (p.status === 'archived') return (await getAdmin(id))!
  if (p.status !== 'published') throw new NewsError('NEWS_NOT_PUBLISHED', 409, 'Nur veröffentlichte Neuigkeiten werden archiviert – Entwürfe kannst du löschen.')
  await db.update(newsPosts).set({ status: 'archived', updatedAt: new Date() }).where(eq(newsPosts.id, id))
  return (await getAdmin(id))!
}

/** Nur Entwürfe dürfen gelöscht werden. */
export async function deleteDraft(id: string): Promise<void> {
  const p = await loadPost(id)
  if (p.status !== 'draft') throw new NewsError('NEWS_NOT_DRAFT', 409, 'Nur Entwürfe können gelöscht werden – veröffentlichte Neuigkeiten werden archiviert.')
  await db.delete(newsPosts).where(eq(newsPosts.id, id))
}

/**
 * Testversand nur an die Geräte des angemeldeten Admins. Veröffentlicht nichts, setzt keinen Status,
 * zählt nicht fürs Tageslimit. devices = 0 → „Du hast kein Gerät mit Push angemeldet“.
 */
export async function sendTest(id: string, adminId: string): Promise<{ devices: number; result: EnqueueResult | null }> {
  const p = await loadPost(id)
  const [row] = await db.select({ n: sql<number>`count(*)::int`.mapWith(Number) }).from(pushDevices)
    .where(and(eq(pushDevices.userId, adminId), eq(pushDevices.enabled, true)))
  const devices = row?.n ?? 0
  if (devices === 0) return { devices: 0, result: null }
  const result = await enqueuePush({ userId: adminId, ...pushPayload(p), collapseKey: 'news-test', throttleSeconds: 30 })
  return { devices, result }
}
