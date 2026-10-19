/**
 * Testet den KI-Antwortvorschlag gegen ein echtes Gespräch (ohne etwas zu senden).
 * Legt wie die Admin-Oberfläche einen Eintrag in support_ai_suggestions an.
 *
 * App-Server:  cd /var/www/finestsites && node --env-file=.env.production --import tsx scripts/support-ai-test.ts <conversationId|username> ["Stichpunkte"]
 * Lokal:       node --env-file=.env.local --import tsx scripts/support-ai-test.ts <conversationId|username>
 */
import { db } from '@/lib/db'
import { supportConversations, users } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import { generateSuggestion } from '@/lib/support/ai-suggest'

async function main() {
  const arg = process.argv[2]
  const hint = process.argv[3] ?? ''
  if (!arg) throw new Error('conversationId oder Benutzername angeben')

  let conv = /^[0-9a-f-]{36}$/i.test(arg)
    ? await db.query.supportConversations.findFirst({ where: eq(supportConversations.id, arg) })
    : null
  if (!conv) {
    const u = await db.query.users.findFirst({ where: eq(users.username, arg), columns: { id: true } })
    if (!u) throw new Error('Gespräch/Benutzer nicht gefunden')
    conv = await db.query.supportConversations.findFirst({ where: eq(supportConversations.userId, u.id), orderBy: desc(supportConversations.lastMessageAt) })
  }
  if (!conv) throw new Error('Kein Gespräch gefunden')
  const admin = await db.query.users.findFirst({ where: eq(users.isAdmin, true), columns: { id: true } })
  if (!admin) throw new Error('Kein Admin')

  const r = await generateSuggestion({ conversationId: conv.id, userId: conv.userId, adminId: admin.id, hint })
  console.log(`Modell ${r.model} · ${r.durationMs} ms · prompt ${r.usage.promptTokens} (cached ${r.usage.cachedTokens}) · out ${r.usage.completionTokens} · ≈ ${r.costCents} ct\n`)
  console.log(r.text)
  process.exit(0)
}
main().catch(e => { console.error(e); process.exit(1) })
