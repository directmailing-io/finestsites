-- Billing Performance Indices
-- Adds indices on columns queried daily by the billing-enforcement cron.
-- Without these, every cron run does a full table scan on users and user_sites.

-- users: queried by subscriptionStatus + paymentFailedAt + deactivatedAt
CREATE INDEX IF NOT EXISTS idx_users_subscription_status
  ON users (subscription_status);

CREATE INDEX IF NOT EXISTS idx_users_payment_failed_at
  ON users (payment_failed_at)
  WHERE payment_failed_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_deactivated_at
  ON users (deactivated_at)
  WHERE deactivated_at IS NULL;

-- user_sites: queried by status + scheduledDeletionAt for the 90-day hard deletion
CREATE INDEX IF NOT EXISTS idx_user_sites_scheduled_deletion
  ON user_sites (scheduled_deletion_at, status)
  WHERE status = 'deactivated' AND scheduled_deletion_at IS NOT NULL;
