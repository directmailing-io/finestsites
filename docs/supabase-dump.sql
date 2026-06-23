--
-- PostgreSQL database dump
--

\restrict 7T4BqmkKvA5gPifKdkMcABHbxmNQG2xRjD26bvuUOuF9Q7whpsoo4xU9B1mhpzZ

-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.3 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.users (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$;


--
-- Name: handle_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: rls_auto_enable(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rls_auto_enable() RETURNS event_trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: affiliate_commissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.affiliate_commissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    referrer_id uuid NOT NULL,
    referred_user_id uuid,
    subscription_id text,
    commission_amount integer DEFAULT 0 NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    referee_id uuid,
    stripe_invoice_id text,
    stripe_customer_id text,
    gross_amount integer DEFAULT 0 NOT NULL,
    commission_rate numeric(5,4) DEFAULT 0.15,
    available_at timestamp with time zone,
    paid_at timestamp with time zone,
    CONSTRAINT affiliate_commissions_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'available'::text, 'paid'::text, 'cancelled'::text])))
);


--
-- Name: affiliate_payouts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.affiliate_payouts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    referrer_id uuid NOT NULL,
    amount integer DEFAULT 0 NOT NULL,
    stripe_transfer_id text,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    total_amount integer DEFAULT 0 NOT NULL,
    commission_count integer DEFAULT 0,
    period_start timestamp with time zone,
    period_end timestamp with time zone,
    paid_at timestamp with time zone,
    CONSTRAINT affiliate_payouts_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'completed'::text, 'failed'::text])))
);


--
-- Name: form_schemas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.form_schemas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    template_id uuid NOT NULL,
    form_name text NOT NULL,
    title text NOT NULL,
    fields jsonb DEFAULT '[]'::jsonb NOT NULL,
    email_notification_enabled boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: form_submissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.form_submissions (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_site_id uuid NOT NULL,
    form_name text DEFAULT 'default'::text NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    ip_address text,
    user_agent text,
    read_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    submitter_ip_hash text,
    is_spam boolean DEFAULT false NOT NULL,
    archived_at timestamp with time zone
);


--
-- Name: site_data; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.site_data (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_site_id uuid NOT NULL,
    field_key text NOT NULL,
    field_value text,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: site_images; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.site_images (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_site_id uuid NOT NULL,
    field_key text NOT NULL,
    r2_path text NOT NULL,
    public_url text NOT NULL,
    file_size integer,
    mime_type text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: subscription_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscription_events (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    event_type text NOT NULL,
    plan text,
    billing_interval text,
    amount_cents integer,
    stripe_event_id text,
    stripe_subscription_id text,
    stripe_invoice_id text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT subscription_events_event_type_check CHECK ((event_type = ANY (ARRAY['subscription_created'::text, 'subscription_renewed'::text, 'subscription_updated'::text, 'subscription_canceled'::text, 'subscription_deleted'::text, 'payment_failed'::text, 'payment_succeeded'::text, 'account_deactivated'::text])))
);


--
-- Name: template_access; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.template_access (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    template_id uuid NOT NULL,
    user_id uuid NOT NULL,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    granted_by uuid
);


--
-- Name: template_updates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.template_updates (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    template_id uuid NOT NULL,
    update_type text NOT NULL,
    description text,
    schema_version_before integer,
    schema_version_after integer,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT template_updates_update_type_check CHECK ((update_type = ANY (ARRAY['auto'::text, 'manual_required'::text])))
);


--
-- Name: templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.templates (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    title text NOT NULL,
    description text,
    preview_images jsonb DEFAULT '[]'::jsonb,
    domain text NOT NULL,
    r2_bundle_path text,
    status text DEFAULT 'draft'::text NOT NULL,
    placeholder_schema jsonb DEFAULT '{"fields": [], "version": 1}'::jsonb NOT NULL,
    schema_version integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    cf_hostname_id text,
    cf_hostname_status text,
    cf_hostname_data jsonb,
    tags text[] DEFAULT '{}'::text[],
    is_test boolean DEFAULT false NOT NULL,
    is_free boolean DEFAULT false NOT NULL,
    CONSTRAINT templates_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text])))
);


--
-- Name: user_notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_notifications (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    type text NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    data jsonb DEFAULT '{}'::jsonb,
    read_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: user_sites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_sites (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    template_id uuid NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    published_at timestamp with time zone,
    deactivated_at timestamp with time zone,
    scheduled_deletion_at timestamp with time zone,
    r2_published_path text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    custom_domain text,
    custom_domain_status text,
    cf_custom_hostname_id text,
    custom_domain_verified_at timestamp with time zone,
    CONSTRAINT user_sites_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text, 'deactivated'::text, 'deleted'::text])))
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid NOT NULL,
    email text NOT NULL,
    username text,
    username_set_at timestamp with time zone,
    plan text DEFAULT 'starter'::text NOT NULL,
    billing_interval text DEFAULT 'monthly'::text NOT NULL,
    stripe_customer_id text,
    stripe_subscription_id text,
    subscription_status text,
    current_period_end timestamp with time zone,
    payment_failed_at timestamp with time zone,
    deactivated_at timestamp with time zone,
    is_admin boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    stripe_connect_id text,
    affiliate_onboarded boolean DEFAULT false,
    referred_by_username text,
    CONSTRAINT users_billing_interval_check CHECK ((billing_interval = ANY (ARRAY['monthly'::text, 'yearly'::text]))),
    CONSTRAINT users_plan_check CHECK ((plan = ANY (ARRAY['starter'::text, 'pro'::text, 'unlimited'::text])))
);


--
-- Data for Name: affiliate_commissions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.affiliate_commissions (id, referrer_id, referred_user_id, subscription_id, commission_amount, status, created_at, updated_at, referee_id, stripe_invoice_id, stripe_customer_id, gross_amount, commission_rate, available_at, paid_at) FROM stdin;
96c97da9-755d-45f9-afad-e64803e3f50f	691ce6da-c0b9-4d76-93e9-3105779f9f61	\N	\N	216	paid	2026-04-19 19:24:05.032251+00	2026-04-27 12:27:17.315+00	4665a7b4-cb1b-4349-8613-e3590d0c4642	in_1TO0p2GWVCygqvfcqTl6Iy8R	cus_UMjt9j8rTFc4DS	1445	0.1500	2026-04-19 19:38:37.101649+00	2026-04-27 12:27:17.315+00
ea95249c-7fb9-439e-9b52-fcb84ffe7993	691ce6da-c0b9-4d76-93e9-3105779f9f61	\N	\N	255	pending	2026-05-19 20:17:30.245412+00	2026-05-19 20:17:30.245412+00	4665a7b4-cb1b-4349-8613-e3590d0c4642	in_1TYt8JGWVCygqvfcofchGCVx	cus_UMjt9j8rTFc4DS	1700	0.1500	2026-06-02 20:17:30.186+00	\N
3193e65b-8b5e-4240-9a90-219cda0bbbc9	691ce6da-c0b9-4d76-93e9-3105779f9f61	\N	\N	255	pending	2026-06-19 20:30:39.33078+00	2026-06-19 20:30:39.33078+00	4665a7b4-cb1b-4349-8613-e3590d0c4642	in_1Tk7v6GWVCygqvfczDobJWke	cus_UMjt9j8rTFc4DS	1700	0.1500	2026-07-03 20:30:39.085+00	\N
\.


--
-- Data for Name: affiliate_payouts; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.affiliate_payouts (id, referrer_id, amount, stripe_transfer_id, status, created_at, updated_at, total_amount, commission_count, period_start, period_end, paid_at) FROM stdin;
365fdf90-95d8-4f2f-a69d-feedcf3e682d	691ce6da-c0b9-4d76-93e9-3105779f9f61	216	\N	completed	2026-04-27 20:23:09.821426+00	2026-04-27 20:23:09.821426+00	216	1	2026-04-01 00:00:00+00	2026-04-27 00:00:00+00	2026-04-27 12:27:17.315+00
\.


--
-- Data for Name: form_schemas; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.form_schemas (id, template_id, form_name, title, fields, email_notification_enabled, created_at, updated_at) FROM stdin;
f5d840e1-77bd-4d8e-bc88-fe8094620462	3bc5ab65-f218-4a22-a097-c016ceb3c076	kontakt	Kontakt	[{"key": "name", "label": "Name"}, {"key": "email", "label": "E-Mail"}, {"key": "laendervorwahl", "label": "Ländervorwahl"}, {"key": "telefon", "label": "Telefon"}, {"key": "kontaktweg", "label": "Bevorzugter Kontaktweg"}, {"key": "hintergrund", "label": "Hintergrund / Ausgangssituation"}, {"key": "ziele", "label": "Ziele"}]	t	2026-06-05 12:11:27.689841+00	2026-06-05 12:11:27.689841+00
\.


--
-- Data for Name: form_submissions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.form_submissions (id, user_site_id, form_name, data, ip_address, user_agent, read_at, created_at, submitter_ip_hash, is_spam, archived_at) FROM stdin;
\.


