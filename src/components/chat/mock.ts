/**
 * Zugriff auf die Betreiber-API des Besucher-Chats (/api/app/v1/chat/*, Cookie-Sitzung)
 * und die Admin-Endpunkte (/api/admin/chat/*).
 *
 * Mit NEXT_PUBLIC_CHAT_MOCK=1 liefert dieselbe Schnittstelle Beispieldaten (3 Gespräche,
 * Nachrichten, simulierte Besucher-Antwort) – für die lokale Entwicklung ohne Backend.
 *
 * Verträge: src/lib/contracts/app-v1/chat.ts (verbindlich).
 */
import type {
  ChatConversation,
  ChatConversationsResponse,
  ChatConversationResponse,
  ChatConversationStatus,
  ChatMessage,
  ChatMessagesResponse,
  ChatUnreadResponse,
} from '@/lib/contracts/app-v1/chat'

export type ReportReason = 'spam' | 'abuse' | 'illegal' | 'other'

export interface AdminChatSettings { enabled: boolean; users: string[] }
export interface AdminChatReport {
  conversationId: string
  username: string
  siteHost: string
  reason: ReportReason | string
  note: string | null
  reportedAt: string
  status: string
  lastMessages: { sender: 'visitor' | 'owner' | 'system'; body: string; createdAt: string }[]
}

export class ChatApiError extends Error {
  status: number
  code: string
  constructor(status: number, code: string, message?: string) {
    super(message ?? code)
    this.status = status
    this.code = code
  }
}

export interface ChatApi {
  listConversations(params: { status: ChatConversationStatus; q?: string }): Promise<ChatConversationsResponse>
  getConversation(id: string): Promise<ChatConversationResponse>
  getMessages(id: string, params: { after?: string; before?: string }): Promise<ChatMessagesResponse>
  sendMessage(id: string, body: string, clientId: string): Promise<ChatMessage>
  markRead(id: string): Promise<void>
  setArchived(id: string, archived: boolean): Promise<ChatConversation | null>
  block(id: string): Promise<ChatConversation | null>
  unblock(id: string): Promise<ChatConversation | null>
  /** Neuen Gesprächs-Code erzeugen (der alte gilt sofort nicht mehr). */
  newCode(id: string): Promise<ChatConversation | null>
  report(id: string, input: { reason: ReportReason; note?: string; block: boolean }): Promise<ChatConversation | null>
  deleteConversation(id: string): Promise<void>
  getUnread(): Promise<ChatUnreadResponse>
  // Admin
  adminGetSettings(): Promise<AdminChatSettings>
  adminSaveSettings(s: AdminChatSettings): Promise<AdminChatSettings>
  adminGetReports(): Promise<AdminChatReport[]>
}

export const CHAT_MOCK = process.env.NEXT_PUBLIC_CHAT_MOCK === '1'

// ─── Echte API ────────────────────────────────────────────────────────────────

