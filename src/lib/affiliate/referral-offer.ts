import type Stripe from 'stripe'
import { db } from '@/lib/db'
import { users, subscriptionEvents, emailLogs } from '@/lib/db/schema'
import { and, eq, ne, sql, inArray } from 'drizzle-orm'
import { PLANS } from '@/lib/plans'
import {
  buildReferralOffer,
  parseModelCStart,
  resolveReferralOffer,
  resolveReferralTerms,
  type ReferralCoupons,
  type ReferralInterval,
  type ReferralOfferPublic,
  type ResolvedReferralDiscount,
  type ReferralTerms,
  mergeReferralDiscounts,
  effectiveCouponIds,
  assertReferralCouponAllowed,
  type ExistingDiscount,
  type DiscountMergeResult,
} from '@/lib/affiliate/referral-model'

/**
 * Server-Seite des Empfehlungsrabatts: sammelt Eingaben (Env, DB, Stripe) für das reine
 * Modell in referral-model.ts. Wird von Checkout, Upgrade, Vorschau und den Anzeige-APIs
 * genutzt – alle rechnen damit dasselbe.
 */

export function referralCouponsFromEnv(): ReferralCoupons {
  return {
    legacy: process.env.STRIPE_AFFILIATE_COUPON_ID?.trim() || null,
    firstMonth: process.env.STRIPE_AFFILIATE_FIRST_MONTH_COUPON_ID?.trim() || null,
  }
}

export function modelCStartFromEnv(): Date {
  return parseModelCStart(process.env.AFFILIATE_MODEL_C_START)
}

const PLAN_PRICES = Object.fromEntries(
  Object.values(PLANS).map(p => [p.key, { monthly_eur: p.monthly_eur, yearly_eur: p.yearly_eur }]),
)

/** Ziffern der Teampartner-Nummer (Leerzeichen, Bindestriche usw. ignoriert). */
export function normalizeTeamPartnerNumber(v: string | null | undefined): string | null {
  const digits = (v ?? '').replace(/\D/g, '')
  return digits.length >= 4 ? digits : null
}

const ENDED_STATUSES = ['canceled', 'incomplete_expired', 'unpaid']
const RUNNING_STATUSES = ['active', 'trialing', 'past_due']
/** Mails, die nur an echte (frühere) Kunden gehen */
const CUSTOMER_MAIL_TYPES = ['subscription_confirmation', 'account_expired', 'account_deactivated', 'account_canceled', 'upcoming_debit']

export interface ReturningCustomerCheck {
  returning: boolean
  /** z. B. ['own_history'], ['team_partner_number:anna'], ['email_stripe:cus_…'] */
  reasons: string[]
}

/**
 * "Nur echte Neukunden": war diese Person schon einmal FinestSites-Kunde?
 *  1. eigenes Konto hatte schon ein Abo (DB-Ereignis/Status oder Stripe-Kunde mit Abo)
 *  2. anderes Konto mit derselben Teampartner-Nummer hatte ein Abo, das BEENDET ist
 *     (läuft das andere Abo noch, zählt es nicht – Paare/Duo-Partner teilen Nummern)
 *  3. dieselbe E-Mail war schon Kunde: Kunden-Mails im E-Mail-Log (überlebt gelöschte Konten)
 *     und weitere Stripe-Kunden mit dieser E-Mail und einem Abo
 * Stripe-Fehler → diese Teilprüfung zählt als "nicht gefunden" (lieber Rabatt als Blockade).
 * Grenzen: neue E-Mail + neue/fehlende Teampartner-Nummer wird erst nach der Zahlung über den
 * Zahlungsmittel-Fingerprint erkannt (nur Hinweis, kein Entzug), siehe flagFingerprintMatch.
 */
