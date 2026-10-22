/** POST /api/app/v1/chat/conversations/[id]/unarchive — archiviertes Gespräch wieder öffnen. */
import { appError, appJson } from '@/lib/app-api/http'
import { requireChatUser, requireOwnedConversation, type RouteParams } from '@/lib/chat/owner'
import { getConversationForOwner, setConversationStatus, toContractConversation } from '@/lib/chat/service'
import { ChatOkResponse } from '@/lib/contracts/app-v1/chat'

export const dynamic = 'force-dynamic'

export async function POST(req: Request, { params }: RouteParams) {
  const auth = await requireChatUser(req, 'chat-archive', 60)
  if (auth.response) return auth.response
  const { id } = await params
  const owned = await requireOwnedConversation(id, auth.user.id)
  if (owned.response) return owned.response
  if (owned.row.conv.status === 'blocked') return appError('VALIDATION_FAILED', 'Gesperrte Gespräche zuerst entsperren.')
  await setConversationStatus(id, 'open')
  const fresh = await getConversationForOwner(id, auth.user.id)
  return appJson(ChatOkResponse, { ok: true, conversation: fresh ? toContractConversation(fresh) : undefined })
}
