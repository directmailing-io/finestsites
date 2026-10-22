/**
 * GET  /api/app/v1/chat/conversations/[id]/messages?after=<id> | ?before=<id> — Polling bzw. Verlauf
 * POST /api/app/v1/chat/conversations/[id]/messages { body, clientId? } — Antwort des Betreibers
 *      Filter (422 VALIDATION_FAILED mit neutraler Meldung), visitor_unread+1, ggf. Antwort-Mail an den Besucher.
 */
import { appError, appJson, readJson } from '@/lib/app-api/http'
import { requireChatUser, requireOwnedConversation, type RouteParams } from '@/lib/chat/owner'
import {
  findMessageByClientId, listMessages, ownerNameOf, loadSiteContext, recentBodies, recordMessage,
  siteHostOf, toContractConversation, toContractMessage, touchOwnerSeen,
} from '@/lib/chat/service'
import { checkChatMessage, CHAT_REJECT_MESSAGE } from '@/lib/chat/filter'
import { notifyVisitorOfReply } from '@/lib/chat/notify'
import { ChatMessagesQuery, ChatMessagesResponse, SendChatMessageRequest, SendChatMessageResponse } from '@/lib/contracts/app-v1/chat'

export const dynamic = 'force-dynamic'

export async function GET(req: Request, { params }: RouteParams) {
  const auth = await requireChatUser(req, 'chat-messages', 300)
  if (auth.response) return auth.response
  const { id } = await params
  const owned = await requireOwnedConversation(id, auth.user.id)
  if (owned.response) return owned.response

  const sp = new URL(req.url).searchParams
  const q = ChatMessagesQuery.safeParse({
    after: sp.get('after') ?? undefined,
    before: sp.get('before') ?? undefined,
    limit: sp.get('limit') ?? undefined,
  })
  if (!q.success) return appError('VALIDATION_FAILED')

  const [{ messages, hasMore }] = await Promise.all([listMessages(id, q.data), touchOwnerSeen(id)])
  return appJson(ChatMessagesResponse, {
    messages: messages.map(m => toContractMessage(m, 'owner')),
    conversation: toContractConversation(owned.row),
    hasMore,
  })
}

export async function POST(req: Request, { params }: RouteParams) {
  const auth = await requireChatUser(req, 'chat-send', 60)
  if (auth.response) return auth.response
  const { id } = await params
  const owned = await requireOwnedConversation(id, auth.user.id)
  if (owned.response) return owned.response
  const conv = owned.row.conv

  const body = await readJson(req, SendChatMessageRequest)
  if (body.response) return body.response
  const clientId = body.data.clientId ?? null

  const dup = await findMessageByClientId(conv.id, 'owner', clientId)
  if (dup) return appJson(SendChatMessageResponse, { message: toContractMessage(dup, 'owner') })

  if (conv.status === 'blocked') return appError('VALIDATION_FAILED', 'Dieser Besucher ist gesperrt.', 422)

  const check = checkChatMessage(body.data.body, await recentBodies(conv.id, 'owner'))
  if (!check.ok) return appError('VALIDATION_FAILED', CHAT_REJECT_MESSAGE, 422)

  const { message, created } = await recordMessage(conv, 'owner', check.body, clientId)
  if (created) {
    const site = await loadSiteContext(conv.siteId).catch(() => null)
    if (site) {
      void notifyVisitorOfReply({ conversationId: conv.id, ownerName: ownerNameOf(site), siteHost: siteHostOf(site), body: check.body })
    }
  }
  return appJson(SendChatMessageResponse, { message: toContractMessage(message, 'owner') })
}