export async function detectReturningCustomer(params: {
  userId: string
  email: string | null | undefined
  teamPartnerNumber: string | null | undefined
  stripeCustomerId: string | null | undefined
  subscriptionStatus: string | null | undefined
  stripeSubscriptionId: string | null | undefined
  deactivatedAt: Date | null | undefined
  stripe?: Stripe | null
}): Promise<ReturningCustomerCheck> {
  const reasons: string[] = []

  // 1. eigenes Konto (DB)
  if (params.stripeSubscriptionId || params.deactivatedAt
    || [...ENDED_STATUSES, ...RUNNING_STATUSES].includes(params.subscriptionStatus ?? '')) {
    reasons.push('own_history')
  } else {
    const ownEvent = await db.query.subscriptionEvents.findFirst({
      where: and(eq(subscriptionEvents.userId, params.userId), eq(subscriptionEvents.eventType, 'subscription_created')),
      columns: { id: true },
    })
    if (ownEvent) reasons.push('own_history')
  }

  // 2. Teampartner-Nummer eines anderen, beendeten Kontos
  const tpn = normalizeTeamPartnerNumber(params.teamPartnerNumber)
  if (tpn) {
    const others = await db.select({
      id: users.id,
      username: users.username,
      subscriptionStatus: users.subscriptionStatus,
      stripeSubscriptionId: users.stripeSubscriptionId,
      deactivatedAt: users.deactivatedAt,
    }).from(users).where(and(
      ne(users.id, params.userId),
      sql`regexp_replace(coalesce(${users.teamPartnerNumber}, ''), '\\D', '', 'g') = ${tpn}`,
    ))
    for (const o of others) {
      const running = RUNNING_STATUSES.includes(o.subscriptionStatus ?? '') && !!o.stripeSubscriptionId && !o.deactivatedAt
      if (running) continue
      let hadSubscription = ENDED_STATUSES.includes(o.subscriptionStatus ?? '') || !!o.deactivatedAt
      if (!hadSubscription) {
        const ev = await db.query.subscriptionEvents.findFirst({
          where: and(eq(subscriptionEvents.userId, o.id), eq(subscriptionEvents.eventType, 'subscription_created')),
          columns: { id: true },
        })
        hadSubscription = !!ev
      }
      if (hadSubscription) reasons.push(`team_partner_number:${o.username ?? o.id}`)
    }
  }

  // 3a. E-Mail-Log (Konten, die es nicht mehr gibt, hinterlassen hier Spuren)
  const email = params.email?.trim().toLowerCase()
  if (email && !reasons.includes('own_history')) {
    const mail = await db.select({ id: emailLogs.id }).from(emailLogs).where(and(
      sql`lower(${emailLogs.to}) = ${email}`,
      inArray(emailLogs.type, CUSTOMER_MAIL_TYPES),
      eq(emailLogs.status, 'sent'),
    )).limit(1)
    if (mail.length) reasons.push('email_log')
  }

  // 1b + 3b. Stripe: eigener Kunde mit früherem Abo, weitere Kunden mit derselben E-Mail
  const stripe = params.stripe
  if (stripe && !reasons.length) {
    const hadRealSubscription = async (customerId: string) => {
      const subs = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 5 })
      return subs.data.some(s => s.status !== 'incomplete' && s.status !== 'incomplete_expired')
    }
    try {
      if (params.stripeCustomerId && await hadRealSubscription(params.stripeCustomerId)) reasons.push('own_stripe_history')
    } catch (e) {
      console.error('[referral] own stripe check failed:', e instanceof Error ? e.message : e)
    }
    if (email && !reasons.length) {
      try {
        const customers = await stripe.customers.list({ email, limit: 10 })
        for (const c of customers.data) {
          if (c.id === params.stripeCustomerId) continue
          if (await hadRealSubscription(c.id)) { reasons.push(`email_stripe:${c.id}`); break }
        }
      } catch (e) {
        console.error('[referral] stripe email check failed:', e instanceof Error ? e.message : e)
      }
    }
  }

  return { returning: reasons.length > 0, reasons }
}

export interface ReferralContext {
  referrer: { id: string; username: string; firstName: string | null; isAdmin: boolean }
  terms: ReferralTerms
  returning: ReturningCustomerCheck
  coupons: ReferralCoupons
  now: Date
  startAt: Date
  termsOnUser: string | null
  /** Konto hat/hatte ein Abo → gespeicherte Konditionen sind bestätigt (siehe resolveReferralTerms) */
  termsLocked: boolean
}

