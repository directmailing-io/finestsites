/**
 * Einmalig: Stripe-Coupon für den Modell-C-Startbonus anlegen (src/lib/affiliate/referral-model.ts).
 *
 *   id AFFILIATE20FIRST · 20 % · duration once (nur die erste Rechnung) · nur Monatsabo
 *   (die Beschränkung aufs Monatsabo erzwingt der Code: assertReferralCouponAllowed)
 *
 * Danach in .env.local und /var/www/finestsites/.env.production:
 *   STRIPE_AFFILIATE_FIRST_MONTH_COUPON_ID=AFFILIATE20FIRST
 * (Env wird erst durch das Deploy-Script wirksam.)
 *
 * Läuft auf dem App-Server (Live-Stripe-Key über .env.production):
 *   node --env-file=.env.production --import tsx scripts/stripe-create-affiliate-first-month-coupon.ts           # Trockenlauf (Standard)
 *   node --env-file=.env.production --import tsx scripts/stripe-create-affiliate-first-month-coupon.ts --apply   # wirklich anlegen
 *
 * Trockenlauf: zeigt die Parameter und prüft (nur lesend), ob es den Coupon schon gibt.
 * Idempotent: existiert der Coupon bereits mit passenden Werten, passiert nichts.
 */
import Stripe from 'stripe'

const APPLY = process.argv.includes('--apply')
const COUPON_ID = 'AFFILIATE20FIRST'

const params: Stripe.CouponCreateParams = {
  id: COUPON_ID,
  percent_off: 20,
  duration: 'once',
  name: '20 % Startbonus (1. Monat)',
  metadata: {
    purpose: 'affiliate_referral_first_month',
    model: 'c2026',
    interval: 'monthly',
    created_by: 'scripts/stripe-create-affiliate-first-month-coupon.ts',
  },
}

function matches(c: Stripe.Coupon): boolean {
  return c.percent_off === 20 && c.duration === 'once' && !c.amount_off && c.valid
}

async function main() {
  console.log(`Modus: ${APPLY ? 'APPLY' : 'Trockenlauf (--apply zum Anlegen)'}`)
  console.log('Parameter:', JSON.stringify(params, null, 2))

  const key = process.env.STRIPE_SECRET_KEY
  if (!key) {
    if (APPLY) throw new Error('STRIPE_SECRET_KEY fehlt')
    console.log('\nKein STRIPE_SECRET_KEY gesetzt – Prüfung auf vorhandenen Coupon übersprungen.')
    return
  }
  const stripe = new Stripe(key)

  let existing: Stripe.Coupon | null = null
  try {
    existing = await stripe.coupons.retrieve(COUPON_ID)
  } catch (err) {
    if ((err as { code?: string })?.code !== 'resource_missing') throw err
  }

  if (existing) {
    if (matches(existing)) {
      console.log(`\n= Coupon ${COUPON_ID} existiert bereits (20 %, once, gültig). Nichts zu tun.`)
      return
    }
    // Coupons sind in Stripe (bis auf Name/Metadaten) unveränderlich → bewusst abbrechen
    throw new Error(`Coupon ${COUPON_ID} existiert, passt aber nicht (percent_off=${existing.percent_off}, duration=${existing.duration}, valid=${existing.valid}). Bitte im Stripe-Dashboard prüfen.`)
  }

  if (!APPLY) {
    console.log(`\n→ Coupon ${COUPON_ID} würde angelegt (Trockenlauf).`)
    return
  }
  const created = await stripe.coupons.create(params)
  console.log(`\n✓ Coupon angelegt: ${created.id} (${created.percent_off} %, ${created.duration})`)
  console.log('Jetzt STRIPE_AFFILIATE_FIRST_MONTH_COUPON_ID=AFFILIATE20FIRST in .env.production setzen und deployen.')
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
