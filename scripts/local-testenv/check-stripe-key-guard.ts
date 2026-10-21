/**
 * Prüfung für src/lib/security/stripe-key-guard.ts (ohne Test-Framework).
 *
 *   npx tsx scripts/local-testenv/check-stripe-key-guard.ts
 *
 * Exit 0 = alle Fälle wie erwartet.
 */
import { assertStripeKeyAllowed, LiveStripeKeyError } from '../../src/lib/security/stripe-key-guard'

type Case = { name: string; env: Record<string, string | undefined>; expectThrow: boolean }

// Dummy-Werte: nur die Präfixe zählen, keine echten Schlüssel
const LIVE = 'sk_live_' + 'x'.repeat(24)
const RESTRICTED_LIVE = 'rk_live_' + 'x'.repeat(24)
const TEST = 'sk_test_' + 'x'.repeat(24)
const PK_LIVE = 'pk_live_' + 'x'.repeat(24)

const cases: Case[] = [
  { name: 'Produktion heute: kein FS_ENV, Live-Key → erlaubt', env: { STRIPE_SECRET_KEY: LIVE }, expectThrow: false },
  { name: 'FS_ENV=production, Live-Key → erlaubt', env: { FS_ENV: 'production', STRIPE_SECRET_KEY: LIVE }, expectThrow: false },
  { name: 'FS_ENV leer, Live-Key → erlaubt', env: { FS_ENV: '', STRIPE_SECRET_KEY: LIVE }, expectThrow: false },
  { name: 'FS_ENV=local, Test-Key → erlaubt', env: { FS_ENV: 'local', STRIPE_SECRET_KEY: TEST }, expectThrow: false },
  { name: 'FS_ENV=local, kein Key → erlaubt', env: { FS_ENV: 'local' }, expectThrow: false },
  { name: 'FS_ENV=local, Live-Key → Fehler', env: { FS_ENV: 'local', STRIPE_SECRET_KEY: LIVE }, expectThrow: true },
  { name: 'FS_ENV=LOCAL (Großschreibung), Live-Key → Fehler', env: { FS_ENV: 'LOCAL', STRIPE_SECRET_KEY: LIVE }, expectThrow: true },
  { name: 'FS_ENV=staging, Restricted-Live-Key → Fehler', env: { FS_ENV: 'staging', STRIPE_SECRET_KEY: RESTRICTED_LIVE }, expectThrow: true },
  { name: 'FS_ENV=local, pk_live → Fehler', env: { FS_ENV: 'local', STRIPE_SECRET_KEY: TEST, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: PK_LIVE }, expectThrow: true },
]

let failed = 0
for (const c of cases) {
  let threw = false
  let leaked = false
  try {
    assertStripeKeyAllowed(c.env)
  } catch (e) {
    threw = e instanceof LiveStripeKeyError
    leaked = String((e as Error).message).includes('x'.repeat(24))
  }
  const ok = threw === c.expectThrow && !leaked
  if (!ok) failed++
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${c.name}${leaked ? ' (Schlüssel in Fehlermeldung!)' : ''}`)
}

if (failed) {
  console.error(`\n${failed} Fall/Fälle fehlgeschlagen`)
  process.exit(1)
}
console.log('\nAlle Fälle bestanden.')
