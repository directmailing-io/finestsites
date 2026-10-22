/** GET /api/app/v1/chat/unread — { count, conversations } für Badges (Polling alle 30 s). */
import { appJson } from '@/lib/app-api/http'
import { requireChatUser } from '@/lib/chat/owner'
import { ownerUnread } from '@/lib/chat/service'
import { ChatUnreadResponse } from '@/lib/contracts/app-v1/chat'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const auth = await requireChatUser(req, 'chat-unread', 240)
  if (auth.response) return auth.response
  return appJson(ChatUnreadResponse, await ownerUnread(auth.user.id))
}
