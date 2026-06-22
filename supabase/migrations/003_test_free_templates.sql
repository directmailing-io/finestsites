-- ============================================================
-- Migration 003: Test-Modus & Kostenlose Templates
-- ============================================================

-- Add flags to templates table
ALTER TABLE public.templates
  ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_free BOOLEAN NOT NULL DEFAULT FALSE;

-- Whitelist table for test-mode templates
CREATE TABLE IF NOT EXISTS public.template_access (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES public.templates(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES public.users(id)     ON DELETE CASCADE,
  granted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  granted_by  UUID REFERENCES public.users(id) ON DELETE SET NULL,
  UNIQUE(template_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_template_access_template ON public.template_access(template_id);
CREATE INDEX IF NOT EXISTS idx_template_access_user     ON public.template_access(user_id);

ALTER TABLE public.template_access ENABLE ROW LEVEL SECURITY;

-- Admins can fully manage the whitelist
CREATE POLICY "Admins manage template_access" ON public.template_access
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = TRUE)
  );

-- Users can read their own grants (needed to check visibility)
CREATE POLICY "Users view own template_access" ON public.template_access
  FOR SELECT USING (user_id = auth.uid());
