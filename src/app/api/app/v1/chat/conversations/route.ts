/**
 * GET /api/app/v1/chat/conversations?status=open|archived|blocked&q=&cursor=&limit=
 * Liste der Besucher-Gespräche (neueste Aktivität zuerst) + unreadTotal.
 */
import { appError, appJson } from '@/lib/app-api/http'
import { requireChatUser } from '@/lib/chat/owner'
import { listConversationsForOwner, ownerUnread, toContractConversation } from '@/lib/chat/service'
import { ChatConversationsQuery, ChatConversationsResponse } from '@/lib/contracts/app-v1/chat'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const auth = await requireChatUser(req, 'chat-list')
  if (auth.response) return auth.response

  const sp = new URL(req.url).searchParams
  const q = ChatConversationsQuery.safeParse({
    status: sp.get('status') ?? undefined,
    q: sp.get('q') ?? undefined,
    cursor: sp.get('cursor') ?? undefined,
    limit: sp.get('limit') ?? undefined,
  })
  if (!q.success) return appError('VALIDATION_FAILED')

  const [{ rows, nextCursor }, unread] = await Promise.all([
    listConversationsForOwner(auth.user.id, q.data),
    ownerUnread(auth.user.id),
  ])
  const now = Date.now()
  return appJson(ChatConversationsResponse, {
    conversations: rows.map(r => toContractConversation(r, now)),
    nextCursor,
    unreadTotal: unread.count,
  })
}
