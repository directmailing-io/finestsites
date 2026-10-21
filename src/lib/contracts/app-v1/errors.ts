/**
 * Feste Fehlercodes der App-Schnittstellen (/api/app/v1/* und App-Antworten anderer Routen).
 * Die App zeigt zu jedem Code ihren EIGENEN neutralen Text – Server-Texte sind nur Rückfall.
 * Codes nie umbenennen oder entfernen (ältere App-Versionen im Umlauf), nur ergänzen.
 *
 * Nur zod – keine Next-/Drizzle-Importe, damit die App diese Dateien 1:1 nutzen kann.
 */
import { z } from 'zod'

export const AppErrorCode = z.enum([
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'VALIDATION_FAILED',
  'RATE_LIMITED',
  'INTERNAL',
  'FEATURE_DISABLED',
  'UPGRADE_REQUIRED', // App-Version zu alt
  // Kauf-/Abo-Schnittstellen sind für die App gesperrt (Apple 3.1.1 / 3.1.3(f))
  'APP_PURCHASE_DISABLED',
  // Veröffentlichen (POST /api/sites/[id]/publish)
  'SUBSCRIPTION_REQUIRED',
  'PLAN_LIMIT_REACHED',
  'PAYMENT_PENDING',
  'CONSENT_REQUIRED',
  'IMPRESSUM_REQUIRED',
  'COMPLIANCE_BLOCKED',
  'COMPLIANCE_REQUIRED',
  // Partnerprogramm
  'AFFILIATE_NOT_AVAILABLE',
  'CONNECT_UNAVAILABLE',
  // Editor-Übergabe
  'HANDOFF_INVALID',
  // Konto löschen (/api/app/v1/account/deletion)
  'INVALID_PASSWORD',
  'BALANCE_CHOICE_REQUIRED',
  'DELETION_NOT_ALLOWED',
  'DELETION_ALREADY_REQUESTED',
  'NO_DELETION_PENDING',
  'ACCOUNT_DELETION_PENDING',
])
export type AppErrorCode = z.infer<typeof AppErrorCode>

/** Fehlerantwort aller /api/app/v1/*-Routen. */
export const AppErrorBody = z.object({
  code: AppErrorCode,
  message: z.string(),
})
export type AppErrorBody = z.infer<typeof AppErrorBody>

/** Antwort der gesperrten /api/billing/*-Routen bei App-Anfragen (403). */
export const AppPurchaseDisabledBody = z.object({
  code: z.literal('APP_PURCHASE_DISABLED'),
  message: z.string(),
})

/** Codes, die POST /api/sites/[id]/publish liefern kann (Antwort `{ error, code }`). */
export const PublishErrorCode = z.enum([
  'SUBSCRIPTION_REQUIRED',
  'PLAN_LIMIT_REACHED',
  'PAYMENT_PENDING',
  'CONSENT_REQUIRED',
  'IMPRESSUM_REQUIRED',
  'COMPLIANCE_BLOCKED',
  'COMPLIANCE_REQUIRED',
])
export const PublishErrorBody = z.object({
  error: z.string(),
  code: PublishErrorCode,
  field: z.string().optional(),
})
export const PublishSuccessBody = z.object({ success: z.literal(true), url: z.string().url() })

export const OkBody = z.object({ ok: z.literal(true) })
