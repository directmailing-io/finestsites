import { NextResponse } from 'next/server'
import { getServerUser } from '@/lib/auth/server'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getStripe } from '@/lib/stripe/client'

/**
 * Returns the authenticated user's Stripe invoices.
 *
 * Returns up to 24 most recent invoices. Each invoice has:
 *  - amount_paid (cents, includes VAT when Stripe Tax is enabled)
 *  - amount_due  (cents, includes VAT)
 *  - currency
 *  - status (paid, open, void, uncollectible, draft)
 *  - invoice_pdf — direct PDF download link (signed, time-limited)
 *  - hosted_invoice_url — full invoice viewer (signed, hostable to customer)
 *  - period_start / period_end / created (unix timestamps)
 *  - number (Stripe invoice number, e.g. "INV-2026-0042")
 */
export async function GET() {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await db.query.users.findFirst({
    where: eq(users.id, user.id),
    columns: { stripeCustomerId: true },
  })

  const customerId = profile?.stripeCustomerId
  if (!customerId) return NextResponse.json({ invoices: [] })

  try {
    const stripe = getStripe()
    const list = await stripe.invoices.list({
      customer: customerId,
      limit: 24,
    })

    const invoices = list.data
      .filter(inv => inv.status !== 'draft')
      .map(inv => ({
        id: inv.id,
        number: inv.number,
        created: inv.created,
        amount_paid: inv.amount_paid,
        amount_due: inv.amount_due,
        currency: inv.currency,
        status: inv.status,
        hosted_invoice_url: inv.hosted_invoice_url,
        invoice_pdf: inv.invoice_pdf,
        period_start: inv.period_start,
        period_end: inv.period_end,
      }))

    return NextResponse.json({ invoices })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[billing/invoices] error:', message)
    return NextResponse.json({ invoices: [], error: message }, { status: 500 })
  }
}
