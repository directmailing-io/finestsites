-- ============================================
-- FORM SCHEMAS (admin-defined forms per template)
-- ============================================
CREATE TABLE public.form_schemas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES public.templates(id) ON DELETE CASCADE,
  form_name TEXT NOT NULL,                          -- slug: 'contact', 'questionnaire' — matches /.finestsites/forms/{form_name}
  title TEXT NOT NULL,                               -- display: "Kontaktformular", "Beratungsanfrage"
  fields JSONB NOT NULL DEFAULT '[]'::jsonb,         -- [{key, label, type, required, placeholder?, options?}]
  email_notification_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(template_id, form_name)
);

-- ============================================
-- FORM SUBMISSIONS (visitor-submitted data)
-- ============================================
CREATE TABLE public.form_submissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_site_id UUID NOT NULL REFERENCES public.user_sites(id) ON DELETE CASCADE,
  form_name TEXT NOT NULL,                           -- matches form_schemas.form_name
  data JSONB NOT NULL DEFAULT '{}'::jsonb,           -- raw submitted fields {key: value}
  submitter_ip_hash TEXT,                            -- SHA-256 of IP — never plain IP (DSGVO)
  is_spam BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMPTZ,                               -- NULL = unread
  archived_at TIMESTAMPTZ,                           -- NULL = not archived
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_form_schemas_template ON public.form_schemas(template_id);

CREATE INDEX idx_form_submissions_site ON public.form_submissions(user_site_id);
CREATE INDEX idx_form_submissions_unread
  ON public.form_submissions(user_site_id, read_at)
  WHERE archived_at IS NULL AND is_spam = false;
CREATE INDEX idx_form_submissions_created ON public.form_submissions(created_at DESC);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE public.form_schemas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_submissions ENABLE ROW LEVEL SECURITY;

-- form_schemas: admins manage all; users can read schemas for templates they have a site on
CREATE POLICY "Admins can manage form_schemas" ON public.form_schemas
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = TRUE)
  );

CREATE POLICY "Users can view form_schemas for own sites" ON public.form_schemas
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_sites us
      WHERE us.template_id = form_schemas.template_id
        AND us.user_id = auth.uid()
    )
  );

-- form_submissions: users manage submissions for their own sites
CREATE POLICY "Users can manage own submissions" ON public.form_submissions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_sites us
      WHERE us.id = form_submissions.user_site_id
        AND us.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all submissions" ON public.form_submissions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = TRUE)
  );

-- ============================================
-- TRIGGERS
-- ============================================
CREATE TRIGGER handle_updated_at_form_schemas
  BEFORE UPDATE ON public.form_schemas
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