type ProfileForReferral = {
  id: string
  email: string | null
  username: string | null
  teamPartnerNumber: string | null
  stripeCustomerId: string | null
  subscriptionStatus: string | null
  stripeSubscriptionId: string | null
  deactivatedAt: Date | null
  referralTerms: string | null
}

export const referralProfileColumns = {
  id: true, email: true, username: true, teamPartnerNumber: true, stripeCustomerId: true,
  subscriptionStatus: true, stripeSubscriptionId: true, deactivatedAt: true, referralTerms: true,
} as const

/** Hat/hatte das eigene Konto ein Abo? (DB: Abo-ID, Status, Deaktivierung, Ereignis subscription_created) */
export async function hasOwnSubscriptionHistory(profile: Pick<ProfileForReferral, 'id' | 'stripeSubscriptionId' | 'subscriptionStatus' | 'deactivatedAt'>): Promise<boolean> {
  if (profile.stripeSubscriptionId || profile.deactivatedAt
    || [...ENDED_STATUSES, ...RUNNING_STATUSES].includes(profile.subscriptionStatus ?? '')) return true
  const ev = await db.query.subscriptionEvents.findFirst({
    where: and(eq(subscriptionEvents.userId, profile.id), eq(subscriptionEvents.eventType, 'subscription_created')),
    columns: { id: true },
  })
  return !!ev
}

/**
 * Alles, was für die Entscheidung nötig ist. `referrerUsername` = gespeicherte Zuordnung
 * oder ein gerade eingegebener Partnercode. null, wenn kein (gültiger) Partner – auch bei
 * Selbstempfehlung.
 */
export async function loadReferralContext(params: {
  profile: ProfileForReferral
  referrerUsername: string | null | undefined
  stripe?: Stripe | null
  now?: Date
}): Promise<ReferralContext | null> {
  const code = params.referrerUsername?.trim().toLowerCase()
  if (!code) return null
  const referrer = await db.query.users.findFirst({
    where: eq(users.username, code),
    columns: { id: true, username: true, firstName: true, isAdmin: true },
  })
  if (!referrer?.username || referrer.id === params.profile.id) return null

  const now = params.now ?? new Date()
  const startAt = modelCStartFromEnv()
  const coupons = referralCouponsFromEnv()
  const termsOnUser = params.profile.referralTerms ?? null
  // Nur für einen 'legacy10'-Vermerk relevant: stammt er aus einem Abo (bestätigt) oder nur aus
  // der Zuordnung (Registrierung/Partnercode) – dann gilt er nur bis Stichtag + 30 Tage.
  const termsLocked = termsOnUser === 'legacy10' ? await hasOwnSubscriptionHistory(params.profile) : true
  const terms = resolveReferralTerms({ now, startAt, referrerIsAdmin: referrer.isAdmin, termsOnUser, termsLocked })
  // Neukunden-Prüfung nur für Modell C – das alte Modell bleibt unverändert
  const returning: ReturningCustomerCheck = terms === 'c2026'
    ? await detectReturningCustomer({ ...params.profile, userId: params.profile.id, stripe: params.stripe })
    : { returning: false, reasons: [] }

  return {
    referrer: { id: referrer.id, username: referrer.username, firstName: referrer.firstName, isAdmin: referrer.isAdmin },
    terms, returning, coupons, now, startAt, termsOnUser, termsLocked,
  }
}

/**
 * Wie loadReferralContext, wirft aber nie (für den Checkout): Fehler (DB, Stripe) → `failed: true`,
 * der Aufrufer macht ohne Empfehlungsrabatt weiter und behält die Zuordnung.
 */
export async function loadReferralContextSafe(params: Parameters<typeof loadReferralContext>[0]): Promise<{ ctx: ReferralContext | null; failed: boolean }> {
  try {
    return { ctx: await loadReferralContext(params), failed: false }
  } catch (err) {
    console.error('[referral] context error (continuing without referral discount):', err instanceof Error ? err.message : err)
    return { ctx: null, failed: true }
  }
}

