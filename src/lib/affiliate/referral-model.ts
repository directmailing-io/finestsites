/**
 * Empfehlungsrabatt für geworbene Kunden – einzige Quelle der Wahrheit ("Modell C", ab 16.10.2026).
 *
 * Rein (kein DB-/Stripe-Zugriff, kein process.env) → läuft in Server-Routen, in Tests und
 * darf auch von Client-Komponenten importiert werden. Die Eingaben (Zeitpunkt, Coupon-IDs,
 * Neukunden-Prüfung) sammelt src/lib/affiliate/referral-offer.ts auf dem Server.
 *
 *  legacy10 (Bestandsschutz, altes Modell): 10 % dauerhaft, egal ob Monats- oder Jahresabo
 *           (Coupon STRIPE_AFFILIATE_COUPON_ID = AFFILIATE10, duration forever).
 *  c2026    (Modell C): Monatsabo 20 % nur auf die ERSTE Rechnung (AFFILIATE20FIRST, duration once),
 *           Jahresabo 10 % "Partnerpreis", solange das Jahresabo läuft (AFFILIATE10).
 *           Nur für echte Neukunden – wer schon einmal Kunde war, bekommt keinen Rabatt
 *           (der Partner behält Zuordnung und Provision).
 *
 * Partnerprovision (10 % vom Netto jeder bezahlten Rechnung) ist davon unabhängig.
 */

export type ReferralTerms = 'legacy10' | 'c2026'
export type ReferralInterval = 'monthly' | 'yearly'
export type ReferralDuration = 'once' | 'forever'
export type ReferralDeniedReason = 'returning_customer' | 'unavailable'

/** Start von Modell C, falls AFFILIATE_MODEL_C_START nicht gesetzt ist (16.10.2026, 00:00 Uhr deutscher Zeit;
 *  Daniel: neues Modell gilt sofort für neue Empfehlungen, bisher Geworbene behalten 10 % dauerhaft). */
export const AFFILIATE_MODEL_C_START_DEFAULT = '2026-10-16T00:00:00+02:00'

export const LEGACY_PERCENT = 10
export const FIRST_MONTH_PERCENT = 20
export const YEARLY_PARTNER_PERCENT = 10

export interface ReferralCoupons {
  /** AFFILIATE10 – 10 %, duration forever (alt: alle Intervalle; Modell C: nur Jahresabo) */
  legacy: string | null | undefined
  /** AFFILIATE20FIRST – 20 %, duration once (Modell C, nur Monatsabo) */
  firstMonth: string | null | undefined
}

/** Ungültige/fehlende Angabe → Standard-Startdatum. */
export function parseModelCStart(value: string | null | undefined): Date {
  const raw = value?.trim()
  if (raw) {
    const d = new Date(raw)
    if (!Number.isNaN(d.getTime())) return d
  }
  return new Date(AFFILIATE_MODEL_C_START_DEFAULT)
}

/**
 * Ein 'legacy10'-Vermerk, der nur aus der Zuordnung stammt (Registrierung bzw. Partnercode vor dem
 * Stichtag, noch kein bezahltes Abo), zählt nur, wenn das erste Abo innerhalb dieser Frist nach
 * dem Stichtag abgeschlossen wird. Danach wird neu entschieden (= Modell C).
 */
export const LEGACY_STAMP_GRACE_DAYS = 30

/** Ende der Frist für nicht bestätigte 'legacy10'-Vermerke (Stichtag + 30 Tage). */
export function legacyStampDeadline(startAt: Date): Date {
  return new Date(startAt.getTime() + LEGACY_STAMP_GRACE_DAYS * 24 * 60 * 60 * 1000)
}

