-- Affiliate System Migration
-- Adds referral tracking, commission ledger, and Stripe Connect support

-- 1. Extend users table
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS referred_by_username TEXT,
  ADD COLUMN IF NOT EXISTS stripe_connect_id TEXT,         -- Stripe Connect Express account ID
  ADD COLUMN IF NOT EXISTS affiliate_onboarded BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS affiliate_payout_email TEXT;    -- fallback email for payouts

-- Index for referral lookups
CREATE INDEX IF NOT EXISTS idx_users_referred_by ON users(referred_by_username);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_stripe_connect ON users(stripe_connect_id) WHERE stripe_connect_id IS NOT NULL;

-- 2. Commission ledger — one row per Stripe invoice
CREATE TABLE IF NOT EXISTS affiliate_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stripe_invoice_id TEXT NOT NULL UNIQUE,   -- idempotency key
  stripe_customer_id TEXT,
  gross_amount INTEGER NOT NULL,            -- amount user paid in cents (after their discount)
  commission_rate NUMERIC(5,4) NOT NULL DEFAULT 0.15,
  commission_amount INTEGER NOT NULL,       -- gross_amount * rate, in cents
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','available','paid','reversed','failed')),
  available_at TIMESTAMPTZ NOT NULL,        -- pending → available after holdback period
  paid_at TIMESTAMPTZ,
  payout_id UUID,                           -- references affiliate_payouts.id
  reversal_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_commissions_referrer ON affiliate_commissions(referrer_id, status);
CREATE INDEX IF NOT EXISTS idx_commissions_referee ON affiliate_commissions(referee_id);
CREATE INDEX IF NOT EXISTS idx_commissions_available ON affiliate_commissions(status, available_at)
  WHERE status = 'pending';

-- 3. Payout batches — one row per monthly payout run per affiliate
CREATE TABLE IF NOT EXISTS affiliate_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  commission_ids UUID[] NOT NULL,           -- which commissions are included
  total_amount INTEGER NOT NULL,            -- sum in cents
  commission_count INTEGER NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  stripe_transfer_id TEXT,                  -- Stripe Transfer ID when paid via Connect
  payout_method TEXT DEFAULT 'stripe_connect'
    CHECK (payout_method IN ('stripe_connect', 'manual')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'paid', 'failed')),
  pdf_url TEXT,                             -- Gutschrift PDF stored in Supabase Storage
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_payouts_referrer ON affiliate_payouts(referrer_id);

-- 4. Referral clicks tracking (optional analytics)
CREATE TABLE IF NOT EXISTS affiliate_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_username TEXT NOT NULL,
  ip_hash TEXT,                             -- hashed IP, not raw (DSGVO)
  user_agent_short TEXT,
  converted BOOLEAN DEFAULT FALSE,          -- did they sign up?
  converted_user_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clicks_referrer ON affiliate_clicks(referrer_username);

-- 5. RLS Policies
ALTER TABLE affiliate_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_clicks ENABLE ROW LEVEL SECURITY;

-- Affiliates can only see their own commissions
CREATE POLICY "Own commissions" ON affiliate_commissions
  FOR SELECT USING (referrer_id = auth.uid());

-- Affiliates can only see their own payouts
CREATE POLICY "Own payouts" ON affiliate_payouts
  FOR SELECT USING (referrer_id = auth.uid());

-- Service role can do everything (for webhooks and cron)
CREATE POLICY "Service full access commissions" ON affiliate_commissions
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service full access payouts" ON affiliate_payouts
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service full access clicks" ON affiliate_clicks
  FOR ALL USING (auth.role() = 'service_role');
