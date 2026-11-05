/**
 * Besucher-Nachrichten (Widget: /.finestsites/chat/messages)
 *
 * GET  ?after=<messageId>[&wait=1..25]  Polling → { messages, status, ownerLastSeenAt, ownerReadAt }; setzt visitor_last_seen_at
 *      wait = Long-Polling: Antwort erst bei Änderung (neue Nachricht, Lesebestätigung, Status) oder nach wait Sekunden
 * POST { body, clientId?, pageUrl? } → { message, conversationId }
 *      Erste Nachricht ohne bekanntes Gespräch legt eines an (Token Pflicht).
 *      422 MESSAGE_REJECTED (Filter), 429 RATE_LIMITED, 403 TICKET_REQUIRED | TICKET_INVALID, 400 TOKEN_REQUIRED
 *      `cf` = Turnstile-Token (nur für die erste Nachricht eines neuen Gesprächs, src/lib/chat/turnstile.ts)
 *      Unsichtbare Sperre (05.11.2026): Gesperrte bekommen nie 403 BLOCKED, ihre Nachrichten landen still im
 *      gesperrten Gespräch – keine Mitteilung, kein Zähler beim Betreiber.
 *      Spam-Schutz: Ticket aus `session` Pflicht, Honigtopf `hp`, `wd` (navigator.webdriver) → engere Grenzen,
 *      Gespräche je Seite begrenzt, automatische Sperre nach wiederholt abgelehnten Nachrichten.
 */
import type { NextRequest } from 'next/server'
import { resolveVisitor, visibleStatus, visitorError, visitorJson } from '@/lib/chat/visitor'
import {
  blockConversation, blockVisitor, conversationSnapshot, createConversation, findConversationByToken, findMessageByClientId, listMessages, noteVisitorIp, ownerReadAtOf, pathOf, recentBodies, recordMessage, silenceConversation, snapshotChanged,
  toContractMessage, touchVisitorSeen, formatResumeCode,
} from '@/lib/chat/service'
import { checkChatMessage, CHAT_REJECT_MESSAGE } from '@/lib/chat/filter'
import { allowNewConversation, allowNewConversationForSite, checkMessageRate, countRejection } from '@/lib/chat/rate-limit'
import { randomUUID } from 'node:crypto'
import { pushTriggers } from '@/lib/push/triggers'
import { verifyTurnstile } from '@/lib/chat/turnstile'
import type { ChatMessageRow } from '@/lib/db/schema'

export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const LONGPOLL_MAX_S = 25
const LONGPOLL_STEP_MS = 2000
export const maxDuration = 30

/** Antwort für Honigtopf-Treffer: sieht aus wie Erfolg, es wird nichts gespeichert und niemand benachrichtigt. */
function fakeAccepted(text: string, clientId: string | null) {
  const now = new Date().toISOString()
  return { message: { id: randomUUID(), conversationId: randomUUID(), sender: 'visitor', body: text.slice(0, 2000), createdAt: now, readAt: null, clientId }, conversationId: null }
}

export async function GET(req: NextRequest) {
  const r = await resolveVisitor(req)
  if (!r.ok) return r.response
  const { h, site } = r.ctx
  if (!h.tokenHash) return visitorJson({ messages: [], status: null, ownerLastSeenAt: null, ownerReadAt: null })

  let conv = await findConversationByToken(site.siteId, h.tokenHash)
  if (!conv) return visitorJson({ messages: [], status: null, ownerLastSeenAt: null, ownerReadAt: null })

  const afterRaw = req.nextUrl.searchParams.get('after') ?? ''
  const after = UUID_RE.test(afterRaw) ? afterRaw : undefined
  // Long-Polling (?wait=1..25): Antwort offen halten, bis sich am Gespräch etwas ändert (neue Nachricht,
  // Lesebestätigung, Status) oder die Zeit abläuft. Je Durchlauf nur ein Primärschlüssel-Lookup alle 2 s –
  // statt 20 vollen Abfragen pro Minute bei 3-s-Polling. Begrenzt auf 25 s (Cloudflare bricht bei 100 s ab).
  const waitRaw = Number(req.nextUrl.searchParams.get('wait') ?? '0')
  const waitMs = Number.isFinite(waitRaw) && waitRaw > 0 ? Math.min(waitRaw, LONGPOLL_MAX_S) * 1000 : 0
  void touchVisitorSeen(conv.id).catch(() => {})
  if (waitMs > 0) {
    const first = await conversationSnapshot(conv.id)
    const deadline = Date.now() + waitMs
    // Gibt es schon Neues seit `after`, sofort antworten
    const probe = after ? await listMessages(conv.id, { after, limit: 1 }) : { messages: [] as ChatMessageRow[] }
    if (probe.messages.length === 0 && first) {
      while (Date.now() < deadline) {
        await new Promise(r => setTimeout(r, Math.min(LONGPOLL_STEP_MS, Math.max(0, deadline - Date.now()))))
        if (req.signal.aborted) return visitorJson({ messages: [], status: visibleStatus(conv.status), ownerLastSeenAt: null, ownerReadAt: null })
        const now = await conversationSnapshot(conv.id)
        if (!now || snapshotChanged(first, now)) break
      }
    }
  }
  const [{ messages }, ownerReadAt, fresh] = await Promise.all([
    listMessages(conv.id, after ? { after, limit: 100 } : { limit: 50 }),
    ownerReadAtOf(conv.id),
    waitMs > 0 ? findConversationByToken(site.siteId, h.tokenHash) : Promise.resolve(conv),
  ])
  if (fresh) conv = fresh
  return visitorJson({
    messages: messages.map(m => toContractMessage(m, 'visitor')),
    status: visibleStatus(conv.status),
    ownerLastSeenAt: conv.ownerLastSeenAt?.toISOString() ?? null,
    ownerReadAt,
  })
}