--
-- Data for Name: site_data; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.site_data (id, user_site_id, field_key, field_value, updated_at) FROM stdin;
37b91b6e-8acc-49b3-a142-97d3c1cb6586	6bc11998-2577-41e2-a24d-d0ab36d76e0c	vorname	Anna	2026-06-10 07:28:11.287+00
1148dd3a-36c6-44fa-aed7-16c0672a3d53	6bc11998-2577-41e2-a24d-d0ab36d76e0c	nachname	Krempel	2026-06-10 07:28:11.287+00
a751288d-f9d3-46e9-add3-7709aca00b20	6bc11998-2577-41e2-a24d-d0ab36d76e0c	profilbild	https://finestsites.vercel.app/api/media/user-images/691ce6da-c0b9-4d76-93e9-3105779f9f61/06f0244b-11fb-44c9-beee-6c9ddacbeffc.jpg	2026-06-10 07:28:11.287+00
0ce7d887-e829-4d92-bfa8-08aa63d227e9	6bc11998-2577-41e2-a24d-d0ab36d76e0c	headline	meine Veranstaltungen	2026-06-10 07:28:11.287+00
2fc7d44f-d75a-4f53-9c67-5ecaa4375b03	6bc11998-2577-41e2-a24d-d0ab36d76e0c	bio	life live love	2026-06-10 07:28:11.287+00
33ba349e-42e1-45a9-a264-7bab903d94e7	6bc11998-2577-41e2-a24d-d0ab36d76e0c	instagram	#	2026-06-10 07:28:11.287+00
9a1acb57-900a-4260-9099-d4da725d7261	6bc11998-2577-41e2-a24d-d0ab36d76e0c	tiktok	#	2026-06-10 07:28:11.287+00
1eacd033-7aac-4afc-bc09-3485dacc8f4d	6bc11998-2577-41e2-a24d-d0ab36d76e0c	youtube	#	2026-06-10 07:28:11.287+00
8db09c55-56d8-458d-856d-ecf88f701028	6bc11998-2577-41e2-a24d-d0ab36d76e0c	linkedin		2026-06-10 07:28:11.287+00
a40a060d-920e-4e32-903d-59c459e259e3	6bc11998-2577-41e2-a24d-d0ab36d76e0c	website		2026-06-10 07:28:11.287+00
56f7a393-bf76-46d8-9061-7459c48df46d	6bc11998-2577-41e2-a24d-d0ab36d76e0c	modus	dunkel	2026-06-10 07:28:11.287+00
9f710f5d-0636-40a2-8d1a-37dbe441daa8	c0feeeda-d456-44cc-b370-dce0ec3463dd	vorname	Daniel	2026-06-15 06:54:58.685+00
3e856557-e423-48b2-82fd-fe45f9ed8285	c0feeeda-d456-44cc-b370-dce0ec3463dd	nachname	Kurzeja	2026-06-15 06:54:58.685+00
94cef96d-263f-4566-9037-8b5f3758cc59	c0feeeda-d456-44cc-b370-dce0ec3463dd	username		2026-06-10 21:09:46.334+00
c575cedf-4a2a-4efc-851e-ab70e2c01a39	c0feeeda-d456-44cc-b370-dce0ec3463dd	profilbild	https://finestsites.vercel.app/api/media/user-images/691ce6da-c0b9-4d76-93e9-3105779f9f61/33d8cf75-2965-4323-b89a-d111650118bf.jpg	2026-06-15 06:54:58.685+00
67c4684d-fe1e-4a1a-90df-eb495e3e5db1	c0feeeda-d456-44cc-b370-dce0ec3463dd	headline		2026-06-10 21:09:46.334+00
7b4857ef-eec0-4d56-b29b-e25179d88b04	c0feeeda-d456-44cc-b370-dce0ec3463dd	standort		2026-06-10 21:09:46.334+00
184a83c4-b577-4019-bd25-3530c68cbbea	c0feeeda-d456-44cc-b370-dce0ec3463dd	verifiziert	blau	2026-06-10 21:09:46.334+00
bb4aedb2-2836-42a3-82e7-e511ecfaa62f	c0feeeda-d456-44cc-b370-dce0ec3463dd	newsletter_aktiv	ja	2026-06-10 21:09:46.334+00
00f5a61d-b18f-4c97-bc45-6855e9d1df6e	c0feeeda-d456-44cc-b370-dce0ec3463dd	newsletter_headline		2026-06-10 21:09:46.334+00
1e508199-f955-45ba-9987-6f7e7aed73c8	c0feeeda-d456-44cc-b370-dce0ec3463dd	newsletter_subline		2026-06-10 21:09:46.334+00
106850c0-174b-4e81-a7fd-e89ea87b4d8a	c0feeeda-d456-44cc-b370-dce0ec3463dd	newsletter_button		2026-06-10 21:09:46.334+00
fbbdabed-3480-41ec-b86a-b26856f27492	c0feeeda-d456-44cc-b370-dce0ec3463dd	tipping_aktiv	ja	2026-06-10 21:09:46.334+00
77e95494-2649-4251-b68f-7120654fc37d	c0feeeda-d456-44cc-b370-dce0ec3463dd	tipping_headline	fasfsefse	2026-06-10 21:09:46.334+00
71063ab6-a89d-48f1-99d4-e9b92a40ca8c	c0feeeda-d456-44cc-b370-dce0ec3463dd	tipping_subline	fasfsfsf	2026-06-10 21:09:46.334+00
1c373496-0980-47b4-8863-717debf651ea	c0feeeda-d456-44cc-b370-dce0ec3463dd	tipping_button		2026-06-10 21:09:46.334+00
76be0232-2409-47c0-a2c2-1765c71282bd	c0feeeda-d456-44cc-b370-dce0ec3463dd	impressum_url		2026-06-10 22:22:18.984+00
ec73a8af-e7f1-4be0-890f-666a57899108	c0feeeda-d456-44cc-b370-dce0ec3463dd	bio	fsdfafsffsfsffsefsefsfafseffasfaesfas\nfasefasefasefse\nafsefesffs	2026-06-15 06:54:58.685+00
64771f49-e63b-4626-8fb5-47635bd17680	c0feeeda-d456-44cc-b370-dce0ec3463dd	akzentfarbe	#A855F7	2026-06-15 06:54:58.685+00
038d4574-30c0-43f2-987f-85ef054d23cd	c0feeeda-d456-44cc-b370-dce0ec3463dd	theme	minimal_light	2026-06-15 06:54:58.685+00
aade3c6e-61d1-440b-9405-ae673a186825	c0feeeda-d456-44cc-b370-dce0ec3463dd	font_combo	modern_clean	2026-06-15 06:54:58.685+00
cd9f0272-e644-4d88-a171-ca23825b758e	c0feeeda-d456-44cc-b370-dce0ec3463dd	tipping_url		2026-06-10 21:09:46.334+00
9f3a778a-8a51-4470-b155-71cac6d5b865	c0feeeda-d456-44cc-b370-dce0ec3463dd	whatsapp_aktiv	ja	2026-06-10 21:09:46.334+00
2f3db894-86fe-4ed6-9373-fb0ca3e394a1	c0feeeda-d456-44cc-b370-dce0ec3463dd	whatsapp_headline	fsefffafe	2026-06-10 21:09:46.334+00
fc9f67ce-3e20-4dd6-9f27-c19683ddeb38	c0feeeda-d456-44cc-b370-dce0ec3463dd	whatsapp_subline	fasfaesfsefsefas	2026-06-10 21:09:46.334+00
a3f72a9d-8e78-41a9-b8c3-783e5a213500	c0feeeda-d456-44cc-b370-dce0ec3463dd	whatsapp_button	fasfasfsf	2026-06-10 21:09:46.334+00
198453ea-663e-4ce3-9ff1-004dd6957483	c0feeeda-d456-44cc-b370-dce0ec3463dd	card_style	glass	2026-06-15 06:54:58.685+00
6a37b5db-70de-446b-8f2e-006fc2deb81d	c0feeeda-d456-44cc-b370-dce0ec3463dd	kontakt_name		2026-06-15 06:54:58.685+00
8555d32f-d352-4202-b610-4809431c9970	c0feeeda-d456-44cc-b370-dce0ec3463dd	kontakt_firma		2026-06-15 06:54:58.685+00
60136433-08ac-44a9-a158-88f84eec4ab1	c0feeeda-d456-44cc-b370-dce0ec3463dd	kontakt_strasse		2026-06-15 06:54:58.685+00
77407b75-67b2-49cb-a006-edbd98c8782f	c0feeeda-d456-44cc-b370-dce0ec3463dd	kontakt_plz_ort		2026-06-15 06:54:58.685+00
327e7739-278f-4b20-bb97-b865aabaf6e9	c0feeeda-d456-44cc-b370-dce0ec3463dd	kontakt_land		2026-06-15 06:54:58.685+00
c2dd9ca8-97a1-44c6-9d84-949beaa01350	c0feeeda-d456-44cc-b370-dce0ec3463dd	kontakt_telefon		2026-06-15 06:54:58.685+00
2ac662af-3283-42c8-bae9-f812cfbe9e68	c0feeeda-d456-44cc-b370-dce0ec3463dd	kontakt_email		2026-06-15 06:54:58.685+00
5c2ca7c1-0523-40e1-a619-70bbcd5d316d	c0feeeda-d456-44cc-b370-dce0ec3463dd	kontakt_ust_id		2026-06-15 06:54:58.685+00
7b51584e-6c6d-43c3-a8c4-c8277315d343	c0feeeda-d456-44cc-b370-dce0ec3463dd	mail		2026-06-15 06:54:58.685+00
1cbc7139-8449-4183-a685-740128616974	c0feeeda-d456-44cc-b370-dce0ec3463dd	website		2026-06-15 06:54:58.685+00
a346d7c4-1d85-4dce-9ad8-c9a202bcb250	c0feeeda-d456-44cc-b370-dce0ec3463dd	whatsapp_nummer		2026-06-10 21:09:46.334+00
4eb23102-8bbd-4eb3-8451-8c88ac62e472	c0feeeda-d456-44cc-b370-dce0ec3463dd	whatsapp_nachricht	fsefasfef	2026-06-10 21:09:46.334+00
cf7d8330-5fb7-4a6a-ae83-1f02a1a33a7d	c0feeeda-d456-44cc-b370-dce0ec3463dd	vcard_aktiv	ja	2026-06-10 21:09:46.334+00
8cedaf6f-7b90-4330-a75e-ba753d54b212	c0feeeda-d456-44cc-b370-dce0ec3463dd	vcard_button	fasfseff	2026-06-10 21:09:46.334+00
236fbd49-5c0f-48b8-ba78-97b697c6fe9d	c0feeeda-d456-44cc-b370-dce0ec3463dd	vcard_firma	fsfesffef	2026-06-10 21:09:46.334+00
255b354a-d148-42eb-a3d7-8b75c89fac2a	c0feeeda-d456-44cc-b370-dce0ec3463dd	vcard_telefon	+41234124123	2026-06-10 21:09:46.334+00
0a54077a-839e-400f-84f3-be606800d909	c0feeeda-d456-44cc-b370-dce0ec3463dd	vcard_email		2026-06-10 21:09:46.334+00
776478ae-8478-4543-8c6a-f2fbf8fb8ac6	c0feeeda-d456-44cc-b370-dce0ec3463dd	vcard_website		2026-06-10 21:09:46.334+00
5564ecf4-ad7c-4236-98a6-3f9eabc8d756	c0feeeda-d456-44cc-b370-dce0ec3463dd	hintergrund_farbe	#EC4899	2026-06-15 06:54:58.685+00
8205dd82-ec12-4f8d-ac8e-02a877ec4498	c0feeeda-d456-44cc-b370-dce0ec3463dd	card_radius	normal	2026-06-15 06:54:58.685+00
cdfe086a-f18c-47f2-a9f3-e0dc4d80d14f	c0feeeda-d456-44cc-b370-dce0ec3463dd	hintergrund_bild		2026-06-15 06:54:58.685+00
88d465c9-0535-46ea-9831-2b27d28d578e	c0feeeda-d456-44cc-b370-dce0ec3463dd	hintergrund_bild_blur	0	2026-06-15 06:54:58.685+00
64d41593-1a3c-4693-8650-e6217830d960	c0feeeda-d456-44cc-b370-dce0ec3463dd	hintergrund_bild_overlay	0.1	2026-06-15 06:54:58.685+00
0455a22e-5e83-494c-ac9a-c89921d9a989	c0feeeda-d456-44cc-b370-dce0ec3463dd	github		2026-06-15 06:54:58.685+00
9f36b200-3864-40d7-8210-86dada17266e	c0feeeda-d456-44cc-b370-dce0ec3463dd	hintergrund_typ	solid	2026-06-11 15:46:50.418+00
81f4a73d-c78c-4e88-bd68-818dfeec075b	6bc11998-2577-41e2-a24d-d0ab36d76e0c	akzentfarbe	#0EA5E9	2026-06-10 07:28:11.287+00
d1eb3657-62de-4361-96f7-21ca27ffb106	6bc11998-2577-41e2-a24d-d0ab36d76e0c	events	[{"name":"Testevent","kuerzel":"testevent","status":"veroeffentlicht","typ":"online","titelbild":"https://finestsites.vercel.app/api/media/user-images/691ce6da-c0b9-4d76-93e9-3105779f9f61/c8fe6651-b03c-4824-945e-89c593ae9504.jpg","datum":"2026-06-11","datum_ende":"","uhrzeit":"20:00","uhrzeit_ende_aktiv":"","uhrzeit_ende":"20:00","wiederkehrung":"einmalig","wiederkehrung_wochentag":"","wiederkehrung_bis":"","wiederkehrung_termine":"[\\"2026-06-12\\",\\"2026-06-24\\",\\"2026-06-27\\"]","ort":"","link":"#","beschreibung":"<p>fdsafasfsfsfsfasfsfsfsasefs</p>","highlights":"[{\\"titel\\":\\"dadsad\\",\\"beschreibung\\":\\"adsasdadaasdsa\\"},{\\"titel\\":\\"dsdas\\",\\"beschreibung\\":\\"dadadsad\\"}]","special_guests":"[{\\"bild\\":\\"\\",\\"name\\":\\"asdadsadssadd\\",\\"rolle\\":\\"\\",\\"beschreibung\\":\\"\\"}]","teilnahme_modus":"anmeldung","countdown_anzeigen":"ja","modus_event":"hell","akzentfarbe_event":"#F59E0B"}]	2026-06-10 07:28:11.287+00
fbb0b75b-3af2-4f8a-9e11-f7b571828cf0	c0feeeda-d456-44cc-b370-dce0ec3463dd	featured_aktiv	ja	2026-06-10 21:09:46.334+00
1c7e832e-cfae-4ab0-8cce-28369f77a7ce	c0feeeda-d456-44cc-b370-dce0ec3463dd	featured_titel	fesafsefffefsaf	2026-06-10 21:09:46.334+00
6eb6ef9a-d9e0-4181-aa26-d0a6758ea0e2	c0feeeda-d456-44cc-b370-dce0ec3463dd	featured_text	feasfsafsef	2026-06-10 21:09:46.334+00
7e3dee52-6519-4927-a686-7be7a65ad6b9	c0feeeda-d456-44cc-b370-dce0ec3463dd	datenschutz_url		2026-06-10 22:22:18.984+00
64615af3-8d0e-468a-bacb-e31b0669b124	c0feeeda-d456-44cc-b370-dce0ec3463dd	links	[{"typ":"youtube","titel":"fawefawfw","url":"https://www.youtube.com/watch?v=9OW8n2n2V7U","beschreibung":"fafsfef","icon_bild":"","badge":"live","aktiv":"ja"},{"aktiv":"ja","typ":"link","titel":"fasfseffs","url":"#","beschreibung":"fesfsaefaefasfsf","icon_bild":"","badge":"neu"}]	2026-06-15 06:54:58.685+00
1251e4c2-c3dc-4bc4-a343-f3f03b2e4f77	c0feeeda-d456-44cc-b370-dce0ec3463dd	instagram		2026-06-15 06:54:58.685+00
4955064e-b3ca-46d6-a47f-e912aa1f3a5e	c0feeeda-d456-44cc-b370-dce0ec3463dd	tiktok	#	2026-06-15 06:54:58.685+00
95cd94b5-922e-4d88-92b1-98f8583d674b	c0feeeda-d456-44cc-b370-dce0ec3463dd	youtube	#	2026-06-15 06:54:58.685+00
04f8b68b-7faf-42bf-9f25-1403d46d063d	c0feeeda-d456-44cc-b370-dce0ec3463dd	x_twitter	#	2026-06-15 06:54:58.685+00
fd80b794-cc60-4016-92b0-809435a43602	c0feeeda-d456-44cc-b370-dce0ec3463dd	linkedin		2026-06-15 06:54:58.685+00
ed67f85a-6f11-4764-ba5f-0b78d1449416	c0feeeda-d456-44cc-b370-dce0ec3463dd	spotify		2026-06-15 06:54:58.685+00
d0e4ac8c-e51a-4bea-a9a2-2d6fdd17414e	c0feeeda-d456-44cc-b370-dce0ec3463dd	featured_bild	https://finestsites.vercel.app/api/media/user-images/691ce6da-c0b9-4d76-93e9-3105779f9f61/6a2c6d9c-5604-4f59-bf6b-0182d4a5d68d.jpg	2026-06-10 21:09:46.334+00
4b102b3c-f543-41c9-a110-1f0e5c46bab2	c0feeeda-d456-44cc-b370-dce0ec3463dd	featured_cta		2026-06-10 21:09:46.334+00
718a947a-7841-4280-af6c-1d8eac661495	c0feeeda-d456-44cc-b370-dce0ec3463dd	featured_url		2026-06-10 21:09:46.334+00
\.