/**
 * Welche Bedingungen gelten für eine Empfehlung?
 *  - am Konto gespeichert und durch ein Abo bestätigt (termsLocked) → bleibt (Bestandsschutz in beide Richtungen)
 *  - 'c2026' am Konto → bleibt
 *  - 'legacy10' am Konto, aber noch kein Abo (Vermerk aus Registrierung/Partnercode):
 *      gilt nur bis Stichtag + 30 Tage und nie bei einem Admin als Empfehlendem; sonst neu entscheiden
 *  - sonst: ab Stichtag Modell C, vorher altes Modell
 *  - Test: Ist der Empfehlende Admin (z. B. "demo"), gilt Modell C sofort
 *
 * `termsLocked` = das Konto hat/hatte ein Abo (der Vermerk stammt dann aus einem bezahlten Checkout
 * oder dem Bestands-Backfill). Fehlt die Angabe, gilt der Vermerk als bestätigt (altes Verhalten).
 */
export function resolveReferralTerms(input: {
  now: Date
  startAt: Date
  referrerIsAdmin: boolean
  termsOnUser: string | null | undefined
  termsLocked?: boolean
}): ReferralTerms {
  const locked = input.termsLocked ?? true
  if (input.termsOnUser === 'c2026') return 'c2026'
  if (input.termsOnUser === 'legacy10') {
    if (locked) return 'legacy10'
    if (!input.referrerIsAdmin && input.now.getTime() < legacyStampDeadline(input.startAt).getTime()) return 'legacy10'
    // abgelaufener bzw. ungültiger Vermerk → wie ohne Vermerk entscheiden
  }
  if (input.referrerIsAdmin) return 'c2026'
  return input.now.getTime() >= input.startAt.getTime() ? 'c2026' : 'legacy10'
}

export interface ResolvedReferralDiscount {
  terms: ReferralTerms
  interval: ReferralInterval
  /** Stripe-Coupon für den Checkout, null = kein Rabatt */
  couponId: string | null
  percentOff: number | null
  duration: ReferralDuration | null
  deniedReason: ReferralDeniedReason | null
}

/** Rabatt für EIN Intervall. Wirft nie; fehlende Coupon-Konfiguration → kein Rabatt ('unavailable'). */
export function resolveReferralOffer(input: {
  now: Date
  startAt: Date
  referrerIsAdmin: boolean
  interval: ReferralInterval
  isReturningCustomer: boolean
  termsOnUser: string | null | undefined
  termsLocked?: boolean
  coupons: ReferralCoupons
}): ResolvedReferralDiscount {
  const terms = resolveReferralTerms(input)
  const legacy = input.coupons.legacy?.trim() || null
  const firstMonth = input.coupons.firstMonth?.trim() || null
  const none = (deniedReason: ReferralDeniedReason): ResolvedReferralDiscount =>
    ({ terms, interval: input.interval, couponId: null, percentOff: null, duration: null, deniedReason })

  if (terms === 'legacy10') {
    // Altes Modell unverändert: keine Neukunden-Prüfung, 10 % dauerhaft auf jedes Intervall
    if (!legacy) return none('unavailable')
    return { terms, interval: input.interval, couponId: legacy, percentOff: LEGACY_PERCENT, duration: 'forever', deniedReason: null }
  }

  if (input.isReturningCustomer) return none('returning_customer')
  if (input.interval === 'monthly') {
    if (!firstMonth || firstMonth === legacy) return none('unavailable')
    return { terms, interval: 'monthly', couponId: firstMonth, percentOff: FIRST_MONTH_PERCENT, duration: 'once', deniedReason: null }
  }
  if (!legacy) return none('unavailable')
  return { terms, interval: 'yearly', couponId: legacy, percentOff: YEARLY_PARTNER_PERCENT, duration: 'forever', deniedReason: null }
}

/**
 * Harte Absicherung vor jedem Stripe-Aufruf: Der 20-%-Startbonus darf nie an ein Jahresabo,
 * AFFILIATE10 nie an ein Monatsabo mit Modell-C-Bedingungen. Wirft bei Verstoß.
 */