export function referralDiscountFor(ctx: ReferralContext, interval: ReferralInterval): ResolvedReferralDiscount {
  return resolveReferralOffer({
    now: ctx.now,
    startAt: ctx.startAt,
    referrerIsAdmin: ctx.referrer.isAdmin,
    interval,
    isReturningCustomer: ctx.returning.returning,
    termsOnUser: ctx.termsOnUser,
    termsLocked: ctx.termsLocked,
    coupons: ctx.coupons,
  })
}

export function referralOfferFor(ctx: ReferralContext): ReferralOfferPublic {
  return buildReferralOffer({
    now: ctx.now,
    startAt: ctx.startAt,
    referrerIsAdmin: ctx.referrer.isAdmin,
    isReturningCustomer: ctx.returning.returning,
    termsOnUser: ctx.termsOnUser,
    termsLocked: ctx.termsLocked,
    coupons: ctx.coupons,
    referrerName: ctx.referrer.firstName ?? ctx.referrer.username,
    plans: PLAN_PRICES,
  })
}

/**
 * Angebot ohne Kundenkonto (Registrierung, Startseite): Neukunden-Prüfung ist noch nicht
 * möglich, gezeigt wird das Angebot für Neukunden.
 */
export function anonymousReferralOffer(referrer: { username: string; firstName: string | null; isAdmin: boolean }, now = new Date()): ReferralOfferPublic {
  return buildReferralOffer({
    now,
    startAt: modelCStartFromEnv(),
    referrerIsAdmin: referrer.isAdmin,
    isReturningCustomer: false,
    termsOnUser: null,
    coupons: referralCouponsFromEnv(),
    referrerName: referrer.firstName ?? referrer.username,
    plans: PLAN_PRICES,
  })
}

/**
 * Wird ein Partner VOR dem Stichtag zugeordnet (Registrierung, Code im Checkout), gilt für
 * dieses Konto das alte Modell – aber nur, wenn das erste Abo bis Stichtag + 30 Tage beginnt
 * (resolveReferralTerms mit termsLocked=false). Ist der Empfehlende Admin (Testpfad, Modell C
 * sofort), wird nie 'legacy10' vermerkt. Modell C wird erst beim Abschluss mit Rabatt
 * gespeichert (Webhook), ebenso bestätigt der Webhook 'legacy10' beim bezahlten Checkout.
 */
export async function stampLegacyTermsIfBeforeStart(userId: string, referrer: { isAdmin: boolean | null | undefined }, now = new Date()): Promise<ReferralTerms | null> {
  if (referrer.isAdmin) return null
  const terms = resolveReferralTerms({ now, startAt: modelCStartFromEnv(), referrerIsAdmin: false, termsOnUser: null })
  if (terms !== 'legacy10') return null
  const updated = await db.update(users)
    .set({ referralTerms: 'legacy10' })
    .where(and(eq(users.id, userId), sql`${users.referralTerms} IS NULL`))
    .returning({ id: users.id })
  return updated.length ? 'legacy10' : null
}

// ── Zahlungsmittel-Fingerprints (nach der Zahlung) ──────────────────────────────────────────

/** card.fingerprint bzw. sepa_debit.fingerprint eines Zahlungsmittels */
export function paymentMethodFingerprint(pm: Pick<Stripe.PaymentMethod, 'card' | 'sepa_debit'> | null | undefined): string | null {
  return pm?.card?.fingerprint ?? pm?.sepa_debit?.fingerprint ?? null
}

/** Fingerprint am Konto merken (für spätere Prüfungen anderer Konten). Idempotent. */
export async function rememberPaymentFingerprint(userId: string, fingerprint: string): Promise<void> {
  await db.update(users)
    .set({ paymentFingerprints: sql`array_append(${users.paymentFingerprints}, ${fingerprint})` })
    .where(and(eq(users.id, userId), sql`NOT (${fingerprint} = ANY(${users.paymentFingerprints}))`))
}

/**
 * Gehört das Zahlungsmittel einem ANDEREN, früheren (beendeten) Kunden? Dann nur markieren
 * (users.referral_discount_flag) und loggen – kein automatischer Entzug, der Admin entscheidet.
 * Gibt die Markierung zurück (oder null).
 */
