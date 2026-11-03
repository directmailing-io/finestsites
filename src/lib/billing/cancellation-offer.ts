/**
 * Kündigungsflow – die Entscheidung „welches Angebot zu welchem Grund“ (docs/kuendigung/konzept.html, Abschnitt 04/08/09).
 *
 * Rein: kein DB-, kein Stripe-Zugriff, kein process.env – damit sie deterministisch testbar ist
 * (scripts/cancellation-offer-test.ts) und sich später ändern lässt, ohne die Oberfläche anzufassen.
 * Die Eingaben (Abo, Rabatt, Seitenzahl, Vorgeschichte) sammelt src/lib/billing/cancellation.ts.
 *
 * Leitplanken (Daniel, 03.11.2026): maximal zwei Schritte, genau EIN Hauptangebot je Grund,
 * „Trotzdem kündigen“ immer sichtbar, kein Angebot wird zweimal gemacht (der Treue-Rabatt gilt
 * als „gemacht“, sobald er angezeigt wurde).
 */
import { PLANS, PLAN_ORDER, getPlanMaxSites, type BillingInterval, type PlanKey } from '@/lib/plans'

export const CANCEL_REASONS = [
  'too_expensive',
  'not_needed_now',
  'business_ended',
  'missing_features',
  'too_complex',
  'switching',
  'other',
] as const
export type CancelReason = typeof CANCEL_REASONS[number]

export const CANCEL_REASON_LABELS: Record<CancelReason, string> = {
  too_expensive: 'Zu teuer, lohnt sich gerade nicht',
  not_needed_now: 'Ich brauche die Webseite gerade nicht',
  business_ended: 'Ich mache das Geschäft nicht mehr',
  missing_features: 'Mir fehlt etwas oder die Vorlage passt nicht',
  too_complex: 'Zu kompliziert oder technische Probleme',
  switching: 'Ich wechsle zu einem anderen Anbieter',
  other: 'Anderer Grund / möchte ich nicht sagen',
}

/** Stripe `cancellation_details.feedback` (feste Liste von Stripe) je Grund – so steht der Grund auch im Stripe-Dashboard. */
export const STRIPE_FEEDBACK: Record<CancelReason, 'too_expensive' | 'unused' | 'missing_features' | 'too_complex' | 'switched_service' | 'other'> = {
  too_expensive: 'too_expensive',
  not_needed_now: 'unused',
  business_ended: 'unused',
  missing_features: 'missing_features',
  too_complex: 'too_complex',
  switching: 'switched_service',
  other: 'other',
}

export function isCancelReason(v: unknown): v is CancelReason {
  return typeof v === 'string' && (CANCEL_REASONS as readonly string[]).includes(v)
}

/** Treue-Rabatt (Daniel: dauerhaft, einmal pro Konto) */
export const RETENTION_PERCENT = 10
/** Pause: 1 bis 3 Monate, eine je 12 Monate */
export const PAUSE_MONTH_OPTIONS = [1, 2, 3] as const
export const PAUSE_COOLDOWN_DAYS = 365
/** Jahresabo: mehr Restlaufzeit als das = „früh“ → Erinnerung statt Kündigung */
export const YEARLY_FAR_DAYS = 60

export type OfferKind = 'discount' | 'discount_followup' | 'pause' | 'downgrade' | 'reminder' | 'talk' | 'none'

export interface OfferContext {
  now: Date
  plan: PlanKey
  interval: BillingInterval
  /** Ende des bezahlten Zeitraums */
  periodEnd: Date
  /** Laufender Rabatt auf dem Abo (null = keiner) */
  discount: { percent: number; end: Date | null; forever: boolean } | null
  /** Treue-Rabatt schon einmal angezeigt/angewendet → nie wieder */
  retentionUsed: boolean
  /** Mindestens eine bezahlte Rechnung (kein Angebot in der ersten Woche) */
  hasPaidInvoice: boolean
  /** Admin-/Test-/internes Konto (100 % Rabatt) → keine Angebote */
  isInternal: boolean
  /** Pause möglich (kein Zahlungsproblem, keine Pause in den letzten 12 Monaten, keine laufende/geplante Pause) */
  pauseAllowed: boolean
  /** Es ist bereits ein Tarifwechsel zum Laufzeitende eingeplant (Stripe-Zeitplan) */
  pendingPlanChange: boolean
  /** Veröffentlichte Premium-Seiten (zählen gegen das Tarif-Limit) */
  paidPublishedSites: number
  /** Jahresabo: Erinnerung vor der Verlängerung ist schon bestellt */
  renewalReminderOptIn: boolean
}