export async function POST(req: NextRequest) {
  const r = await resolveVisitor(req, { requireTicket: true })
  if (!r.ok) return r.response
  const { h, site, blocked } = r.ctx
  if (!h.tokenHash) return visitorError('TOKEN_REQUIRED', 400)

  let body: { body?: unknown; clientId?: unknown; pageUrl?: unknown; hp?: unknown; wd?: unknown; cf?: unknown } = {}
  try { body = await req.json() } catch { body = {} }
  if (typeof body.body !== 'string') return visitorError('VALIDATION_FAILED', 400)
  const clientId = typeof body.clientId === 'string' && body.clientId.length > 0 && body.clientId.length <= 64 ? body.clientId : null

  // Honigtopf (verstecktes Feld „website“ im Widget): nur Bots füllen es → scheinbar erfolgreich, nichts gespeichert
  if (typeof body.hp === 'string' && body.hp.trim()) return visitorJson(fakeAccepted(body.body, clientId))
  // navigator.webdriver = Automatisierung: nicht blockieren (Tests, Hilfstechnik), aber enger begrenzen
  const automation = body.wd === true

  let conv = await findConversationByToken(site.siteId, h.tokenHash)

  // Idempotenz: dieselbe clientId liefert dieselbe Nachricht (vor Filter und Ratenbremse)
  if (conv && clientId) {
    const dup = await findMessageByClientId(conv.id, 'visitor', clientId)
    if (dup) return visitorJson({ message: toContractMessage(dup, 'visitor'), conversationId: conv.id })
  }

  // Filter VOR dem Anlegen eines Gesprächs (kein leeres Gespräch durch abgelehnte Nachrichten)
  const recent = conv ? await recentBodies(conv.id, 'visitor') : []
  const check = checkChatMessage(body.body, recent)
  if (!check.ok) {
    // Wer den Filter wiederholt auslöst, wird automatisch gesperrt (Konto-weit, wie „Besucher sperren“)
    if (countRejection(h.tokenHash)) {
      if (conv) await blockConversation(conv, 'automatisch: Filter mehrfach ausgelöst')
      else await blockVisitor(site.userId, h.tokenHash, h.ipHash, 'automatisch: Filter mehrfach ausgelöst', h.ipNetHash)
    }
    return visitorError('MESSAGE_REJECTED', 422, { message: CHAT_REJECT_MESSAGE })
  }

  if (!conv) {
    if (!allowNewConversation(h.ipHash)) return visitorError('RATE_LIMITED', 429)
    if (!allowNewConversationForSite(site.siteId)) return visitorError('RATE_LIMITED', 429)
    conv = await createConversation({
      siteId: site.siteId,
      userId: site.userId,
      tokenHash: h.tokenHash,
      ipHash: h.ipHash,
      ipNetHash: h.ipNetHash,
      userAgent: h.userAgent,
      startedOnPath: pathOf(body.pageUrl),
    })
    // Neues Gespräch still stellen, wenn der Besucher gesperrt ist (neue Sitzung/Inkognito aus gesperrtem Netz)
    // oder die Cloudflare-Prüfung nicht bestanden hat – vor dem Speichern der Nachricht, damit keine Mitteilung rausgeht
    const silence = blocked ? 'gesperrter Besucher (neue Sitzung)'
      : (await verifyTurnstile(body.cf)) === 'failed' ? 'Cloudflare-Prüfung nicht bestanden' : null
    if (silence && conv.status !== 'blocked') {
      await silenceConversation(conv.id, silence)
      conv = { ...conv, status: 'blocked', blockReason: silence }
    }
  } else {
    const rate = await checkMessageRate(conv.id, 'visitor', { automation })
    if (rate !== 'ok') return visitorError('RATE_LIMITED', 429)
    await noteVisitorIp(conv, h.ipHash, h.ipNetHash)
    // Gesperrt über ein anderes Gespräch (gleiches Netz), schreibt aber in einem älteren offenen weiter
    if (blocked && conv.status !== 'blocked') {
      await silenceConversation(conv.id, 'gesperrter Besucher')
      conv = { ...conv, status: 'blocked', blockReason: 'gesperrter Besucher' }
    }
  }

  const { message, created } = await recordMessage(conv, 'visitor', check.body, clientId)
  if (created && conv.status !== 'blocked') void pushTriggers.newChatMessage(conv.id)
  // resumeCode: das Widget zeigt nach der ersten Nachricht die Karte „Dein Gesprächs-Code“
  return visitorJson({ message: toContractMessage(message, 'visitor'), conversationId: conv.id, resumeCode: formatResumeCode(conv.resumeCode) })
}
