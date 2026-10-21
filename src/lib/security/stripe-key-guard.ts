/**
 * Schutz gegen Live-Stripe-Schlüssel außerhalb der Produktion.
 *
 * VORSCHLAG – wird absichtlich noch nirgends importiert (Entscheidung, wo und
 * wie es eingehängt wird, trifft der Lead).
 *
 * Sicher für Produktion: Produktion setzt heute KEIN `FS_ENV`. Der Wächter
 * greift deshalb nur, wenn `FS_ENV` ausdrücklich auf `local` oder `staging`
 * steht (die lokale Testumgebung setzt `FS_ENV=local`). Ohne `FS_ENV` oder mit
 * jedem anderen Wert passiert nichts – ein versehentlicher Einbau kann die
 * Produktion also nicht lahmlegen.
 *
 * Geprüft werden alle Variablen, über die ein Live-Schlüssel hereinkommen
 * könnte: `STRIPE_SECRET_KEY` (sk_live_/rk_live_), `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
 * (pk_live_) und die Webhook-Secrets (ein Live-Webhook-Secret ist nicht von
 * einem Test-Secret unterscheidbar, daher nur Schlüssel-Präfixe).
 */

export const GUARDED_ENVS = ['local', 'staging'] as const
export type GuardedEnv = (typeof GUARDED_ENVS)[number]

export class LiveStripeKeyError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'LiveStripeKeyError'
  }
}

type Env = Record<string, string | undefined>

/** Liefert den geschützten Umgebungsnamen oder null, wenn der Wächter nicht greift. */
export function guardedEnv(env: Env = process.env): GuardedEnv | null {
  const v = (env.FS_ENV ?? '').trim().toLowerCase()
  return (GUARDED_ENVS as readonly string[]).includes(v) ? (v as GuardedEnv) : null
}

/** Findet Live-Schlüssel in den bekannten Stripe-Variablen (Namen, nie Werte). */
export function findLiveStripeKeys(env: Env = process.env): string[] {
  const hits: string[] = []
  const secret = env.STRIPE_SECRET_KEY ?? ''
  if (/^(sk|rk)_live_/.test(secret)) hits.push('STRIPE_SECRET_KEY')
  const pub = env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ''
  if (/^pk_live_/.test(pub)) hits.push('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY')
  return hits
}

/**
 * Wirft, wenn `FS_ENV` = local|staging ist und ein Live-Stripe-Schlüssel gesetzt ist.
 * Gibt sonst still zurück. Der Schlüsselwert erscheint nie in der Fehlermeldung.
 */
export function assertStripeKeyAllowed(env: Env = process.env): void {
  const where = guardedEnv(env)
  if (!where) return
  const hits = findLiveStripeKeys(env)
  if (hits.length > 0) {
    throw new LiveStripeKeyError(
      `Live-Stripe-Schlüssel in FS_ENV=${where} verboten (${hits.join(', ')}). ` +
        'Nur sk_test_/pk_test_ verwenden – siehe docs/local-testenv.md.',
    )
  }
}
