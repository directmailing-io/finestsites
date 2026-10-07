-- Payment recovery with grace period (see src/lib/billing/payment-recovery.ts)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS payment_failed_invoice_id TEXT,
  ADD COLUMN IF NOT EXISTS payment_grace_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_retry_processing_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_notice_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_reminder_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_offline_notified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_fallback_sepa BOOLEAN NOT NULL DEFAULT FALSE;
