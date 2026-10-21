/**
 * GET /api/app/v1/affiliate/connect/return?state=…[&refresh=1]
 *
 * Rücksprung von Stripe nach der Connect-Einrichtung aus der App. Ohne Cookie-Sitzung:
 * der signierte State (src/lib/affiliate/connect-app.ts) belegt Nutzer + Konto, zusätzlich muss
 * das Stripe-Konto beim Anlegen mit derselben user_id markiert worden sein (wie im Web-Rückweg).
 * Danach Weiterleitung auf finestsites://affiliate?connect=done|pending|refresh|error, die das
 * Apple-Anmeldefenster an die App zurückgibt.
 */
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getClientIp, rateLimit } from '@/lib/security/request'
import { verifyConnectState } from '@/lib/affiliate/connect-app'
import { isConnectAccountOnboarded } from '@/lib/affiliate/connect-status'
import { getStripe } from '@/lib/stripe/client'

export const dynamic = 'force-dynamic'

function back(result: 'done' | 'pending' | 'refresh' | 'error'): Response {
  return new Response(null, {
    status: 302,
    headers: { Location: `finestsites://affiliate?connect=${result}`, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' },
  })
}

export async function GET(req: Request) {
  if (!rateLimit('app-connect-return', getClientIp(req), 30, 60_000)) return back('error')
  const sp = new URL(req.url).searchParams
  const state = verifyConnectState(sp.get('state'))
  if (!state) return back('error')
  // Link abgelaufen → App holt einen frischen Link (POST /api/app/v1/affiliate/connect)
  if (sp.get('refresh') === '1') return back('refresh')

  try {
    const profile = await db.query.users.findFirst({ where: eq(users.id, state.userId), columns: { stripeConnectId: true } })
    if (!profile || profile.stripeConnectId !== state.accountId) return back('error')
    const account = await getStripe().accounts.retrieve(state.accountId)
    if (account.metadata?.user_id !== state.userId) return back('error')
    const onboarded = isConnectAccountOnboarded(account)
    await db.update(users).set({ affiliateOnboarded: onboarded }).where(eq(users.id, state.userId))
    return back(onboarded ? 'done' : 'pending')
  } catch (err) {
    console.error('[app/affiliate/connect/return] failed:', err instanceof Error ? err.message : err)
    return back('error')
  }
}