export function assertReferralCouponAllowed(terms: ReferralTerms | null | undefined, interval: ReferralInterval, couponIds: Array<string | null | undefined>, coupons: ReferralCoupons): void {
  const legacy = coupons.legacy?.trim() || null
  const firstMonth = coupons.firstMonth?.trim() || null
  for (const raw of couponIds) {
    const id = raw?.trim()
    if (!id) continue
    if (firstMonth && id === firstMonth && interval === 'yearly') {
      throw new Error(`[referral] Startbonus-Coupon ${id} darf nicht auf ein Jahresabo`)
    }
    if (legacy && id === legacy && terms === 'c2026' && interval === 'monthly') {
      throw new Error(`[referral] Coupon ${id} darf bei Modell C nicht auf ein Monatsabo`)
    }
  }
}

/** Gehört der Coupon zum Empfehlungsprogramm (alt oder neu)? Für Webhook-Logik (Override-Erkennung). */
export function isReferralCoupon(couponId: string | null | undefined, coupons: ReferralCoupons): boolean {
  const id = couponId?.trim()
  if (!id) return false
  return id === coupons.legacy?.trim() || id === coupons.firstMonth?.trim()
}

// ── Rabatt-Zusammenführung beim Wechsel ins Jahresabo / Upgrade ─────────────────────────────

/** Eine Discount-Angabe, wie sie stripe.subscriptions.update / invoices.createPreview erwarten. */
export type DiscountParam = { coupon: string } | { discount: string } | { promotion_code: string }

/** Coupon als ID oder (expandiert) Objekt; metadata.interval = 'monthly' | 'yearly' | 'both' (Admin-Gutscheine). */
type CouponRef = string | { id?: string | null; metadata?: Record<string, string> | null } | null | undefined

/** Minimale Form eines bestehenden Abo-/Kunden-Discounts (ID-String oder expandiertes Objekt, alte + dahlia-Form). */
export type ExistingDiscount = string | {
  id?: string | null
  coupon?: CouponRef
  source?: { coupon?: CouponRef } | null
}

function discountCoupon(d: ExistingDiscount): CouponRef {
  if (typeof d === 'string') return null
  return d.source?.coupon ?? d.coupon ?? null
}

function discountCouponId(d: ExistingDiscount): string | null {
  const c = discountCoupon(d)
  if (!c) return null
  return typeof c === 'string' ? c : c.id ?? null
}

/** Intervall-Beschränkung des Coupons (nur bekannt, wenn der Coupon expandiert ist). */
function discountIntervalRestriction(d: ExistingDiscount): ReferralInterval | null {
  const c = discountCoupon(d)
  if (!c || typeof c === 'string') return null
  const v = c.metadata?.interval
  return v === 'monthly' || v === 'yearly' ? v : null
}

export interface DiscountMergeResult {
  /** null = Rabatte NICHT mitschicken (Stripe behält alle bestehenden unverändert) */
  discounts: DiscountParam[] | null
  addedCoupon: string | null
  removedCoupons: string[]
}

/**
 * Welche Abo-Rabatte gelten nach einem Plan-/Intervallwechsel?
 *  - Intervallwechsel (Monat → Jahr): IMMER eine explizite Liste. Rabatte, deren Coupon per
 *    metadata.interval auf ein anderes Intervall beschränkt ist (z. B. Monats-Aktionen, auch
 *    'repeating'), fallen weg – wie im Checkout; der 20-%-Startbonus ebenso.
 *  - c2026 → Jahresabo: AFFILIATE10 ergänzen (falls nicht schon da)
 *  - legacy10 / ohne Empfehlung ohne Intervallwechsel: nichts ändern (AFFILIATE10 bleibt, wie bisher)
 *  - c2026 bleibt Monatsabo: nichts ändern
 * Hat das Abo selbst keine Rabatte, wirkt ein Kunden-Rabatt (customer.discount) – der wird in eine
 * explizite Liste übernommen, sonst ginge er durch das Mitschicken verloren (er wird nicht gefiltert:
 * am Abo lässt er sich ohnehin nicht abschalten).
 * Discounts ohne erkennbaren Coupon (nicht expandiert) werden per ID weitergereicht, also nie verworfen.
 */
