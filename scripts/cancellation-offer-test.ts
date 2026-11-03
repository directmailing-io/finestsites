/**
 * Deterministische Tests der Angebotslogik im Kündigungsflow (src/lib/billing/cancellation-offer.ts).
 *   npx tsx scripts/cancellation-offer-test.ts
 * Kein DB-/Stripe-Zugriff. Jede Zeile der Entscheidungstabelle aus docs/kuendigung/konzept.html wird geprüft.
 */
import assert from 'node:assert/strict'
import { decideOffer, fittingDowngrade, retentionMode, isYearlyFar, type OfferContext, CANCEL_REASONS } from '../src/lib/billing/cancellation-offer'

const now = new Date('2026-11-03T10:00:00Z')
const days = (n: number) => new Date(now.getTime() + n * 24 * 60 * 60 * 1000)

function ctx(over: Partial<OfferContext> = {}): OfferContext {
  return {
    now,
    plan: 'pro',
    interval: 'monthly',
    periodEnd: days(20),
    discount: null,
    retentionUsed: false,
    hasPaidInvoice: true,
    isInternal: false,
    pauseAllowed: true,
    pendingPlanChange: false,
    paidPublishedSites: 1,
    renewalReminderOptIn: false,
    ...over,
  }
}

let n = 0
function t(name: string, fn: () => void) { fn(); n++; console.log('  ✓', name) }

// ── Treue-Rabatt ──────────────────────────────────────────────────────────────
t('ohne Rabatt → sofort', () => assert.equal(retentionMode(ctx()), 'now'))
t('befristeter Rabatt → Anschluss', () => assert.equal(retentionMode(ctx({ discount: { percent: 20, end: days(60), forever: false } })), 'followup'))
t('dauerhafter Rabatt (Geworbene/Team) → kein Angebot', () => assert.equal(retentionMode(ctx({ discount: { percent: 10, end: null, forever: true } })), null))
t('schon gezeigt → nie wieder', () => assert.equal(retentionMode(ctx({ retentionUsed: true })), null))
t('keine bezahlte Rechnung → kein Angebot', () => assert.equal(retentionMode(ctx({ hasPaidInvoice: false })), null))
t('Tarifwechsel eingeplant → kein Rabatt (ein Zeitplan)', () => assert.equal(retentionMode(ctx({ pendingPlanChange: true })), null))
t('100 %-Konto → nichts', () => assert.equal(decideOffer('too_expensive', ctx({ isInternal: true })).kind, 'none'))

// ── Kleinerer Tarif ───────────────────────────────────────────────────────────
t('Pro mit 1 Seite → Starter passt', () => assert.equal(fittingDowngrade('pro', 1), 'starter'))
t('Pro mit 2 Seiten → nichts passt', () => assert.equal(fittingDowngrade('pro', 2), null))
t('Unlimited mit 3 Seiten → Pro', () => assert.equal(fittingDowngrade('unlimited', 3), 'pro'))
t('Unlimited mit 0 Seiten → Starter (kleinster)', () => assert.equal(fittingDowngrade('unlimited', 0), 'starter'))
t('Starter → nichts', () => assert.equal(fittingDowngrade('starter', 1), null))

// ── Zu teuer ─────────────────────────────────────────────────────────────────
t('zu teuer, kein Rabatt → 10 % sofort, Preis 24,30', () => {
  const o = decideOffer('too_expensive', ctx())
  assert.equal(o.kind, 'discount'); assert.equal(o.discount?.priceAfter, 24.3); assert.equal(o.discount?.unit, 'Monat'); assert.ok(o.downgrade); assert.ok(o.yearlyHint)
})
t('zu teuer, 20 % bis Januar → Anschluss ab Rabattende', () => {
  const o = decideOffer('too_expensive', ctx({ discount: { percent: 20, end: days(70), forever: false } }))
  assert.equal(o.kind, 'discount_followup'); assert.equal(o.discount?.startsAfter, days(70).toISOString())
})
t('zu teuer, Rabatt schon genutzt, 1 Seite → kleinerer Tarif als Hauptangebot', () => {
  const o = decideOffer('too_expensive', ctx({ retentionUsed: true }))
  assert.equal(o.kind, 'downgrade'); assert.equal(o.downgrade?.plan, 'starter'); assert.equal(o.downgrade?.price, 17)
})
t('zu teuer, dauerhafter Rabatt, 3 Seiten auf Pro → nichts außer Hinweisen', () => {
  const o = decideOffer('too_expensive', ctx({ discount: { percent: 10, end: null, forever: true }, paidPublishedSites: 3 }))
  assert.equal(o.kind, 'none'); assert.equal(o.downgrade, null); assert.ok(o.yearlyHint); assert.equal(o.pauseLink, true)
})
t('Unlimited → Gespräch zusätzlich', () => assert.equal(decideOffer('too_expensive', ctx({ plan: 'unlimited' })).talk, true))
t('Jahresabo kurz vor Verlängerung → Jahr→Monat als Nebenzeile, 243 € mit Rabatt', () => {
  const o = decideOffer('too_expensive', ctx({ interval: 'yearly', periodEnd: days(30) }))
  assert.equal(o.kind, 'discount'); assert.equal(o.discount?.priceAfter, 243); assert.equal(o.discount?.unit, 'Jahr'); assert.equal(o.yearlyToMonthly?.price, 27); assert.equal(o.yearlyHint, null); assert.equal(o.talk, true)
})

