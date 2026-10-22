/** POST /api/app/v1/chat/conversations/[id]/unblock — Sperre aufheben, Gespräch wieder offen. */
import { appJson } from '@/lib/app-api/http'
import { requireChatUser, requireOwnedConversation, type RouteParams } from '@/lib/chat/owner'
import { getConversationForOwner, toContractConversation, unblockConversation } from '@/lib/chat/service'
import { ChatOkResponse } from '@/lib/contracts/app-v1/chat'

export const dynamic = 'force-dynamic'

export async function POST(req: Request, { params }: RouteParams) {
  const auth = await requireChatUser(req, 'chat-block', 30)
  if (auth.response) return auth.response
  const { id } = await params
  const owned = await requireOwnedConversation(id, auth.user.id)
  if (owned.response) return owned.response
  if (owned.row.conv.status === 'blocked') await unblockConversation(owned.row.conv)
  const fresh = await getConversationForOwner(id, auth.user.id)
  return appJson(ChatOkResponse, { ok: true, conversation: fresh ? toContractConversation(fresh) : undefined })
}
