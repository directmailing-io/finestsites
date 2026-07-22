import { NextRequest, NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { db } from '@/lib/db'
import { users, userSites, subscriptionEvents, affiliateCommissions } from '@/lib/db/schema'
import { eq, and, inArray, isNull } from 'drizzle-orm'
import { getStripe, getPlanByPriceId, planCents, type PlanKey, type BillingInterval } from '@/lib/stripe/client'
import { sendEmail } from '@/lib/resend'
import {
  affiliateNewReferralEmail,
  paymentFailedEmail,
  accountDeactivatedEmail,
  accountExpiredEmail,
  accountCanceledEmail,
  accountReactivatedEmail,
} from '@/lib/email/templates'
import { setSiteOfflineKV, deleteCustomDomainKV, clearSiteMetaKV, setCustomDomainKV } from '@/lib/cloudflare/kv-api'

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

      // ── Capture promo code / coupon used in checkout ──────────────────────
      // When allow_promotion_codes:true, the discount is applied to the session/invoice
      // but NOT automatically stored on the subscription object → Stripe shows
      // "Kein Gutschein angewendet". Fix: fetch the discount and write it to
      // subscription metadata so it's visible in Stripe and traceable.
      // affiliateOverrideDetected: true if user applied a non-affiliate Stripe code →
      // this ends the affiliate relationship and suppresses the first-payment commission.
      let affiliateOverrideDetected = false
      try {
        const sessionExpanded = await stripe.checkout.sessions.retrieve(session.id, {
          expand: ['total_details.breakdown.discounts.discount.coupon'],
        })
        const appliedDiscount = sessionExpanded.total_details?.breakdown?.discounts?.[0]
        const coupon = (appliedDiscount?.discount as any)?.coupon as Stripe.Coupon | undefined
        const promoCodeId = (appliedDiscount?.discount as any)?.promotion_code as string | undefined

        if (coupon?.id) {
          let promoCodeStr = ''
          if (promoCodeId) {
            try {
              const pc = await stripe.promotionCodes.retrieve(promoCodeId)
              promoCodeStr = pc.code
            } catch { /* ignore */ }
          }
          await stripe.subscriptions.update(subscription.id, {
            metadata: {
              ...subscription.metadata,
              coupon_id: coupon.id,
              coupon_name: coupon.name ?? coupon.id,
              promo_code: promoCodeStr,
              discount_amount_cents: String(appliedDiscount?.amount ?? 0),
            },
          })

          // ── Affiliate override detection ──────────────────────────────────
          // If the user had a partner referral but explicitly applied a different
          // Stripe promo code (e.g. ADMIN100), the affiliate relationship ends here:
          // we clear referredByUsername and reverse any pending/available commissions.
          // Future renewals will no longer generate commissions for the old referrer.
          const affiliateCouponId = process.env.STRIPE_AFFILIATE_COUPON_ID?.trim()
          if (affiliateCouponId && coupon.id !== affiliateCouponId) {
            const currentUser = await db.query.users.findFirst({
              where: eq(users.id, userId),
              columns: { referredByUsername: true },
            })
            if (currentUser?.referredByUsername) {
              affiliateOverrideDetected = true
              // End the affiliate link
              await db.update(users)
                .set({ referredByUsername: null })
                .where(eq(users.id, userId))
              // Reverse any commissions that haven't been paid out yet
              await db.update(affiliateCommissions).set({
                status: 'reversed',
                reversalReason: 'promo_code_override',
                updatedAt: new Date(),
              }).where(
                and(
                  eq(affiliateCommissions.refereeId, userId),
                  inArray(affiliateCommissions.status, ['pending', 'available'])
                )
              )
            }
          }
        }
      } catch (e) {
        console.error('[billing/webhook] failed to capture coupon info:', e)
      }

      await db.update(users).set({
        plan,
        billingInterval: interval,
        subscriptionStatus: subscription.status,
        stripeSubscriptionId: subscription.id,
        currentPeriodEnd: getPeriodEnd(subscription),
        paymentFailedAt: null,
        deactivatedAt: null,
      }).where(eq(users.id, userId))

      // Reactivate previously deactivated/canceled sites (fix: includes scheduledDeletionAt sites)
      const sitesToRestore = await db.query.userSites.findMany({
        where: and(
          eq(userSites.userId, userId),
          eq(userSites.status, 'deactivated'),
        ),
        columns: { id: true, customDomain: true },
        with: {
          template: { columns: { domain: true } },
          user: { columns: { username: true } },
        },
      })
      if (sitesToRestore.length > 0) {
        await db.update(userSites).set({
          status: 'published',
          deactivatedAt: null,
          scheduledDeletionAt: null,
        }).where(and(
          eq(userSites.userId, userId),
          eq(userSites.status, 'deactivated'),
        ))
        for (const site of sitesToRestore) {
          const username       = (site as any).user?.username as string | null
          const templateDomain = (site as any).template?.domain as string | null
          if (username && templateDomain) {
            await clearSiteMetaKV(username, templateDomain).catch(() => {})
          }
          if (site.customDomain && username && templateDomain) {
            await setCustomDomainKV(site.customDomain, username, templateDomain).catch(() => {})
          }
        }
      }

      await logEvent({
        userId,
        eventType: 'subscription_created',
        plan,
        billingInterval: interval,
        // Use actual amount_total from Stripe checkout (after coupons/discounts)
        amountCents: session.amount_total ?? planCents(plan as PlanKey, interval as BillingInterval),
        stripeEventId: event.id,
        stripeSubscriptionId: subscription.id,
      })

      // ── Affiliate commission for first payment ────────────────────────────
      // Skip if the user overrode their affiliate code with a different Stripe promo code.
      const referredBy = session.metadata?.referred_by
      if (referredBy && !affiliateOverrideDetected) {
        const referrer = await db.query.users.findFirst({
          where: eq(users.username, referredBy),
          columns: { id: true, email: true },
        })

        if (referrer) {
          const grossPaid = session.amount_total ?? 0  // cents, after coupon
          const commissionAmount = Math.floor(grossPaid * 0.10)
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
                commissionRate: '0.10',
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
            sendEmail({ to: referrer.email, subject: 'Neuer Partner über deinen Empfehlungslink – FinestSites', html: affiliateNewReferralEmail({ refereeEmail: session.customer_email ?? session.customer_details?.email ?? '–', planLabel: planLabel[plan] ?? plan }), type: 'affiliate_referral' }).catch(() => {})
          }
        }
      }
      break
    }

    // ── Subscription updated (plan change, renewal, cancel_at_period_end) ───
    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription
      const prevSub = event.data.previous_attributes as Partial<Stripe.Subscription> | undefined
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
        cancelAtPeriodEnd: sub.cancel_at_period_end,
      }).where(eq(users.id, userId))

      // Send cancellation email ONLY when cancel_at_period_end just flipped false → true.
      // Stripe's previous_attributes only includes fields that CHANGED — if absent, the field
      // did not change. Treating undefined as false causes re-sends on unrelated sub updates.
      const cancelJustChanged = prevSub !== undefined && 'cancel_at_period_end' in (prevSub as object)
      const justCanceled = cancelJustChanged && sub.cancel_at_period_end === true && prevSub?.cancel_at_period_end === false
      if (justCanceled) {
        const periodEnd = getPeriodEnd(sub)
        const periodEndStr = periodEnd
          ? periodEnd.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
          : 'Ende des Abrechnungszeitraums'
        const userRow = await db.query.users.findFirst({
          where: eq(users.id, userId),
          columns: { email: true },
        })
        if (userRow?.email) {
          sendEmail({ to: userRow.email, subject: 'Dein Abo wurde gekündigt', html: accountCanceledEmail({ periodEnd: periodEndStr }), type: 'account_canceled' }).catch(() => {})
        }
      }

      await logEvent({
        userId,
        eventType: 'subscription_updated',
        plan,
        billingInterval: interval,
        amountCents: 0,  // Not a payment event — no money exchanged
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
      const deletionDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)

      const userRow = await db.query.users.findFirst({
        where: eq(users.id, userId),
        columns: { email: true, deactivatedAt: true, subscriptionStatus: true },
      })

      // Was this a voluntary cancellation or a payment-failure termination?
      // past_due/unpaid → Stripe gave up on retries → payment failure email
      // active/trialing → period ended after cancel_at_period_end → expired email
      const wasPaymentFailure = ['past_due', 'unpaid'].includes(userRow?.subscriptionStatus ?? '')

      // Deactivate user account
      await db.update(users).set({
        plan: 'starter',
        subscriptionStatus: 'canceled',
        stripeSubscriptionId: null,
        cancelAtPeriodEnd: false,
        deactivatedAt: now,
      }).where(eq(users.id, userId))

      // Find published/draft sites to deactivate
      const liveSites = await db.query.userSites.findMany({
        where: and(
          eq(userSites.userId, userId),
          inArray(userSites.status, ['published', 'draft']),
        ),
        columns: { id: true, customDomain: true },
        with: {
          template: { columns: { domain: true } },
          user: { columns: { username: true } },
        },
      })

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

      // Take sites offline in KV
      for (const site of liveSites) {
        const username       = (site as any).user?.username as string | null
        const templateDomain = (site as any).template?.domain as string | null
        if (username && templateDomain) {
          await setSiteOfflineKV(username, templateDomain).catch(() => {})
        }
        if (site.customDomain) {
          await deleteCustomDomainKV(site.customDomain).catch(() => {})
        }
      }

      // Send correct email based on why the subscription ended
      // (only if not already deactivated by cron — cron sets deactivatedAt)
      if (!userRow?.deactivatedAt && userRow?.email) {
        const emailHtml = wasPaymentFailure ? accountDeactivatedEmail() : accountExpiredEmail()
        const emailSubject = wasPaymentFailure
          ? 'Dein Konto wurde pausiert'
          : 'Dein Abo ist ausgelaufen'
        sendEmail({ to: userRow.email, subject: emailSubject, html: emailHtml, type: wasPaymentFailure ? 'account_deactivated' : 'account_expired' }).catch(() => {})
      }

      // Reverse pending/available affiliate commissions — no real money will flow anymore
      await db.update(affiliateCommissions).set({
        status: 'reversed',
        reversalReason: 'subscription_canceled',
        updatedAt: new Date(),
      }).where(
        and(
          eq(affiliateCommissions.refereeId, userId),
          inArray(affiliateCommissions.status, ['pending', 'available'])
        )
      )

      await logEvent({
        userId,
        eventType: 'subscription_deleted',
        stripeEventId: event.id,
        stripeSubscriptionId: sub.id,
        metadata: { sites_deactivated: liveSites.length, scheduled_deletion_at: deletionDate.toISOString() },
      })
      break
    }

    // ── Payment failed ───────────────────────────────────────────────────────
    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice
      const userId = await getUserIdByCustomer(invoice.customer as string)
      if (!userId) break

      // Only set paymentFailedAt on the first failure (don't reset the clock on retries)
      const existing = await db.query.users.findFirst({
        where: eq(users.id, userId),
        columns: { email: true, paymentFailedAt: true },
      })

      const isFirstFailure = !existing?.paymentFailedAt
      await db.update(users).set({
        subscriptionStatus: 'past_due',
        ...(isFirstFailure ? { paymentFailedAt: new Date() } : {}),
      }).where(eq(users.id, userId))

      // Take sites offline immediately on payment failure — no grace period.
      // Sites are reactivated automatically by invoice.payment_succeeded.
      // scheduledDeletionAt is NOT set here — this state is recoverable.
      const failedSites = await db.query.userSites.findMany({
        where: and(
          eq(userSites.userId, userId),
          inArray(userSites.status, ['published', 'draft']),
        ),
        columns: { id: true, customDomain: true },
        with: {
          template: { columns: { domain: true } },
          user: { columns: { username: true } },
        },
      })
      if (failedSites.length > 0) {
        await db.update(userSites).set({
          status: 'deactivated',
          deactivatedAt: new Date(),
        }).where(and(
          eq(userSites.userId, userId),
          inArray(userSites.status, ['published', 'draft'])
        ))
        for (const site of failedSites) {
          const username       = (site as any).user?.username as string | null
          const templateDomain = (site as any).template?.domain as string | null
          if (username && templateDomain) {
            await setSiteOfflineKV(username, templateDomain).catch(() => {})
          }
          if (site.customDomain) {
            await deleteCustomDomainKV(site.customDomain).catch(() => {})
          }
        }
      }

      // Send email only on first failure
      if (isFirstFailure && existing?.email) {
        const inv1 = invoice as any
        const invoiceUrl = inv1.hosted_invoice_url ?? undefined
        sendEmail({ to: existing.email, subject: 'Deine Seite ist gerade offline', html: paymentFailedEmail({ invoiceUrl }), type: 'payment_failed' }).catch(() => {})
      }

      const inv1 = invoice as any
      await logEvent({
        userId,
        eventType: 'payment_failed',
        stripeEventId: event.id,
        stripeSubscriptionId: typeof inv1.subscription === 'string' ? inv1.subscription : inv1.subscription?.id,
        stripeInvoiceId: invoice.id,
        metadata: { attempt_count: inv1.attempt_count ?? null, first_failure: isFirstFailure },
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

      // Check if account was deactivated — need to reactivate
      const userBefore = await db.query.users.findFirst({
        where: eq(users.id, userId),
        columns: { email: true, deactivatedAt: true },
      })
      const wasDeactivated = !!userBefore?.deactivatedAt

      await db.update(users).set({
        subscriptionStatus: sub.status,
        currentPeriodEnd: getPeriodEnd(sub),
        paymentFailedAt: null,
        deactivatedAt: null,
      }).where(eq(users.id, userId))

      // Reactivate deactivated sites and restore KV entries
      if (wasDeactivated) {
        const deactivatedSites = await db.query.userSites.findMany({
          where: and(
            eq(userSites.userId, userId),
            eq(userSites.status, 'deactivated'),
            // Only reactivate sites deactivated due to billing (no scheduledDeletionAt set
            // by subscription.deleted — those are permanent)
            isNull(userSites.scheduledDeletionAt),
          ),
          columns: { id: true, customDomain: true },
          with: {
            template: { columns: { domain: true } },
            user: { columns: { username: true } },
          },
        })

        for (const site of deactivatedSites) {
          await db.update(userSites)
            .set({ status: 'published', deactivatedAt: null })
            .where(eq(userSites.id, site.id))

          const username       = (site as any).user?.username as string | null
          const templateDomain = (site as any).template?.domain as string | null

          // Remove offline marker so Worker falls back to DB (now published)
          if (username && templateDomain) {
            await clearSiteMetaKV(username, templateDomain).catch(() => {})
          }

          // Restore custom domain KV entry
          if (site.customDomain && username && templateDomain) {
            await setCustomDomainKV(site.customDomain, username, templateDomain).catch(() => {})
          }
        }

        // Send reactivation email
        if (userBefore?.email) {
          sendEmail({ to: userBefore.email, subject: 'Dein Konto ist wieder aktiv!', html: accountReactivatedEmail(), type: 'account_reactivated' }).catch(() => {})
        }
      }

      await logEvent({
        userId,
        eventType: 'subscription_renewed',
        plan,
        billingInterval: interval,
        // Use actual amount_paid from Stripe invoice (after coupons/discounts)
        amountCents: (invoice as any).amount_paid ?? planCents(plan as PlanKey, interval as BillingInterval),
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
          const commissionAmount = Math.floor(grossPaid * 0.10)
          const availableAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)

          // Idempotent: unique on stripe_invoice_id
          try {
            await db.insert(affiliateCommissions).values({
              referrerId: referrer.id,
              refereeId: userId,
              stripeInvoiceId: invoice.id,
              stripeCustomerId: invoice.customer as string,
              grossAmount: grossPaid,
              commissionRate: '0.10',
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
