/**
 * Freigabe des Support-Zugriffs durch den Kontoinhaber (gemeinsam für Web und App).
 *
 *   /api/impersonate/approve, /api/impersonate/reject  (Web, Antworten unverändert)
 *   /api/app/v1/impersonation                         (App)
 *
 * Regeln wie bisher: Freigeben nur, solange die Anfrage 'pending' und nicht abgelaufen ist;
 * Ablehnen geht für jede eigene Anfrage.
 */
import { db } from '@/lib/db'
import { impersonationRequests, users } from '@/lib/db/schema'
import { and, desc, eq, gt } from 'drizzle-orm'

/** Offene, nicht abgelaufene Anfrage freigeben. false = nicht gefunden oder abgelaufen. */
export async function approveImpersonationRequest(userId: string, token: string): Promise<boolean> {
  const record = await db.query.impersonationRequests.findFirst({
    where: and(
      eq(impersonationRequests.token, token),
      eq(impersonationRequests.userId, userId),
      eq(impersonationRequests.status, 'pending'),
      gt(impersonationRequests.expiresAt, new Date()),
    ),
  })
  if (!record) return false

  await db.update(impersonationRequests)
    .set({ status: 'approved', approvedAt: new Date() })
    .where(eq(impersonationRequests.id, record.id))
  return true
}

/** Eigene Anfrage ablehnen. false = nicht gefunden. */
export async function rejectImpersonationRequest(userId: string, token: string): Promise<boolean> {
  const record = await db.query.impersonationRequests.findFirst({
    where: and(
      eq(impersonationRequests.token, token),
      eq(impersonationRequests.userId, userId),
    ),
  })
  if (!record) return false

  await db.update(impersonationRequests)
    .set({ status: 'rejected' })
    .where(eq(impersonationRequests.id, record.id))
  return true
}

export type ImpersonationView = {
  token: string
  status: 'pending' | 'approved' | 'active' | 'ended' | 'rejected' | 'expired'
  adminName: string
  expiresAt: Date
}

async function adminNameOf(adminId: string): Promise<string> {
  const admin = await db.query.users.findFirst({
    where: eq(users.id, adminId),
    columns: { username: true, firstName: true, lastName: true },
  })
  return admin?.username
    ? `@${admin.username}`
    : [admin?.firstName, admin?.lastName].filter(Boolean).join(' ') || 'Admin'
}

function view(record: typeof impersonationRequests.$inferSelect, adminName: string): ImpersonationView {
  const expired = record.expiresAt < new Date()
  const s = record.status
  const status: ImpersonationView['status'] =
    expired && (s === 'pending' || s === 'approved' || s === 'active') ? 'expired'
      : s === 'pending' || s === 'approved' || s === 'active' || s === 'ended' || s === 'rejected' ? s
        : 'expired'
  return { token: record.token, status, adminName, expiresAt: record.expiresAt }
}

/**
 * Stand für die App: mit `token` genau diese eigene Anfrage (null = unbekannt), sonst die neueste
 * noch laufende Anfrage (pending/approved/active, nicht abgelaufen) wie /api/impersonate/stream.
 */
export async function impersonationViewForUser(userId: string, token?: string): Promise<ImpersonationView | null> {
  if (token) {
    const record = await db.query.impersonationRequests.findFirst({
      where: and(eq(impersonationRequests.token, token), eq(impersonationRequests.userId, userId)),
    })
    if (!record) return null
    return view(record, await adminNameOf(record.adminId))
  }
  const record = await db.query.impersonationRequests.findFirst({
    where: eq(impersonationRequests.userId, userId),
    orderBy: [desc(impersonationRequests.createdAt)],
  })
  if (!record) return null
  const v = view(record, await adminNameOf(record.adminId))
  return v.status === 'pending' || v.status === 'approved' || v.status === 'active' ? v : null
}
