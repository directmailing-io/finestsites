import { NextRequest, NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { db } from '@/lib/db'
import { users, userSites, subscriptionEvents, affiliateCommissions } from '@/lib/db/schema'
import { eq, and, inArray } from 'drizzle-orm'
import { getStripe, getPlanByPriceId, planCents, type PlanKey, type BillingInterval } from '@/lib/stripe/client'
import { getResend, FROM_EMAIL } from '@/lib/resend'
import { affiliateNewReferralEmail } from '@/lib/email/templates'

export async function POST(req: NextRequest) {
  if (!process.env.STRIPE_WEBHOOK_SECRET) throw new Error('Missing STRIPE_WEBHOOK_SECRET')

  const body = await req.text()
  const sig = req.headers.get('stripe-signature') ?? ''

  const stripe = getStripe()
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    console.error('[webhook] Invalid signature:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  // ── helpers ────────────────────────────────────────────────────────────────

  // In Stripe API 2025+, current_period_end moved from Subscription root to
  // SubscriptionItem. We read from the item first, fall back to root.
  function getPeriodEnd(sub: Stripe.Subscription): Date | null {
    const itemTs = (sub.items.data[0] as any)?.current_period_end
    const rootTs = (sub as any).current_period_end
    const ts = itemTs ?? rootTs
    return ts ? new Date(ts * 1000) : null
  }

  async function getUserIdByCustomer(customerId: string): Promise<string | null> {
    const row = await db.query.users.findFirst({
      where: eq(users.stripeCustomerId, customerId),
      columns: { id: true },
    })
    return row?.id ?? null
  }

  async function logEvent(params: {
    userId: string
    eventType: string
    plan?: string
    billingInterval?: string
    amountCents?: number
    stripeEventId: string
    stripeSubscriptionId?: string
    stripeInvoiceId?: string
    metadata?: Record<string, unknown>
  }) {
    try {
      await db.insert(subscriptionEvents).values({
        userId: params.userId,
        eventType: params.eventType,
        plan: params.plan ?? null,
        billingInterval: params.billingInterval ?? null,
        amountCents: params.amountCents ?? null,
        stripeEventId: params.stripeEventId,
        stripeSubscriptionId: params.stripeSubscriptionId ?? null,
        stripeInvoiceId: params.stripeInvoiceId ?? null,
        metadata: params.metadata ?? {},
      })
    } catch (err: any) {
      // 23505 = unique_violation (duplicate event — idempotency, safe to ignore)
      if (err?.code !== '23505') {
        console.error('[webhook] logEvent error:', err?.message ?? err)
      }
    }
  }

  // ── event handlers ─────────────────────────────────────────────────────────

  switch (event.type) {

    // ── Initial checkout completed ───────────────────────────────────────────
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      if (session.mode !== 'subscription') break

      const subscription = await stripe.subscriptions.retrieve(session.subscription as string)
      const priceId = subscription.items.data[0]?.price.id ?? ''
      const plan = getPlanByPriceId()[priceId] ?? 'starter'
      const interval = subscription.items.data[0]?.price.recurring?.interval === 'year' ? 'yearly' : 'monthly'
      const userId = session.metadata?.supabase_user_id ?? session.metadata?.user_id
      if (!userId) break

      await db.update(users).set({
        plan,
        billingInterval: interval,
        subscriptionStatus: subscription.status,
        stripeSubscriptionId: subscription.id,
        currentPeriodEnd: getPeriodEnd(subscription),
        paymentFailedAt: null,
        deactivatedAt: null,
      }).where(eq(users.id, userId))

      await logEvent({
        userId,
        eventType: 'subscription_created',
        plan,
        billingInterval: interval,
        amountCents: planCents(plan as PlanKey, interval as BillingInterval),
        stripeEventId: event.id,
        stripeSubscriptionId: subscription.id,
      })

      // ── Affiliate commission for first payment ────────────────────────────
      const referredBy = session.metadata?.referred_by
      if (referredBy) {
        const referrer = await db.query.users.findFirst({
          where: eq(users.username, referredBy),
          columns: { id: true, email: true },
        })

        if (referrer) {
          const grossPaid = session.amount_total ?? 0  // cents, after coupon
          const commissionAmount = Math.floor(grossPaid * 0.15)
          const availableAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)

          // Retrieve the invoice ID from the subscription's latest invoice
          const latestInvoiceId = typeof subscription.latest_invoice === 'string'
            ? subscription.latest_invoice
            : (subscription.latest_invoice as any)?.id ?? null

          if (latestInvoiceId) {
            try {
              await db.insert(affiliateCommissions).values({
                referrerId: referrer.id,
                refereeId: userId,
                stripeInvoiceId: latestInvoiceId,
                stripeCustomerId: session.customer as string,
                grossAmount: grossPaid,
                commissionRate: '0.15',
                commissionAmount,
                status: 'pending',
                availableAt,
              })
            } catch (err: any) {
              if (err?.code !== '23505') {
                console.error('[webhook] first-payment commission error:', err?.message ?? err)
              }
            }
          }

          // Notify referrer by email (fire-and-forget)
          if (referrer.email) {
            const planLabel: Record<string, string> = { starter: 'Starter', pro: 'Pro', unlimited: 'Unlimited' }
            getResend().emails.send({
              from: FROM_EMAIL,
              to: referrer.email,
              subject: 'Neuer Partner über deinen Empfehlungslink – FinestSites',
              html: affiliateNewReferralEmail({
                refereeEmail: session.customer_email ?? session.customer_details?.email ?? '–',
                planLabel: planLabel[plan] ?? plan,
              }),
            }).catch(err => console.error('[webhook] affiliate referral email error:', err))
          }
        }
      }
      break
    }

    // ── Subscription updated (plan change, renewal, cancel_at_period_end) ───
    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription
      const priceId = sub.items.data[0]?.price.id ?? ''
      const plan = getPlanByPriceId()[priceId] ?? 'starter'
      const interval = sub.items.data[0]?.price.recurring?.interval === 'year' ? 'yearly' : 'monthly'
      const userId = await getUserIdByCustomer(sub.customer as string)
      if (!userId) break

      await db.update(users).set({
        plan,
        billingInterval: interval,
        subscriptionStatus: sub.status,
        stripeSubscriptionId: sub.id,
        currentPeriodEnd: getPeriodEnd(sub),
      }).where(eq(users.id, userId))

      await logEvent({
        userId,
        eventType: 'subscription_updated',
        plan,
        billingInterval: interval,
        amountCents: planCents(plan as PlanKey, interval as BillingInterval),
        stripeEventId: event.id,
        stripeSubscriptionId: sub.id,
        metadata: { cancel_at_period_end: sub.cancel_at_period_end },
      })
      break
    }

    // ── Subscription deleted (after cancellation period ends) ───────────────
    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription
      const userId = await getUserIdByCustomer(sub.customer as string)
      if (!userId) break

      const now = new Date()
      const deletionDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

      // Deactivate user account
      await db.update(users).set({
        plan: 'starter',
        subscriptionStatus: 'canceled',
        stripeSubscriptionId: null,
        deactivatedAt: now,
      }).where(eq(users.id, userId))

      // Deactivate all published/draft sites and schedule deletion in 30 days
      await db.update(userSites).set({
        status: 'deactivated',
        deactivatedAt: now,
        scheduledDeletionAt: deletionDate,
      }).where(
        and(
          eq(userSites.userId, userId),
          inArray(userSites.status, ['published', 'draft'])
        )
      )

      await logEvent({
        userId,
        eventType: 'subscription_deleted',
        stripeEventId: event.id,
        stripeSubscriptionId: sub.id,
        metadata: { sites_deactivated: true, scheduled_deletion_at: deletionDate.toISOString() },
      })
      break
    }

    // ── Payment failed ───────────────────────────────────────────────────────
    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice
      const userId = await getUserIdByCustomer(invoice.customer as string)
      if (!userId) break

      await db.update(users).set({
        subscriptionStatus: 'past_due',
        paymentFailedAt: new Date(),
      }).where(eq(users.id, userId))

      const inv1 = invoice as any
      await logEvent({
        userId,
        eventType: 'payment_failed',
        stripeEventId: event.id,
        stripeSubscriptionId: typeof inv1.subscription === 'string' ? inv1.subscription : inv1.subscription?.id,
        stripeInvoiceId: invoice.id,
        metadata: { attempt_count: inv1.attempt_count ?? null },
      })
      break
    }

    // ── Payment succeeded (clears past_due + affiliate commission) ──────────
    case 'invoice.payment_succeeded': {
      const invoice = event.data.object as Stripe.Invoice
      const billingReason = (invoice as any).billing_reason

      // Skip the very first invoice — handled by checkout.session.completed
      if (billingReason === 'subscription_create') break

      const userId = await getUserIdByCustomer(invoice.customer as string)
      if (!userId) break

      const inv2 = invoice as any
      const subId = typeof inv2.subscription === 'string'
        ? inv2.subscription
        : inv2.subscription?.id
      if (!subId) break

      const sub = await stripe.subscriptions.retrieve(subId)
      const priceId = sub.items.data[0]?.price.id ?? ''
      const plan = getPlanByPriceId()[priceId] ?? 'starter'
      const interval = sub.items.data[0]?.price.recurring?.interval === 'year' ? 'yearly' : 'monthly'

      await db.update(users).set({
        subscriptionStatus: sub.status,
        currentPeriodEnd: getPeriodEnd(sub),
        paymentFailedAt: null,
      }).where(eq(users.id, userId))

      await logEvent({
        userId,
        eventType: 'subscription_renewed',
        plan,
        billingInterval: interval,
        amountCents: planCents(plan as PlanKey, interval as BillingInterval),
        stripeEventId: event.id,
        stripeSubscriptionId: sub.id,
        stripeInvoiceId: invoice.id,
      })

      // ── Affiliate commission ──────────────────────────────────────────────
      // Check if this user was referred
      const paidUser = await db.query.users.findFirst({
        where: eq(users.id, userId),
        columns: { referredByUsername: true },
      })

      if (paidUser?.referredByUsername) {
        const referrer = await db.query.users.findFirst({
          where: eq(users.username, paidUser.referredByUsername),
          columns: { id: true },
        })

        if (referrer) {
          const grossPaid = invoice.amount_paid  // in cents, after coupon
          const commissionAmount = Math.floor(grossPaid * 0.15)
          const availableAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)

          // Idempotent: unique on stripe_invoice_id
          try {
            await db.insert(affiliateCommissions).values({
              referrerId: referrer.id,
              refereeId: userId,
              stripeInvoiceId: invoice.id,
              stripeCustomerId: invoice.customer as string,
              grossAmount: grossPaid,
              commissionRate: '0.15',
              commissionAmount,
              status: 'pending',
              availableAt,
            })
          } catch (err: any) {
            if (err?.code !== '23505') {
              console.error('[webhook] commission insert error:', err?.message ?? err)
            }
          }
        }
      }
      break
    }

    // ── Refund → reverse pending commission ──────────────────────────────────
    case 'charge.refunded': {
      const charge = event.data.object as any
      const invoiceId = charge.invoice
      if (!invoiceId) break

      await db.update(affiliateCommissions).set({
        status: 'reversed',
        reversalReason: 'charge_refunded',
        updatedAt: new Date(),
      }).where(
        and(
          eq(affiliateCommissions.stripeInvoiceId, invoiceId),
          inArray(affiliateCommissions.status, ['pending', 'available'])
        )
      )
      break
    }
  }

  return NextResponse.json({ received: true })
}
