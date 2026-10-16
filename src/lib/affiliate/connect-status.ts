import type Stripe from 'stripe'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getStripe } from '@/lib/stripe/client'

/**
 * Ein Partner gilt als "eingerichtet" (affiliate_onboarded), wenn Stripe Auszahlungen
 * erlaubt, alle Angaben eingereicht sind und das Konto nicht gesperrt ist.
 * Reine Funktion – auch für account.updated-Events nutzbar.
 */
export function isConnectAccountOnboarded(account: Pick<Stripe.Account, 'payouts_enabled' | 'details_submitted' | 'requirements'>): boolean {
  return !!account.payouts_enabled && !!account.details_submitted && !account.requirements?.disabled_reason
}

/**
 * Gleicht users.affiliate_onboarded mit dem echten Stripe-Status ab.
 * Schreibt nur, wenn sich etwas geändert hat. Fehler → null (Aufrufer behält alten Stand).
 */
export async function syncConnectStatus(
  userId: string,
  accountId: string,
  known?: { current?: boolean | null; account?: Stripe.Account },
): Promise<boolean | null> {
  try {
    const account = known?.account ?? await getStripe().accounts.retrieve(accountId)
    const onboarded = isConnectAccountOnboarded(account)
    if (known?.current !== onboarded) {
      await db.update(users)
        .set({ affiliateOnboarded: onboarded })
        .where(eq(users.id, userId))
    }
    return onboarded
  } catch (err) {
    console.error('[affiliate/connect-status] sync failed:', err instanceof Error ? err.message : err)
    return null
  }
}