export interface Offer {
  kind: OfferKind
  /** Treue-Rabatt: Prozent, Preis jetzt (ohne Rabatt) und mit Rabatt, je Abrechnung */
  discount?: { percent: number; priceBefore: number; priceAfter: number; unit: 'Monat' | 'Jahr'; startsAfter: string | null }
  /** Pause: wählbare Monate, Beginn (Laufzeitende) */
  pause?: { months: readonly number[]; from: string }
  /** Kleinerer Tarif, in den die Seitenzahl passt (als Haupt- oder Nebenangebot) */
  downgrade: { plan: PlanKey; name: string; price: number; unit: 'Monat' | 'Jahr' } | null
  /** Monatskunde: Jahresabo als Sparweg (Hinweiszeile) */
  yearlyHint: { perYear: number; perMonth: number } | null
  /** Jahreskunde kurz vor der Verlängerung: lieber monatlich weiter (nur im Kündigungsflow, nur zum Laufzeitende) */
  yearlyToMonthly: { price: number } | null
  /** Jahreskunde früh im Jahr: Erinnerung 14 Tage vor der Verlängerung (Variante E) */
  reminder: { periodEnd: string; remindAt: string } | null
  /** „Lass uns kurz sprechen“ anbieten (Nachricht in den Support-Chat) */
  talk: boolean
  /** Leiser Link „Oder erst mal pausieren“ */
  pauseLink: boolean
  /** Hinweis „Seite im Editor offline nehmen, das Jahr läuft weiter“ (Jahreskunde, braucht die Seite gerade nicht) */
  unpublishHint: boolean
  /** Empfehlungshinweis mit Zahl: eine Pro-Empfehlung ≈ 2,30 € im Monat Guthaben */
  referralPerMonth: number
  periodEnd: string
  plan: PlanKey
  interval: BillingInterval
}

const DAY_MS = 24 * 60 * 60 * 1000

/** 10 % vom Netto einer Pro-Monatsrechnung (27 € brutto / 1,19 × 10 %) – für den Empfehlungshinweis */
export const REFERRAL_PRO_PER_MONTH = Math.round((PLANS.pro.monthly_eur / 1.19) * 0.1 * 100) / 100

