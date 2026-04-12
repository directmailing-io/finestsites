-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- USERS (extends Supabase auth.users)
-- ============================================
CREATE TABLE public.users (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  username TEXT UNIQUE,
  username_set_at TIMESTAMPTZ,
  plan TEXT NOT NULL DEFAULT 'starter' CHECK (plan IN ('starter', 'pro', 'unlimited')),
  billing_interval TEXT NOT NULL DEFAULT 'monthly' CHECK (billing_interval IN ('monthly', 'yearly')),
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  subscription_status TEXT DEFAULT 'active',
  current_period_end TIMESTAMPTZ,
  payment_failed_at TIMESTAMPTZ,
  deactivated_at TIMESTAMPTZ,
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TEMPLATES (admin-created)
-- ============================================
CREATE TABLE public.templates (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  preview_images JSONB DEFAULT '[]'::jsonb,
  domain TEXT NOT NULL, -- e.g. vitaldarm.de
  r2_bundle_path TEXT, -- path in R2 bucket
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  placeholder_schema JSONB NOT NULL DEFAULT '{"version": 1, "fields": []}'::jsonb,
  schema_version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- USER SITES (user activates a template)
-- ============================================
CREATE TABLE public.user_sites (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  template_id UUID REFERENCES public.templates(id) ON DELETE RESTRICT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'deactivated', 'deleted')),
  published_at TIMESTAMPTZ,
  deactivated_at TIMESTAMPTZ,
  scheduled_deletion_at TIMESTAMPTZ,
  r2_published_path TEXT, -- path of generated static site in R2
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, template_id) -- one site per template per user
);

-- ============================================
-- SITE DATA (form field values)
-- ============================================
CREATE TABLE public.site_data (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_site_id UUID REFERENCES public.user_sites(id) ON DELETE CASCADE NOT NULL,
  field_key TEXT NOT NULL,
  field_value TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_site_id, field_key)
);

-- ============================================
-- SITE IMAGES (uploaded images)
-- ============================================
CREATE TABLE public.site_images (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_site_id UUID REFERENCES public.user_sites(id) ON DELETE CASCADE NOT NULL,
  field_key TEXT NOT NULL,
  r2_path TEXT NOT NULL,
  public_url TEXT NOT NULL,
  file_size INT,
  mime_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_site_id, field_key)
);

-- ============================================
-- TEMPLATE UPDATES (notification system)
-- ============================================
CREATE TABLE public.template_updates (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  template_id UUID REFERENCES public.templates(id) ON DELETE CASCADE NOT NULL,
  update_type TEXT NOT NULL CHECK (update_type IN ('auto', 'manual_required')),
  description TEXT,
  schema_version_before INT,
  schema_version_after INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- USER NOTIFICATIONS
-- ============================================
CREATE TABLE public.user_notifications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL, -- 'template_update', 'payment_failed', 'site_deactivated', etc.
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB DEFAULT '{}'::jsonb,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_users_username ON public.users(username);
CREATE INDEX idx_users_stripe_customer ON public.users(stripe_customer_id);
CREATE INDEX idx_user_sites_user_id ON public.user_sites(user_id);
CREATE INDEX idx_user_sites_template_id ON public.user_sites(template_id);
CREATE INDEX idx_user_sites_status ON public.user_sites(status);
CREATE INDEX idx_site_data_user_site_id ON public.site_data(user_site_id);
CREATE INDEX idx_notifications_user_id ON public.user_notifications(user_id);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;

-- Users: can only read/update own profile
CREATE POLICY "Users can view own profile" ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id);

-- Templates: anyone authenticated can read published templates
CREATE POLICY "Anyone can view published templates" ON public.templates
  FOR SELECT USING (status = 'published');

CREATE POLICY "Admins can manage templates" ON public.templates
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = TRUE)
  );

-- User sites: users can only access their own
CREATE POLICY "Users can manage own sites" ON public.user_sites
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all sites" ON public.user_sites
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = TRUE)
  );

-- Site data: own sites only
CREATE POLICY "Users can manage own site data" ON public.site_data
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_sites WHERE id = user_site_id AND user_id = auth.uid())
  );

-- Site images: own sites only
CREATE POLICY "Users can manage own site images" ON public.site_images
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_sites WHERE id = user_site_id AND user_id = auth.uid())
  );

-- Notifications: own only
CREATE POLICY "Users can view own notifications" ON public.user_notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications" ON public.user_notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Auto-create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER handle_updated_at_users
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_updated_at_templates
  BEFORE UPDATE ON public.templates
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_updated_at_user_sites
  BEFORE UPDATE ON public.user_sites
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
