/**
 * Externe Nebenwirkungen der Kontolöschung (Cloudflare KV, Custom Hostnames, R2, Stripe).
 *
 * Sicherheitsnetz: In FS_ENV=local|staging (src/lib/security/stripe-key-guard.ts) werden KV, Custom
 * Hostnames und R2 NIE angesprochen – das sind Produktions-Ressourcen. Die Aufrufe werden dann nur
 * protokolliert (`recordedEffects`, Konsole), damit Tests prüfen können, dass sie ausgelöst würden.
 * Stripe läuft dort nur mit Test-Schlüssel (assertStripeKeyAllowed wirft bei Live-Schlüsseln).
 *
 * Alle Funktionen werfen nie: Fehler werden geloggt und als Ergebnis zurückgegeben. Die Datenbank
 * ist die Quelle der Wahrheit; KV-Einträge haben TTLs bzw. werden vom Worker gegen die App geprüft.
 */
import { guardedEnv, assertStripeKeyAllowed } from '@/lib/security/stripe-key-guard'
import { setSiteOfflineKV, deleteCustomDomainKV, purgeUsernameKV } from '@/lib/cloudflare/kv-api'
import { deleteCustomHostname } from '@/lib/cloudflare/custom-hostnames'
import { deleteFromR2, deletePrefixFromR2 } from '@/lib/r2/client'
import { getStripe } from '@/lib/stripe/client'

export type EffectRecord = { kind: string; target: string; at: string }

/** Nur in lokalen/Staging-Läufen gefüllt (zum Nachvollziehen), max. 500 Einträge. */
export const recordedEffects: EffectRecord[] = []

export function externalEffectsDisabled(): boolean {
  return guardedEnv() !== null
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

async function guarded(kind: string, target: string, fn: () => Promise<unknown>): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  if (externalEffectsDisabled()) {
    recordedEffects.push({ kind, target, at: new Date().toISOString() })
    if (recordedEffects.length > 500) recordedEffects.shift()
    console.log(`[account-deletion] (lokal, nicht ausgeführt) ${kind}: ${target}`)
    return { ok: true, skipped: true }
  }
  try {
    await fn()
    return { ok: true }
  } catch (err) {
    console.error(`[account-deletion] ${kind} fehlgeschlagen (${target}):`, errMsg(err))
    return { ok: false, error: errMsg(err) }
  }
}

export const effects = {
  siteOffline: (username: string, templateDomain: string) =>
    guarded('kv.site_offline', `${username}.${templateDomain}`, () => setSiteOfflineKV(username, templateDomain)),
  customDomainKvDelete: (hostname: string) =>
    guarded('kv.custom_domain_delete', hostname, () => deleteCustomDomainKV(hostname)),
  customHostnameDelete: (cfId: string, hostname: string) =>
    guarded('cf.custom_hostname_delete', `${hostname} (${cfId})`, () => deleteCustomHostname(cfId)),
  purgeUsername: (username: string) =>
    guarded('kv.purge_username', username, () => purgeUsernameKV(username)),
  r2Delete: (key: string) =>
    guarded('r2.delete', key, () => deleteFromR2(key)),
  r2DeletePrefix: (prefix: string) =>
    guarded('r2.delete_prefix', prefix, () => deletePrefixFromR2(prefix)),
}

/** R2-Ordner, die ausschließlich Dateien genau eines Nutzers enthalten (Upload-Routen). */
export function userR2Prefixes(userId: string): string[] {
  return [`user-images/${userId}/`, `profile-images/${userId}/`, `support-media/${userId}/`]
}

export type StripeCancelResult = {
  ok: boolean
  cancelled: string[]
  invoiceVoided: boolean
  error?: string
}

/**
 * Beendet alle laufenden Abos des Stripe-Kunden SOFORT (ohne anteilige Erstattung, ohne Schlussrechnung)
 * und storniert eine offene Rechnung aus einer Zahlungsstörung. Keine Stripe-Kundenmails (im Dashboard aus).
 * Idempotent: bereits beendete Abos werden übersprungen.
 */
export async function cancelStripeSubscriptions(params: {
  customerId: string | null
  subscriptionId: string | null
  trackedInvoiceId: string | null
}): Promise<StripeCancelResult> {
  const result: StripeCancelResult = { ok: true, cancelled: [], invoiceVoided: false }
  if (!params.customerId && !params.subscriptionId) return result
  try {
    assertStripeKeyAllowed()
  } catch (err) {
    return { ...result, ok: false, error: errMsg(err) }
  }
  const stripe = getStripe()
  const ids = new Set<string>()
  try {
    if (params.subscriptionId) ids.add(params.subscriptionId)
    if (params.customerId) {
      const list = await stripe.subscriptions.list({ customer: params.customerId, status: 'all', limit: 20 })
      for (const s of list.data) {
        if (!['canceled', 'incomplete_expired'].includes(s.status)) ids.add(s.id)
      }
    }
    for (const id of ids) {
      const sub = await stripe.subscriptions.retrieve(id)
      if (sub.status === 'canceled' || sub.status === 'incomplete_expired') continue
      await stripe.subscriptions.cancel(id, { invoice_now: false, prorate: false })
      result.cancelled.push(id)
    }
  } catch (err) {
    // Unbekannte Abo-ID (z. B. Testdaten) ist kein Grund, die Löschung aufzuhalten – aber melden.
    const code = (err as { code?: string })?.code
    if (code !== 'resource_missing') {
      result.ok = false
      result.error = errMsg(err)
    }
    console.error('[account-deletion] Stripe-Abo beenden:', errMsg(err))
  }
  if (params.trackedInvoiceId) {
    try {
      const inv = await stripe.invoices.retrieve(params.trackedInvoiceId)
      if (inv.status === 'open') {
        await stripe.invoices.voidInvoice(inv.id)
        result.invoiceVoided = true
      }
    } catch (err) {
      console.error('[account-deletion] offene Rechnung stornieren:', errMsg(err))
    }
  }
  return result
}
