/**
 * Besucher-Chat – Datenzugriff und Abbildung auf die Verträge (src/lib/contracts/app-v1/chat.ts).
 *
 * Grundsätze (docs/chat/konzept.md):
 *   - Vom Besucher-Token und von Resume-Tokens wird nur der sha256-Hash gespeichert.
 *   - Die IP kommt bereits als Hash vom Worker (x-fs-ip-hash) – hier wird nie eine IP gelesen.
 *   - Kurzkennung `visitor_key` = erste 4 Zeichen des Token-Hashes („Besucher 4F2A“).
 *   - Vorschau = erste 140 Zeichen, einzeilig.
 */
import { createHash, randomBytes } from 'node:crypto'
import { db } from '@/lib/db'
import {
  chatBlocks, chatConversations, chatMessages, chatResumeTokens, chatVisitorTokens, templates, userSites, users,
  type ChatConversationRow, type ChatMessageRow,
} from '@/lib/db/schema'
import { and, asc, desc, eq, gt, ilike, inArray, isNull, lt, or, sql } from 'drizzle-orm'
import type { ChatConversation, ChatMessage, ChatSender } from '@/lib/contracts/app-v1/chat'
import { normalizeWhatsAppNumber } from '@/lib/utils/social-links'

export const ONLINE_WINDOW_MS = 90_000
export const PREVIEW_LENGTH = 140
export const RESUME_TOKEN_DAYS = 30
/** Übergabe-Links (In-App-Browser → Safari, „Link per E-Mail“): kürzer gültig als die Antwort-Mail. */
export const HANDOFF_TOKEN_DAYS = 7
/** Höchstens so viele Übergabe-Mails je Gespräch und 24 Stunden. */
export const HANDOFF_MAILS_PER_DAY = 3
export type ResumeTokenKind = 'reply' | 'handoff' | 'handoff_mail'
export const RETENTION_DAYS = 180
export const BLOCK_RETENTION_DAYS = 365
/** Gesprächs-Code: gültig bis 90 Tage nach der letzten Nachricht (Gespräche selbst leben 180 Tage) */
export const RESUME_CODE_DAYS = 90
export const RESUME_CODE_LENGTH = 8
/** Alphabet ohne 0/O, 1/I/L – nichts, was man beim Abschreiben verwechselt (auch Migration 20261022250000) */
export const RESUME_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
/** Im Gespräch sichtbare Zeile, wenn ein weiterer Browser per Code oder Link dazukommt */
export const DEVICE_ADDED_TEXT = 'Gespräch auf einem weiteren Gerät geöffnet.'
export const WELCOME_TEXT = 'Hi! Schreib mir gern, ich antworte so schnell ich kann.'

// ─── Kleine Helfer ────────────────────────────────────────────────────────────

export function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

/** Besucher-Token des Widgets: 32 Byte Zufall als Hex oder base64url. */
export function isValidVisitorToken(token: unknown): token is string {
  return typeof token === 'string' && /^[A-Za-z0-9_-]{16,128}$/.test(token)
}

export function visitorKeyFromHash(hash: string): string {
  return hash.slice(0, 4).toUpperCase()
}

export function previewOf(body: string): string {
  const flat = body.replace(/\s+/g, ' ').trim()
  return flat.length > PREVIEW_LENGTH ? `${flat.slice(0, PREVIEW_LENGTH - 1).trimEnd()}…` : flat
}

export function displayNameOf(name: string | null | undefined, visitorKey: string): string {
  const n = (name ?? '').trim()
  return n || `Besucher ${visitorKey}`
}