--
-- Data for Name: site_images; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.site_images (id, user_site_id, field_key, r2_path, public_url, file_size, mime_type, created_at) FROM stdin;
\.


--
-- Data for Name: subscription_events; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.subscription_events (id, user_id, event_type, plan, billing_interval, amount_cents, stripe_event_id, stripe_subscription_id, stripe_invoice_id, metadata, created_at) FROM stdin;
b759e263-8b39-4742-af78-5510a3d56cf3	4665a7b4-cb1b-4349-8613-e3590d0c4642	subscription_created	starter	monthly	1700	evt_1TO0pdGWVCygqvfcOsSEPHnt	sub_1TO0paGWVCygqvfcchHtoJJR	\N	{}	2026-04-19 19:16:39.77488+00
0f223c7f-4ee2-4656-8627-621ef0de0f00	4665a7b4-cb1b-4349-8613-e3590d0c4642	subscription_updated	starter	monthly	1700	evt_1TYt8KGWVCygqvfcfMuDB6Kg	sub_1TO0paGWVCygqvfcchHtoJJR	\N	{"cancel_at_period_end": false}	2026-05-19 19:17:03.601014+00
2829dea9-9d1b-4d93-a4e4-209158c84720	4665a7b4-cb1b-4349-8613-e3590d0c4642	subscription_renewed	starter	monthly	1700	evt_1TYu4xGWVCygqvfcgRf6NVYh	sub_1TO0paGWVCygqvfcchHtoJJR	in_1TYt8JGWVCygqvfcofchGCVx	{}	2026-05-19 20:17:29.450033+00
7d210dd7-a72b-4d07-a02e-62433b67ceaf	4665a7b4-cb1b-4349-8613-e3590d0c4642	subscription_updated	starter	monthly	1700	evt_1Tk7v7GWVCygqvfcaco14Err	sub_1TO0paGWVCygqvfcchHtoJJR	\N	{"cancel_at_period_end": false}	2026-06-19 19:17:44.47645+00
099ea56b-dad6-4797-9cf7-e7bf4414881c	4665a7b4-cb1b-4349-8613-e3590d0c4642	subscription_renewed	starter	monthly	1700	evt_1Tk93fGWVCygqvfcz19OoUml	sub_1TO0paGWVCygqvfcchHtoJJR	in_1Tk7v6GWVCygqvfczDobJWke	{}	2026-06-19 20:30:38.322045+00
\.


--
-- Data for Name: template_access; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.template_access (id, template_id, user_id, granted_at, granted_by) FROM stdin;
\.


--
-- Data for Name: template_updates; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.template_updates (id, template_id, update_type, description, schema_version_before, schema_version_after, created_at) FROM stdin;
\.


