import { NextRequest, NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStripe, getPlanByPriceId, planCents, type PlanKey, type BillingInterval } from '@/lib/stripe/client'
import { getResend, FROM_EMAIL } from '@/lib/resend'
import { affiliateNewReferralEmail } from '@/lib/email/templates'

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature') ?? ''
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? ''

  const stripe = getStripe()
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
  } catch (err) {
    console.error('[webhook] Invalid signature:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const admin = createAdminClient()

  // ── helpers ────────────────────────────────────────────────────────────────

  // In Stripe API 2025+, current_period_end moved from Subscription root to
  // SubscriptionItem. We read from the item first, fall back to root.
  function getPeriodEnd(sub: Stripe.Subscription): string | null {
    const itemTs = (sub.items.data[0] as any)?.current_period_end
    const rootTs = (sub as any).current_period_end
    const ts = itemTs ?? rootTs
    return ts ? new Date(ts * 1000).toISOString() : null
  }

  async function getUserIdByCustomer(customerId: string): Promise<string | null> {
    const { data } = await admin
      .from('users')
      .select('id')
      .eq('stripe_customer_id', customerId)
      .single()
    return data?.id ?? null
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
    const { error } = await admin.from('subscription_events').insert({
      user_id: params.userId,
      event_type: params.eventType,
      plan: params.plan ?? null,
      billing_interval: params.billingInterval ?? null,
      amount_cents: params.amountCents ?? null,
      stripe_event_id: params.stripeEventId,
      stripe_subscription_id: params.stripeSubscriptionId ?? null,
      stripe_invoice_id: params.stripeInvoiceId ?? null,
      metadata: params.metadata ?? {},
    })
    if (error && error.code !== '23505') {
      // 23505 = unique_violation (duplicate event — idempotency, safe to ignore)
      console.error('[webhook] logEvent error:', error.message)
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
      const userId = session.metadata?.supabase_user_id
      if (!userId) break

      await admin.from('users').update({
        plan,
        billing_interval: interval,
        subscription_status: subscription.status,
        stripe_subscription_id: subscription.id,
        current_period_end: getPeriodEnd(subscription),
        payment_failed_at: null,
        deactivated_at: null,
      }).eq('id', userId)

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
        const { data: referrer } = await admin
          .from('users')
          .select('id, email')
          .eq('username', referredBy)
          .single()

        if (referrer) {
          const grossPaid = session.amount_total ?? 0  // cents, after coupon
          const commissionAmount = Math.floor(grossPaid * 0.15)
          const availableAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()

          // Retrieve the invoice ID from the subscription's latest invoice
          const latestInvoiceId = typeof subscription.latest_invoice === 'string'
            ? subscription.latest_invoice
            : (subscription.latest_invoice as any)?.id ?? null

          const { error: commErr } = await admin.from('affiliate_commissions').insert({
            referrer_id: referrer.id,
            referee_id: userId,
            stripe_invoice_id: latestInvoiceId,
            stripe_customer_id: session.customer as string,
            gross_amount: grossPaid,
            commission_rate: 0.15,
            commission_amount: commissionAmount,
            status: 'pending',
            available_at: availableAt,
          })
          if (commErr && commErr.code !== '23505') {
            console.error('[webhook] first-payment commission error:', commErr.message)
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

      await admin.from('users').update({
        plan,
        billing_interval: interval,
        subscription_status: sub.status,
        stripe_subscription_id: sub.id,
        current_period_end: getPeriodEnd(sub),
      }).eq('id', userId)

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

      // Deactivate user account
      await admin.from('users').update({
        plan: 'starter',
        subscription_status: 'canceled',
        stripe_subscription_id: null,
        deactivated_at: new Date().toISOString(),
      }).eq('id', userId)

      // Deactivate all published/draft sites and schedule deletion in 30 days
      const deletionDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      await admin.from('user_sites')
        .update({
          status: 'deactivated',
          deactivated_at: new Date().toISOString(),
          scheduled_deletion_at: deletionDate,
        })
        .eq('user_id', userId)
        .in('status', ['published', 'draft'])

      await logEvent({
        userId,
        eventType: 'subscription_deleted',
        stripeEventId: event.id,
        stripeSubscriptionId: sub.id,
        metadata: { sites_deactivated: true, scheduled_deletion_at: deletionDate },
      })
      break
    }

    // ── Payment failed ───────────────────────────────────────────────────────
    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice
      const userId = await getUserIdByCustomer(invoice.customer as string)
      if (!userId) break

      await admin.from('users').update({
        subscription_status: 'past_due',
        payment_failed_at: new Date().toISOString(),
      }).eq('id', userId)

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

      await admin.from('users').update({
        subscription_status: sub.status,
        current_period_end: getPeriodEnd(sub),
        payment_failed_at: null,
      }).eq('id', userId)

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
      const { data: paidUser } = await admin
        .from('users')
        .select('referred_by_username')
        .eq('id', userId)
        .single()

      if (paidUser?.referred_by_username) {
        const { data: referrer } = await admin
          .from('users')
          .select('id')
          .eq('username', paidUser.referred_by_username)
          .single()

        if (referrer) {
          const grossPaid = invoice.amount_paid  // in cents, after coupon
          const commissionAmount = Math.floor(grossPaid * 0.15)
          const availableAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()

          // Idempotent: unique on stripe_invoice_id
          const { error: commErr } = await admin.from('affiliate_commissions').insert({
            referrer_id: referrer.id,
            referee_id: userId,
            stripe_invoice_id: invoice.id,
            stripe_customer_id: invoice.customer as string,
            gross_amount: grossPaid,
            commission_rate: 0.15,
            commission_amount: commissionAmount,
            status: 'pending',
            available_at: availableAt,
          })
          if (commErr && commErr.code !== '23505') {
            console.error('[webhook] commission insert error:', commErr.message)
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

      await admin.from('affiliate_commissions')
        .update({ status: 'reversed', reversal_reason: 'charge_refunded', updated_at: new Date().toISOString() })
        .eq('stripe_invoice_id', invoiceId)
        .in('status', ['pending', 'available'])
      break
    }
  }

  return NextResponse.json({ received: true })
}
