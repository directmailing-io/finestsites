/**
 * Einmalig: Auszahlungsplan aller verbundenen Partner-Konten (Stripe Connect Express)
 * von "monatlich am 1." auf "täglich" umstellen.
 *
 * Hintergrund: Der Transfer-Cron überweist die Provisionen am 1. des Monats auf das
 * Connect-Konto. Mit monatlichem Auszahlungsplan (ebenfalls am 1.) blieb das Geld
 * dort bis zu einen Monat liegen. Neue Konten werden seit dem Fix direkt mit 'daily'
 * angelegt (src/app/api/affiliate/connect/route.ts).
 *
 * Läuft auf dem App-Server (Prod-DB + Live-Stripe-Key über .env.production):
 *   node --env-file=.env.production --import tsx scripts/affiliate-set-daily-payouts.ts           # Trockenlauf (Standard)
 *   node --env-file=.env.production --import tsx scripts/affiliate-set-daily-payouts.ts --apply   # wirklich umstellen
 */
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { isNotNull } from 'drizzle-orm'
import { getStripe } from '@/lib/stripe/client'

const APPLY = process.argv.includes('--apply')

async function main() {
  const stripe = getStripe()
  const rows = await db
    .select({ id: users.id, username: users.username, stripeConnectId: users.stripeConnectId })
    .from(users)
    .where(isNotNull(users.stripeConnectId))

  console.log(`${rows.length} Konten mit stripe_connect_id – Modus: ${APPLY ? 'APPLY' : 'Trockenlauf (--apply zum Umstellen)'}`)

  let changed = 0, already = 0, failed = 0
  for (const row of rows) {
    const acct = row.stripeConnectId!
    try {
      const account = await stripe.accounts.retrieve(acct)
      const schedule = account.settings?.payouts?.schedule
      const label = `${row.username ?? row.id} (${acct})`
      if (schedule?.interval === 'daily') {
        already++
        console.log(`  = ${label}: bereits täglich (delay_days ${schedule.delay_days})`)
        continue
      }
      const current = schedule ? `${schedule.interval}${schedule.monthly_anchor ? ` am ${schedule.monthly_anchor}.` : ''}` : 'unbekannt'
      if (!APPLY) {
        console.log(`  → ${label}: ${current} → daily (Trockenlauf)`)
        changed++
        continue
      }
      const updated = await stripe.accounts.update(acct, {
        settings: { payouts: { schedule: { interval: 'daily' } } },
      })
      const s = updated.settings?.payouts?.schedule
      console.log(`  ✓ ${label}: ${current} → ${s?.interval} (delay_days ${s?.delay_days})`)
      changed++
    } catch (err) {
      failed++
      console.error(`  ✗ ${row.username ?? row.id} (${acct}):`, err instanceof Error ? err.message : err)
    }
  }

  console.log(`\nFertig: ${changed} ${APPLY ? 'umgestellt' : 'würden umgestellt'}, ${already} bereits täglich, ${failed} Fehler.`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
