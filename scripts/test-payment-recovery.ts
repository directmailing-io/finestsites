/**
 * Pure-logic checks for the payment recovery rules.
 * Run: npx tsx scripts/test-payment-recovery.ts
 */
import assert from 'node:assert/strict'
import {
  shouldBeOffline,
  pickFallbackPaymentMethod,
  addDays,
  GRACE_DAYS,
  HARD_DEADLINE_DAYS,
  type PaymentMethodSummary,
} from '../src/lib/billing/payment-recovery'

const t0 = new Date('2026-10-10T10:00:00Z')
const failedAt = t0
const graceUntil = addDays(failedAt, GRACE_DAYS)
const base = { subscriptionStatus: 'past_due', paymentFailedAt: failedAt, paymentGraceUntil: graceUntil, paymentRetryProcessingAt: null }

// No failure → online, whatever Stripe says (SEPA processing = past_due)
assert.equal(shouldBeOffline({ subscriptionStatus: 'past_due', paymentFailedAt: null, paymentGraceUntil: null, paymentRetryProcessingAt: null }, t0), false)
assert.equal(shouldBeOffline({ subscriptionStatus: 'active', paymentFailedAt: null, paymentGraceUntil: null, paymentRetryProcessingAt: null }, t0), false)
// Stripe gave up → offline
assert.equal(shouldBeOffline({ subscriptionStatus: 'unpaid', paymentFailedAt: null, paymentGraceUntil: null, paymentRetryProcessingAt: null }, t0), true)

// Day 0 … day 6: online; day 7: offline
assert.equal(shouldBeOffline(base, t0), false)
assert.equal(shouldBeOffline(base, addDays(t0, 6.9)), false)
assert.equal(shouldBeOffline(base, addDays(t0, 7)), true)
assert.equal(shouldBeOffline(base, addDays(t0, 10)), true)

// Stripe says active (voided first invoice) but our episode is open → still enforced
assert.equal(shouldBeOffline({ ...base, subscriptionStatus: 'active' }, addDays(t0, 8)), true)

// A retry in flight keeps the sites online past the grace …
assert.equal(shouldBeOffline({ ...base, paymentRetryProcessingAt: addDays(t0, 6) }, addDays(t0, 12)), false)
// … but never past the hard deadline
assert.equal(shouldBeOffline({ ...base, paymentRetryProcessingAt: addDays(t0, 6) }, addDays(t0, HARD_DEADLINE_DAYS)), true)

// Second strike: grace set to "now" → offline immediately
assert.equal(shouldBeOffline({ ...base, paymentGraceUntil: addDays(t0, 9) }, addDays(t0, 9)), true)
assert.equal(shouldBeOffline({ ...base, paymentGraceUntil: addDays(t0, 9) }, addDays(t0, 8.99)), false)

// Fallback selection
const pm = (over: Partial<PaymentMethodSummary>): PaymentMethodSummary => ({
  id: 'pm_x', type: 'card', label: 'Visa •••• 4242', brand: 'Visa', last4: '4242',
  expMonth: 12, expYear: 2030, expired: false, isDefault: false, created: 1, ...over,
})
const sepa = pm({ id: 'pm_sepa', type: 'sepa_debit', label: 'SEPA •••• 3000', created: 5 })
const oldCard = pm({ id: 'pm_old', created: 1 })
const newCard = pm({ id: 'pm_new', created: 9 })
const expiredCard = pm({ id: 'pm_exp', created: 10, expired: true })
const defaultCard = pm({ id: 'pm_def', created: 2, isDefault: true })

// SEPA failed, two cards → newest card
assert.equal(pickFallbackPaymentMethod([sepa, oldCard, newCard], 'pm_sepa', false)?.id, 'pm_new')
// … unless one card is the customer default
assert.equal(pickFallbackPaymentMethod([sepa, newCard, defaultCard], 'pm_sepa', false)?.id, 'pm_def')
// Expired cards are never used
assert.equal(pickFallbackPaymentMethod([sepa, expiredCard], 'pm_sepa', false), null)
// The method that just failed is never retried as fallback
assert.equal(pickFallbackPaymentMethod([newCard], 'pm_new', true), null)
// Card failed, SEPA on file → only with opt-in
assert.equal(pickFallbackPaymentMethod([newCard, sepa], 'pm_new', false), null)
assert.equal(pickFallbackPaymentMethod([newCard, sepa], 'pm_new', true)?.id, 'pm_sepa')
// Card failed, other card on file → card wins over SEPA even with opt-in
assert.equal(pickFallbackPaymentMethod([newCard, oldCard, sepa], 'pm_new', true)?.id, 'pm_old')

console.log('payment-recovery: all checks passed')