--
-- Data for Name: templates; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.templates (id, title, description, preview_images, domain, r2_bundle_path, status, placeholder_schema, schema_version, created_at, updated_at, cf_hostname_id, cf_hostname_status, cf_hostname_data, tags, is_test, is_free) FROM stdin;
eb848ad4-3028-49c5-8bc9-3bdc762d36e9	myevnt	Aktiviere diese Seite, wenn du Events, Teamcalls oder Infocalls für deine Teampartner und Kunden promoten möchtest. Jedes Event bekommt seine eigene Landingpage.	["/api/media/template-images/eb848ad4-3028-49c5-8bc9-3bdc762d36e9/73af1068-f095-4d05-84fa-badf12932b3d.png"]	myevnt.io	templates/eb848ad4-3028-49c5-8bc9-3bdc762d36e9/index.html	published	{"fields": [{"key": "vorname", "type": "text", "label": "Vorname", "order": 1, "options": [], "section": "Profil", "required": true, "max_length": 30, "card_options": [], "default_value": "Vorname", "placeholder_text": "z. B. Anna"}, {"key": "nachname", "type": "text", "label": "Nachname", "order": 2, "options": [], "section": "Profil", "required": true, "max_length": 30, "card_options": [], "default_value": "Nachname", "placeholder_text": "z. B. Müller"}, {"key": "profilbild", "type": "image", "label": "Profilbild", "order": 3, "options": [], "section": "Profil", "required": false, "max_length": null, "aspect_ratio": "1/1", "card_options": [], "default_value": "https://finestsites.vercel.app/placeholders/profilbild.webp", "placeholder_text": "Quadratisch, min. 400×400 px"}, {"key": "headline", "type": "text", "label": "Headline", "order": 4, "options": [], "section": "Profil", "required": false, "max_length": 120, "card_options": [], "default_value": "Lerne mich live kennen. Online und vor Ort.", "placeholder_text": "Ein kurzer Satz, was Besucher erwartet"}, {"key": "bio", "type": "textarea", "label": "Kurze Bio", "order": 5, "options": [], "section": "Profil", "required": false, "max_length": 600, "card_options": [], "default_value": "", "placeholder_text": "Wer bist du? 2–4 Sätze, persönlich."}, {"key": "instagram", "type": "url", "label": "Instagram (optional)", "order": 6, "options": [], "section": "Profil", "required": false, "max_length": null, "card_options": [], "default_value": "", "placeholder_text": "https://instagram.com/..."}, {"key": "tiktok", "type": "url", "label": "TikTok (optional)", "order": 7, "options": [], "section": "Profil", "required": false, "max_length": null, "card_options": [], "default_value": "", "placeholder_text": "https://tiktok.com/@..."}, {"key": "youtube", "type": "url", "label": "YouTube (optional)", "order": 8, "options": [], "section": "Profil", "required": false, "max_length": null, "card_options": [], "default_value": "", "placeholder_text": "https://youtube.com/@..."}, {"key": "linkedin", "type": "url", "label": "LinkedIn (optional)", "order": 9, "options": [], "section": "Profil", "required": false, "max_length": null, "card_options": [], "default_value": "", "placeholder_text": "https://linkedin.com/in/..."}, {"key": "website", "type": "url", "label": "Website / Link (optional)", "order": 10, "options": [], "section": "Profil", "required": false, "max_length": null, "card_options": [], "default_value": "", "placeholder_text": "https://..."}, {"key": "modus", "type": "card_select", "label": "Modus", "order": 11, "options": [], "section": "Design", "required": true, "max_length": null, "card_options": [{"icon": "M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z", "color": "#0A0A0A", "label": "Dunkel", "value": "dunkel", "card_type": "color", "image_url": "", "description": "Cinematic, hoher Kontrast."}, {"icon": "M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42", "color": "#F59E0B", "label": "Hell", "value": "hell", "card_type": "color", "image_url": "", "description": "Klar, hell, freundlich."}], "default_value": "dunkel", "placeholder_text": ""}, {"key": "akzentfarbe", "type": "color", "label": "Akzentfarbe", "order": 12, "options": [], "section": "Design", "required": true, "max_length": null, "card_options": [], "default_value": "#7C3AED", "placeholder_text": "#7C3AED"}, {"key": "events", "type": "loop", "label": "Events", "order": 13, "options": [], "section": "Events", "required": false, "max_items": 50, "min_items": 0, "max_length": null, "sub_fields": [{"key": "name", "type": "text", "label": "Eventname", "required": true, "max_length": 60, "placeholder_text": "z. B. Teamcall, Powerday, Infocall"}, {"key": "kuerzel", "type": "text", "label": "Kürzel (für die URL)", "required": true, "max_length": 30, "placeholder_text": "z. B. powerday-juni"}, {"key": "status", "type": "card_select", "label": "Sichtbarkeit", "required": true, "card_options": [{"color": "#10B981", "label": "Veröffentlicht", "value": "veroeffentlicht", "card_type": "color", "image_url": "", "description": "Live auf deiner Seite sichtbar."}, {"color": "#6B7280", "label": "Entwurf", "value": "entwurf", "card_type": "color", "image_url": "", "description": "Nur für dich sichtbar."}], "display_mode": "toggle", "default_value": "veroeffentlicht", "toggle_on_value": "veroeffentlicht", "toggle_off_value": "entwurf"}, {"key": "typ", "type": "card_select", "label": "Art des Events", "required": true, "card_options": [{"icon": "M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0zM12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z", "color": "#F97066", "label": "Vor Ort", "value": "vor_ort", "card_type": "color", "image_url": "", "description": "Live in echt, mit Adresse und Maps-Link."}, {"icon": "M23 7 16 12l7 5V7zM1 5h15v14H1z", "color": "#3B82F6", "label": "Online", "value": "online", "card_type": "color", "image_url": "", "description": "Digital via Zoom, Meet oder Stream-Link."}], "default_value": "vor_ort"}, {"key": "titelbild", "type": "image", "label": "Titelbild (Banner)", "required": false, "aspect_ratio": "16/9", "placeholder_text": "Querformat, 16:9"}, {"key": "datum", "type": "date", "label": "Datum (Start)", "required": true, "placeholder_text": ""}, {"key": "datum_ende", "type": "date", "label": "Datum Ende (optional, mehrtägig)", "required": false, "placeholder_text": ""}, {"key": "uhrzeit", "type": "time", "label": "Uhrzeit (Start)", "required": true, "placeholder_text": ""}, {"key": "uhrzeit_ende_aktiv", "type": "toggle", "label": "Auch Endzeit angeben", "required": false, "default_value": "", "toggle_on_value": "ja", "placeholder_text": "Aktivieren, wenn das Event eine feste Endzeit hat", "toggle_off_value": ""}, {"key": "uhrzeit_ende", "type": "time", "label": "Uhrzeit Ende", "required": false, "show_when": {"field": "uhrzeit_ende_aktiv", "value": "ja"}, "placeholder_text": ""}, {"key": "wiederkehrung", "type": "card_select", "label": "Wiederkehrung", "required": true, "card_options": [{"icon": "M12 6v6l4 2M12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20z", "color": "#A78BFA", "label": "Einmalig", "value": "einmalig", "card_type": "color", "image_url": "", "description": "Findet genau einmal statt."}, {"icon": "M3 12h2M12 3v2M12 19v2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4M12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10z", "color": "#F59E0B", "label": "Täglich", "value": "taeglich", "card_type": "color", "image_url": "", "description": "Jeden Tag zur gleichen Zeit ab Startdatum."}, {"icon": "M3 4h18M3 4v16h18V4M3 9h18M8 4v16M16 4v16", "color": "#10B981", "label": "Wöchentlich", "value": "woechentlich", "card_type": "color", "image_url": "", "description": "Jeden Montag, Dienstag, … (du wählst den Wochentag)."}, {"icon": "M3 5h18v16H3zM3 11h18M8 3v4M16 3v4", "color": "#EC4899", "label": "Individuell", "value": "individuell", "card_type": "color", "image_url": "", "description": "Du wählst die einzelnen Termine im Kalender aus."}], "default_value": "einmalig"}, {"key": "wiederkehrung_wochentag", "type": "dropdown", "label": "Welcher Wochentag?", "options": ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"], "required": false, "show_when": {"field": "wiederkehrung", "value": "woechentlich"}, "default_value": ""}, {"key": "wiederkehrung_bis", "type": "date", "label": "Wiederkehrung läuft bis (optional)", "required": false, "show_when": {"field": "wiederkehrung", "value": ["taeglich", "woechentlich"]}, "placeholder_text": "Leer = unbegrenzt"}, {"key": "wiederkehrung_termine", "type": "date_multi", "label": "Wähle die Termine im Kalender (Mehrfachauswahl, Uhrzeit ist bei allen die gleiche)", "required": false, "show_when": {"field": "wiederkehrung", "value": "individuell"}, "default_value": "[]", "placeholder_text": ""}, {"key": "ort", "type": "textarea", "label": "Adresse", "required": false, "show_when": {"field": "typ", "value": "vor_ort"}, "max_length": 200, "placeholder_text": "Straße, PLZ Ort"}, {"key": "link", "type": "url", "label": "Link zum Event", "required": false, "show_when": {"field": "typ", "value": "online"}, "placeholder_text": "https://zoom.us/..."}, {"key": "beschreibung", "type": "richtext", "label": "Beschreibung", "required": true, "max_length": 4000, "placeholder_text": "Worum geht es bei diesem Event?"}, {"key": "highlights", "type": "loop", "label": "Highlights", "required": false, "max_items": 12, "min_items": 0, "sub_fields": [{"key": "titel", "type": "text", "label": "Titel", "required": true, "max_length": 70, "placeholder_text": "z. B. Konkrete Strategie zum Mitnehmen"}, {"key": "beschreibung", "type": "textarea", "label": "Beschreibung", "required": false, "max_length": 320, "placeholder_text": "1–3 Sätze: Was bekommt der Teilnehmer hier konkret?"}], "placeholder_text": "Was macht dieses Event besonders?"}, {"key": "special_guests", "type": "loop", "label": "Special Guests", "required": false, "max_items": 10, "min_items": 0, "sub_fields": [{"key": "bild", "type": "image", "label": "Foto (wird quadratisch zugeschnitten)", "required": true, "aspect_ratio": "1/1", "placeholder_text": "Quadratisch, min. 400×400 px"}, {"key": "name", "type": "text", "label": "Name", "required": true, "max_length": 60, "placeholder_text": "Vor- und Nachname"}, {"key": "rolle", "type": "text", "label": "Rolle / Titel (optional)", "required": false, "max_length": 60, "placeholder_text": "z. B. Coach, Bronze Manager"}, {"key": "beschreibung", "type": "textarea", "label": "Kurzbeschreibung (optional)", "required": false, "max_length": 240, "placeholder_text": "1–2 Sätze zur Person"}], "placeholder_text": "Gäste mit Bild und Bio"}, {"key": "teilnahme_modus", "type": "card_select", "label": "Wie können Besucher teilnehmen?", "required": true, "card_options": [{"icon": "M9 12l2 2 4-4M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z", "color": "#10B981", "label": "Direkt teilnehmen", "value": "direkt", "card_type": "color", "image_url": "", "description": "Link bzw. Adresse ist für alle sofort sichtbar."}, {"icon": "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z", "color": "#F59E0B", "label": "Mit Anmeldung", "value": "anmeldung", "card_type": "color", "image_url": "", "description": "Besucher füllen ein Formular aus, du schickst Zugang manuell."}], "default_value": "direkt"}, {"key": "countdown_anzeigen", "type": "toggle", "label": "Live-Countdown anzeigen", "required": false, "default_value": "ja", "toggle_on_value": "ja", "placeholder_text": "Floating Countdown im Event-Hero", "toggle_off_value": ""}, {"key": "modus_event", "type": "card_select", "label": "Eigener Modus für dieses Event (optional)", "required": false, "card_options": [{"icon": "M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z", "color": "#0A0A0A", "label": "Dunkel", "value": "dunkel", "card_type": "color", "image_url": "", "description": "Cinematic für dieses Event."}, {"icon": "M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42", "color": "#F59E0B", "label": "Hell", "value": "hell", "card_type": "color", "image_url": "", "description": "Klar und hell für dieses Event."}], "default_value": ""}, {"key": "akzentfarbe_event", "type": "color", "label": "Akzentfarbe (optional, überschreibt global)", "required": false, "default_value": "", "placeholder_text": "Leer = globale Farbe"}], "card_options": [], "default_value": "", "placeholder_text": "Lege deine Events an"}], "version": 1}	1	2026-06-09 13:03:03.482383+00	2026-06-19 10:23:27.314135+00	\N	\N	\N	{}	f	t
e825dd89-2733-4e56-9d0b-6bb61d661056	Vitalcheck FitLine	Teile deinen Teampartnern und Kunden einen kurzen Gesundheitscheck, der am Ende passende FitLine-Produkte empfiehlt. Anonym, ohne Anmeldung, in unter 3 Minuten.	["/api/media/template-images/e825dd89-2733-4e56-9d0b-6bb61d661056/5e28046a-0e28-4894-b8bd-ad76069b65aa.png"]	vitalcheck.me	templates/e825dd89-2733-4e56-9d0b-6bb61d661056/index.html	published	{"fields": [{"key": "vorname", "type": "text", "label": "Vorname", "order": 0, "options": [], "section": "Profil", "required": true, "max_length": 40, "card_options": [], "default_value": "", "placeholder_text": "z. B. Anna"}, {"key": "nachname", "type": "text", "label": "Nachname", "order": 1, "options": [], "section": "Profil", "required": true, "max_length": 40, "card_options": [], "default_value": "", "placeholder_text": "z. B. Bauer"}, {"key": "profilbild", "type": "image", "label": "Profilbild", "order": 2, "options": [], "section": "Profil", "required": false, "aspect_ratio": "1/1", "card_options": [], "default_value": "", "placeholder_text": "Quadratisch, mind. 400×400 px"}, {"key": "geschlecht", "type": "card_select", "label": "Geschlecht", "order": 3, "options": [], "section": "Profil", "required": true, "max_length": null, "card_options": [{"color": "", "label": "Weiblich", "value": "weiblich", "card_type": "text", "image_url": "", "description": "Beraterin"}, {"color": "", "label": "Männlich", "value": "maennlich", "card_type": "text", "image_url": "", "description": "Berater"}], "default_value": "weiblich", "placeholder_text": "Für die Bezeichnung &bdquo;Berater/in&ldquo;"}, {"key": "email_benachrichtigung", "type": "email", "label": "Benachrichtigungs-E-Mail", "order": 4, "options": [], "section": "Profil", "required": true, "max_length": null, "card_options": [], "default_value": "", "placeholder_text": "Hier landen die Auswertungen deiner Interessenten"}, {"key": "whatsapp_nummer", "type": "text", "label": "WhatsApp-Nummer (Ländercode + Nummer ohne Plus)", "order": 5, "options": [], "section": "Profil", "required": false, "max_length": 20, "card_options": [], "default_value": "", "placeholder_text": "z. B. 491701234567"}, {"key": "hero_headline", "type": "text", "label": "Headline (Hero)", "order": 10, "options": [], "section": "Texte", "required": false, "max_length": 80, "card_options": [], "default_value": "Wie vital fühlst du dich wirklich?", "placeholder_text": "z. B. Wie vital fühlst du dich wirklich?"}, {"key": "hero_subtext", "type": "textarea", "label": "Begrüßungstext", "order": 11, "options": [], "section": "Texte", "required": false, "max_length": 220, "card_options": [], "default_value": "3 Minuten ehrliche Antworten — und du erhältst eine präzise Auswertung mit Tipps, die wirklich zu dir passen.", "placeholder_text": "Kurzbeschreibung des Vitalchecks"}, {"key": "hero_cta", "type": "text", "label": "Button-Text zum Start", "order": 12, "options": [], "section": "Texte", "required": false, "max_length": 40, "card_options": [], "default_value": "Vitalcheck starten", "placeholder_text": "z. B. Vitalcheck starten"}, {"key": "farbthema", "type": "card_select", "label": "Farbthema", "order": 20, "options": [], "section": "Design", "required": true, "max_length": null, "card_options": [{"color": "#FAFAF7", "label": "Hell", "value": "hell", "card_type": "color", "image_url": "", "description": "Cremig-weiß, frisch"}, {"color": "#0A0A0A", "label": "Dunkel", "value": "dunkel", "card_type": "color", "image_url": "", "description": "Elegantes Schwarz"}], "default_value": "hell", "placeholder_text": ""}, {"key": "akzentfarbe", "type": "color", "label": "Akzentfarbe", "order": 21, "options": [], "section": "Design", "required": false, "max_length": null, "card_options": [], "default_value": "#10B981", "placeholder_text": "Wird für Buttons, Badges, Highlights verwendet"}, {"key": "zeige_block_verdauung", "type": "toggle", "label": "Block &bdquo;Verdauung & Ernährung&ldquo; zeigen", "order": 30, "options": [], "section": "Fragen anpassen", "required": false, "max_length": null, "card_options": [], "default_value": "ja", "placeholder_text": "5 Fragen zu Verdauung, Ernährung, Flüssigkeit"}, {"key": "zeige_block_energie", "type": "toggle", "label": "Block &bdquo;Energie & Fokus&ldquo; zeigen", "order": 31, "options": [], "section": "Fragen anpassen", "required": false, "max_length": null, "card_options": [], "default_value": "ja", "placeholder_text": "5 Fragen zu Müdigkeit, Konzentration, Kopfschmerzen"}, {"key": "zeige_block_schlaf", "type": "toggle", "label": "Block &bdquo;Schlaf & Erholung&ldquo; zeigen", "order": 32, "options": [], "section": "Fragen anpassen", "required": false, "max_length": null, "card_options": [], "default_value": "ja", "placeholder_text": "5 Fragen zu Schlaf, Stress, Stimmung"}, {"key": "zeige_block_lebensstil", "type": "toggle", "label": "Block &bdquo;Lebensstil & Körper&ldquo; zeigen", "order": 33, "options": [], "section": "Fragen anpassen", "required": false, "max_length": null, "card_options": [], "default_value": "ja", "placeholder_text": "5 Fragen zu Haut/Haar, Alter, Sport"}, {"key": "zeige_frage_rauchen", "type": "toggle", "label": "Frage &bdquo;Rauchst du?&ldquo; zeigen", "order": 34, "options": [], "section": "Fragen anpassen", "required": false, "max_length": null, "card_options": [], "default_value": "ja", "placeholder_text": "Sensible Frage — manche Berater lassen sie weg"}, {"key": "shop_optimalset", "type": "url", "label": "Shop-Link Optimalset", "order": 40, "options": [], "section": "Produkt-Links", "required": true, "max_length": null, "card_options": [], "default_value": "https://www.fitline.com/de/de-de/products/9700731", "placeholder_text": "Dein personalisierter Shoplink zum Optimalset"}, {"key": "shop_activize", "type": "url", "label": "Shop-Link Activize Oxyplus", "order": 41, "options": [], "section": "Produkt-Links", "required": true, "max_length": null, "card_options": [], "default_value": "https://www.fitline.com/de/de-de/products/0708054", "placeholder_text": "Shoplink zu Activize Oxyplus"}, {"key": "shop_restorate", "type": "url", "label": "Shop-Link Restorate", "order": 42, "options": [], "section": "Produkt-Links", "required": true, "max_length": null, "card_options": [], "default_value": "https://www.fitline.com/de/de-de/products/0708052", "placeholder_text": "Shoplink zu Restorate"}, {"key": "shop_probiotic", "type": "url", "label": "Shop-Link Probiotischer Joghurt-Drink", "order": 43, "options": [], "section": "Produkt-Links", "required": false, "max_length": null, "card_options": [], "default_value": "https://www.fitline.com/de/de-de/products/0708071", "placeholder_text": "Shoplink Probiotik"}, {"key": "shop_q10", "type": "url", "label": "Shop-Link Q10 Plus", "order": 44, "options": [], "section": "Produkt-Links", "required": false, "max_length": null, "card_options": [], "default_value": "https://www.fitline.com/de/de-de/products/0708089", "placeholder_text": "Shoplink Q10"}, {"key": "shop_beauty", "type": "url", "label": "Shop-Link FitLine Beauty", "order": 45, "options": [], "section": "Produkt-Links", "required": false, "max_length": null, "card_options": [], "default_value": "https://www.fitline.com/de/de-de/products/0708137", "placeholder_text": "Shoplink Beauty"}, {"key": "shop_basics", "type": "url", "label": "Shop-Link FitLine Basics", "order": 46, "options": [], "section": "Produkt-Links", "required": false, "max_length": null, "card_options": [], "default_value": "https://www.fitline.com/de/de-de/products/0708023", "placeholder_text": "Shoplink Basics"}], "version": 1, "preview_values": {"vorname": "Anna", "hero_cta": "Vitalcheck starten", "nachname": "Bauer", "farbthema": "hell", "geschlecht": "weiblich", "akzentfarbe": "#10B981", "hero_subtext": "3 Minuten ehrliche Antworten — und du erhältst eine präzise Auswertung mit Tipps, die wirklich zu dir passen.", "hero_headline": "Wie vital fühlst du dich wirklich?", "zeige_block_schlaf": "ja", "zeige_block_energie": "ja", "zeige_frage_rauchen": "ja", "zeige_block_verdauung": "ja", "email_benachrichtigung": "anna@example.de", "zeige_block_lebensstil": "ja"}}	1	2026-06-14 06:46:00.700685+00	2026-06-19 10:23:27.453772+00	\N	\N	\N	{fitline,pminternational,quiz,lead-gen,health}	f	f
3bc5ab65-f218-4a22-a097-c016ceb3c076	FitLine Optimalset	Präsentiere das FitLine Optimalset professionell und überzeugend. Perfekt um Kunden oder neue Teampartner für das Starterpaket zu begeistern.	["/templates/fitline-optimalset/hero-previews/hero-v2.webp", "/templates/fitline-optimalset/hero-previews/hero-v1.webp", "/templates/fitline-optimalset/hero-previews/hero-v3.webp"]	womenplus.io	templates/3bc5ab65-f218-4a22-a097-c016ceb3c076/index.html	published	{"fields": [{"key": "vorname", "type": "text", "label": "Vorname", "options": [], "section": "Profil", "required": true, "max_length": 40, "card_options": [], "default_value": "Vorname", "placeholder_text": "z. B. Anna"}, {"key": "nachname", "type": "text", "label": "Nachname", "options": [], "section": "Profil", "required": true, "max_length": 60, "card_options": [], "default_value": "Nachname", "placeholder_text": "z. B. Krempel"}, {"key": "geschlecht", "type": "card_select", "label": "Anrede", "options": [], "section": "Profil", "required": true, "max_length": null, "card_options": [{"color": "#FDF2F8", "label": "Weiblich", "value": "weiblich", "card_type": "color", "image_url": "", "description": "Beraterin, Vertriebspartnerin, deine persönliche…"}, {"color": "#EFF6FF", "label": "Männlich", "value": "maennlich", "card_type": "color", "image_url": "", "description": "Berater, Vertriebspartner, dein persönlicher…"}], "default_value": "weiblich", "placeholder_text": ""}, {"key": "profilbild", "type": "image", "label": "Profilbild", "options": [], "section": "Profil", "required": true, "max_length": null, "aspect_ratio": "1/1", "card_options": [], "default_value": "https://finestsites.vercel.app/placeholders/profilbild.webp", "placeholder_text": "Quadratisch, min. 400×400 px. Wird in Navigation, Header und Signatur verwendet."}, {"key": "about_bild", "type": "image", "label": "„Über mich\\"-Bild", "options": [], "section": "Profil", "required": true, "max_length": null, "aspect_ratio": "3/4", "card_options": [], "default_value": "https://finestsites.vercel.app/placeholders/about-bild.webp", "placeholder_text": "Hochformat empfohlen (3/4), min. 600 px breit. Zeigt dich im „Wer ich bin\\"-Bereich."}, {"key": "email_benachrichtigung", "type": "email", "label": "E-Mail für Formular-Benachrichtigungen", "options": [], "section": "Profil", "required": true, "max_length": null, "card_options": [], "default_value": "", "placeholder_text": "deine@email.de"}, {"key": "farbthema", "type": "card_select", "label": "Farbthema", "options": [], "section": "Design", "required": true, "max_length": null, "card_options": [{"color": "#2F8650", "label": "Grün", "value": "gruen", "card_type": "color", "image_url": "", "description": "Natürlich, frisch, gesund. Klassische FitLine-Anmutung."}, {"color": "#C0392B", "label": "Rot", "value": "rot", "card_type": "color", "image_url": "", "description": "Kraftvoll, energiegeladen, aufmerksamkeitsstark."}, {"color": "#D4851C", "label": "Orange", "value": "orange", "card_type": "color", "image_url": "", "description": "Warm, einladend, sonnig. Optimismus pur."}], "default_value": "gruen", "placeholder_text": ""}, {"key": "hero_variant", "type": "card_select", "label": "Welche Hero-Variante möchtest du nutzen?", "options": [], "section": "Design", "required": true, "max_length": null, "card_options": [{"color": "", "label": "Produkt-Hotspots", "value": "v1", "card_type": "image", "image_url": "/templates/fitline-optimalset/hero-previews/hero-v1.webp", "description": "Interaktive Tooltips zu jedem Produkt direkt im Hero-Bild."}, {"color": "", "label": "Familie in der Küche", "value": "v2", "card_type": "image", "image_url": "/templates/fitline-optimalset/hero-previews/hero-v2.webp", "description": "Warmer Familien-Moment, persönlich und einladend."}, {"color": "", "label": "Frau mit PowerCocktail", "value": "v3", "card_type": "image", "image_url": "/templates/fitline-optimalset/hero-previews/hero-v3.webp", "description": "Fokus auf eine Person beim Genuss."}], "default_value": "v2", "placeholder_text": ""}, {"key": "about_me_html", "type": "richtext", "label": "„Über mich\\"-Text", "options": [], "section": "Inhalte", "required": true, "max_length": 1500, "card_options": [], "default_value": "<p>Hier kommt dein persönlicher Text. Erzähle, wie du zum Optimalset gekommen bist und was dich überzeugt.</p>", "compliance_check": true, "placeholder_text": "Wie bist du zum Optimalset gekommen? Was überzeugt dich? Nutze die Buttons oben für Fettdruck, kursive Schrift und Listen."}, {"key": "eigenes_zitat", "type": "text", "label": "Dein persönliches Zitat (Signatur am Seitenende)", "options": [], "section": "Inhalte", "required": true, "max_length": 220, "card_options": [], "default_value": "Dein persönliches Zitat.", "placeholder_text": "Ein kurzer Satz, der dich und deine Empfehlung beschreibt."}, {"key": "shop_optimalset", "type": "url", "label": "Shop-Link Optimalset", "options": [], "section": "Inhalte", "required": true, "max_length": null, "card_options": [], "default_value": "https://www.fitline.com/de/de-de/products/9700731", "placeholder_text": "Dein personalisierter Shoplink zum Optimalset"}, {"key": "shop_activize", "type": "url", "label": "Shop-Link Activize Oxyplus", "options": [], "section": "Inhalte", "required": true, "max_length": null, "card_options": [], "default_value": "https://www.fitline.com/de/de-de/products/0708054", "placeholder_text": "Dein personalisierter Shoplink zu Activize Oxyplus"}, {"key": "shop_joghurt", "type": "url", "label": "Shop-Link Feel-Good Yoghurt Drink", "options": [], "section": "Inhalte", "required": true, "max_length": null, "card_options": [], "default_value": "https://www.fitline.com/de/de-de/products/9709001", "placeholder_text": "Dein personalisierter Shoplink zum Feel-Good Yoghurt Drink"}, {"key": "instagram_url", "type": "url", "label": "Instagram-Profil", "options": [], "section": "Kontakt", "required": false, "max_length": null, "card_options": [], "default_value": "", "placeholder_text": "https://instagram.com/dein.handle"}, {"key": "facebook_url", "type": "url", "label": "Facebook-Profil", "options": [], "section": "Kontakt", "required": false, "max_length": null, "card_options": [], "default_value": "", "placeholder_text": "https://facebook.com/dein.handle"}, {"key": "whatsapp_number", "type": "text", "label": "WhatsApp-Nummer", "options": [], "section": "Kontakt", "required": false, "max_length": 20, "card_options": [], "default_value": "", "placeholder_text": "Internationales Format ohne + und ohne Leerzeichen, z. B. 4915112345678"}, {"key": "telefon", "type": "text", "label": "Telefonnummer", "options": [], "section": "Kontakt", "required": false, "max_length": 30, "card_options": [], "default_value": "", "placeholder_text": "z. B. +49 151 1234 5678"}, {"key": "zeige_was_ersetzt", "type": "card_select", "label": "Sektion „Was das Optimalset ersetzt\\"", "options": [], "section": "Sektionen", "required": true, "max_length": null, "card_options": [{"color": "", "label": "Anzeigen", "value": "ja", "card_type": "image", "image_url": "/templates/fitline-optimalset/section-previews/section-was-ersetzt.webp", "description": "Vergleich: einzelne Drogerie-Vitamine vs. Optimalset."}, {"color": "#F1F5F9", "label": "Ausblenden", "value": "nein", "card_type": "color", "image_url": "", "description": "Diese Sektion wird auf deiner Webseite nicht angezeigt."}], "default_value": "ja", "placeholder_text": ""}, {"key": "zeige_mit_optimalset", "type": "card_select", "label": "Sektion „Mit dem Optimalset\\"", "options": [], "section": "Sektionen", "required": true, "max_length": null, "card_options": [{"color": "", "label": "Anzeigen", "value": "ja", "card_type": "image", "image_url": "/templates/fitline-optimalset/section-previews/section-mit-optimalset.webp", "description": "Was dir das Optimalset im Alltag erspart, mit Bon-Vergleich."}, {"color": "#F1F5F9", "label": "Ausblenden", "value": "nein", "card_type": "color", "image_url": "", "description": "Diese Sektion wird auf deiner Webseite nicht angezeigt."}], "default_value": "ja", "placeholder_text": ""}, {"key": "zeige_vergleich", "type": "card_select", "label": "Sektion „Im direkten Vergleich\\"", "options": [], "section": "Sektionen", "required": true, "max_length": null, "card_options": [{"color": "", "label": "Anzeigen", "value": "ja", "card_type": "image", "image_url": "/templates/fitline-optimalset/section-previews/section-vergleich.webp", "description": "Tabellen-Vergleich: Optimalset vs. Einzel-Supplements vs. Smoothie."}, {"color": "#F1F5F9", "label": "Ausblenden", "value": "nein", "card_type": "color", "image_url": "", "description": "Diese Sektion wird auf deiner Webseite nicht angezeigt."}], "default_value": "ja", "placeholder_text": ""}], "preview_values": {"telefon": "", "vorname": "Anna", "nachname": "Krempel", "farbthema": "gruen", "about_bild": "assets/anna-krempel.jpg", "geschlecht": "weiblich", "profilbild": "assets/anna-krempel.jpg", "facebook_url": "", "hero_variant": "v2", "shop_joghurt": "https://www.fitline.com/de/de-de/products/9709001", "about_me_html": "<p>Ende 2019 hat mich mein Schwager auf das Optimalset aufmerksam gemacht. Ich war ehrlich gesagt skeptisch, aber ich hatte zwei Sachen, die mich schon eine Weile genervt haben: Ich brauchte jeden Mittag einen Schläfchen, weil mir sonst die Energie komplett gefehlt hat. Und meine Haut war trotz allem, was ich ausprobiert habe, Cremes, Behandlungen, alles Mögliche, einfach nicht gut.</p><p>Also habe ich es einfach mal probiert. Drei Monate lang, täglich und konsequent. Was mich wirklich überzeugt hat? Das erzähle ich dir lieber in einem persönlichen Gespräch, als es hier in drei Sätze zu quetschen.</p><p>Weil ich so begeistert war, haben Familie und Freunde automatisch angefangen zu fragen. So bin ich dazu gekommen, das Optimalset weiterzuempfehlen.</p><p>Ob das auch was für dich sein könnte, das schauen wir gerne gemeinsam an. Kein Druck, kein Verkaufsgespräch.</p>", "eigenes_zitat": "Seit 2019 Teil meines Alltags. Meine Empfehlung kommt aus Überzeugung, nicht aus dem Hochglanzprospekt.", "instagram_url": "https://www.instagram.com/anna.krempel/", "shop_activize": "https://www.fitline.com/de/de-de/products/0708054", "shop_optimalset": "https://www.fitline.com/de/de-de/products/9700731", "whatsapp_number": "", "zeige_vergleich": "ja", "zeige_was_ersetzt": "ja", "zeige_mit_optimalset": "ja", "email_benachrichtigung": "anna@example.com"}}	1	2026-06-05 09:17:57.600162+00	2026-06-19 10:23:27.589022+00	\N	\N	\N	{fitline,pminternational}	f	f
fb2de3c0-b41e-4030-a56a-039a04431276	lnko.me	Nutze diese Linkseite, um alle wichtigen Links an einem Ort zu sammeln und einfach in deine Instagram-Bio einzufügen. Ideal um Teampartner und Kunden direkt weiterzuleiten.	["/api/media/template-images/fb2de3c0-b41e-4030-a56a-039a04431276/21539ff4-4812-4b15-b2f2-47b67a2f8a1b.png"]	lnko.me	templates/fb2de3c0-b41e-4030-a56a-039a04431276/index.html	published	{"fields": [{"key": "vorname", "type": "text", "label": "Vorname", "order": 0, "options": [], "section": "Profil", "required": true, "max_length": 40, "card_options": [], "default_value": "", "placeholder_text": "z. B. Anna"}, {"key": "nachname", "type": "text", "label": "Nachname", "order": 1, "options": [], "section": "Profil", "required": false, "max_length": 40, "card_options": [], "default_value": "", "placeholder_text": "z. B. Bauer"}, {"key": "profilbild", "type": "image", "label": "Profilbild", "order": 2, "options": [], "section": "Profil", "required": false, "aspect_ratio": "1/1", "card_options": [], "default_value": "", "placeholder_text": "Quadratisch, mind. 400×400 px"}, {"key": "bio", "type": "textarea", "label": "Biografie", "order": 3, "options": [], "section": "Profil", "required": false, "max_length": 180, "card_options": [], "default_value": "", "placeholder_text": "z. B. Designerin aus Berlin. Cats & Code."}, {"key": "hintergrund_farbe", "type": "color", "label": "Hintergrundfarbe", "order": 10, "options": [], "section": "Design", "required": true, "max_length": null, "card_options": [], "default_value": "#FFFFFF", "placeholder_text": "Bestimmt die Grundfarbe der Seite"}, {"key": "akzentfarbe", "type": "color", "label": "Akzentfarbe", "order": 11, "options": [], "section": "Design", "required": true, "max_length": null, "card_options": [], "default_value": "#0A0A0A", "placeholder_text": "Für Badges, Icons, Highlights"}, {"key": "theme", "type": "card_select", "label": "Theme", "order": 12, "options": [], "section": "Design", "required": true, "max_length": null, "card_options": [{"icon": "M4 6H20M4 12H20M4 18H14", "color": "#1a1a1a", "label": "Pure", "value": "pure", "card_type": "text", "image_url": "", "description": "Schlicht, ohne Effekte"}, {"icon": "M12 22V12M12 12C16 12 18 8 18 5C18 4 15 2 12 2C9 2 6 4 6 5C6 8 8 12 12 12Z", "color": "#1a1a1a", "label": "Glow", "value": "glow", "card_type": "text", "image_url": "", "description": "Weicher Schimmer von oben"}, {"icon": "M6 6C8 6 8 10 6 10C4 10 4 6 6 6ZM18 6C20 6 20 10 18 10C16 10 16 6 18 6ZM12 14C14 14 14 18 12 18C10 18 10 14 12 14Z", "color": "#1a1a1a", "label": "Mesh", "value": "mesh", "card_type": "text", "image_url": "", "description": "Mehrere Farbflächen"}, {"icon": "M3 8C6 5 9 11 12 8C15 5 18 11 21 8M3 14C6 11 9 17 12 14C15 11 18 17 21 14", "color": "#1a1a1a", "label": "Aurora", "value": "aurora", "card_type": "text", "image_url": "", "description": "Polarlichter am oberen Rand"}, {"icon": "M12 2L8 8H16L12 2ZM4 22H20L17 10H7L4 22Z", "color": "#1a1a1a", "label": "Spotlight", "value": "spotlight", "card_type": "text", "image_url": "", "description": "Lichtkegel hinter dem Avatar"}, {"icon": "M5 5L7 5M11 5L13 5M17 5L19 5M5 12L7 12M11 12L13 12M17 12L19 12M5 19L7 19M11 19L13 19M17 19L19 19M8 8L9 8M14 8L15 8M8 15L9 15M14 15L15 15", "color": "#1a1a1a", "label": "Grain", "value": "grain", "card_type": "text", "image_url": "", "description": "Filmkorn-Textur"}, {"icon": "M6 6L7 6M12 6L13 6M18 6L19 6M6 12L7 12M12 12L13 12M18 12L19 12M6 18L7 18M12 18L13 18M18 18L19 18", "color": "#1a1a1a", "label": "Dots", "value": "dots", "card_type": "text", "image_url": "", "description": "Sanftes Punktraster"}, {"icon": "M4 7H20M4 11H20M4 15H20M4 19H20", "color": "#1a1a1a", "label": "Lines", "value": "lines", "card_type": "text", "image_url": "", "description": "Subtile Linien"}, {"icon": "M3 16C6 12 9 20 12 16C15 12 18 20 21 16", "color": "#1a1a1a", "label": "Wave", "value": "wave", "card_type": "text", "image_url": "", "description": "Welle am unteren Rand"}, {"icon": "M12 2C7 2 3 6 3 11C3 16 7 20 12 20C17 20 21 16 21 11C21 6 17 2 12 2ZM12 7C10 7 8 9 8 11C8 13 10 15 12 15C14 15 16 13 16 11C16 9 14 7 12 7Z", "color": "#1a1a1a", "label": "Pulse", "value": "pulse", "card_type": "text", "image_url": "", "description": "Pulsierendes Glow"}, {"icon": "M2 2C8 2 8 8 2 8M22 22C16 22 16 16 22 16", "color": "#1a1a1a", "label": "Corners", "value": "corners", "card_type": "text", "image_url": "", "description": "Glow in zwei Ecken"}], "default_value": "pure", "placeholder_text": "Atmosphärischer Effekt — verwendet die Akzentfarbe"}, {"key": "font_combo", "type": "card_select", "label": "Schrift", "order": 13, "options": [], "section": "Design", "required": true, "max_length": null, "card_options": [{"color": "", "label": "Modern Clean", "value": "modern_clean", "card_type": "text", "image_url": "", "description": "Inter — neutral, universell"}, {"color": "", "label": "Editorial", "value": "editorial", "card_type": "text", "image_url": "", "description": "Fraunces — warm, persönlich, Serif"}, {"color": "", "label": "Tech Minimal", "value": "tech_minimal", "card_type": "text", "image_url": "", "description": "Geist — präzise, industrial"}, {"color": "", "label": "Warm & Friendly", "value": "warm_friendly", "card_type": "text", "image_url": "", "description": "DM Sans — rund, freundlich"}, {"color": "", "label": "Bold Grotesk", "value": "bold_grotesk", "card_type": "text", "image_url": "", "description": "Space Grotesk — markant, modern"}], "default_value": "modern_clean", "placeholder_text": ""}, {"key": "card_style", "type": "card_select", "label": "Karten-Stil", "order": 14, "options": [], "section": "Design", "required": true, "max_length": null, "card_options": [{"icon": "M4 7C4 5.34315 5.34315 4 7 4H17C18.6569 4 20 5.34315 20 7V17C20 18.6569 18.6569 20 17 20H7C5.34315 20 4 18.6569 4 17V7Z", "color": "#1a1a1a", "label": "Gefüllt", "value": "filled", "card_type": "text", "image_url": "", "description": ""}, {"icon": "M7 4H17C18.6569 4 20 5.34315 20 7V17C20 18.6569 18.6569 20 17 20H7C5.34315 20 4 18.6569 4 17V7C4 5.34315 5.34315 4 7 4Z", "color": "#1a1a1a", "label": "Umrandet", "value": "outlined", "card_type": "text", "image_url": "", "description": ""}, {"icon": "M7 4H17C18.6569 4 20 5.34315 20 7V17C20 18.6569 18.6569 20 17 20H7C5.34315 20 4 18.6569 4 17V7C4 5.34315 5.34315 4 7 4ZM8 8L16 16M16 8L8 16", "color": "#1a1a1a", "label": "Glas", "value": "glass", "card_type": "text", "image_url": "", "description": ""}, {"icon": "M7 3H17C18.6569 3 20 4.34315 20 6V14C20 15.6569 18.6569 17 17 17H7C5.34315 17 4 15.6569 4 14V6C4 4.34315 5.34315 3 7 3ZM4 20H20", "color": "#1a1a1a", "label": "Schwebend", "value": "elevated", "card_type": "text", "image_url": "", "description": ""}, {"icon": "M3 8H21M3 12H21M3 16H15", "color": "#1a1a1a", "label": "Flach", "value": "flat", "card_type": "text", "image_url": "", "description": ""}], "display_mode": "chips", "default_value": "filled", "placeholder_text": ""}, {"key": "card_radius", "type": "card_select", "label": "Karten-Rundung", "order": 15, "options": [], "section": "Design", "required": true, "max_length": null, "card_options": [{"icon": "M4 4H20V20H4Z", "color": "#1a1a1a", "label": "Eckig", "value": "eckig", "card_type": "text", "image_url": "", "description": ""}, {"icon": "M6 4H18A2 2 0 0 1 20 6V18A2 2 0 0 1 18 20H6A2 2 0 0 1 4 18V6A2 2 0 0 1 6 4Z", "color": "#1a1a1a", "label": "Soft", "value": "soft", "card_type": "text", "image_url": "", "description": ""}, {"icon": "M9 4H15A5 5 0 0 1 20 9V15A5 5 0 0 1 15 20H9A5 5 0 0 1 4 15V9A5 5 0 0 1 9 4Z", "color": "#1a1a1a", "label": "Normal", "value": "normal", "card_type": "text", "image_url": "", "description": ""}, {"icon": "M11 4H13A7 7 0 0 1 20 11V13A7 7 0 0 1 13 20H11A7 7 0 0 1 4 13V11A7 7 0 0 1 11 4Z", "color": "#1a1a1a", "label": "Rund", "value": "rund", "card_type": "text", "image_url": "", "description": ""}, {"icon": "M9 7H15A5 5 0 0 1 20 12A5 5 0 0 1 15 17H9A5 5 0 0 1 4 12A5 5 0 0 1 9 7Z", "color": "#1a1a1a", "label": "Pill", "value": "pill", "card_type": "text", "image_url": "", "description": ""}], "display_mode": "chips", "default_value": "normal", "placeholder_text": ""}, {"key": "hintergrund_bild", "type": "image", "label": "Hintergrundbild (optional)", "order": 16, "options": [], "section": "Design", "required": false, "aspect_ratio": "free", "card_options": [], "default_value": "", "placeholder_text": "Überschreibt die Hintergrundfarbe"}, {"key": "hintergrund_bild_blur", "max": 30, "min": 0, "step": 1, "type": "range", "unit": "px", "label": "Bild-Unschärfe", "order": 17, "options": [], "section": "Design", "required": false, "show_when": {"field": "hintergrund_bild", "value": "__truthy__"}, "max_length": null, "card_options": [], "default_value": "0", "placeholder_text": "Hintergrund weichzeichnen"}, {"key": "hintergrund_bild_overlay", "max": 0.8, "min": 0, "step": 0.05, "type": "range", "unit": "", "label": "Dunkel-Overlay", "order": 18, "options": [], "section": "Design", "required": false, "show_when": {"field": "hintergrund_bild", "value": "__truthy__"}, "max_length": null, "card_options": [], "default_value": "0.3", "placeholder_text": "Verbessert Lesbarkeit über Bild"}, {"key": "links", "type": "loop", "label": "Links", "order": 40, "options": [], "section": "Links", "required": false, "max_items": 30, "min_items": 0, "max_length": null, "sub_fields": [{"key": "aktiv", "type": "toggle", "label": "Aktiv (auf der Live-Seite sichtbar)", "required": false, "max_length": null, "default_value": "ja", "placeholder_text": ""}, {"key": "typ", "type": "card_select", "label": "Typ", "required": true, "max_length": null, "card_options": [{"icon": "M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71", "color": "#1a1a1a", "label": "Link", "value": "link", "card_type": "text", "image_url": "", "description": "Button mit Icon & Text"}, {"icon": "M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17M10 15l5-3-5-3z", "color": "#FF0000", "label": "YouTube", "value": "youtube", "card_type": "color", "image_url": "", "description": "Eingebettetes Video"}, {"icon": "M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zM8 16c2.5-1 5-1 8 0M8 12c2.5-1 5-1 8 0M8 8c2.5-1 5-1 8 0", "color": "#1DB954", "label": "Spotify", "value": "spotify", "card_type": "color", "image_url": "", "description": "Eingebetteter Player"}], "display_mode": "chips", "default_value": "link", "placeholder_text": ""}, {"key": "titel", "type": "text", "label": "Titel", "required": true, "max_length": 60, "placeholder_text": "z. B. Mein neuester Podcast"}, {"key": "url", "type": "url", "label": "URL", "required": true, "max_length": null, "placeholder_text": "https://..."}, {"key": "beschreibung", "type": "text", "label": "Beschreibung (optional)", "required": false, "show_when": {"field": "typ", "value": "link"}, "max_length": 100, "placeholder_text": "Kurz erklären, ein Satz"}, {"key": "icon_bild", "type": "image", "label": "Eigenes Icon (optional)", "required": false, "show_when": {"field": "typ", "value": "link"}, "aspect_ratio": "1/1", "placeholder_text": "Sonst lädt automatisch das Favicon"}, {"key": "badge", "type": "card_select", "label": "Badge", "required": false, "show_when": {"field": "typ", "value": "link"}, "card_options": [{"color": "", "label": "Kein Badge", "value": "keine", "card_type": "text", "image_url": "", "description": "Standard"}, {"color": "#0A0A0A", "label": "Neu", "value": "neu", "card_type": "color", "image_url": "", "description": "Frisch dazugekommen"}, {"color": "#FF3B30", "label": "Live", "value": "live", "card_type": "color", "image_url": "", "description": "Pulsierender roter Punkt"}, {"color": "#F1B82E", "label": "Empfehlung", "value": "empfehlung", "card_type": "color", "image_url": "", "description": "Gold mit Stern-Icon"}, {"color": "", "label": "Coming Soon", "value": "coming_soon", "card_type": "text", "image_url": "", "description": "Vorankündigung"}], "display_mode": "chips", "default_value": "keine", "placeholder_text": ""}], "card_options": [], "default_value": "", "placeholder_text": "Füge deine wichtigsten Links hinzu"}, {"key": "kontakt_name", "type": "text", "label": "Vor- und Nachname (Inhaber)", "order": 45, "options": [], "section": "Rechtliches", "required": false, "max_length": 80, "card_options": [], "default_value": "", "placeholder_text": "z. B. Anna Bauer"}, {"key": "kontakt_firma", "type": "text", "label": "Firma / Marke (optional)", "order": 46, "options": [], "section": "Rechtliches", "required": false, "max_length": 80, "card_options": [], "default_value": "", "placeholder_text": "z. B. Studio Bauer"}, {"key": "kontakt_strasse", "type": "text", "label": "Straße und Hausnummer", "order": 47, "options": [], "section": "Rechtliches", "required": false, "max_length": 80, "card_options": [], "default_value": "", "placeholder_text": "z. B. Hauptstraße 12"}, {"key": "kontakt_plz_ort", "type": "text", "label": "PLZ und Ort", "order": 48, "options": [], "section": "Rechtliches", "required": false, "max_length": 80, "card_options": [], "default_value": "", "placeholder_text": "z. B. 10115 Berlin"}, {"key": "kontakt_land", "type": "text", "label": "Land", "order": 49, "options": [], "section": "Rechtliches", "required": false, "max_length": 40, "card_options": [], "default_value": "Deutschland", "placeholder_text": "Deutschland"}, {"key": "kontakt_telefon", "type": "text", "label": "Telefon (optional)", "order": 50, "options": [], "section": "Rechtliches", "required": false, "max_length": 40, "card_options": [], "default_value": "", "placeholder_text": "z. B. +49 30 1234567"}, {"key": "kontakt_email", "type": "email", "label": "Kontakt-E-Mail (aktiviert Impressum + Datenschutz)", "order": 51, "options": [], "section": "Rechtliches", "required": false, "max_length": null, "card_options": [], "default_value": "", "placeholder_text": "hallo@..."}, {"key": "kontakt_ust_id", "type": "text", "label": "Umsatzsteuer-ID (optional)", "order": 52, "options": [], "section": "Rechtliches", "required": false, "max_length": 30, "card_options": [], "default_value": "", "placeholder_text": "z. B. DE123456789"}, {"key": "instagram", "type": "url", "label": "Instagram", "order": 60, "options": [], "section": "Social Media", "required": false, "max_length": null, "card_options": [], "default_value": "", "placeholder_text": "https://instagram.com/..."}, {"key": "tiktok", "type": "url", "label": "TikTok", "order": 61, "options": [], "section": "Social Media", "required": false, "max_length": null, "card_options": [], "default_value": "", "placeholder_text": "https://tiktok.com/@..."}, {"key": "youtube", "type": "url", "label": "YouTube", "order": 62, "options": [], "section": "Social Media", "required": false, "max_length": null, "card_options": [], "default_value": "", "placeholder_text": "https://youtube.com/@..."}, {"key": "x_twitter", "type": "url", "label": "X (Twitter)", "order": 63, "options": [], "section": "Social Media", "required": false, "max_length": null, "card_options": [], "default_value": "", "placeholder_text": "https://x.com/..."}, {"key": "linkedin", "type": "url", "label": "LinkedIn", "order": 64, "options": [], "section": "Social Media", "required": false, "max_length": null, "card_options": [], "default_value": "", "placeholder_text": "https://linkedin.com/in/..."}, {"key": "spotify", "type": "url", "label": "Spotify", "order": 65, "options": [], "section": "Social Media", "required": false, "max_length": null, "card_options": [], "default_value": "", "placeholder_text": "https://open.spotify.com/..."}, {"key": "github", "type": "url", "label": "GitHub", "order": 66, "options": [], "section": "Social Media", "required": false, "max_length": null, "card_options": [], "default_value": "", "placeholder_text": "https://github.com/..."}, {"key": "mail", "type": "email", "label": "E-Mail-Adresse", "order": 67, "options": [], "section": "Social Media", "required": false, "max_length": null, "card_options": [], "default_value": "", "placeholder_text": "hallo@..."}, {"key": "website", "type": "url", "label": "Eigene Website", "order": 68, "options": [], "section": "Social Media", "required": false, "max_length": null, "card_options": [], "default_value": "", "placeholder_text": "https://..."}], "version": 1, "preview_values": {"bio": "Designerin aus Berlin. Ich helfe kleinen Marken, groß zu wirken.", "links": "[{\\"aktiv\\":\\"ja\\",\\"typ\\":\\"link\\",\\"titel\\":\\"Mein Portfolio\\",\\"url\\":\\"https://example.com\\",\\"beschreibung\\":\\"Aktuelle Arbeiten & Cases\\",\\"badge\\":\\"neu\\"},{\\"aktiv\\":\\"ja\\",\\"typ\\":\\"link\\",\\"titel\\":\\"Online-Shop\\",\\"url\\":\\"https://shop.example.com\\",\\"beschreibung\\":\\"Print, Postkarten, Notizbücher\\",\\"badge\\":\\"keine\\"},{\\"aktiv\\":\\"ja\\",\\"typ\\":\\"link\\",\\"titel\\":\\"Termin buchen\\",\\"url\\":\\"https://cal.com/example\\",\\"beschreibung\\":\\"Kostenloses Erstgespräch · 20 Min\\",\\"badge\\":\\"empfehlung\\"}]", "theme": "glow", "tiktok": "https://tiktok.com/@example", "vorname": "Anna", "youtube": "https://youtube.com/@example", "nachname": "Bauer", "instagram": "https://instagram.com/example", "card_style": "filled", "font_combo": "modern_clean", "akzentfarbe": "#7C3AED", "card_radius": "normal", "hintergrund_farbe": "#FFFFFF"}}	1	2026-06-10 20:51:45.468849+00	2026-06-19 10:23:27.119339+00	\N	\N	\N	{link-in-bio,social,creator,minimal}	f	t
\.


--
-- Data for Name: user_notifications; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.user_notifications (id, user_id, type, title, message, data, read_at, created_at) FROM stdin;
\.


--
-- Data for Name: user_sites; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.user_sites (id, user_id, template_id, status, published_at, deactivated_at, scheduled_deletion_at, r2_published_path, created_at, updated_at, custom_domain, custom_domain_status, cf_custom_hostname_id, custom_domain_verified_at) FROM stdin;
28666d8b-9b63-41f5-837b-3885b9a9926c	691ce6da-c0b9-4d76-93e9-3105779f9f61	3bc5ab65-f218-4a22-a097-c016ceb3c076	draft	\N	\N	\N	\N	2026-06-06 10:10:55.896097+00	2026-06-06 10:10:55.896097+00	\N	\N	\N	\N
6bc11998-2577-41e2-a24d-d0ab36d76e0c	691ce6da-c0b9-4d76-93e9-3105779f9f61	eb848ad4-3028-49c5-8bc9-3bdc762d36e9	published	2026-06-10 07:28:12.701+00	\N	\N	\N	2026-06-09 13:22:42.062848+00	2026-06-10 07:28:12.756135+00	\N	\N	\N	\N
c0feeeda-d456-44cc-b370-dce0ec3463dd	691ce6da-c0b9-4d76-93e9-3105779f9f61	fb2de3c0-b41e-4030-a56a-039a04431276	draft	\N	\N	\N	\N	2026-06-10 21:03:48.609441+00	2026-06-10 21:03:48.609441+00	\N	\N	\N	\N
c86bef2e-47c5-4db8-a3f7-281713cd9588	691ce6da-c0b9-4d76-93e9-3105779f9f61	e825dd89-2733-4e56-9d0b-6bb61d661056	draft	\N	\N	\N	\N	2026-06-19 11:47:17.339182+00	2026-06-19 11:47:17.339182+00	\N	\N	\N	\N
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.users (id, email, username, username_set_at, plan, billing_interval, stripe_customer_id, stripe_subscription_id, subscription_status, current_period_end, payment_failed_at, deactivated_at, is_admin, created_at, updated_at, stripe_connect_id, affiliate_onboarded, referred_by_username) FROM stdin;
4665a7b4-cb1b-4349-8613-e3590d0c4642	testmail@daniel-kurzeja.de	testuser	2026-04-19 19:16:50.557+00	starter	monthly	cus_UMjt9j8rTFc4DS	sub_1TO0paGWVCygqvfcchHtoJJR	active	2026-07-19 19:16:00+00	\N	\N	f	2026-04-19 18:47:30.36498+00	2026-06-19 20:30:37.926697+00	acct_1TNx0NGebL5V9oiF	t	daniel-kurzeja
691ce6da-c0b9-4d76-93e9-3105779f9f61	daniel-kurzeja@live.de	daniel-kurzeja	2026-04-12 13:30:06.699+00	starter	monthly	\N	\N	\N	\N	\N	\N	t	2026-04-12 13:28:12.015211+00	2026-04-19 20:10:57.763599+00	acct_1TNxONGebL5V9oiF	t	\N
\.


--
-- Name: affiliate_commissions affiliate_commissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.affiliate_commissions
    ADD CONSTRAINT affiliate_commissions_pkey PRIMARY KEY (id);


--
-- Name: affiliate_payouts affiliate_payouts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.affiliate_payouts
    ADD CONSTRAINT affiliate_payouts_pkey PRIMARY KEY (id);


--
-- Name: form_schemas form_schemas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_schemas
    ADD CONSTRAINT form_schemas_pkey PRIMARY KEY (id);


--
-- Name: form_schemas form_schemas_template_id_form_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_schemas
    ADD CONSTRAINT form_schemas_template_id_form_name_key UNIQUE (template_id, form_name);


--
-- Name: form_submissions form_submissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_submissions
    ADD CONSTRAINT form_submissions_pkey PRIMARY KEY (id);


--
-- Name: site_data site_data_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_data
    ADD CONSTRAINT site_data_pkey PRIMARY KEY (id);


--
-- Name: site_data site_data_user_site_id_field_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_data
    ADD CONSTRAINT site_data_user_site_id_field_key_key UNIQUE (user_site_id, field_key);


--
-- Name: site_images site_images_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_images
    ADD CONSTRAINT site_images_pkey PRIMARY KEY (id);


--
-- Name: site_images site_images_user_site_id_field_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_images
    ADD CONSTRAINT site_images_user_site_id_field_key_key UNIQUE (user_site_id, field_key);


--
-- Name: subscription_events subscription_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_events
    ADD CONSTRAINT subscription_events_pkey PRIMARY KEY (id);


--
-- Name: subscription_events subscription_events_stripe_event_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_events
    ADD CONSTRAINT subscription_events_stripe_event_id_key UNIQUE (stripe_event_id);


--
-- Name: template_access template_access_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.template_access
    ADD CONSTRAINT template_access_pkey PRIMARY KEY (id);


--
-- Name: template_access template_access_template_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.template_access
    ADD CONSTRAINT template_access_template_id_user_id_key UNIQUE (template_id, user_id);


--
-- Name: template_updates template_updates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.template_updates
    ADD CONSTRAINT template_updates_pkey PRIMARY KEY (id);


--
-- Name: templates templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.templates
    ADD CONSTRAINT templates_pkey PRIMARY KEY (id);


--
-- Name: user_notifications user_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_notifications
    ADD CONSTRAINT user_notifications_pkey PRIMARY KEY (id);


--
-- Name: user_sites user_sites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_sites
    ADD CONSTRAINT user_sites_pkey PRIMARY KEY (id);


--
-- Name: user_sites user_sites_user_id_template_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_sites
    ADD CONSTRAINT user_sites_user_id_template_id_key UNIQUE (user_id, template_id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_stripe_customer_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_stripe_customer_id_key UNIQUE (stripe_customer_id);


--
-- Name: users users_stripe_subscription_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_stripe_subscription_id_key UNIQUE (stripe_subscription_id);


--
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- Name: affiliate_commissions_invoice_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX affiliate_commissions_invoice_idx ON public.affiliate_commissions USING btree (stripe_invoice_id) WHERE (stripe_invoice_id IS NOT NULL);


--
-- Name: idx_form_schemas_template; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_form_schemas_template ON public.form_schemas USING btree (template_id);


--
-- Name: idx_form_submissions_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_form_submissions_created ON public.form_submissions USING btree (created_at DESC);


--
-- Name: idx_form_submissions_site; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_form_submissions_site ON public.form_submissions USING btree (user_site_id);


--
-- Name: idx_form_submissions_unread; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_form_submissions_unread ON public.form_submissions USING btree (user_site_id, read_at) WHERE ((archived_at IS NULL) AND (is_spam = false));


--
-- Name: idx_notifications_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_user_id ON public.user_notifications USING btree (user_id);


--
-- Name: idx_site_data_user_site_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_site_data_user_site_id ON public.site_data USING btree (user_site_id);


--
-- Name: idx_subscription_events_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscription_events_created_at ON public.subscription_events USING btree (created_at);


--
-- Name: idx_subscription_events_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscription_events_type ON public.subscription_events USING btree (event_type);


--
-- Name: idx_subscription_events_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscription_events_user_id ON public.subscription_events USING btree (user_id);


--
-- Name: idx_template_access_template; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_template_access_template ON public.template_access USING btree (template_id);


--
-- Name: idx_template_access_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_template_access_user ON public.template_access USING btree (user_id);


--
-- Name: idx_user_sites_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_sites_status ON public.user_sites USING btree (status);


--
-- Name: idx_user_sites_template_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_sites_template_id ON public.user_sites USING btree (template_id);


--
-- Name: idx_user_sites_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_sites_user_id ON public.user_sites USING btree (user_id);


--
-- Name: idx_users_stripe_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_stripe_customer ON public.users USING btree (stripe_customer_id);


--
-- Name: idx_users_username; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_username ON public.users USING btree (username);


--
-- Name: user_sites_custom_domain_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX user_sites_custom_domain_unique ON public.user_sites USING btree (custom_domain) WHERE (custom_domain IS NOT NULL);


--
-- Name: form_schemas handle_updated_at_form_schemas; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER handle_updated_at_form_schemas BEFORE UPDATE ON public.form_schemas FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


--
-- Name: templates handle_updated_at_templates; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER handle_updated_at_templates BEFORE UPDATE ON public.templates FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


--
-- Name: user_sites handle_updated_at_user_sites; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER handle_updated_at_user_sites BEFORE UPDATE ON public.user_sites FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


--
-- Name: users handle_updated_at_users; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER handle_updated_at_users BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


--
-- Name: affiliate_commissions affiliate_commissions_referee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.affiliate_commissions
    ADD CONSTRAINT affiliate_commissions_referee_id_fkey FOREIGN KEY (referee_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: affiliate_commissions affiliate_commissions_referred_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.affiliate_commissions
    ADD CONSTRAINT affiliate_commissions_referred_user_id_fkey FOREIGN KEY (referred_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: affiliate_commissions affiliate_commissions_referrer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.affiliate_commissions
    ADD CONSTRAINT affiliate_commissions_referrer_id_fkey FOREIGN KEY (referrer_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: affiliate_payouts affiliate_payouts_referrer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.affiliate_payouts
    ADD CONSTRAINT affiliate_payouts_referrer_id_fkey FOREIGN KEY (referrer_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: form_schemas form_schemas_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_schemas
    ADD CONSTRAINT form_schemas_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.templates(id) ON DELETE CASCADE;


--
-- Name: form_submissions form_submissions_user_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_submissions
    ADD CONSTRAINT form_submissions_user_site_id_fkey FOREIGN KEY (user_site_id) REFERENCES public.user_sites(id) ON DELETE CASCADE;


--
-- Name: site_data site_data_user_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_data
    ADD CONSTRAINT site_data_user_site_id_fkey FOREIGN KEY (user_site_id) REFERENCES public.user_sites(id) ON DELETE CASCADE;


--
-- Name: site_images site_images_user_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_images
    ADD CONSTRAINT site_images_user_site_id_fkey FOREIGN KEY (user_site_id) REFERENCES public.user_sites(id) ON DELETE CASCADE;


--
-- Name: subscription_events subscription_events_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_events
    ADD CONSTRAINT subscription_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: template_access template_access_granted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.template_access
    ADD CONSTRAINT template_access_granted_by_fkey FOREIGN KEY (granted_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: template_access template_access_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.template_access
    ADD CONSTRAINT template_access_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.templates(id) ON DELETE CASCADE;


--
-- Name: template_access template_access_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.template_access
    ADD CONSTRAINT template_access_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: template_updates template_updates_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.template_updates
    ADD CONSTRAINT template_updates_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.templates(id) ON DELETE CASCADE;


--
-- Name: user_notifications user_notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_notifications
    ADD CONSTRAINT user_notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_sites user_sites_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_sites
    ADD CONSTRAINT user_sites_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.templates(id) ON DELETE RESTRICT;


--
-- Name: user_sites user_sites_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_sites
    ADD CONSTRAINT user_sites_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: users users_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: form_schemas Admins can manage form_schemas; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage form_schemas" ON public.form_schemas USING ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.id = auth.uid()) AND (users.is_admin = true)))));


--
-- Name: templates Admins can manage templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage templates" ON public.templates USING ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.id = auth.uid()) AND (users.is_admin = true)))));


--
-- Name: subscription_events Admins can read all subscription events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can read all subscription events" ON public.subscription_events FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.id = auth.uid()) AND (users.is_admin = true)))));


--
-- Name: user_sites Admins can view all sites; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all sites" ON public.user_sites FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.id = auth.uid()) AND (users.is_admin = true)))));


--
-- Name: form_submissions Admins can view all submissions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all submissions" ON public.form_submissions FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.id = auth.uid()) AND (users.is_admin = true)))));


--
-- Name: template_access Admins manage template_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins manage template_access" ON public.template_access USING ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.id = auth.uid()) AND (users.is_admin = true)))));


--
-- Name: templates Anyone can view published templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view published templates" ON public.templates FOR SELECT USING ((status = 'published'::text));


--
-- Name: form_submissions Users can delete own submissions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own submissions" ON public.form_submissions FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.user_sites
  WHERE ((user_sites.id = form_submissions.user_site_id) AND (user_sites.user_id = auth.uid())))));


--
-- Name: site_data Users can manage own site data; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage own site data" ON public.site_data USING ((EXISTS ( SELECT 1
   FROM public.user_sites
  WHERE ((user_sites.id = site_data.user_site_id) AND (user_sites.user_id = auth.uid())))));


--
-- Name: site_images Users can manage own site images; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage own site images" ON public.site_images USING ((EXISTS ( SELECT 1
   FROM public.user_sites
  WHERE ((user_sites.id = site_images.user_site_id) AND (user_sites.user_id = auth.uid())))));


--
-- Name: user_sites Users can manage own sites; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage own sites" ON public.user_sites USING ((auth.uid() = user_id));


--
-- Name: form_submissions Users can manage own submissions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage own submissions" ON public.form_submissions USING ((EXISTS ( SELECT 1
   FROM public.user_sites us
  WHERE ((us.id = form_submissions.user_site_id) AND (us.user_id = auth.uid())))));


--
-- Name: subscription_events Users can read own subscription events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read own subscription events" ON public.subscription_events FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: user_notifications Users can update own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own notifications" ON public.user_notifications FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: users Users can update own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE USING ((auth.uid() = id));


--
-- Name: form_submissions Users can update own submissions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own submissions" ON public.form_submissions FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.user_sites
  WHERE ((user_sites.id = form_submissions.user_site_id) AND (user_sites.user_id = auth.uid())))));


--
-- Name: form_schemas Users can view form_schemas for own sites; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view form_schemas for own sites" ON public.form_schemas FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.user_sites us
  WHERE ((us.template_id = form_schemas.template_id) AND (us.user_id = auth.uid())))));


