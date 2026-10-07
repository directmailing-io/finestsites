import { NextRequest, NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { db } from '@/lib/db'
import { users, subscriptionEvents, affiliateCommissions } from '@/lib/db/schema'
import { eq, and, inArray } from 'drizzle-orm'
import { getStripe, getPlanByPriceId, planCents, type PlanKey, type BillingInterval } from '@/lib/stripe/client'
import { sendEmail } from '@/lib/resend'
import {
  affiliateNewReferralEmail,
  paymentFallbackUsedEmail,
  upcomingDebitEmail,
  accountDeactivatedEmail,
  accountExpiredEmail,
  accountCanceledEmail,
  accountReactivatedEmail,
} from '@/lib/email/templates'
import { suspendSites, restoreSites, reconcileSiteAccess } from '@/lib/billing/site-access'
import {
  recoveryCleared,
  recordPaymentFailure,
  clearPaymentFailure,
  markRetryProcessing,
  retrackInvoice,
  paidInvoiceSettlesArrears,
  attemptFallbackPayment,
  createReplacementInvoice,
  resolveDefaultPaymentMethodId,
  formatDateDe,
  formatEur,
} from '@/lib/billing/payment-recovery'
import { runRecoveryNotificationsFor } from '@/lib/billing/recovery-notifications'

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

  // Like logEvent, but tells the caller whether THIS delivery was the first
  // one — used to send a mail exactly once even if Stripe redelivers the event.
  async function logEventOnce(params: Parameters<typeof logEvent>[0]): Promise<boolean> {
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
      return true
    } catch (err: any) {
      if (err?.code !== '23505') console.error('[webhook] logEventOnce error:', err?.message ?? err)
      return false
    }
  }

  // Extract payment method type + last4 from any Stripe object that carries
  // a charge or payment_intent ID (invoices, checkout sessions, etc.).
  // Tries invoice.charge first (older API), then payment_intent → latest_charge.
  // Never throws — PM info is an optional enhancement, never blocking.
  async function extractPaymentMethod(inv: any): Promise<{ pmType: string | null; pmLast4: string | null }> {
    try {
      const chargeId = typeof inv.charge === 'string' ? inv.charge : null
      const piId = typeof inv.payment_intent === 'string' ? inv.payment_intent : null
      if (chargeId) {
        const ch = await stripe.charges.retrieve(chargeId, { expand: ['payment_method_details'] })
        const pmd = (ch as any).payment_method_details
        if (pmd?.type) return { pmType: pmd.type, pmLast4: pmd.card?.last4 || pmd.sepa_debit?.last4 || null }
      }
      if (piId) {
        const pi = await stripe.paymentIntents.retrieve(piId, { expand: ['latest_charge.payment_method_details'] })
        const pmd = (pi as any).latest_charge?.payment_method_details
        if (pmd?.type) return { pmType: pmd.type, pmLast4: pmd.card?.last4 || pmd.sepa_debit?.last4 || null }
      }
    } catch { /* PM info is optional */ }
    return { pmType: null, pmLast4: null }
  }

  // Commission base = the tax-free net amount the customer actually paid,
  // taken from the real Stripe invoice (NOT a hardcoded VAT rate).
  // Uses total_excluding_tax when present, otherwise total minus invoice tax.
  // Partial payments scale the net proportionally. Pure integer math (cents).
  function computeInvoiceNet(inv: any): number {
    const paid = inv.amount_paid ?? 0
    if (paid <= 0) return 0
    const total = inv.total ?? paid
    let netTotal: number
    if (typeof inv.total_excluding_tax === 'number') {
      netTotal = inv.total_excluding_tax
    } else {
      const taxCents = typeof inv.tax === 'number'
        ? inv.tax
        : Array.isArray(inv.total_taxes)
          ? inv.total_taxes.reduce((s: number, t: any) => s + (t.amount ?? 0), 0)
          : 0
      netTotal = total - taxCents
    }
    if (netTotal <= 0) return 0
    if (paid >= total || total === 0) return netTotal
    return Math.floor((netTotal * paid) / total)
  }

  // 10% commission on the net base — integer division, no floats.
  function commissionFromNet(netCents: number): number {
    return netCents > 0 ? Math.floor(netCents / 10) : 0
  }

  // Refund/chargeback handling per spec:
  // - commissions not yet paid out → status 'cancelled'
  // - commissions already paid out → negative balancing entry that offsets
  //   future commissions in the next payout run (idempotent via unique invoice key)
  async function reverseCommissionsForInvoice(invoiceId: string, reason: string) {
    const rows = await db.query.affiliateCommissions.findMany({
      where: eq(affiliateCommissions.stripeInvoiceId, invoiceId),
    })
    for (const row of rows) {
      if (row.status === 'pending' || row.status === 'available') {
        await db.update(affiliateCommissions).set({
          status: 'cancelled',
          reversalReason: reason,
          updatedAt: new Date(),
        }).where(eq(affiliateCommissions.id, row.id))
      } else if (row.status === 'paid' && row.commissionAmount > 0) {
        try {
          await db.insert(affiliateCommissions).values({
            referrerId: row.referrerId,
            refereeId: row.refereeId,
            stripeInvoiceId: `${invoiceId}:chargeback`,
            stripeCustomerId: row.stripeCustomerId,
            grossAmount: -row.grossAmount,
            netAmount: row.netAmount == null ? null : -row.netAmount,
            commissionRate: row.commissionRate,
            commissionAmount: -row.commissionAmount,
            status: 'available',
            availableAt: new Date(),
            reversalReason: `${reason}_after_payout`,
          })
        } catch (err: any) {
          if (err?.code !== '23505') {
            console.error('[webhook] chargeback booking error:', err?.message ?? err)
          }
        }
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

      // Invoice ID — needed for payment method tracking and affiliate commission
      const latestInvoiceId = typeof subscription.latest_invoice === 'string'
        ? subscription.latest_invoice
        : (subscription.latest_invoice as any)?.id ?? null

      // ── Capture promo code / coupon used in checkout ──────────────────────
      // When allow_promotion_codes:true, the discount is applied to the session/invoice
      // but NOT automatically stored on the subscription object → Stripe shows
      // "Kein Gutschein angewendet". Fix: fetch the discount and write it to
      // subscription metadata so it's visible in Stripe and traceable.
      // affiliateOverrideDetected: true if user applied a non-affiliate Stripe code →
      // this ends the affiliate relationship and suppresses the first-payment commission.
      let affiliateOverrideDetected = false
      try {
        // Stripe allows max. 4 expand levels, so the coupon cannot be expanded inline.
        // Stripe v22+: the coupon is a string ID in discount.source.coupon → fetch it separately.
        const sessionExpanded = await stripe.checkout.sessions.retrieve(session.id, {
          expand: ['total_details.breakdown'],
        })
        const appliedDiscount = sessionExpanded.total_details?.breakdown?.discounts?.[0]
        const rawCoupon = (appliedDiscount?.discount as any)?.source?.coupon ?? (appliedDiscount?.discount as any)?.coupon ?? null
        const coupon: Stripe.Coupon | undefined = !rawCoupon ? undefined
          : typeof rawCoupon === 'string' ? await stripe.coupons.retrieve(rawCoupon)
          : rawCoupon
        const rawPromo = (appliedDiscount?.discount as any)?.promotion_code
        const promoCodeId: string | undefined = typeof rawPromo === 'string' ? rawPromo : rawPromo?.id

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
              // Cancel any commissions that haven't been paid out yet
              await db.update(affiliateCommissions).set({
                status: 'cancelled',
                reversalReason: 'promo_code_override',
                updatedAt: new Date(),
              }).where(
                and(
                  eq(affiliateCommissions.refereeId, userId),
                  inArray(affiliateCommissions.status, ['pending', 'available'])
                )
              )
              // Mandatory audit log for every affiliate assignment change
              await logEvent({
                userId,
                eventType: 'affiliate_assignment_changed',
                stripeEventId: `${event.id}:affiliate-override`,
                metadata: {
                  old_affiliate: currentUser.referredByUsername,
                  new_affiliate: null,
                  changed_by: 'system_promo_override',
                  coupon_id: coupon.id,
                },
              })
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
        ...recoveryCleared,
        deactivatedAt: null,
      }).where(eq(users.id, userId))

      // Reactivate previously deactivated/canceled sites — a new subscription
      // brings everything back, including sites that had a deletion timer.
      await restoreSites(userId, { includeScheduledDeletion: true })

      const { pmType: checkoutPmType, pmLast4: checkoutPmLast4 } = await extractPaymentMethod({ payment_intent: session.payment_intent })
      await logEvent({
        userId,
        eventType: 'subscription_created',
        plan,
        billingInterval: interval,
        // Use actual amount_total from Stripe checkout (after coupons/discounts)
        amountCents: session.amount_total ?? planCents(plan as PlanKey, interval as BillingInterval),
        stripeEventId: event.id,
        stripeSubscriptionId: subscription.id,
        stripeInvoiceId: latestInvoiceId ?? undefined,
        metadata: { payment_method_type: checkoutPmType, payment_method_last4: checkoutPmLast4 },
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
          // Commission only if the first invoice is actually paid.
          // Base = tax-free net from the real invoice (after discount, before VAT).
          if (latestInvoiceId) {
            try {
              const firstInvoice = await stripe.invoices.retrieve(latestInvoiceId)
              if (firstInvoice.status === 'paid') {
                const netPaid = computeInvoiceNet(firstInvoice)
                const commissionAmount = commissionFromNet(netPaid)
                if (commissionAmount > 0) {
                  const availableAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
                  await db.insert(affiliateCommissions).values({
                    referrerId: referrer.id,
                    refereeId: userId,
                    stripeInvoiceId: latestInvoiceId,
                    stripeCustomerId: session.customer as string,
                    grossAmount: (firstInvoice as any).amount_paid ?? session.amount_total ?? 0,
                    netAmount: netPaid,
                    commissionRate: '0.10',
                    commissionAmount,
                    status: 'pending',
                    availableAt,
                  })
                }
              }
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

      // A fully deactivated account (subscription.deleted earlier) whose subscription
      // is active again (new subscription via Stripe dashboard, admin action, or
      // fallback when checkout.session.completed was missed) comes back completely —
      // including sites that already had a deletion timer.
      const userBeforeUpdate = await db.query.users.findFirst({
        where: eq(users.id, userId),
        columns: { deactivatedAt: true },
      })
      const fullReactivation = !!userBeforeUpdate?.deactivatedAt && sub.status === 'active'

      await db.update(users).set({
        plan,
        billingInterval: interval,
        subscriptionStatus: sub.status,
        stripeSubscriptionId: sub.id,
        currentPeriodEnd: getPeriodEnd(sub),
        cancelAtPeriodEnd: sub.cancel_at_period_end,
        ...(fullReactivation ? { deactivatedAt: null, ...recoveryCleared } : {}),
      }).where(eq(users.id, userId))

      if (fullReactivation) {
        await restoreSites(userId, { includeScheduledDeletion: true })
      }

      // Sites follow the subscription status — idempotent, order-independent.
      // Stripe delivers this event BEFORE invoice.payment_succeeded, so after a
      // recovered payment this is usually where the sites come back online.
      const reconciled = await reconcileSiteAccess(userId)
      if (reconciled.action === 'restored') {
        const userRow = await db.query.users.findFirst({ where: eq(users.id, userId), columns: { email: true } })
        if (userRow?.email) {
          sendEmail({ to: userRow.email, subject: 'Dein Konto ist wieder aktiv!', html: accountReactivatedEmail(), type: 'account_reactivated' }).catch(() => {})
        }
      }

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
        columns: { email: true, deactivatedAt: true, subscriptionStatus: true, paymentFailedAt: true },
      })

      // Was this a voluntary cancellation or a payment-failure termination?
      // past_due/unpaid → Stripe gave up on retries → payment failure email
      // active/trialing → period ended after cancel_at_period_end → expired email
      const wasPaymentFailure = ['past_due', 'unpaid'].includes(userRow?.subscriptionStatus ?? '') || !!userRow?.paymentFailedAt

      // Deactivate user account; the arrears episode ends with the subscription
      await db.update(users).set({
        plan: 'starter',
        subscriptionStatus: 'canceled',
        stripeSubscriptionId: null,
        cancelAtPeriodEnd: false,
        deactivatedAt: now,
        ...recoveryCleared,
      }).where(eq(users.id, userId))

      // Take all live sites offline and start the 90-day deletion timer
      const sitesDeactivated = await suspendSites(userId, { scheduleDeletionAt: deletionDate })

      // Send correct email based on why the subscription ended
      // (only if not already deactivated by cron — cron sets deactivatedAt)
      if (!userRow?.deactivatedAt && userRow?.email) {
        const emailHtml = wasPaymentFailure ? accountDeactivatedEmail() : accountExpiredEmail()
        const emailSubject = wasPaymentFailure
          ? 'Dein Konto wurde pausiert'
          : 'Dein Abo ist ausgelaufen'
        sendEmail({ to: userRow.email, subject: emailSubject, html: emailHtml, type: wasPaymentFailure ? 'account_deactivated' : 'account_expired' }).catch(() => {})
      }

      // Note: existing commissions stay valid — they belong to invoices that were
      // actually paid and kept. Only refunds/chargebacks reverse commissions.

      await logEvent({
        userId,
        eventType: 'subscription_deleted',
        stripeEventId: event.id,
        stripeSubscriptionId: sub.id,
        metadata: { sites_deactivated: sitesDeactivated, scheduled_deletion_at: deletionDate.toISOString() },
      })
      break
    }

    // ── Payment failed ───────────────────────────────────────────────────────
    // Starts (or continues) an arrears episode — see payment-recovery.ts.
    // Sites stay online for the grace period; the fallback card is charged
    // right away when there is one. Customer mails are state-driven
    // (runRecoveryNotificationsFor) so redeliveries never double-send.
    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice
      const userId = await getUserIdByCustomer(invoice.customer as string)
      if (!userId) break

      const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
        columns: { email: true, stripeCustomerId: true, stripeSubscriptionId: true, paymentFallbackSepa: true, deactivatedAt: true },
      })
      if (!user?.stripeCustomerId) break

      const inv1 = invoice as any
      const invSubId: string | undefined = typeof inv1.subscription === 'string' ? inv1.subscription : inv1.subscription?.id
      const record = await recordPaymentFailure(userId, invoice.id)

      let fallbackOutcome = 'skipped'
      if (record.kind === 'first' && !user.deactivatedAt) {
        const fallback = await attemptFallbackPayment({
          customerId: user.stripeCustomerId,
          subscriptionId: invSubId ?? user.stripeSubscriptionId,
          invoice,
          allowSepa: user.paymentFallbackSepa,
        })
        fallbackOutcome = fallback.outcome === 'none' ? `none:${fallback.reason}` : fallback.outcome

        if (fallback.outcome === 'paid') {
          // invoice.payment_succeeded follows and sets the Stripe status; the
          // episode is over right now so nothing can take the sites offline
          await clearPaymentFailure(userId)
        } else if (fallback.outcome === 'processing') {
          await markRetryProcessing(userId)
        }

        if ((fallback.outcome === 'paid' || fallback.outcome === 'processing') && user.email) {
          const first = await logEventOnce({
            userId,
            eventType: 'payment_fallback',
            stripeEventId: `${event.id}:fallback`,
            stripeSubscriptionId: invSubId,
            stripeInvoiceId: invoice.id,
            metadata: { outcome: fallback.outcome, method: fallback.method.label, method_type: fallback.method.type },
          })
          if (first) {
            sendEmail({
              to: user.email,
              subject: fallback.outcome === 'paid' ? 'Wir haben deine Karte verwendet' : 'Wir versuchen es über deine zweite Zahlungsmethode',
              html: paymentFallbackUsedEmail({ amount: formatEur(invoice.amount_due ?? 0), methodLabel: fallback.method.label, pending: fallback.outcome === 'processing' }),
              type: 'payment_fallback',
            }).catch(() => {})
            // The fallback mail IS the day-0 notice
            await db.update(users).set({ paymentNoticeSentAt: new Date() }).where(eq(users.id, userId))
          }
        } else if (fallback.outcome === 'failed') {
          console.error(`[webhook] fallback payment failed for ${userId}: ${fallback.error}`)
        }
      }

      // Grace → sites stay online; second strike → offline now
      await reconcileSiteAccess(userId)

      // First invoice of a subscription: Stripe may void it right after this
      // event — the notice (with a pay link) is sent by the cron once the
      // replacement invoice exists. Every other invoice: notify immediately.
      if (inv1.billing_reason !== 'subscription_create') {
        await runRecoveryNotificationsFor(userId).catch(err =>
          console.error('[webhook] recovery notification error:', err instanceof Error ? err.message : err))
      }

      await logEvent({
        userId,
        eventType: 'payment_failed',
        stripeEventId: event.id,
        stripeSubscriptionId: invSubId,
        stripeInvoiceId: invoice.id,
        metadata: {
          attempt_count: inv1.attempt_count ?? null,
          billing_reason: inv1.billing_reason ?? null,
          kind: record.kind,
          fallback: fallbackOutcome,
          first_failure: record.kind === 'first',
        },
      })
      break
    }

    // ── Invoice voided ───────────────────────────────────────────────────────
    // Stripe voids a subscription's FIRST invoice itself when its SEPA debit
    // fails (subscription stays active). Nobody paid → the episode continues
    // against a replacement invoice we create. Any other voided tracked invoice
    // was voided by hand in the Dashboard = debt forgiven → episode ends.
    case 'invoice.voided': {
      const invoice = event.data.object as Stripe.Invoice
      const userId = await getUserIdByCustomer(invoice.customer as string)
      if (!userId) break

      const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
        columns: { email: true, stripeCustomerId: true, stripeSubscriptionId: true, paymentFallbackSepa: true, paymentFailedInvoiceId: true, deactivatedAt: true },
      })
      if (!user?.stripeCustomerId || user.paymentFailedInvoiceId !== invoice.id || user.deactivatedAt) break

      const inv3 = invoice as any
      const subId: string | null = typeof inv3.subscription === 'string' ? inv3.subscription : inv3.subscription?.id ?? user.stripeSubscriptionId

      if (inv3.billing_reason !== 'subscription_create' || (invoice.amount_paid ?? 0) > 0) {
        await clearPaymentFailure(userId)
        await reconcileSiteAccess(userId)
        await logEvent({ userId, eventType: 'invoice_forgiven', stripeEventId: event.id, stripeInvoiceId: invoice.id, stripeSubscriptionId: subId ?? undefined })
        break
      }

      // Idempotency: a replacement for this invoice may already exist
      const existing = await stripe.invoices.search({ query: `metadata['fs_replaces_invoice']:'${invoice.id}'`, limit: 1 })
      let replacement: Stripe.Invoice | null = existing.data[0] ?? null
      if (!replacement) {
        replacement = await createReplacementInvoice({ customerId: user.stripeCustomerId, subscriptionId: subId, voided: invoice })
      }
      if (!replacement) break

      await retrackInvoice(userId, replacement.id)

      const fallback = await attemptFallbackPayment({
        customerId: user.stripeCustomerId,
        subscriptionId: subId,
        invoice: replacement,
        allowSepa: user.paymentFallbackSepa,
      })
      if (fallback.outcome === 'paid') {
        await clearPaymentFailure(userId)
      } else if (fallback.outcome === 'processing') {
        await markRetryProcessing(userId)
      }
      if ((fallback.outcome === 'paid' || fallback.outcome === 'processing') && user.email) {
        const first = await logEventOnce({
          userId, eventType: 'payment_fallback', stripeEventId: `${event.id}:fallback`, stripeInvoiceId: replacement.id, stripeSubscriptionId: subId ?? undefined,
          metadata: { outcome: fallback.outcome, method: fallback.method.label, method_type: fallback.method.type },
        })
        if (first) {
          sendEmail({
            to: user.email,
            subject: fallback.outcome === 'paid' ? 'Wir haben deine Karte verwendet' : 'Wir versuchen es über deine zweite Zahlungsmethode',
            html: paymentFallbackUsedEmail({ amount: formatEur(replacement.amount_due ?? 0), methodLabel: fallback.method.label, pending: fallback.outcome === 'processing' }),
            type: 'payment_fallback',
          }).catch(() => {})
          await db.update(users).set({ paymentNoticeSentAt: new Date() }).where(eq(users.id, userId))
        }
      }

      await reconcileSiteAccess(userId)
      await runRecoveryNotificationsFor(userId).catch(() => {})
      await logEvent({
        userId, eventType: 'invoice_replaced', stripeEventId: event.id, stripeInvoiceId: replacement.id, stripeSubscriptionId: subId ?? undefined,
        amountCents: replacement.amount_due ?? 0,
        metadata: { voided_invoice: invoice.id, fallback: fallback.outcome },
      })
      break
    }

    // ── A new attempt for the open invoice is being processed (SEPA) ────────
    // The customer paid via the hosted invoice page or Stripe retried the
    // debit: sites stay (or come back) online until the bank answers.
    case 'payment_intent.processing': {
      const pi = event.data.object as Stripe.PaymentIntent
      const piInvoiceId: string | null = typeof (pi as any).invoice === 'string' ? (pi as any).invoice : (pi as any).invoice?.id ?? null
      if (!piInvoiceId || !pi.customer) break
      const userId = await getUserIdByCustomer(pi.customer as string)
      if (!userId) break

      const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
        columns: { paymentFailedAt: true, paymentFailedInvoiceId: true, deactivatedAt: true },
      })
      if (!user?.paymentFailedAt || user.deactivatedAt || user.paymentFailedInvoiceId !== piInvoiceId) break

      await markRetryProcessing(userId)
      await reconcileSiteAccess(userId)
      await logEvent({ userId, eventType: 'payment_retry_processing', stripeEventId: event.id, stripeInvoiceId: piInvoiceId, metadata: { payment_intent: pi.id } })
      break
    }

    // ── Upcoming renewal (Stripe sends this N days before, Dashboard setting) ─
    // SEPA customers get a heads-up so the account is covered on the day.
    case 'invoice.upcoming': {
      const upcoming = event.data.object as Stripe.Invoice
      if (!upcoming.customer) break
      const userId = await getUserIdByCustomer(upcoming.customer as string)
      if (!userId) break
      const amountDue = upcoming.amount_due ?? 0
      if (amountDue <= 0) break

      const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
        columns: { email: true, stripeCustomerId: true, stripeSubscriptionId: true, deactivatedAt: true },
      })
      if (!user?.email || !user.stripeCustomerId || user.deactivatedAt) break

      const up = upcoming as any
      const upSubId: string | null = typeof up.subscription === 'string' ? up.subscription : up.subscription?.id ?? user.stripeSubscriptionId
      let pmType: string | null = null
      let last4: string | null = null
      try {
        const pmId = await resolveDefaultPaymentMethodId(user.stripeCustomerId, upSubId)
        if (pmId) {
          const pm = await stripe.paymentMethods.retrieve(pmId)
          pmType = pm.type
          last4 = pm.sepa_debit?.last4 ?? null
        }
      } catch { /* no mail without a known method */ }
      if (pmType !== 'sepa_debit') break

      const debitTs: number | null = up.next_payment_attempt ?? up.period_end ?? null
      const debitDate = debitTs ? new Date(debitTs * 1000) : null
      if (!debitDate) break

      // upcoming invoices have no id — the event id + period keeps this once per renewal
      const first = await logEventOnce({
        userId, eventType: 'upcoming_debit_notice', stripeEventId: event.id, stripeSubscriptionId: upSubId ?? undefined,
        amountCents: amountDue, metadata: { debit_date: debitDate.toISOString(), last4 },
      })
      if (first) {
        sendEmail({
          to: user.email,
          subject: `Am ${formatDateDe(debitDate)} buchen wir ${formatEur(amountDue)} ab`,
          html: upcomingDebitEmail({ amount: formatEur(amountDue), date: formatDateDe(debitDate), last4 }),
          type: 'upcoming_debit',
        }).catch(() => {})
      }
      break
    }

    // ── Payment succeeded (clears past_due + affiliate commission) ──────────
    case 'invoice.payment_succeeded': {
      const invoice = event.data.object as Stripe.Invoice
      const billingReason = (invoice as any).billing_reason

      const userId = await getUserIdByCustomer(invoice.customer as string)
      if (!userId) break

      const inv2 = invoice as any
      const subId = typeof inv2.subscription === 'string'
        ? inv2.subscription
        : inv2.subscription?.id

      const userBefore = await db.query.users.findFirst({
        where: eq(users.id, userId),
        columns: { email: true, deactivatedAt: true, paymentFailedAt: true, paymentFailedInvoiceId: true },
      })

      // Does this payment close an open arrears episode? Only if it pays the
      // tracked invoice (or that one is paid by now) — a different invoice
      // (e.g. an upgrade) leaves the old debt open.
      const settles = userBefore?.paymentFailedAt
        ? await paidInvoiceSettlesArrears(userBefore.paymentFailedInvoiceId, invoice.id)
        : false

      // The very first invoice: plan/status were set by checkout.session.completed.
      // Still, a late SEPA confirmation after a failure must end the episode.
      if (billingReason === 'subscription_create') {
        if (settles) {
          await clearPaymentFailure(userId)
          const reconciledFirst = await reconcileSiteAccess(userId)
          if (reconciledFirst.action === 'restored' && userBefore?.email) {
            sendEmail({ to: userBefore.email, subject: 'Dein Konto ist wieder aktiv!', html: accountReactivatedEmail(), type: 'account_reactivated' }).catch(() => {})
          }
        }
        break
      }
      if (!subId) break

      const sub = await stripe.subscriptions.retrieve(subId)
      const priceId = sub.items.data[0]?.price.id ?? ''
      const plan = getPlanByPriceId()[priceId] ?? 'starter'
      const interval = sub.items.data[0]?.price.recurring?.interval === 'year' ? 'yearly' : 'monthly'

      await db.update(users).set({
        subscriptionStatus: sub.status,
        currentPeriodEnd: getPeriodEnd(sub),
        ...(settles ? recoveryCleared : {}),
        deactivatedAt: null,
      }).where(eq(users.id, userId))

      // A fully deactivated account that pays again comes back completely
      if (userBefore?.deactivatedAt) {
        await restoreSites(userId, { includeScheduledDeletion: true })
      }

      // Sites follow the (fresh, from Stripe) subscription status. Usually
      // customer.subscription.updated already restored them — then this is a no-op
      // and no second email goes out. If that event was missed or arrives later,
      // this is the path that brings the sites back.
      const reconciled = await reconcileSiteAccess(userId)
      if (reconciled.action === 'restored' && userBefore?.email) {
        sendEmail({ to: userBefore.email, subject: 'Dein Konto ist wieder aktiv!', html: accountReactivatedEmail(), type: 'account_reactivated' }).catch(() => {})
      }

      const { pmType: renewedPmType, pmLast4: renewedPmLast4 } = await extractPaymentMethod(invoice)
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
        metadata: { payment_method_type: renewedPmType, payment_method_last4: renewedPmLast4 },
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

        if (referrer && invoice.id) {
          // Base = tax-free net from the real invoice (after discount, before VAT).
          const netPaid = computeInvoiceNet(invoice)
          const commissionAmount = commissionFromNet(netPaid)
          const availableAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)

          // Idempotent: unique on stripe_invoice_id
          if (commissionAmount > 0) {
            try {
              await db.insert(affiliateCommissions).values({
                referrerId: referrer.id,
                refereeId: userId,
                stripeInvoiceId: invoice.id,
                stripeCustomerId: invoice.customer as string,
                grossAmount: invoice.amount_paid,
                netAmount: netPaid,
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
      }
      break
    }

    // ── Refund → cancel unpaid commission / negative booking if already paid ──
    case 'charge.refunded': {
      const charge = event.data.object as any
      const invoiceId = charge.invoice
      if (!invoiceId) break

      await reverseCommissionsForInvoice(invoiceId, 'charge_refunded')
      break
    }

    // ── Chargeback (dispute lost, funds pulled) → same reversal rules ─────────
    case 'charge.dispute.funds_withdrawn': {
      const dispute = event.data.object as Stripe.Dispute
      const chargeId = typeof dispute.charge === 'string' ? dispute.charge : dispute.charge?.id
      if (!chargeId) break

      try {
        const charge = await stripe.charges.retrieve(chargeId) as any
        if (charge.invoice) {
          await reverseCommissionsForInvoice(charge.invoice, 'chargeback')
        }
      } catch (err) {
        console.error('[webhook] dispute charge lookup error:', err)
      }
      break
    }
  }

  return NextResponse.json({ received: true })
}
