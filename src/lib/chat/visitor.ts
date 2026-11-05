/**
 * Gemeinsamer Einstieg der Besucher-Routen /api/worker/chat/* (Widget → Worker → App).
 *
 * Der Worker setzt (docs/chat/konzept.md):
 *   x-worker-secret  Pflicht (checkWorkerSecret)
 *   x-fs-site-id     user_sites.id (Pflicht)
 *   x-fs-host        Hostname der Kundenseite
 *   x-fs-ip-hash     gehashte IP (nie Klartext)
 *   x-fs-ip-net-hash gehashtes Netz (IPv6: /64, IPv4: Adresse) – für Sperren, die IPv6-Adresswechsel überstehen
 *   x-fs-ua          User-Agent, gekürzt
 *   x-fs-visitor     Besucher-Token (optional; wird hier nur gehasht weiterverwendet)
 *
 * Antworten sind JSON mit `Cache-Control: no-store`; Fehler als { error: CODE, message? }.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { checkWorkerSecret } from '@/lib/tracking/worker-auth'
import { isVisitorChatEnabledForUsername } from './flags'
import { allowVisitorRequest } from './rate-limit'
import {
  ensureResumeCode, isBlocked, isValidVisitorToken, listMessages, loadSiteContext, ownerReadAtOf, sha256,
  toContractMessage, touchVisitorSeen, type ChatSiteContext, type ConversationState,
} from './service'
import { issueTicket, verifyTicket } from './ticket'
import type { ChatConversationRow } from '@/lib/db/schema'

const NO_STORE = { 'Cache-Control': 'no-store' }
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function visitorJson(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status, headers: NO_STORE })
}

export function visitorError(code: string, status: number, extra?: Record<string, unknown>): NextResponse {
  return visitorJson({ error: code, ...(extra ?? {}) }, status)
}

export type VisitorHeaders = {
  siteId: string
  host: string | null
  ipHash: string | null
  ipNetHash: string | null
  userAgent: string | null
  visitorToken: string | null
  tokenHash: string | null
  /** Ticket aus `POST session` (Header X-FS-Ticket, vom Worker als x-fs-ticket weitergereicht) */
  ticket: string | null
}

export function readVisitorHeaders(req: NextRequest): VisitorHeaders | null {
  const siteId = (req.headers.get('x-fs-site-id') ?? '').trim()
  if (!UUID_RE.test(siteId)) return null
  const rawToken = (req.headers.get('x-fs-visitor') ?? '').trim()
  const visitorToken = isValidVisitorToken(rawToken) ? rawToken : null
  const ipHash = (req.headers.get('x-fs-ip-hash') ?? '').trim().slice(0, 64) || null
  return {
    siteId,
    host: (req.headers.get('x-fs-host') ?? '').trim().toLowerCase().slice(0, 253) || null,
    ipHash,
    ipNetHash: (req.headers.get('x-fs-ip-net-hash') ?? '').trim().slice(0, 64) || null,
    userAgent: (req.headers.get('x-fs-ua') ?? '').trim().slice(0, 200) || null,
    visitorToken,
    tokenHash: visitorToken ? sha256(visitorToken) : null,
    ticket: (req.headers.get('x-fs-ticket') ?? '').trim().slice(0, 400) || null,
  }
}

export type VisitorContext = {
  h: VisitorHeaders
  site: ChatSiteContext
  enabled: boolean
  /** Besucher steht auf der Sperrliste – unsichtbare Sperre: Routen antworten normal, nichts erreicht den Betreiber */
  blocked: boolean
}

/**
 * Prüft Secret, Kopfzeilen, Ratenbremse, Seite, Freischaltung und Sperre.
 * Standard: nicht freigeschaltet → 404 { error: 'disabled' }. `config` setzt allowDisabled und entscheidet selbst.
 * Gesperrt (seit 05.11.2026, Daniel): KEIN 403 mehr – unsichtbare Sperre. ctx.blocked = true, die Routen
 * antworten wie gewohnt, Nachrichten landen still im gesperrten Gespräch (keine Mitteilung, kein Zähler).
 * Wer nichts merkt, sucht sich keinen neuen Weg (Inkognito, neue IP).
 */
export async function resolveVisitor(req: NextRequest, opts: { allowDisabled?: boolean; requireTicket?: boolean } = {}):
  Promise<{ ok: true; ctx: VisitorContext } | { ok: false; response: NextResponse }> {
  if (!checkWorkerSecret(req)) return { ok: false, response: visitorError('unauthorized', 401) }
  const h = readVisitorHeaders(req)
  if (!h) return { ok: false, response: visitorError('bad_request', 400) }
  if (!allowVisitorRequest(h.ipHash, h.tokenHash)) return { ok: false, response: visitorError('RATE_LIMITED', 429) }

  const site = await loadSiteContext(h.siteId)
  if (!site || site.siteStatus !== 'published') return { ok: false, response: visitorError('not_found', 404) }

  // Konto freigeschaltet UND Schalter dieser Seite im Editor an
  const enabled = site.visitorChatEnabled && await isVisitorChatEnabledForUsername(site.username)
  if (!enabled && !opts.allowDisabled) return { ok: false, response: visitorError('disabled', 404) }

  // Schreibende Aufrufe nur mit Ticket aus `POST session` (Spam-Schutz; docs/chat/konzept.md)
  if (opts.requireTicket) {
    const t = verifyTicket(h.ticket, h.siteId)
    if (t === 'missing') return { ok: false, response: visitorError('TICKET_REQUIRED', 403) }
    if (t !== 'ok') return { ok: false, response: visitorError('TICKET_INVALID', 403) }
  }

  const blocked = enabled && await isBlocked(site.userId, h.tokenHash, h.ipHash, h.ipNetHash)
  return { ok: true, ctx: { h, site, enabled, blocked } }
}

/** Status, den der Besucher sieht: eine Sperre bleibt unsichtbar („blocked“ → „open“). */
export function visibleStatus(status: string): ChatConversationRow['status'] {
  return status === 'blocked' ? 'open' : status
}

/** Antwort von `session`/`resume` für ein bekanntes, nicht gesperrtes Gespräch (ConversationState). */
export async function conversationState(conv: ChatConversationRow, siteId: string, visitorToken: string | null): Promise<ConversationState> {
  const [{ messages }, ownerReadAt, resumeCode] = await Promise.all([
    listMessages(conv.id, { limit: 50 }), ownerReadAtOf(conv.id), ensureResumeCode(conv), touchVisitorSeen(conv.id),
  ])
  return {
    enabled: true,
    ticket: issueTicket(siteId),
    conversationId: conv.id,
    visitorToken,
    status: visibleStatus(conv.status),
    visitor: { name: conv.visitorName, email: conv.visitorEmail, phone: conv.visitorPhone, notifyByEmail: conv.notifyByEmail },
    messages: messages.map(m => toContractMessage(m, 'visitor')),
    ownerLastSeenAt: conv.ownerLastSeenAt?.toISOString() ?? null,
    ownerReadAt,
    resumeCode,
  }
}
