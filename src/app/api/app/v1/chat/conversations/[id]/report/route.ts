/**
 * POST /api/app/v1/chat/conversations/[id]/report { reason, note?, block=true }
 * Meldet das Gespräch an FinestSites (Mail an info@finestsites.io mit den letzten 20 Nachrichten),
 * speichert reported_at/report_reason und sperrt den Besucher, wenn gewünscht.
 */
import { appJson, readJson } from '@/lib/app-api/http'
import { requireChatUser, requireOwnedConversation, type RouteParams } from '@/lib/chat/owner'
import { blockConversation, getConversationForOwner, listMessages, markReported, siteHostOf, toContractConversation } from '@/lib/chat/service'
import { sendChatReportMail } from '@/lib/chat/notify'
import { ChatOkResponse, ReportChatRequest } from '@/lib/contracts/app-v1/chat'

export const dynamic = 'force-dynamic'

export async function POST(req: Request, { params }: RouteParams) {
  const auth = await requireChatUser(req, 'chat-report', 20)
  if (auth.response) return auth.response
  const { id } = await params
  const owned = await requireOwnedConversation(id, auth.user.id)
  if (owned.response) return owned.response
  const body = await readJson(req, ReportChatRequest)
  if (body.response) return body.response
  const { reason, note, block } = body.data
  const conv = owned.row.conv

  await markReported(id, note ? `${reason}: ${note}` : reason)
  const blocked = block || conv.status === 'blocked'
  if (block && conv.status !== 'blocked') await blockConversation(conv, `Gemeldet: ${reason}`)

  const { messages } = await listMessages(id, { limit: 20 })
  void sendChatReportMail({
    conversation: conv,
    reason,
    note: note ?? null,
    blocked,
    ownerEmail: auth.user.email,
    ownerUsername: owned.row.username,
    siteTitle: owned.row.siteTitle,
    siteHost: siteHostOf(owned.row),
    messages,
  })

  const fresh = await getConversationForOwner(id, auth.user.id)
  return appJson(ChatOkResponse, { ok: true, conversation: fresh ? toContractConversation(fresh) : undefined })
}