export function mergeReferralDiscounts(input: {
  terms: ReferralTerms | null | undefined
  /** true, solange der Kunde einem Partner zugeordnet ist UND den Empfehlungsrabatt bekam */
  referralActive: boolean
  targetInterval: ReferralInterval
  /** aktuelles Intervall des Abos; fehlt es, gilt: kein Intervallwechsel */
  currentInterval?: ReferralInterval | null
  existing: ExistingDiscount[] | null | undefined
  /** customer.discount (wirkt nur, solange das Abo keine eigenen Rabatte hat) */
  customerDiscount?: ExistingDiscount | null
  coupons: ReferralCoupons
}): DiscountMergeResult {
  const unchanged: DiscountMergeResult = { discounts: null, addedCoupon: null, removedCoupons: [] }
  const intervalChange = !!input.currentInterval && input.currentInterval !== input.targetInterval
  if (input.targetInterval !== 'yearly' && !intervalChange) return unchanged
  const legacy = input.coupons.legacy?.trim() || null
  const firstMonth = input.coupons.firstMonth?.trim() || null

  const own = (input.existing ?? []).filter(Boolean)
  // Ohne eigene Abo-Rabatte gilt der Kunden-Rabatt → in die Betrachtung aufnehmen
  const inherited = own.length === 0 && !!input.customerDiscount
  const existing = inherited ? [input.customerDiscount!] : own
  const couponIds = existing.map(discountCouponId)
  // Ein geerbter Kunden-Rabatt lässt sich am Abo nicht entfernen (er wirkt, sobald das Abo keine
  // eigenen Rabatte hat) – er bleibt daher in der Liste, damit Vorschau und Rechnung übereinstimmen.
  const dropped = existing.map((d, i) => !inherited && (
    (input.targetInterval === 'yearly' && !!firstMonth && couponIds[i] === firstMonth)
    || (intervalChange && (() => { const r = discountIntervalRestriction(d); return !!r && r !== input.targetInterval })())))
  const hasLegacy = !!legacy && couponIds.some((c, i) => c === legacy && !dropped[i])
  const addLegacy = input.targetInterval === 'yearly' && input.terms === 'c2026' && input.referralActive && !!legacy && !hasLegacy
  if (!intervalChange && !addLegacy && !dropped.some(Boolean)) return unchanged

  const kept: DiscountParam[] = []
  const removed: string[] = []
  existing.forEach((d, i) => {
    const cid = couponIds[i]
    if (dropped[i]) { removed.push(cid ?? (typeof d === 'string' ? d : d.id ?? '?')); return }
    const id = typeof d === 'string' ? d : d.id ?? null
    if (id) kept.push({ discount: id })
    else if (cid) kept.push({ coupon: cid })
  })
  if (addLegacy) kept.push({ coupon: legacy! })
  return { discounts: kept, addedCoupon: addLegacy ? legacy : null, removedCoupons: removed }
}

/** Wert für den Stripe-Parameter `discounts`: leere Liste → '' (stripe-node lässt [] sonst weg). */
export function discountsParam(discounts: DiscountParam[]): DiscountParam[] | '' {
  return discounts.length ? discounts : ''
}

/** Coupon-IDs, die nach dem Wechsel wirken (für assertReferralCouponAllowed). */
export function effectiveCouponIds(existing: ExistingDiscount[] | null | undefined, merge: DiscountMergeResult, customerDiscount?: ExistingDiscount | null): string[] {
  const own = existing ?? []
  const all = customerDiscount ? [...own, customerDiscount] : own
  if (!merge.discounts) {
    const inherited = own.length === 0 && customerDiscount ? [customerDiscount] : own
    return inherited.map(discountCouponId).filter((x): x is string => !!x)
  }
  const byDiscountId = new Map(all.map(d => [typeof d === 'string' ? d : d.id ?? '', discountCouponId(d)]))
  return merge.discounts
    .map(d => 'coupon' in d ? d.coupon : 'discount' in d ? byDiscountId.get(d.discount) ?? null : null)
    .filter((x): x is string => !!x)
}

// ── Anzeige (Texte + Preise) ─────────────────────────────────────────────────────────────────