--
-- Name: user_notifications Users can view own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own notifications" ON public.user_notifications FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: users Users can view own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own profile" ON public.users FOR SELECT USING ((auth.uid() = id));


--
-- Name: form_submissions Users can view own submissions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own submissions" ON public.form_submissions FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.user_sites
  WHERE ((user_sites.id = form_submissions.user_site_id) AND (user_sites.user_id = auth.uid())))));


--
-- Name: template_access Users view own template_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users view own template_access" ON public.template_access FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: affiliate_commissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.affiliate_commissions ENABLE ROW LEVEL SECURITY;

--
-- Name: affiliate_payouts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.affiliate_payouts ENABLE ROW LEVEL SECURITY;

--
-- Name: form_schemas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.form_schemas ENABLE ROW LEVEL SECURITY;

--
-- Name: form_submissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.form_submissions ENABLE ROW LEVEL SECURITY;

--
-- Name: affiliate_commissions service_role_all_commissions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_role_all_commissions ON public.affiliate_commissions TO service_role USING (true) WITH CHECK (true);


--
-- Name: affiliate_payouts service_role_all_payouts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_role_all_payouts ON public.affiliate_payouts TO service_role USING (true) WITH CHECK (true);


--
-- Name: site_data; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.site_data ENABLE ROW LEVEL SECURITY;

--
-- Name: site_images; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.site_images ENABLE ROW LEVEL SECURITY;

--
-- Name: subscription_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.subscription_events ENABLE ROW LEVEL SECURITY;

--
-- Name: template_access; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.template_access ENABLE ROW LEVEL SECURITY;

--
-- Name: template_updates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.template_updates ENABLE ROW LEVEL SECURITY;

--
-- Name: templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;

--
-- Name: user_notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: user_sites; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_sites ENABLE ROW LEVEL SECURITY;

--
-- Name: users; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--

\unrestrict 7T4BqmkKvA5gPifKdkMcABHbxmNQG2xRjD26bvuUOuF9Q7whpsoo4xU9B1mhpzZ

