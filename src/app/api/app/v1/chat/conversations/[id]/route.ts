/**
 * GET    /api/app/v1/chat/conversations/[id] — Gespräch + letzte 100 Nachrichten (älteste zuerst); setzt owner_last_seen_at
 * DELETE /api/app/v1/chat/conversations/[id] — Gespräch + Nachrichten endgültig löschen
 */
import { appJson } from '@/lib/app-api/http'
import { requireChatUser, requireOwnedConversation, type RouteParams } from '@/lib/chat/owner'
import { deleteConversation, listMessages, toContractConversation, toContractMessage, touchOwnerSeen } from '@/lib/chat/service'
import { ChatConversationResponse, ChatOkResponse } from '@/lib/contracts/app-v1/chat'

export const dynamic = 'force-dynamic'

export async function GET(req: Request, { params }: RouteParams) {
  const auth = await requireChatUser(req, 'chat-get')
  if (auth.response) return auth.response
  const { id } = await params
  const owned = await requireOwnedConversation(id, auth.user.id)
  if (owned.response) return owned.response

  const [{ messages, hasMore }] = await Promise.all([listMessages(id, { limit: 100 }), touchOwnerSeen(id)])
  return appJson(ChatConversationResponse, {
    conversation: toContractConversation(owned.row),
    messages: messages.map(m => toContractMessage(m, 'owner')),
    hasMore,
  })
}

export async function DELETE(req: Request, { params }: RouteParams) {
  const auth = await requireChatUser(req, 'chat-delete', 30)
  if (auth.response) return auth.response
  const { id } = await params
  const owned = await requireOwnedConversation(id, auth.user.id)
  if (owned.response) return owned.response
  await deleteConversation(id)
  return appJson(ChatOkResponse, { ok: true })
}