export function priceOf(plan: PlanKey, interval: BillingInterval): number {
  return interval === 'yearly' ? PLANS[plan].yearly_eur : PLANS[plan].monthly_eur
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** Kleinster Tarif unterhalb des aktuellen, in den die veröffentlichten Premium-Seiten passen (null = keiner). */
export function fittingDowngrade(plan: PlanKey, paidPublishedSites: number): PlanKey | null {
  const idx = PLAN_ORDER.indexOf(plan)
  for (let i = 0; i < idx; i++) {
    const candidate = PLAN_ORDER[i]
    const limit = getPlanMaxSites(candidate)
    if (limit < 0 || paidPublishedSites <= limit) return candidate
  }
  return null
}

/** Treue-Rabatt möglich? 'now' = sofort, 'followup' = ab dem Ende des laufenden befristeten Rabatts, null = nein */
export function retentionMode(ctx: OfferContext): 'now' | 'followup' | null {
  if (ctx.isInternal || ctx.retentionUsed || !ctx.hasPaidInvoice || ctx.pendingPlanChange) return null
  if (!ctx.discount) return 'now'
  if (ctx.discount.forever || !ctx.discount.end) return null
  if (ctx.discount.percent >= 100) return null
  return 'followup'
}

export function isYearlyFar(ctx: OfferContext): boolean {
  return ctx.interval === 'yearly' && ctx.periodEnd.getTime() - ctx.now.getTime() > YEARLY_FAR_DAYS * DAY_MS
}

/**
 * Die Entscheidungstabelle aus dem Konzept (Abschnitt 04, 08, 09).
 */
export function decideOffer(reason: CancelReason, ctx: OfferContext): Offer {
  const unit: 'Monat' | 'Jahr' = ctx.interval === 'yearly' ? 'Jahr' : 'Monat'
  const price = priceOf(ctx.plan, ctx.interval)
  const highValue = ctx.plan === 'unlimited' || ctx.interval === 'yearly'
  const downgradePlan = !ctx.pendingPlanChange ? fittingDowngrade(ctx.plan, ctx.paidPublishedSites) : null
  const downgrade = downgradePlan
    ? { plan: downgradePlan, name: PLANS[downgradePlan].name, price: priceOf(downgradePlan, ctx.interval), unit }
    : null
  const yearlyHint = ctx.interval === 'monthly' && !ctx.isInternal
    ? { perYear: PLANS[ctx.plan].yearly_eur, perMonth: round2(PLANS[ctx.plan].yearly_eur / 12) }
    : null
  const yearlyFar = isYearlyFar(ctx)
  const yearlyToMonthly = ctx.interval === 'yearly' && !yearlyFar && !ctx.pendingPlanChange && !ctx.isInternal
    ? { price: PLANS[ctx.plan].monthly_eur }
    : null
  const mode = retentionMode(ctx)
  const discountOffer = mode
    ? {
        percent: RETENTION_PERCENT,
        priceBefore: price,
        priceAfter: round2(price * (1 - RETENTION_PERCENT / 100)),
        unit,
        startsAfter: mode === 'followup' && ctx.discount?.end ? ctx.discount.end.toISOString() : null,
      }
    : undefined
  const base: Omit<Offer, 'kind'> = {
    downgrade,
    yearlyHint,
    yearlyToMonthly,
    reminder: null,
    talk: false,
    pauseLink: false,
    unpublishHint: false,
    referralPerMonth: REFERRAL_PRO_PER_MONTH,
    periodEnd: ctx.periodEnd.toISOString(),
    plan: ctx.plan,
    interval: ctx.interval,
  }
  const pauseOffer = { months: PAUSE_MONTH_OPTIONS, from: ctx.periodEnd.toISOString() }

  if (ctx.isInternal) return { ...base, kind: 'none', downgrade: null, yearlyHint: null, yearlyToMonthly: null }

  // Jahresabo mit viel Restlaufzeit: nichts zu sparen, nichts zu pausieren – Erinnerung statt Kündigung (Variante E)
  if (yearlyFar) {
    const remindAt = new Date(ctx.periodEnd.getTime() - 14 * DAY_MS).toISOString()
    const reminder = ctx.renewalReminderOptIn ? null : { periodEnd: ctx.periodEnd.toISOString(), remindAt }
    return {
      ...base,
      kind: reminder ? 'reminder' : 'none',
      reminder,
      talk: reason === 'missing_features' || reason === 'too_complex' || reason === 'too_expensive',
      unpublishHint: reason === 'not_needed_now',
      // Preisfrage erst zur Verlängerung: kleinerer Tarif zum Laufzeitende bleibt als Nebenzeile
      downgrade: reason === 'too_expensive' ? downgrade : null,
      yearlyToMonthly: null,
    }
  }

  switch (reason) {
    case 'too_expensive': {
      if (mode === 'now') return { ...base, kind: 'discount', discount: discountOffer, talk: highValue, pauseLink: ctx.pauseAllowed }
      if (mode === 'followup') return { ...base, kind: 'discount_followup', discount: discountOffer, talk: highValue, pauseLink: ctx.pauseAllowed }
      if (downgrade) return { ...base, kind: 'downgrade', downgrade, talk: highValue, pauseLink: ctx.pauseAllowed }
      return { ...base, kind: 'none', talk: highValue, pauseLink: ctx.pauseAllowed }
    }
    case 'not_needed_now': {
      if (ctx.pauseAllowed) return { ...base, kind: 'pause', pause: pauseOffer, downgrade: null, yearlyHint: null, yearlyToMonthly: null }
      if (mode === 'now') return { ...base, kind: 'discount', discount: discountOffer, downgrade: null, yearlyHint: null }
      return { ...base, kind: 'none', downgrade: null, yearlyHint: null }
    }
    case 'business_ended':
      // Kein Verkaufsangebot (Variante D): warmer Abschluss, Pause als leiser Link
      return { ...base, kind: 'none', downgrade: null, yearlyHint: null, yearlyToMonthly: null, pauseLink: ctx.pauseAllowed }
    case 'missing_features':
    case 'too_complex':
      return { ...base, kind: 'talk', talk: true, pauseLink: ctx.pauseAllowed, downgrade: null, yearlyHint: null, yearlyToMonthly: null }
    case 'switching': {
      if (mode === 'now') return { ...base, kind: 'discount', discount: discountOffer, downgrade: null, yearlyHint: null }
      if (mode === 'followup') return { ...base, kind: 'discount_followup', discount: discountOffer, downgrade: null, yearlyHint: null }
      return { ...base, kind: 'none', downgrade: null, yearlyHint: null, yearlyToMonthly: null }
    }
    case 'other':
    default: {
      // Pause und (falls möglich) Treue-Rabatt als zwei ruhige Optionen: Pause ist das Hauptangebot,
      // der Rabatt steht als zweite Karte darunter (die Oberfläche zeigt `discount`, wenn gesetzt)
      if (ctx.pauseAllowed) return { ...base, kind: 'pause', pause: pauseOffer, discount: discountOffer, downgrade: null, yearlyHint: null, yearlyToMonthly: null }
      if (mode === 'now') return { ...base, kind: 'discount', discount: discountOffer, downgrade: null, yearlyHint: null, yearlyToMonthly: null }
      if (mode === 'followup') return { ...base, kind: 'discount_followup', discount: discountOffer, downgrade: null, yearlyHint: null, yearlyToMonthly: null }
      return { ...base, kind: 'none', downgrade: null, yearlyHint: null, yearlyToMonthly: null }
    }
  }
}

/** Welches Angebot in der Tabelle steht (offer_shown) – inkl. Nebenangebot bei „other“ */
export function offerShownLabel(offer: Offer): string {
  if (offer.kind === 'pause' && offer.discount) return 'pause+discount'
  return offer.kind
}
