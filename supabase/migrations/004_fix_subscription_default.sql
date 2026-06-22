-- Fix: subscription_status had DEFAULT 'active' which granted free access to all new users.
-- Every user created via the handle_new_user trigger got subscription_status='active' by default,
-- bypassing the payment gate entirely.
--
-- Applied 2026-04-14:
--   1. Remove the dangerous DEFAULT
--   2. Reset all users who have 'active' status without a real Stripe subscription

ALTER TABLE public.users ALTER COLUMN subscription_status DROP DEFAULT;

UPDATE public.users
SET subscription_status = NULL
WHERE stripe_subscription_id IS NULL
  AND subscription_status = 'active';
