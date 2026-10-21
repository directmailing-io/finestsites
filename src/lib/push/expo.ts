/**
 * Expo Push API über einfaches fetch (keine neue Abhängigkeit).
 * Doku: https://docs.expo.dev/push-notifications/sending-notifications/
 */
import { expoAccessToken, expoReceiptsUrl, expoSendUrl } from './config'

export type ExpoMessage = {
  to: string
  title: string
  body: string
  data?: Record<string, unknown>
  sound?: 'default' | null
  priority?: 'default' | 'normal' | 'high'
  channelId?: string
  ttl?: number
  badge?: number
}

export type ExpoTicket =
  | { status: 'ok'; id: string }
  | { status: 'error'; message?: string; details?: { error?: string } }

export type ExpoReceipt =
  | { status: 'ok' }
  | { status: 'error'; message?: string; details?: { error?: string } }

function headers(): HeadersInit {
  const h: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  }
  const token = expoAccessToken()
  if (token) h.Authorization = `Bearer ${token}`
  return h
}

/** Sendet bis zu 100 Nachrichten. Liefert je Nachricht ein Ticket (gleiche Reihenfolge). */
export async function sendExpoChunk(messages: ExpoMessage[], timeoutMs = 15_000): Promise<ExpoTicket[]> {
  if (messages.length === 0) return []
  if (messages.length > 100) throw new Error('push: höchstens 100 Nachrichten je Anfrage')
  const res = await fetch(expoSendUrl(), {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(messages),
    signal: AbortSignal.timeout(timeoutMs),
  })
  const json = await res.json().catch(() => null) as { data?: ExpoTicket[]; errors?: { message?: string }[] } | null
  if (!res.ok || !json || !Array.isArray(json.data)) {
    const msg = json?.errors?.map(e => e.message).join('; ') || `HTTP ${res.status}`
    throw new Error(`push: Expo-Versand fehlgeschlagen: ${msg}`)
  }
  if (json.data.length !== messages.length) throw new Error('push: Expo lieferte unerwartete Ticketanzahl')
  return json.data
}

export async function getExpoReceipts(ids: string[], timeoutMs = 15_000): Promise<Record<string, ExpoReceipt>> {
  if (ids.length === 0) return {}
  const res = await fetch(expoReceiptsUrl(), {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ ids }),
    signal: AbortSignal.timeout(timeoutMs),
  })
  const json = await res.json().catch(() => null) as { data?: Record<string, ExpoReceipt> } | null
  if (!res.ok || !json?.data) throw new Error(`push: Expo-Empfangsbestätigungen fehlgeschlagen (HTTP ${res.status})`)
  return json.data
}