export interface ReferralPlanPrice {
  /** Monats- bzw. Jahrespreis ohne Rabatt (brutto, EUR) */
  regular_eur: number
  /** Betrag der ersten Rechnung */
  first_eur: number
  /** Betrag ab der zweiten Rechnung */
  after_eur: number
  /** z. B. "1. Monat 13,60 € statt 17 €, danach 17 €" */
  text: string
}

export interface ReferralIntervalOffer {
  percent_off: number
  duration: ReferralDuration
  /** kurz, für Badges: "20 % im ersten Monat" / "10 % im Jahresabo, dauerhaft" */
  label: string
}

/** Öffentliche Form (JSON) – genau das bekommt die Oberfläche, sie rechnet nichts selbst. */
export interface ReferralOfferPublic {
  terms: ReferralTerms
  referrer_name: string
  eligible: boolean
  denied_reason: ReferralDeniedReason | null
  monthly: ReferralIntervalOffer | null
  yearly: ReferralIntervalOffer | null
  /** "Empfohlen von Anna: 20 % Rabatt auf deinen ersten Monat oder dauerhaft 10 % im Jahresabo" */
  headline: string
  /** zweite Zeile unter der Überschrift */
  detail: string
  /** neutraler Hinweis, z. B. "Der Startbonus gilt nur für neue Kunden." */
  note: string | null
  prices: Record<string, { monthly: ReferralPlanPrice; yearly: ReferralPlanPrice }>
}

/** Wie formatEur in billing/promo-duration: "17" bzw. "13,60" – nie Cent wegrunden. */
export function eur(amount: number): string {
  const cents = Math.round(amount * 100)
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2).replace('.', ',')
}

/** Wie Stripe: Rabatt auf den Rechnungsbetrag, auf Cent gerundet. */
export function applyPercent(amountEur: number, percent: number | null | undefined): number {
  const cents = Math.round(amountEur * 100)
  if (!percent) return cents / 100
  return (cents - Math.round(cents * percent / 100)) / 100
}

export function referralPriceLine(regularEur: number, interval: ReferralInterval, offer: ReferralIntervalOffer | null): ReferralPlanPrice {
  const regular = Math.round(regularEur * 100) / 100
  const unit = interval === 'monthly' ? 'im Monat' : 'im Jahr'
  if (!offer) return { regular_eur: regular, first_eur: regular, after_eur: regular, text: `${eur(regular)} € ${unit}` }
  const discounted = applyPercent(regular, offer.percent_off)
  if (offer.duration === 'once') {
    return interval === 'monthly'
      ? { regular_eur: regular, first_eur: discounted, after_eur: regular, text: `1. Monat ${eur(discounted)} € statt ${eur(regular)} €, danach ${eur(regular)} €` }
      : { regular_eur: regular, first_eur: discounted, after_eur: regular, text: `1. Jahr ${eur(discounted)} € statt ${eur(regular)} €, danach ${eur(regular)} €` }
  }
  return interval === 'monthly'
    ? { regular_eur: regular, first_eur: discounted, after_eur: discounted, text: `${eur(discounted)} € statt ${eur(regular)} €, jeden Monat` }
    : { regular_eur: regular, first_eur: discounted, after_eur: discounted, text: `Jahresabo ${eur(discounted)} € statt ${eur(regular)} €, jedes Jahr` }
}

function intervalOffer(r: ResolvedReferralDiscount): ReferralIntervalOffer | null {
  if (!r.couponId || !r.percentOff || !r.duration) return null
  const label = r.duration === 'once'
    ? `${r.percentOff} % im ersten Monat`
    : r.terms === 'c2026' ? `${r.percentOff} % im Jahresabo, dauerhaft` : `${r.percentOff} % Rabatt, dauerhaft`
  return { percent_off: r.percentOff, duration: r.duration, label }
}

