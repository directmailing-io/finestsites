/**
 * Einmalig: Zahlungsmittel-Fingerprints (card/sepa_debit) aller Konten mit Stripe-Kunde in
 * users.payment_fingerprints eintragen. Grundlage für die Neukunden-Prüfung nach der Zahlung
 * (src/lib/affiliate/referral-offer.ts → flagFingerprintMatch): neue Fingerprints merkt der
 * Webhook ab jetzt selbst, frühere Kunden kennt er nur über dieses Script.
 *
 * Stripe wird nur gelesen (paymentMethods.list). Schreibt nur mit --apply in die DB.
 * Voraussetzung: Migration 20261016150000_referral_model_c_customer.sql ist gelaufen.
 *
 * Läuft auf dem App-Server (Prod-DB + Live-Stripe-Key über .env.production):
 *   node --env-file=.env.production --import tsx scripts/backfill-payment-fingerprints.ts           # Trockenlauf (Standard)
 *   node --env-file=.env.production --import tsx scripts/backfill-payment-fingerprints.ts --apply   # wirklich eintragen
 */
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq, isNotNull } from 'drizzle-orm'
import { getStripe } from '@/lib/stripe/client'

const APPLY = process.argv.includes('--apply')

async function main() {
  const stripe = getStripe()
  const rows = await db
    .select({ id: users.id, username: users.username, stripeCustomerId: users.stripeCustomerId, paymentFingerprints: users.paymentFingerprints })
    .from(users)
    .where(isNotNull(users.stripeCustomerId))

  console.log(`${rows.length} Konten mit Stripe-Kunde – Modus: ${APPLY ? 'APPLY' : 'Trockenlauf (--apply zum Eintragen)'}`)

  let updated = 0, unchanged = 0, failed = 0
  const seen = new Map<string, string[]>()
  for (const row of rows) {
    const label = row.username ?? row.id
    try {
      const found = new Set<string>(row.paymentFingerprints ?? [])
      for (const type of ['card', 'sepa_debit'] as const) {
        for await (const pm of stripe.paymentMethods.list({ customer: row.stripeCustomerId!, type, limit: 100 })) {
          const fp = pm.card?.fingerprint ?? pm.sepa_debit?.fingerprint
          if (fp) found.add(fp)
        }
      }
      for (const fp of found) seen.set(fp, [...(seen.get(fp) ?? []), label])
      const next = [...found].sort()
      const before = [...(row.paymentFingerprints ?? [])].sort()
      if (next.join(',') === before.join(',')) { unchanged++; continue }
      updated++
      console.log(`  ${APPLY ? '✓' : '→'} ${label}: ${before.length} → ${next.length} Fingerprint(s)`)
      if (APPLY) await db.update(users).set({ paymentFingerprints: next }).where(eq(users.id, row.id))
    } catch (err) {
      failed++
      console.error(`  ✗ ${label}:`, err instanceof Error ? err.message : err)
    }
  }

  const shared = [...seen.entries()].filter(([, owners]) => owners.length > 1)
  if (shared.length) {
    console.log(`\nZahlungsmittel, die mehrere Konten nutzen (nur Info, z. B. Paare/Duo): ${shared.length}`)
    for (const [, owners] of shared) console.log(`  · ${owners.join(', ')}`)
  }
  console.log(`\nFertig: ${updated} ${APPLY ? 'aktualisiert' : 'würden aktualisiert'}, ${unchanged} unverändert, ${failed} Fehler.`)
  process.exit(failed ? 1 : 0)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