const BASE = '/api/app/v1/chat'

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    cache: 'no-store',
    ...init,
    headers: { Accept: 'application/json', ...(init?.body ? { 'Content-Type': 'application/json' } : {}), ...(init?.headers ?? {}) },
  })
  if (!res.ok) {
    let code = `HTTP_${res.status}`
    let message: string | undefined
    try {
      const data = await res.json()
      code = data?.error?.code ?? data?.code ?? data?.error ?? code
      message = data?.error?.message ?? data?.message
    } catch { /* kein JSON */ }
    throw new ChatApiError(res.status, String(code), message)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

const realApi: ChatApi = {
  listConversations({ status, q }) {
    const p = new URLSearchParams({ status })
    if (q) p.set('q', q)
    return call(`${BASE}/conversations?${p}`)
  },
  getConversation(id) {
    return call(`${BASE}/conversations/${id}`)
  },
  getMessages(id, { after, before }) {
    const p = new URLSearchParams()
    if (after) p.set('after', after)
    if (before) p.set('before', before)
    const qs = p.toString()
    return call(`${BASE}/conversations/${id}/messages${qs ? `?${qs}` : ''}`)
  },
  async sendMessage(id, body, clientId) {
    const r = await call<{ message: ChatMessage }>(`${BASE}/conversations/${id}/messages`, {
      method: 'POST', body: JSON.stringify({ body, clientId }),
    })
    return r.message
  },
  async markRead(id) {
    await call(`${BASE}/conversations/${id}/read`, { method: 'POST' })
  },
  async setArchived(id, archived) {
    const r = await call<{ ok: true; conversation?: ChatConversation }>(
      `${BASE}/conversations/${id}/${archived ? 'archive' : 'unarchive'}`, { method: 'POST' },
    )
    return r.conversation ?? null
  },
  async block(id) {
    const r = await call<{ ok: true; conversation?: ChatConversation }>(`${BASE}/conversations/${id}/block`, {
      method: 'POST', body: JSON.stringify({}),
    })
    return r.conversation ?? null
  },
  async unblock(id) {
    const r = await call<{ ok: true; conversation?: ChatConversation }>(`${BASE}/conversations/${id}/unblock`, { method: 'POST' })
    return r.conversation ?? null
  },
  async newCode(id) {
    const r = await call<{ ok: true; conversation?: ChatConversation }>(`${BASE}/conversations/${id}/code`, { method: 'POST' })
    return r.conversation ?? null
  },
  async report(id, input) {
    const r = await call<{ ok: true; conversation?: ChatConversation }>(`${BASE}/conversations/${id}/report`, {
      method: 'POST', body: JSON.stringify(input),
    })
    return r.conversation ?? null
  },
  async deleteConversation(id) {
    await call(`${BASE}/conversations/${id}`, { method: 'DELETE' })
  },
  getUnread() {
    return call(`${BASE}/unread`)
  },
  adminGetSettings() {
    return call('/api/admin/chat/settings')
  },
  adminSaveSettings(s) {
    return call('/api/admin/chat/settings', { method: 'PUT', body: JSON.stringify(s) })
  },
  async adminGetReports() {
    const r = await call<{ reports: AdminChatReport[] }>('/api/admin/chat/reports')
    return r.reports ?? []
  },
}

// ─── Mock (NEXT_PUBLIC_CHAT_MOCK=1) ───────────────────────────────────────────

function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString()
const daysAgo = (d: number, h = 10, min = 15) => {
  const x = new Date(); x.setDate(x.getDate() - d); x.setHours(h, min, 0, 0); return x.toISOString()
}

const SITE_A = { siteId: '8d2d0e3c-5c66-4b7a-9f8e-6ab1f3d1c201', siteTitle: 'Mein Nährstoff-System', siteHost: 'demo.dailyoptimal.de' }
const SITE_B = { siteId: '1c9a7f52-2a0e-4b1a-8f2d-2f0a7c3e9b02', siteTitle: 'Business mit Anna', siteHost: 'demo.wellpreneur.io' }

function mkConv(input: {
  id: string; site: typeof SITE_A; name: string | null; email?: string | null; phone?: string | null; key: string
  status: ChatConversationStatus; online: boolean; lastSeenMin: number; createdDays: number; path?: string
}): ChatConversation {
  const displayName = input.name ?? `Besucher ${input.key}`
  const parts = displayName.split(/\s+/).filter(Boolean)
  const initials = input.name
    ? (parts.length > 1 ? parts[0][0] + parts[1][0] : parts[0].slice(0, 2)).toUpperCase()
    : input.key.slice(0, 2).toUpperCase()
  const phone = input.phone ?? null
  return {
    id: input.id,
    siteId: input.site.siteId,
    siteTitle: input.site.siteTitle,
    siteHost: input.site.siteHost,
    startedOnPath: input.path ?? '/',
    visitor: {
      name: input.name,
      email: input.email ?? null,
      phone,
      displayName,
      initials,
      whatsappUrl: phone ? `https://wa.me/${phone.replace(/[^\d]/g, '')}` : null,
      online: input.online,
      lastSeenAt: minutesAgo(input.lastSeenMin),
    },
    status: input.status,
    unread: 0,
    lastMessage: null,
    reportedAt: null,
    resumeCode: '7K4M-2P9X',
    createdAt: daysAgo(input.createdDays),
    updatedAt: minutesAgo(input.lastSeenMin),
  }
}

const C1 = 'a1f5c3e2-0d2b-4f1a-9c3e-111111111111'
const C2 = 'b2e6d4f3-1e3c-4a2b-8d4f-222222222222'
const C3 = 'c3f7e5a4-2f4d-4b3c-9e5a-333333333333'

const mockState: { conversations: ChatConversation[]; messages: Record<string, ChatMessage[]> } = {
  conversations: [
    mkConv({ id: C1, site: SITE_A, name: 'Sabine Keller', email: 'sabine.keller@example.invalid', phone: '+49 171 2345678', key: '4F2A', status: 'open', online: true, lastSeenMin: 0, createdDays: 0, path: '/#produkte' }),
    mkConv({ id: C2, site: SITE_B, name: null, key: '9B1C', status: 'open', online: false, lastSeenMin: 95, createdDays: 1, path: '/' }),
    mkConv({ id: C3, site: SITE_A, name: 'Thomas Brandt', email: 'thomas.brandt@example.invalid', key: 'E07D', status: 'open', online: false, lastSeenMin: 60 * 24 * 3, createdDays: 5, path: '/#kontakt' }),
  ],
  messages: {},
}

function mkMsg(conversationId: string, sender: ChatMessage['sender'], body: string, createdAt: string, readAt: string | null = null): ChatMessage {
  return { id: uuid(), conversationId, sender, body, createdAt, readAt, clientId: null }
}

mockState.messages[C1] = [
  mkMsg(C1, 'visitor', 'Hallo! Ich habe deine Seite gefunden und hätte eine Frage zum Nährstoff-System.', minutesAgo(26), minutesAgo(25)),
  mkMsg(C1, 'owner', 'Hallo Sabine, gern! Frag einfach los 🙂', minutesAgo(24), minutesAgo(23)),
  mkMsg(C1, 'visitor', 'Nimmt man alle drei Produkte morgens zusammen? Und gibt es dazu eine Anleitung? https://demo.dailyoptimal.de/#produkte', minutesAgo(21), minutesAgo(20)),
  mkMsg(C1, 'owner', 'Ja, morgens zusammen mit einem Glas Wasser. Eine kurze Anleitung schicke ich dir gleich als Link.', minutesAgo(18), minutesAgo(17)),
  mkMsg(C1, 'visitor', 'Super, danke dir! Dann melde ich mich, sobald ich es ausprobiert habe.', minutesAgo(3)),
  mkMsg(C1, 'visitor', 'Ach ja: Kann ich dich auch per WhatsApp erreichen?', minutesAgo(1)),
]
mockState.messages[C2] = [
  mkMsg(C2, 'visitor', 'Guten Abend, ich bin über Instagram hier gelandet. Wie läuft so ein Erstgespräch bei dir ab?', daysAgo(1, 19, 42), daysAgo(1, 19, 50)),
  mkMsg(C2, 'owner', 'Hallo! Wir telefonieren etwa 20 Minuten, ich erkläre dir alles in Ruhe. Passt dir diese Woche ein Abend?', daysAgo(1, 19, 55), daysAgo(1, 20, 1)),
  mkMsg(C2, 'visitor', 'Donnerstag ab 18 Uhr wäre gut.', daysAgo(1, 20, 3)),
]
mockState.messages[C3] = [
  mkMsg(C3, 'visitor', 'Hi, ich hatte vor ein paar Tagen das Set bestellt. Die Lieferung ist heute angekommen, vielen Dank für die schnelle Hilfe!', daysAgo(3, 9, 12), daysAgo(3, 9, 30)),
  mkMsg(C3, 'owner', 'Das freut mich, Thomas! Bei Fragen zur Einnahme schreib mir einfach.', daysAgo(3, 9, 35), daysAgo(3, 9, 40)),
]

function refreshDerived(conv: ChatConversation) {
  const msgs = mockState.messages[conv.id] ?? []
  const last = msgs[msgs.length - 1]
  conv.unread = msgs.filter(m => m.sender === 'visitor' && !m.readAt).length
  conv.lastMessage = last ? { preview: last.body.replace(/\s+/g, ' ').slice(0, 140), sender: last.sender, at: last.createdAt } : null
  conv.updatedAt = last?.createdAt ?? conv.createdAt
}
mockState.conversations.forEach(refreshDerived)

const delay = (ms = 180) => new Promise(r => setTimeout(r, ms))
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x))