// ── Brauche ich gerade nicht ─────────────────────────────────────────────────
t('nicht nötig → Pause 1–3 Monate ab Laufzeitende', () => {
  const o = decideOffer('not_needed_now', ctx())
  assert.equal(o.kind, 'pause'); assert.deepEqual([...o.pause!.months], [1, 2, 3]); assert.equal(o.pause?.from, days(20).toISOString()); assert.equal(o.downgrade, null)
})
t('nicht nötig, Pause verbraucht → 10 % falls möglich', () => assert.equal(decideOffer('not_needed_now', ctx({ pauseAllowed: false })).kind, 'discount'))
t('nicht nötig, Pause verbraucht, Rabatt gezeigt → nichts', () => assert.equal(decideOffer('not_needed_now', ctx({ pauseAllowed: false, retentionUsed: true })).kind, 'none'))

// ── Geschäft beendet / Gespräch / Wechsel / Sonstiges ─────────────────────────
t('Geschäft beendet → kein Verkaufsangebot, Pause als Link', () => {
  const o = decideOffer('business_ended', ctx()); assert.equal(o.kind, 'none'); assert.equal(o.pauseLink, true); assert.equal(o.downgrade, null)
})
t('fehlt etwas → Gespräch', () => assert.equal(decideOffer('missing_features', ctx()).kind, 'talk'))
t('zu kompliziert → Gespräch', () => assert.equal(decideOffer('too_complex', ctx()).kind, 'talk'))
t('Anbieterwechsel ohne Rabatt → 10 %', () => assert.equal(decideOffer('switching', ctx()).kind, 'discount'))
t('Anbieterwechsel mit Dauerrabatt → nichts', () => assert.equal(decideOffer('switching', ctx({ discount: { percent: 10, end: null, forever: true } })).kind, 'none'))
t('Sonstiges → Pause + Rabatt als zwei Optionen', () => {
  const o = decideOffer('other', ctx()); assert.equal(o.kind, 'pause'); assert.ok(o.discount)
})

// ── Jahresabo früh ───────────────────────────────────────────────────────────
t('Jahresabo mit 200 Tagen Rest → früh', () => assert.equal(isYearlyFar(ctx({ interval: 'yearly', periodEnd: days(200) })), true))
t('Jahresabo mit 59 Tagen Rest → nicht früh', () => assert.equal(isYearlyFar(ctx({ interval: 'yearly', periodEnd: days(59) })), false))
t('Jahresabo früh → Erinnerung statt Kündigung (14 Tage vorher)', () => {
  const o = decideOffer('too_expensive', ctx({ interval: 'yearly', periodEnd: days(200) }))
  assert.equal(o.kind, 'reminder'); assert.equal(o.reminder?.remindAt, days(186).toISOString()); assert.ok(o.downgrade); assert.equal(o.yearlyToMonthly, null)
})
t('Jahresabo früh, Erinnerung schon bestellt → nichts mehr', () => assert.equal(decideOffer('other', ctx({ interval: 'yearly', periodEnd: days(200), renewalReminderOptIn: true })).kind, 'none'))
t('Jahresabo früh, braucht Seite nicht → Hinweis offline nehmen', () => assert.equal(decideOffer('not_needed_now', ctx({ interval: 'yearly', periodEnd: days(200) })).unpublishHint, true))
t('Jahresabo früh, fehlt etwas → Gespräch zusätzlich', () => assert.equal(decideOffer('missing_features', ctx({ interval: 'yearly', periodEnd: days(200) })).talk, true))

// ── Jeder Grund liefert ein wohlgeformtes Angebot ────────────────────────────
for (const r of CANCEL_REASONS) {
  t(`Grund ${r}: vollständig`, () => {
    const o = decideOffer(r, ctx())
    assert.ok(o.periodEnd); assert.ok(o.referralPerMonth > 2 && o.referralPerMonth < 3); assert.ok(['discount', 'discount_followup', 'pause', 'downgrade', 'reminder', 'talk', 'none'].includes(o.kind))
  })
}

console.log(`\n${n} Prüfungen bestanden.`)