export function initialsOf(displayName: string): string {
  const parts = displayName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '??'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function whatsappUrlOf(phone: string | null | undefined): string | null {
  if (!phone) return null
  const digits = normalizeWhatsAppNumber(phone).replace(/\D/g, '')
  return digits.length >= 6 ? `https://wa.me/${digits}` : null
}

/** Nur Pfad + Suche einer Seiten-URL (kein Host, kein Fragment), max. 300 Zeichen. */
/** Zufälliger Gesprächs-Code (8 Zeichen aus RESUME_CODE_ALPHABET, unformatiert). */
export function generateResumeCode(): string {
  const bytes = randomBytes(RESUME_CODE_LENGTH)
  let out = ''
  for (let i = 0; i < RESUME_CODE_LENGTH; i++) out += RESUME_CODE_ALPHABET[bytes[i] % RESUME_CODE_ALPHABET.length]
  return out
}

/** „7K4M2P9X“ → „7K4M-2P9X“ (so steht er im Widget, in App und Web). */
export function formatResumeCode(code: string | null | undefined): string | null {
  if (!code || code.length !== RESUME_CODE_LENGTH) return null
  return `${code.slice(0, 4)}-${code.slice(4)}`
}

/**
 * Eingabe des Besuchers → unformatierter Code oder null. Groß-/Kleinschreibung, Bindestriche und
 * Leerzeichen sind egal; O/0 und I/1/L kommen im Alphabet nicht vor und gelten damit als Tippfehler.
 */
export function normalizeResumeCode(input: unknown): string | null {
  if (typeof input !== 'string') return null
  const code = input.toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (code.length !== RESUME_CODE_LENGTH) return null
  for (const ch of code) if (!RESUME_CODE_ALPHABET.includes(ch)) return null
  return code
}

export function pathOf(pageUrl: unknown): string | null {
  if (typeof pageUrl !== 'string' || !pageUrl.trim()) return null
  try {
    const u = new URL(pageUrl, 'https://placeholder.invalid')
    const p = `${u.pathname}${u.search}`
    return p.slice(0, 300) || '/'
  } catch {
    return null
  }
}

const iso = (d: Date | null | undefined): string | null => (d ? d.toISOString() : null)

// ─── Seite + Besitzer ─────────────────────────────────────────────────────────

export type ChatSiteContext = {
  siteId: string
  siteStatus: string
  siteTitle: string
  templateDomain: string
  customDomain: string | null
  customDomainStatus: string | null
  publishedData: Record<string, string> | null
  userId: string
  username: string | null
  ownerEmail: string
  ownerFirstName: string | null
  ownerProfileImageUrl: string | null
  ownerBrandColor: string | null
  /** Editor-Schalter dieser Seite */
  visitorChatEnabled: boolean
}

export async function loadSiteContext(siteId: string): Promise<ChatSiteContext | null> {
  const [row] = await db.select({
    siteId: userSites.id,
    siteStatus: userSites.status,
    siteTitle: templates.title,
    templateDomain: templates.domain,
    customDomain: userSites.customDomain,
    customDomainStatus: userSites.customDomainStatus,
    publishedData: userSites.publishedData,
    userId: users.id,
    username: users.username,
    ownerEmail: users.email,
    ownerFirstName: users.firstName,
    ownerProfileImageUrl: users.profileImageUrl,
    ownerBrandColor: users.brandColor,
    visitorChatEnabled: userSites.visitorChatEnabled,
  })
    .from(userSites)
    .innerJoin(users, eq(userSites.userId, users.id))
    .innerJoin(templates, eq(userSites.templateId, templates.id))
    .where(eq(userSites.id, siteId))
    .limit(1)
  if (!row) return null
  return { ...row, publishedData: (row.publishedData ?? null) as Record<string, string> | null }
}

export function siteHostOf(s: { customDomain: string | null; customDomainStatus: string | null; username: string | null; templateDomain: string }): string {
  if (s.customDomain && s.customDomainStatus === 'active') return s.customDomain
  return `${s.username ?? 'www'}.${s.templateDomain}`
}

/** Anzeigename des Betreibers für Widget und Mails: published_data.vorname, sonst Vorname, sonst „Inhaber“. */
export function ownerNameOf(s: { publishedData: Record<string, string> | null; ownerFirstName: string | null }): string {
  const fromSite = (s.publishedData?.vorname ?? '').trim()
  if (fromSite) return fromSite.slice(0, 60)
  const first = (s.ownerFirstName ?? '').trim()
  return first ? first.slice(0, 60) : 'Inhaber'
}

/** Erster nicht-leerer published_data-Schlüssel, der /whatsapp/i enthält → https://wa.me/<ziffern>. */
export function ownerWhatsappUrlOf(publishedData: Record<string, string> | null): string | null {
  if (!publishedData) return null
  for (const [key, value] of Object.entries(publishedData)) {
    if (!/whatsapp/i.test(key) || typeof value !== 'string' || !value.trim()) continue
    const v = value.trim()
    if (/^https?:\/\//i.test(v)) {
      try { if (/(^|\.)wa\.me$|whatsapp\.com$/i.test(new URL(v).hostname)) return v } catch { /* weiter */ }
      continue
    }
    const digits = normalizeWhatsAppNumber(v).replace(/\D/g, '')
    if (digits.length >= 6) return `https://wa.me/${digits}`
  }
  return null
}

// ─── Gespräche lesen ──────────────────────────────────────────────────────────

const conversationSelect = {
  conv: chatConversations,
  siteTitle: templates.title,
  templateDomain: templates.domain,
  customDomain: userSites.customDomain,
  customDomainStatus: userSites.customDomainStatus,
  username: users.username,
}
export type ConversationWithSite = {
  conv: ChatConversationRow
  siteTitle: string
  templateDomain: string
  customDomain: string | null
  customDomainStatus: string | null
  username: string | null
}

function conversationQuery() {
  return db.select(conversationSelect)
    .from(chatConversations)
    .innerJoin(userSites, eq(chatConversations.siteId, userSites.id))
    .innerJoin(templates, eq(userSites.templateId, templates.id))
    .innerJoin(users, eq(chatConversations.userId, users.id))
}

/**
 * Gespräch zu einem Besucher-Token auf dieser Seite: zuerst der ursprüngliche Token des Gesprächs,
 * sonst ein Alias aus chat_visitor_tokens (Übergabe zwischen Browsern, docs/chat/konzept.md).
 */
export async function findConversationByToken(siteId: string, tokenHash: string): Promise<ChatConversationRow | null> {
  const row = await db.query.chatConversations.findFirst({
    where: and(eq(chatConversations.siteId, siteId), eq(chatConversations.visitorTokenHash, tokenHash)),
  })
  if (row) return row
  const [alias] = await db.select({ conv: chatConversations })
    .from(chatVisitorTokens)
    .innerJoin(chatConversations, eq(chatVisitorTokens.conversationId, chatConversations.id))
    .where(and(eq(chatVisitorTokens.tokenHash, tokenHash), eq(chatConversations.siteId, siteId)))
    .limit(1)
  if (!alias) return null
  // Nicht auf jedem Poll schreiben: reicht einmal pro Stunde
  void db.update(chatVisitorTokens).set({ lastUsedAt: new Date() })
    .where(and(
      eq(chatVisitorTokens.tokenHash, tokenHash),
      or(isNull(chatVisitorTokens.lastUsedAt), lt(chatVisitorTokens.lastUsedAt, new Date(Date.now() - 3_600_000))),
    ))
    .catch(() => {})
  return alias.conv
}

/** Alle Token-Hashes eines Gesprächs (ursprünglicher + Aliase) – für Sperren. */
export async function tokenHashesOf(conv: ChatConversationRow): Promise<string[]> {
  const rows = await db.select({ h: chatVisitorTokens.tokenHash }).from(chatVisitorTokens)
    .where(eq(chatVisitorTokens.conversationId, conv.id))
  return [conv.visitorTokenHash, ...rows.map(r => r.h)]
}

export async function getConversationById(id: string): Promise<ChatConversationRow | null> {
  const row = await db.query.chatConversations.findFirst({ where: eq(chatConversations.id, id) })
  return row ?? null
}

/** Gespräch samt Seite – nur wenn es dem Betreiber gehört. */
export async function getConversationForOwner(id: string, userId: string): Promise<ConversationWithSite | null> {
  const [row] = await conversationQuery()
    .where(and(eq(chatConversations.id, id), eq(chatConversations.userId, userId)))
    .limit(1)
  return row ?? null
}

export async function listConversationsForOwner(userId: string, opts: {
  status: 'open' | 'archived' | 'blocked'
  q?: string
  cursor?: string
  limit: number
}): Promise<{ rows: ConversationWithSite[]; nextCursor: string | null }> {
  const conds = [eq(chatConversations.userId, userId), eq(chatConversations.status, opts.status)]
  if (opts.cursor) conds.push(lt(chatConversations.updatedAt, new Date(opts.cursor)))
  const q = (opts.q ?? '').trim()
  if (q) {
    const like = `%${q.replace(/[%_\\]/g, m => `\\${m}`)}%`
    conds.push(or(
      ilike(chatConversations.visitorName, like),
      ilike(chatConversations.visitorEmail, like),
      ilike(chatConversations.visitorPhone, like),
      ilike(chatConversations.lastMessagePreview, like),
      ilike(chatConversations.visitorKey, like),
    )!)
  }
  const rows = await conversationQuery()
    .where(and(...conds))
    .orderBy(desc(chatConversations.updatedAt), desc(chatConversations.id))
    .limit(opts.limit + 1)
  const page = rows.slice(0, opts.limit)
  return { rows: page, nextCursor: rows.length > opts.limit ? iso(page[page.length - 1].conv.updatedAt) : null }
}

/** Ungelesene Besucher-Nachrichten über alle offenen Gespräche. */
export async function ownerUnread(userId: string): Promise<{ count: number; conversations: number }> {
  const [row] = await db.select({
    count: sql<number>`coalesce(sum(${chatConversations.ownerUnread}), 0)::int`.mapWith(Number),
    conversations: sql<number>`count(*) filter (where ${chatConversations.ownerUnread} > 0)::int`.mapWith(Number),
  }).from(chatConversations)
    .where(and(eq(chatConversations.userId, userId), eq(chatConversations.status, 'open')))
  return { count: row?.count ?? 0, conversations: row?.conversations ?? 0 }
}

// ─── Abbildung auf die Verträge ───────────────────────────────────────────────

/** Antwort von POST /api/worker/chat/session (Besucher-Sicht, docs/chat/konzept.md). */
export type ConversationState = {
  enabled: true
  /** Pflicht-Header X-FS-Ticket für schreibende Aufrufe (src/lib/chat/ticket.ts) */
  ticket: string
  conversationId: string | null
  visitorToken: string | null
  status: string | null
  visitor: { name: string | null; email: string | null; phone: string | null; notifyByEmail: boolean } | null
  messages: ChatMessage[]
  ownerLastSeenAt: string | null
  /** Bis wann der Betreiber die Besucher-Nachrichten gelesen hat (✓✓ im Widget), null = noch nicht. */
  ownerReadAt: string | null
  /** Gesprächs-Code „7K4M-2P9X“ (nur mit Gespräch): Widget-Karte „Dein Gesprächs-Code“ */
  resumeCode: string | null
}

export function toContractConversation(r: ConversationWithSite, now = Date.now()): ChatConversation {
  const c = r.conv
  const displayName = displayNameOf(c.visitorName, c.visitorKey)
  const lastSeen = c.visitorLastSeenAt
  return {
    id: c.id,
    siteId: c.siteId,
    siteTitle: r.siteTitle,
    siteHost: siteHostOf(r),
    startedOnPath: c.startedOnPath,
    visitor: {
      name: c.visitorName,
      email: c.visitorEmail,
      phone: c.visitorPhone,
      displayName,
      initials: initialsOf(displayName),
      whatsappUrl: whatsappUrlOf(c.visitorPhone),
      online: !!lastSeen && now - lastSeen.getTime() < ONLINE_WINDOW_MS,
      lastSeenAt: iso(lastSeen),
    },
    status: c.status as ChatConversation['status'],
    unread: c.ownerUnread,
    lastMessage: c.lastMessageAt && c.lastMessageSender
      ? { preview: c.lastMessagePreview ?? '', sender: c.lastMessageSender as ChatSender, at: c.lastMessageAt.toISOString() }
      : null,
    reportedAt: iso(c.reportedAt),
    resumeCode: formatResumeCode(c.resumeCode),
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  }
}

/** clientId nur bei eigenen Nachrichten des Betrachters (Vertrag). */
export function toContractMessage(m: ChatMessageRow, viewer: 'owner' | 'visitor'): ChatMessage {
  return {
    id: m.id,
    conversationId: m.conversationId,
    sender: m.sender as ChatSender,
    body: m.body,
    createdAt: m.createdAt.toISOString(),
    readAt: iso(m.readAt),
    clientId: m.sender === viewer ? (m.clientId ?? null) : null,
  }
}

// ─── Nachrichten ──────────────────────────────────────────────────────────────

export async function listMessages(conversationId: string, opts: { after?: string; before?: string; limit: number }): Promise<{ messages: ChatMessageRow[]; hasMore: boolean }> {
  const anchorId = opts.after ?? opts.before
  let anchor: { createdAt: Date; id: string } | null = null
  if (anchorId) {
    const a = await db.query.chatMessages.findFirst({
      where: and(eq(chatMessages.id, anchorId), eq(chatMessages.conversationId, conversationId)),
      columns: { createdAt: true, id: true },
    })
    anchor = a ?? null
  }

  if (opts.after) {
    // Polling: alles nach dem Anker (älteste zuerst). Unbekannter Anker = alles liefern.
    const where = anchor
      ? and(eq(chatMessages.conversationId, conversationId),
        sql`(${chatMessages.createdAt}, ${chatMessages.id}) > (select m.created_at, m.id from chat_messages m where m.id = ${anchor.id}::uuid)`)
      : eq(chatMessages.conversationId, conversationId)
    const rows = await db.select().from(chatMessages).where(where)
      .orderBy(asc(chatMessages.createdAt), asc(chatMessages.id)).limit(opts.limit + 1)
    return { messages: rows.slice(0, opts.limit), hasMore: rows.length > opts.limit }
  }

  // Verlauf: die letzten N (vor dem Anker), geliefert älteste zuerst
  const where = anchor
    ? and(eq(chatMessages.conversationId, conversationId),
      sql`(${chatMessages.createdAt}, ${chatMessages.id}) < (select m.created_at, m.id from chat_messages m where m.id = ${anchor.id}::uuid)`)
    : eq(chatMessages.conversationId, conversationId)
  const rows = await db.select().from(chatMessages).where(where)
    .orderBy(desc(chatMessages.createdAt), desc(chatMessages.id)).limit(opts.limit + 1)
  return { messages: rows.slice(0, opts.limit).reverse(), hasMore: rows.length > opts.limit }
}

/** Letzte Nachrichten eines Absenders (neueste zuerst) – für den Wiederholungsfilter. */
export async function recentBodies(conversationId: string, sender: 'visitor' | 'owner', n = 2): Promise<string[]> {
  const rows = await db.select({ body: chatMessages.body }).from(chatMessages)
    .where(and(eq(chatMessages.conversationId, conversationId), eq(chatMessages.sender, sender)))
    .orderBy(desc(chatMessages.createdAt)).limit(n)
  return rows.map(r => r.body)
}

function isUniqueViolation(err: unknown): boolean {
  return !!err && typeof err === 'object' && (err as { code?: string }).code === '23505'
}

/**
 * Nachricht speichern + Gesprächszeile fortschreiben. Dieselbe clientId desselben Absenders liefert
 * die vorhandene Nachricht zurück (created=false), ohne Zähler erneut zu erhöhen.
 */
export async function findMessageByClientId(conversationId: string, sender: 'visitor' | 'owner', clientId: string | null): Promise<ChatMessageRow | null> {
  if (!clientId) return null
  const row = await db.query.chatMessages.findFirst({
    where: and(eq(chatMessages.conversationId, conversationId), eq(chatMessages.sender, sender), eq(chatMessages.clientId, clientId)),
  })
  return row ?? null
}

export async function recordMessage(conv: ChatConversationRow, sender: 'visitor' | 'owner', body: string, clientId: string | null): Promise<{ message: ChatMessageRow; created: boolean }> {
  const existing = () => findMessageByClientId(conv.id, sender, clientId)

  const dup = await existing()
  if (dup) return { message: dup, created: false }

  let message: ChatMessageRow
  try {
    const [row] = await db.insert(chatMessages).values({ conversationId: conv.id, sender, body, clientId }).returning()
    message = row
  } catch (err) {
    if (!isUniqueViolation(err)) throw err
    const again = await existing()
    if (!again) throw err
    return { message: again, created: false }
  }

  const now = new Date()
  await db.update(chatConversations).set({
    lastMessageAt: now,
    lastMessagePreview: previewOf(body),
    lastMessageSender: sender,
    updatedAt: now,
    ...(sender === 'visitor'
      ? {
        ownerUnread: sql`${chatConversations.ownerUnread} + 1`,
        visitorLastSeenAt: now,
        // Ein archiviertes Gespräch wird durch eine neue Besucher-Nachricht wieder offen
        ...(conv.status === 'archived' ? { status: 'open' } : {}),
      }
      : { visitorUnread: sql`${chatConversations.visitorUnread} + 1`, ownerLastSeenAt: now }),
  }).where(eq(chatConversations.id, conv.id))

  return { message, created: true }
}

export async function markReadByOwner(conversationId: string): Promise<void> {
  const now = new Date()
  await Promise.all([
    db.update(chatMessages).set({ readAt: now })
      .where(and(eq(chatMessages.conversationId, conversationId), eq(chatMessages.sender, 'visitor'), isNull(chatMessages.readAt))),
    db.update(chatConversations).set({ ownerUnread: 0, ownerLastSeenAt: now })
      .where(eq(chatConversations.id, conversationId)),
  ])
}

export async function markReadByVisitor(conversationId: string): Promise<void> {
  const now = new Date()
  await Promise.all([
    db.update(chatMessages).set({ readAt: now })
      .where(and(eq(chatMessages.conversationId, conversationId), eq(chatMessages.sender, 'owner'), isNull(chatMessages.readAt))),
    db.update(chatConversations).set({ visitorUnread: 0, visitorLastSeenAt: now })
      .where(eq(chatConversations.id, conversationId)),
  ])
}

/**
 * Bis wann hat der Betreiber die Besucher-Nachrichten gelesen? = max(read_at) der Besucher-Nachrichten.
 * Steigt zuverlässig bei jedem „read“ des Betreibers (auch ohne Antwort) – fürs ✓✓ im Widget.
 */
/** Leichter Zustands-Abdruck fürs Long-Polling (ein Primärschlüssel-Lookup). */
export type ConversationSnapshot = { lastMessageAt: number; updatedAt: number; status: string; ownerUnread: number; visitorUnread: number }
export async function conversationSnapshot(conversationId: string): Promise<ConversationSnapshot | null> {
  const [row] = await db.select({
    lastMessageAt: chatConversations.lastMessageAt, updatedAt: chatConversations.updatedAt, status: chatConversations.status,
    ownerUnread: chatConversations.ownerUnread, visitorUnread: chatConversations.visitorUnread,
  }).from(chatConversations).where(eq(chatConversations.id, conversationId)).limit(1)
  if (!row) return null
  return {
    lastMessageAt: row.lastMessageAt?.getTime() ?? 0, updatedAt: row.updatedAt?.getTime() ?? 0,
    status: row.status, ownerUnread: row.ownerUnread, visitorUnread: row.visitorUnread,
  }
}
/**
 * Neue Nachricht, Statuswechsel, Lesebestätigung des Betreibers (owner_unread sinkt) oder sonstige Änderung
 * (updated_at: Systemzeile „weiteres Gerät“, Profil, Übergabe)? Die Seen-Stempel setzen updated_at bewusst nicht,
 * sonst würde der Long-Poll alle 20 s grundlos aufwachen.
 */
export function snapshotChanged(a: ConversationSnapshot, b: ConversationSnapshot): boolean {
  return a.lastMessageAt !== b.lastMessageAt || a.updatedAt !== b.updatedAt || a.status !== b.status
    || b.ownerUnread < a.ownerUnread || a.visitorUnread !== b.visitorUnread
}

export async function ownerReadAtOf(conversationId: string): Promise<string | null> {
  const [row] = await db.select({ at: sql<Date | null>`max(${chatMessages.readAt})` }).from(chatMessages)
    .where(and(eq(chatMessages.conversationId, conversationId), eq(chatMessages.sender, 'visitor')))
  const at = row?.at
  if (!at) return null
  return (at instanceof Date ? at : new Date(at)).toISOString()
}

/** Höchstens alle 20 s schreiben (Polling alle 3 s wäre sonst ein UPDATE je Poll). */
export async function touchVisitorSeen(conversationId: string): Promise<void> {
  await db.update(chatConversations).set({ visitorLastSeenAt: new Date() })
    .where(and(
      eq(chatConversations.id, conversationId),
      or(isNull(chatConversations.visitorLastSeenAt), lt(chatConversations.visitorLastSeenAt, new Date(Date.now() - 20_000))),
    ))
}

export async function touchOwnerSeen(conversationId: string): Promise<void> {
  await db.update(chatConversations).set({ ownerLastSeenAt: new Date() }).where(eq(chatConversations.id, conversationId))
}

// ─── Gespräche anlegen / Besucherprofil ───────────────────────────────────────

export async function createConversation(input: {
  siteId: string
  userId: string
  tokenHash: string
  ipHash: string | null
  userAgent: string | null
  startedOnPath: string | null
}): Promise<ChatConversationRow> {
  // Code-Kollision je Seite ist bei 31^8 Möglichkeiten praktisch ausgeschlossen – trotzdem einmal neu würfeln
  for (let attempt = 0; ; attempt++) {
    try {
      const [row] = await db.insert(chatConversations).values({
        siteId: input.siteId,
        userId: input.userId,
        visitorTokenHash: input.tokenHash,
        visitorKey: visitorKeyFromHash(input.tokenHash),
        ipHash: input.ipHash,
        userAgent: input.userAgent,
        startedOnPath: input.startedOnPath,
        resumeCode: generateResumeCode(),
      }).returning()
      return row
    } catch (err) {
      if (!isUniqueViolation(err)) throw err
      const existing = await findConversationByToken(input.siteId, input.tokenHash)
      if (existing) return existing
      if (attempt >= 2) throw err
    }
  }
}

// ─── Gesprächs-Code (Besucher öffnet das Gespräch auf einem anderen Gerät) ────

/** Code eines Gesprächs; Altbestand ohne Code bekommt hier einen. Rückgabe formatiert („7K4M-2P9X“). */
export async function ensureResumeCode(conv: ChatConversationRow): Promise<string> {
  if (conv.resumeCode) return formatResumeCode(conv.resumeCode)!
  const code = await rotateResumeCode(conv.id)
  conv.resumeCode = code.replace('-', '')
  return code
}

/** Neuer Code (Betreiber: „Neuen Code erzeugen“, z. B. nach versehentlichem Weitergeben). Formatiert. */
export async function rotateResumeCode(conversationId: string): Promise<string> {
  for (let attempt = 0; ; attempt++) {
    const code = generateResumeCode()
    try {
      await db.update(chatConversations).set({ resumeCode: code }).where(eq(chatConversations.id, conversationId))
      return formatResumeCode(code)!
    } catch (err) {
      if (!isUniqueViolation(err) || attempt >= 2) throw err
    }
  }
}

/** Code noch gültig? Nicht gesperrt und letzte Nachricht (sonst Anlage) jünger als RESUME_CODE_DAYS. */
export function isResumeCodeValid(conv: ChatConversationRow, now = Date.now()): boolean {
  if (conv.status === 'blocked') return false
  const last = (conv.lastMessageAt ?? conv.createdAt).getTime()
  return now - last < RESUME_CODE_DAYS * 86_400_000
}

export async function findConversationByResumeCode(siteId: string, code: string): Promise<ChatConversationRow | null> {
  const row = await db.query.chatConversations.findFirst({
    where: and(eq(chatConversations.siteId, siteId), eq(chatConversations.resumeCode, code)),
  })
  return row ?? null
}

/**
 * Hängt den Browser (Token-Hash) als weiteren Zugang an das Gespräch (Alias in chat_visitor_tokens) –
 * gemeinsamer Kern von Resume-/Übergabe-Link und Gesprächs-Code. Kennt der Browser das Gespräch schon,
 * passiert nichts. Rückgabe: true, wenn ein neuer Zugang entstanden ist.
 */
export async function attachVisitorToken(conv: ChatConversationRow, newTokenHash: string): Promise<boolean> {
  return await db.transaction(async (tx) => attachVisitorTokenTx(tx, conv, newTokenHash))
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

async function attachVisitorTokenTx(tx: Tx, conv: ChatConversationRow, newTokenHash: string): Promise<boolean> {
  if (conv.visitorTokenHash === newTokenHash) return false
  const [known] = await tx.select({ id: chatVisitorTokens.conversationId }).from(chatVisitorTokens)
    .where(eq(chatVisitorTokens.tokenHash, newTokenHash)).limit(1)
  if (known && known.id === conv.id) return false
  // Ein anderes (frisches) Gespräch dieses Browsers auf derselben Seite darf den Platz nicht blockieren
  const [clash] = await tx.select({ id: chatConversations.id }).from(chatConversations)
    .where(and(eq(chatConversations.siteId, conv.siteId), eq(chatConversations.visitorTokenHash, newTokenHash))).limit(1)
  if (clash && clash.id !== conv.id) {
    await tx.update(chatConversations)
      .set({ visitorTokenHash: sha256(`orphan:${randomBytes(16).toString('hex')}`), updatedAt: new Date() })
      .where(eq(chatConversations.id, clash.id))
  }
  // Ein Token zeigt immer auf genau ein Gespräch
  await tx.insert(chatVisitorTokens)
    .values({ tokenHash: newTokenHash, conversationId: conv.id, lastUsedAt: new Date() })
    .onConflictDoUpdate({ target: chatVisitorTokens.tokenHash, set: { conversationId: conv.id, lastUsedAt: new Date() } })
  await tx.update(chatConversations).set({ updatedAt: new Date() }).where(eq(chatConversations.id, conv.id))
  return true
}

/**
 * Hinweiszeile im Verlauf (sender 'system'), z. B. „Gespräch auf einem weiteren Gerät geöffnet.“
 * Zählt nicht als ungelesen, ändert keine Vorschau, löst keinen Push aus – nur Transparenz für beide Seiten.
 */
/**
 * Systemzeile (z. B. „Gespräch auf einem weiteren Gerät geöffnet.“): kein Ungelesen-Zähler, keine Vorschau, kein Push,
 * aber updated_at wird gesetzt, damit offene Long-Polls (Widget, App) sofort statt erst nach ≤ 25 s antworten.
 */
export async function addSystemMessage(conversationId: string, body: string): Promise<ChatMessageRow> {
  const [row] = await db.insert(chatMessages).values({ conversationId, sender: 'system', body }).returning()
  await db.update(chatConversations).set({ updatedAt: new Date() }).where(eq(chatConversations.id, conversationId))
  return row
}

export async function updateVisitorProfile(conversationId: string, patch: {
  name?: string | null
  email?: string | null
  phone?: string | null
  notifyByEmail?: boolean
}): Promise<ChatConversationRow | null> {
  const set: Partial<typeof chatConversations.$inferInsert> = { updatedAt: new Date() }
  if (patch.name !== undefined) set.visitorName = patch.name
  if (patch.email !== undefined) set.visitorEmail = patch.email
  if (patch.phone !== undefined) set.visitorPhone = patch.phone
  if (patch.notifyByEmail !== undefined) set.notifyByEmail = patch.notifyByEmail
  const [row] = await db.update(chatConversations).set(set).where(eq(chatConversations.id, conversationId)).returning()
  return row ?? null
}

export async function setConversationStatus(conversationId: string, status: 'open' | 'archived' | 'blocked'): Promise<void> {
  await db.update(chatConversations).set({ status, updatedAt: new Date() }).where(eq(chatConversations.id, conversationId))
}

export async function deleteConversation(conversationId: string): Promise<void> {
  await db.delete(chatConversations).where(eq(chatConversations.id, conversationId))
}

export async function markReported(conversationId: string, reason: string): Promise<void> {
  await db.update(chatConversations).set({ reportedAt: new Date(), reportReason: reason.slice(0, 600), updatedAt: new Date() })
    .where(eq(chatConversations.id, conversationId))
}

// ─── Sperren ──────────────────────────────────────────────────────────────────

export async function isBlocked(userId: string, tokenHash: string | null, ipHash: string | null): Promise<boolean> {
  const conds = []
  if (tokenHash) conds.push(eq(chatBlocks.visitorTokenHash, tokenHash))
  if (ipHash) conds.push(eq(chatBlocks.ipHash, ipHash))
  if (conds.length === 0) return false
  const [row] = await db.select({ id: chatBlocks.id }).from(chatBlocks)
    .where(and(eq(chatBlocks.userId, userId), or(...conds))).limit(1)
  return !!row
}

/** Sperrt den Besucher (Token-Hash + IP-Hash) für alle Seiten dieses Kontos; Gespräch → blocked. */
export async function blockConversation(conv: ChatConversationRow, reason: string | null): Promise<void> {
  const hashes = await tokenHashesOf(conv)
  await db.insert(chatBlocks).values(hashes.map((h, i) => ({
    userId: conv.userId,
    visitorTokenHash: h,
    ipHash: i === 0 ? conv.ipHash : null,
    reason: reason?.slice(0, 200) ?? null,
  })))
  await setConversationStatus(conv.id, 'blocked')
}

/** Sperre ohne Gespräch (z. B. automatische Sperre vor der ersten gespeicherten Nachricht). */
export async function blockVisitor(userId: string, tokenHash: string, ipHash: string | null, reason: string | null): Promise<void> {
  await db.insert(chatBlocks).values({ userId, visitorTokenHash: tokenHash, ipHash, reason: reason?.slice(0, 200) ?? null })
}

export async function unblockConversation(conv: ChatConversationRow): Promise<void> {
  const conds = [inArray(chatBlocks.visitorTokenHash, await tokenHashesOf(conv))]
  if (conv.ipHash) conds.push(eq(chatBlocks.ipHash, conv.ipHash))
  await db.delete(chatBlocks).where(and(eq(chatBlocks.userId, conv.userId), or(...conds)))
  await setConversationStatus(conv.id, 'open')
}

// ─── Resume-Tokens (Link aus der Antwort-Mail) ────────────────────────────────

export async function createResumeToken(conversationId: string, kind: ResumeTokenKind = 'reply'): Promise<string> {
  const raw = randomBytes(32).toString('base64url')
  const days = kind === 'reply' ? RESUME_TOKEN_DAYS : HANDOFF_TOKEN_DAYS
  await db.insert(chatResumeTokens).values({
    tokenHash: sha256(raw),
    conversationId,
    kind,
    expiresAt: new Date(Date.now() + days * 86_400_000),
  })
  return raw
}

/** Übergabe-Mails der letzten 24 Stunden (Drossel HANDOFF_MAILS_PER_DAY). */
export async function countHandoffMails(conversationId: string): Promise<number> {
  const [row] = await db.select({ n: sql<number>`count(*)::int`.mapWith(Number) }).from(chatResumeTokens)
    .where(and(
      eq(chatResumeTokens.conversationId, conversationId),
      eq(chatResumeTokens.kind, 'handoff_mail'),
      gt(chatResumeTokens.createdAt, new Date(Date.now() - 86_400_000)),
    ))
  return row?.n ?? 0
}

/**
 * Löst einen Resume-/Übergabe-Token ein: der neue Besucher-Token wird als weiterer Zugang (Alias) an das
 * Gespräch gehängt – der bisherige Browser behält seinen Zugang (Instagram-Browser UND Safari kennen das
 * Gespräch). Der Token ist danach verbraucht. Gibt null zurück bei unbekanntem/abgelaufenem/benutztem
 * Token oder wenn das Gespräch nicht zu dieser Seite gehört. `attached` = dieser Browser ist neu dazugekommen.
 */
export async function consumeResumeToken(rawToken: string, siteId: string, newTokenHash: string): Promise<{ conv: ChatConversationRow; attached: boolean } | null> {
  const tokenHash = sha256(rawToken)
  return await db.transaction(async (tx) => {
    const [t] = await tx.select().from(chatResumeTokens)
      .where(and(eq(chatResumeTokens.tokenHash, tokenHash), isNull(chatResumeTokens.usedAt), gt(chatResumeTokens.expiresAt, new Date())))
      .for('update').limit(1)
    if (!t) return null
    const [conv] = await tx.select().from(chatConversations).where(eq(chatConversations.id, t.conversationId)).for('update').limit(1)
    if (!conv || conv.siteId !== siteId) return null

    const attached = await attachVisitorTokenTx(tx, conv, newTokenHash)
    await tx.update(chatResumeTokens).set({ usedAt: new Date() }).where(eq(chatResumeTokens.tokenHash, tokenHash))
    const [fresh] = await tx.select().from(chatConversations).where(eq(chatConversations.id, conv.id)).limit(1)
    return fresh ? { conv: fresh, attached } : null
  })
}

/**
 * Adresse eines Übergabe-Links: dieselbe Seite (Host der Anfrage), derselbe Pfad, `?fs_chat=<token>`.
 * Alte fs_chat-/unsubscribe-Parameter werden entfernt, Fragment verworfen.
 */
export function handoffUrl(host: string, path: string | null, token: string): string {
  const u = new URL(path || '/', `https://${host}`)
  u.searchParams.delete('fs_chat')
  u.searchParams.delete('unsubscribe')
  u.searchParams.set('fs_chat', token)
  u.hash = ''
  return u.toString()
}

// ─── Aufbewahrung (Cron) ──────────────────────────────────────────────────────

export async function cleanupChat(): Promise<{ conversations: number; tokens: number; blocks: number }> {
  const now = Date.now()
  const convCutoff = new Date(now - RETENTION_DAYS * 86_400_000)
  const blockCutoff = new Date(now - BLOCK_RETENTION_DAYS * 86_400_000)
  const [convs, tokens, blocks] = await Promise.all([
    db.delete(chatConversations)
      .where(sql`coalesce(${chatConversations.lastMessageAt}, ${chatConversations.createdAt}) < ${convCutoff.toISOString()}::timestamptz`)
      .returning({ id: chatConversations.id }),
    db.delete(chatResumeTokens)
      .where(or(lt(chatResumeTokens.expiresAt, new Date(now)), lt(chatResumeTokens.usedAt, new Date(now - 86_400_000)))!)
      .returning({ h: chatResumeTokens.tokenHash }),
    db.delete(chatBlocks).where(lt(chatBlocks.createdAt, blockCutoff)).returning({ id: chatBlocks.id }),
  ])
  return { conversations: convs.length, tokens: tokens.length, blocks: blocks.length }
}

// ─── Admin ────────────────────────────────────────────────────────────────────

export async function listReportedConversations(limit = 100): Promise<Array<ConversationWithSite & { ownerEmail: string; messages: ChatMessageRow[] }>> {
  const rows = await db.select({ ...conversationSelect, ownerEmail: users.email })
    .from(chatConversations)
    .innerJoin(userSites, eq(chatConversations.siteId, userSites.id))
    .innerJoin(templates, eq(userSites.templateId, templates.id))
    .innerJoin(users, eq(chatConversations.userId, users.id))
    .where(sql`${chatConversations.reportedAt} is not null`)
    .orderBy(desc(chatConversations.reportedAt))
    .limit(limit)
  if (rows.length === 0) return []
  const ids = rows.map(r => r.conv.id)
  const msgs = await db.select().from(chatMessages)
    .where(inArray(chatMessages.conversationId, ids))
    .orderBy(desc(chatMessages.createdAt))
  const byConv = new Map<string, ChatMessageRow[]>()
  for (const m of msgs) {
    const list = byConv.get(m.conversationId) ?? []
    if (list.length < 20) list.push(m)
    byConv.set(m.conversationId, list)
  }
  return rows.map(r => ({ ...r, messages: (byConv.get(r.conv.id) ?? []).reverse() }))
}