export async function flagFingerprintMatch(userId: string, fingerprint: string): Promise<string | null> {
  const others = await db.select({
    id: users.id,
    username: users.username,
    subscriptionStatus: users.subscriptionStatus,
    stripeSubscriptionId: users.stripeSubscriptionId,
    deactivatedAt: users.deactivatedAt,
  }).from(users).where(and(
    ne(users.id, userId),
    sql`${fingerprint} = ANY(${users.paymentFingerprints})`,
  )).limit(10)
  const ended = others.find(o =>
    !!o.deactivatedAt || ENDED_STATUSES.includes(o.subscriptionStatus ?? '') || (!o.stripeSubscriptionId && !!o.subscriptionStatus))
  if (!ended) return null
  const flag = `fingerprint_match:${ended.username ?? ended.id}`
  await db.update(users).set({ referralDiscountFlag: flag }).where(eq(users.id, userId))
  console.warn('[referral] Startbonus an Zahlungsmittel eines früheren Kunden:', { userId, match: ended.username ?? ended.id })
  return flag
}

// ── Plan-/Intervallwechsel ──────────────────────────────────────────────────────────────────

/** Expand-Pfad für stripe.subscriptions.list, damit Coupon-Metadaten (interval) lesbar sind. */
export const PLAN_CHANGE_SUBSCRIPTION_EXPAND = ['data.discounts.source.coupon'] as const

/**
 * Kunden-Rabatt (customer.discount) mit expandiertem Coupon – nur relevant, wenn das Abo keine
 * eigenen Rabatte hat (dann wirkt er auf das Abo). Fehler → null (dann wird nichts übernommen).
 */
export async function loadInheritedCustomerDiscount(stripe: Stripe, sub: Pick<Stripe.Subscription, 'discounts' | 'customer'>): Promise<ExistingDiscount | null> {
  if ((sub.discounts ?? []).length > 0) return null
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id
  if (!customerId) return null
  const customer = await stripe.customers.retrieve(customerId, { expand: ['discount.source.coupon'] })
  if ((customer as Stripe.DeletedCustomer).deleted) return null
  return ((customer as Stripe.Customer).discount ?? null) as unknown as ExistingDiscount | null
}

/**
 * Rabatte für einen Plan-/Intervallwechsel (Upgrade-Route und Vorschau rechnen identisch).
 * `sub` muss mit expandierten Coupons geladen sein (PLAN_CHANGE_SUBSCRIPTION_EXPAND),
 * `customerDiscount` aus loadInheritedCustomerDiscount.
 * discounts = null → nichts mitschicken, Stripe behält alle bestehenden Rabatte.
 */
export function referralDiscountsForPlanChange(params: {
  profile: { username: string | null; referredByUsername: string | null; referralTerms: string | null }
  sub: Pick<Stripe.Subscription, 'discounts'>
  targetInterval: ReferralInterval
  currentInterval?: ReferralInterval | null
  customerDiscount?: ExistingDiscount | null
}): DiscountMergeResult & { terms: ReferralTerms | null } {
  const coupons = referralCouponsFromEnv()
  const terms = params.profile.referralTerms === 'c2026' || params.profile.referralTerms === 'legacy10'
    ? params.profile.referralTerms : null
  const referralActive = !!params.profile.referredByUsername && params.profile.referredByUsername !== params.profile.username
  const existing = (params.sub.discounts ?? []) as unknown as ExistingDiscount[]
  const customerDiscount = params.customerDiscount ?? null
  const merge = mergeReferralDiscounts({
    terms, referralActive, targetInterval: params.targetInterval, currentInterval: params.currentInterval,
    existing, customerDiscount, coupons,
  })
  if (merge.discounts) {
    // Harte Absicherung (wirft): kein Startbonus aufs Jahresabo, kein AFFILIATE10 auf Modell-C-Monatsabo
    assertReferralCouponAllowed(terms, params.targetInterval, effectiveCouponIds(existing, merge, customerDiscount), coupons)
  }
  return { ...merge, terms }
}
