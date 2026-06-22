-- ============================================
-- SUBSCRIPTION EVENTS (audit trail)
-- ============================================
CREATE TABLE public.subscription_events (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'subscription_created',
    'subscription_renewed',
    'subscription_updated',
    'subscription_canceled',
    'subscription_deleted',
    'payment_failed',
    'payment_succeeded',
    'account_deactivated'
  )),
  plan TEXT,
  billing_interval TEXT,
  amount_cents INT,          -- e.g. 1400 for €14.00
  stripe_event_id TEXT UNIQUE,
  stripe_subscription_id TEXT,
  stripe_invoice_id TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for analytics queries (per-user timeline)
CREATE INDEX idx_subscription_events_user_id ON public.subscription_events(user_id);
-- Index for monthly aggregations
CREATE INDEX idx_subscription_events_created_at ON public.subscription_events(created_at);
-- Index for event type queries
CREATE INDEX idx_subscription_events_type ON public.subscription_events(event_type);

-- Row Level Security
ALTER TABLE public.subscription_events ENABLE ROW LEVEL SECURITY;

-- Admins can read all events
CREATE POLICY "Admins can read all subscription events"
  ON public.subscription_events FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = TRUE)
  );

-- Users can read their own events
CREATE POLICY "Users can read own subscription events"
  ON public.subscription_events FOR SELECT
  USING (user_id = auth.uid());