/** Beide Intervalle + Texte + Preise je Tarif. `plans`: { starter: { monthly_eur, yearly_eur }, … } */
export function buildReferralOffer(input: {
  now: Date
  startAt: Date
  referrerIsAdmin: boolean
  isReturningCustomer: boolean
  termsOnUser: string | null | undefined
  termsLocked?: boolean
  coupons: ReferralCoupons
  referrerName: string
  plans: Record<string, { monthly_eur: number; yearly_eur: number }>
}): ReferralOfferPublic {
  const monthlyR = resolveReferralOffer({ ...input, interval: 'monthly' })
  const yearlyR = resolveReferralOffer({ ...input, interval: 'yearly' })
  const monthly = intervalOffer(monthlyR)
  const yearly = intervalOffer(yearlyR)
  const terms = monthlyR.terms
  const name = input.referrerName.trim() || 'deinem Partner'
  const denied = monthlyR.deniedReason ?? yearlyR.deniedReason

  let headline: string
  let detail: string
  let note: string | null = null
  if (terms === 'legacy10') {
    headline = monthly ? `Empfohlen von ${name}: dauerhaft 10 % Rabatt auf dein Abo` : `Empfohlen von ${name}`
    detail = monthly ? 'Der Rabatt wird beim Bezahlen automatisch abgezogen, jeden Monat und jedes Jahr.' : ''
  } else if (monthly || yearly) {
    // Klartext statt Trennpunkt: "20 % Rabatt auf deinen ersten Monat oder dauerhaft 10 % im Jahresabo"
    const parts = [
      monthly ? `${monthly.percent_off} % Rabatt auf deinen ersten Monat` : null,
      yearly ? (monthly ? `dauerhaft ${yearly.percent_off} % im Jahresabo` : `dauerhaft ${yearly.percent_off} % Rabatt im Jahresabo`) : null,
    ].filter(Boolean)
    headline = `Empfohlen von ${name}: ${parts.join(' oder ')}`
    detail = 'Der Rabatt wird beim Bezahlen automatisch abgezogen.'
  } else {
    headline = `Empfohlen von ${name}`
    detail = ''
  }
  if (denied === 'returning_customer') note = 'Der Startbonus gilt nur für neue Kunden.'

  const prices: ReferralOfferPublic['prices'] = {}
  for (const [key, p] of Object.entries(input.plans)) {
    prices[key] = {
      monthly: referralPriceLine(p.monthly_eur, 'monthly', monthly),
      yearly: referralPriceLine(p.yearly_eur, 'yearly', yearly),
    }
  }

  return {
    terms,
    referrer_name: name,
    eligible: !!(monthly || yearly),
    denied_reason: monthly || yearly ? null : denied,
    monthly,
    yearly,
    headline,
    detail,
    note,
    prices,
  }
}

// ── Texte für die Partner-Seite ──────────────────────────────────────────────────────────────

/** Was ein NEU geworbener Kunde dieses Partners heute bekommt (Kopfzeile + Schritt 2 der Partner-Seite). */
export function partnerReferralPitch(terms: ReferralTerms): { headline: string; step: string } {
  if (terms === 'legacy10') {
    return {
      headline: 'Dein Empfohlener spart 10 % dauerhaft.',
      // Partner rechtzeitig auf den Wechsel zu Modell C hinweisen (AGB § 16 Abs. 2)
      step: `Dein Empfohlener bucht FinestSites und zahlt dauerhaft 10 % weniger, egal welchen Tarif. Neue Kunden bekommen inzwischen stattdessen ${FIRST_MONTH_PERCENT} % auf den ersten Monat oder dauerhaft ${YEARLY_PARTNER_PERCENT} % im Jahresabo.`,
    }
  }
  return {
    headline: `Dein Empfohlener bekommt ${FIRST_MONTH_PERCENT} % auf den ersten Monat oder dauerhaft ${YEARLY_PARTNER_PERCENT} % im Jahresabo.`,
    step: `Dein Empfohlener bucht FinestSites und bekommt als Neukunde ${FIRST_MONTH_PERCENT} % auf den ersten Monat oder dauerhaft ${YEARLY_PARTNER_PERCENT} % im Jahresabo, egal welchen Tarif.`,
  }
}
