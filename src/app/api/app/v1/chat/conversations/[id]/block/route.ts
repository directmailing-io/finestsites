/** POST /api/app/v1/chat/conversations/[id]/block { reason? } — Besucher (Kennung + IP-Hash) für alle Seiten des Kontos sperren. */
import { appJson, readJson } from '@/lib/app-api/http'
import { requireChatUser, requireOwnedConversation, type RouteParams } from '@/lib/chat/owner'
import { blockConversation, getConversationForOwner, toContractConversation } from '@/lib/chat/service'
import { BlockChatVisitorRequest, ChatOkResponse } from '@/lib/contracts/app-v1/chat'

export const dynamic = 'force-dynamic'

export async function POST(req: Request, { params }: RouteParams) {
  const auth = await requireChatUser(req, 'chat-block', 30)
  if (auth.response) return auth.response
  const { id } = await params
  const owned = await requireOwnedConversation(id, auth.user.id)
  if (owned.response) return owned.response

  let reason: string | null = null
  if ((req.headers.get('content-length') ?? '0') !== '0') {
    const body = await readJson(req, BlockChatVisitorRequest)
    if (body.response) return body.response
    reason = body.data.reason || null
  }
  if (owned.row.conv.status !== 'blocked') await blockConversation(owned.row.conv, reason)
  const fresh = await getConversationForOwner(id, auth.user.id)
  return appJson(ChatOkResponse, { ok: true, conversation: fresh ? toContractConversation(fresh) : undefined })
}