const MOCK_REPLIES = [
  'Danke für die schnelle Antwort!',
  'Alles klar, das hilft mir weiter.',
  'Okay, ich schaue es mir an und melde mich wieder.',
  'Perfekt, vielen Dank 🙂',
]

const mockAdmin: AdminChatSettings = { enabled: true, users: ['demo', 'qapro'] }

const mockApi: ChatApi = {
  async listConversations({ status, q }) {
    await delay()
    const needle = (q ?? '').trim().toLowerCase()
    const rows = mockState.conversations
      .filter(c => c.status === status)
      .filter(c => !needle || c.visitor.displayName.toLowerCase().includes(needle) || (c.lastMessage?.preview ?? '').toLowerCase().includes(needle) || c.siteTitle.toLowerCase().includes(needle))
      .sort((a, b) => (b.lastMessage?.at ?? b.createdAt).localeCompare(a.lastMessage?.at ?? a.createdAt))
    const unreadTotal = mockState.conversations.filter(c => c.status === 'open').reduce((s, c) => s + c.unread, 0)
    return { conversations: clone(rows), nextCursor: null, unreadTotal }
  },
  async getConversation(id) {
    await delay()
    const conv = mockState.conversations.find(c => c.id === id)
    if (!conv) throw new ChatApiError(404, 'NOT_FOUND')
    return { conversation: clone(conv), messages: clone(mockState.messages[id] ?? []), hasMore: false }
  },
  async getMessages(id, { after }) {
    await delay(80)
    const conv = mockState.conversations.find(c => c.id === id)
    if (!conv) throw new ChatApiError(404, 'NOT_FOUND')
    const all = mockState.messages[id] ?? []
    const idx = after ? all.findIndex(m => m.id === after) : -1
    return { messages: clone(all.slice(idx + 1)), conversation: clone(conv), hasMore: false }
  },
  async sendMessage(id, body, clientId) {
    await delay(250)
    const conv = mockState.conversations.find(c => c.id === id)
    if (!conv) throw new ChatApiError(404, 'NOT_FOUND')
    if (conv.status === 'blocked') throw new ChatApiError(403, 'BLOCKED')
    if (/^fehler$/i.test(body.trim())) throw new ChatApiError(422, 'MESSAGE_REJECTED', 'Diese Nachricht kann nicht gesendet werden.')
    const existing = (mockState.messages[id] ?? []).find(m => m.clientId === clientId)
    if (existing) return clone(existing)
    const msg: ChatMessage = { id: uuid(), conversationId: id, sender: 'owner', body, createdAt: new Date().toISOString(), readAt: null, clientId }
    mockState.messages[id] = [...(mockState.messages[id] ?? []), msg]
    refreshDerived(conv)
    // Simulierte Antwort: Besucher liest nach 1,5 s, antwortet nach 4 s.
    setTimeout(() => { msg.readAt = new Date().toISOString() }, 1500)
    setTimeout(() => {
      const reply = mkMsg(id, 'visitor', MOCK_REPLIES[Math.floor(Math.random() * MOCK_REPLIES.length)], new Date().toISOString())
      mockState.messages[id] = [...(mockState.messages[id] ?? []), reply]
      conv.visitor.online = true
      conv.visitor.lastSeenAt = reply.createdAt
      refreshDerived(conv)
    }, 4000)
    return clone(msg)
  },
  async markRead(id) {
    await delay(60)
    const conv = mockState.conversations.find(c => c.id === id)
    if (!conv) return
    const now = new Date().toISOString()
    for (const m of mockState.messages[id] ?? []) if (m.sender === 'visitor' && !m.readAt) m.readAt = now
    refreshDerived(conv)
  },
  async setArchived(id, archived) {
    await delay()
    const conv = mockState.conversations.find(c => c.id === id)
    if (!conv) throw new ChatApiError(404, 'NOT_FOUND')
    conv.status = archived ? 'archived' : 'open'
    return clone(conv)
  },
  async block(id) {
    await delay()
    const conv = mockState.conversations.find(c => c.id === id)
    if (!conv) throw new ChatApiError(404, 'NOT_FOUND')
    conv.status = 'blocked'
    return clone(conv)
  },
  async unblock(id) {
    await delay()
    const conv = mockState.conversations.find(c => c.id === id)
    if (!conv) throw new ChatApiError(404, 'NOT_FOUND')
    conv.status = 'open'
    return clone(conv)
  },
  async newCode(id) {
    await delay()
    const conv = mockState.conversations.find(c => c.id === id)
    if (!conv) throw new ChatApiError(404, 'NOT_FOUND')
    const a = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
    let code = ''
    for (let i = 0; i < 8; i++) code += a[Math.floor(Math.random() * a.length)]
    conv.resumeCode = `${code.slice(0, 4)}-${code.slice(4)}`
    return clone(conv)
  },
  async report(id, input) {
    await delay(300)
    const conv = mockState.conversations.find(c => c.id === id)
    if (!conv) throw new ChatApiError(404, 'NOT_FOUND')
    conv.reportedAt = new Date().toISOString()
    if (input.block) conv.status = 'blocked'
    return clone(conv)
  },
  async deleteConversation(id) {
    await delay()
    mockState.conversations = mockState.conversations.filter(c => c.id !== id)
    delete mockState.messages[id]
  },
  async getUnread() {
    await delay(40)
    const open = mockState.conversations.filter(c => c.status === 'open' && c.unread > 0)
    return { count: open.reduce((s, c) => s + c.unread, 0), conversations: open.length }
  },
  async adminGetSettings() {
    await delay()
    return { ...mockAdmin, users: [...mockAdmin.users] }
  },
  async adminSaveSettings(s) {
    await delay(300)
    mockAdmin.enabled = s.enabled
    mockAdmin.users = [...s.users]
    return { ...mockAdmin, users: [...mockAdmin.users] }
  },
  async adminGetReports() {
    await delay()
    return [
      {
        conversationId: 'd4a8f6b5-3a5e-4c4d-8f6b-444444444444',
        username: 'demo',
        siteHost: 'demo.wellpreneur.io',
        reason: 'spam',
        note: 'Schickt immer wieder denselben Link zu einer fremden Seite.',
        reportedAt: minutesAgo(140),
        resumeCode: 'Q3WX-8HTB',
        status: 'blocked',
        lastMessages: [
          { sender: 'visitor', body: 'Schau dir mal dieses Angebot an: https://example.invalid/angebot', createdAt: minutesAgo(160) },
          { sender: 'visitor', body: 'Schau dir mal dieses Angebot an: https://example.invalid/angebot', createdAt: minutesAgo(155) },
          { sender: 'owner', body: 'Bitte keine Werbung hier.', createdAt: minutesAgo(150) },
          { sender: 'visitor', body: 'Schau dir mal dieses Angebot an: https://example.invalid/angebot', createdAt: minutesAgo(145) },
        ],
      },
      {
        conversationId: 'e5b9a7c6-4b6f-4d5e-9a7c-555555555555',
        username: 'qapro',
        siteHost: 'demo.dailyoptimal.de',
        reason: 'abuse',
        note: null,
        reportedAt: daysAgo(1, 22, 5),
        resumeCode: 'N5RK-2VYD',
        status: 'blocked',
        lastMessages: [
          { sender: 'visitor', body: 'Hallo, ist das hier seriös?', createdAt: daysAgo(1, 21, 50) },
          { sender: 'owner', body: 'Ja, gern beantworte ich deine Fragen.', createdAt: daysAgo(1, 21, 55) },
          { sender: 'visitor', body: '(beleidigende Nachricht)', createdAt: daysAgo(1, 22, 0) },
        ],
      },
    ]
  },
}

export const chatApi: ChatApi = CHAT_MOCK ? mockApi : realApi
