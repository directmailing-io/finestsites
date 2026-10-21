-- ─────────────────────────────────────────────────────────────────────────────
-- Anonymisierung der lokalen Test-Datenbank `finestsites_dev`.
-- Läuft NUR lokal (setup.sh), NIEMALS gegen Produktion.
--
-- Prinzip: Struktur und Mengen bleiben realistisch (Pläne, Status, Seiten,
-- Benutzernamen, Template-Inhalte), aber alles, was eine echte Person
-- identifiziert (E-Mail, Name, Telefon, Adresse, Steuerdaten, Fotos,
-- Social-Profile, IP/User-Agent, Stripe-IDs, Tokens, Chat-Inhalte,
-- Formular-Einsendungen), wird ersetzt oder gelöscht.
--
-- Alle Konten erhalten das Passwort  Test1234!
-- (BetterAuth-scrypt-Hash, erzeugt mit hash-password.mjs).
-- ─────────────────────────────────────────────────────────────────────────────
\set ON_ERROR_STOP on
SET client_min_messages = warning;

-- Schutz: nur in finestsites_dev ausführen
DO $$
BEGIN
  IF current_database() <> 'finestsites_dev' THEN
    RAISE EXCEPTION 'anonymize.sql darf nur in finestsites_dev laufen (aktuell: %)', current_database();
  END IF;
END $$;

BEGIN;

-- ─── Hilfsfunktionen (werden am Ende wieder entfernt) ────────────────────────
CREATE OR REPLACE FUNCTION pg_temp.fake_phone(n int, orig text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN orig IS NULL OR orig = '' THEN orig
    WHEN orig ~ '^\+' THEN '+49 151 ' || lpad(n::text, 8, '0')
    ELSE '49151' || lpad(n::text, 8, '0')
  END
$$;

CREATE OR REPLACE FUNCTION pg_temp.fake_partner_no(n int) RETURNS text
LANGUAGE sql IMMUTABLE AS $$ SELECT '9' || lpad(n::text, 7, '0') $$;

CREATE OR REPLACE FUNCTION pg_temp.fake_social(n int, orig text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN orig IS NULL OR btrim(orig) = '' THEN orig
    WHEN orig ~* '^https?://' THEN
      regexp_replace(orig, '^(https?://[^/?#]+).*$', '\1') || '/testprofil' || n
    WHEN orig ~ '^@' THEN '@testprofil' || n
    ELSE 'testprofil' || n
  END
$$;

-- Eingebettete Kontaktdaten in beliebigem Text ersetzen (E-Mail, Partnernummer, WhatsApp-Links).
CREATE OR REPLACE FUNCTION pg_temp.anon_inline(v text, n int) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT regexp_replace(regexp_replace(
           regexp_replace(
             regexp_replace(v, '[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}', 'kontakt' || n || '@example.invalid', 'g'),
             '(sponsor=|[?&]TP=|[?&]tp=)[0-9]+', '\1' || pg_temp.fake_partner_no(n), 'g'),
           '(wa\.me/|phone=)\+?[0-9]+', '\1' || '49151' || lpad(n::text, 8, '0'), 'g'),
         '\m[0-9]{6,9}(\.fitline\.com)', pg_temp.fake_partner_no(n) || '\1', 'g')
$$;

-- Ein Feldwert einer Webseite (site_data / published_data) anonymisieren.
CREATE OR REPLACE FUNCTION pg_temp.anon_site_value(k text, v text, n int) RETURNS text
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  lk text := lower(k);
BEGIN
  IF v IS NULL OR btrim(v) = '' THEN RETURN v; END IF;

  -- Fotos der echten Person (R2-Medien) → leer (Template zeigt Platzhalter)
  IF v ~* '/api/media/(user-images|profile-images)/' OR v ~* 'r2\.(dev|cloudflarestorage\.com)' THEN
    RETURN '';
  END IF;

  -- JSON-Werte (z. B. Linklisten): nur eingebettete Kontaktdaten ersetzen, Struktur behalten
  IF lk = 'links' OR v ~ '^\s*[\[{]' THEN
    RETURN pg_temp.anon_inline(v, n);
  END IF;

  -- Freitexte (Über mich, Intro, Bio, Zitate, Datenschutz, Übersetzungen/Backups)
  IF lk ~ '^(about_me_html|about_intro|intro|bio|eigenes_zitat|partner_zitat|datenschutz_text)' THEN
    IF v ~ '^\s*<' THEN
      RETURN '<p>Dies ist ein anonymisierter Beispieltext für die lokale Testumgebung.</p>'
          || '<p>Hier steht normalerweise die persönliche Geschichte des Seitenbesitzers. '
          || 'Der Text ist bewusst lang genug, um Umbrüche, Absätze und das Layout zu prüfen.</p>';
    END IF;
    RETURN 'Anonymisierter Beispieltext für die lokale Testumgebung.';
  END IF;

  -- E-Mail-Adressen (email_benachrichtigung, mail, impressum_email, …)
  IF v ~ '[^@\s]+@[^@\s]+\.[^@\s]+' THEN
    RETURN 'kontakt' || n || '@example.invalid';
  END IF;

  -- Telefon / WhatsApp
  IF lk ~ '(telefon|phone|whatsapp)' THEN
    RETURN pg_temp.fake_phone(n, v);
  END IF;

  -- Namen
  IF lk ~ 'vorname' THEN RETURN 'Test'; END IF;
  IF lk ~ 'nachname' THEN RETURN 'Nutzer' || n; END IF;
  IF lk IN ('impressum_name', 'kontakt_name', 'anbieter_name') THEN RETURN 'Test Nutzer' || n; END IF;
  IF lk = 'kontakt_firma' THEN RETURN 'Testfirma ' || n; END IF;

  -- Adresse / Steuer
  IF lk ~ '(strasse|adresse)' THEN RETURN 'Teststraße ' || n; END IF;
  IF lk ~ 'plz_ort' THEN RETURN '12345 Teststadt'; END IF;
  IF lk ~ '(ust_id|steuer)' THEN RETURN 'DE000000000'; END IF;

  -- Teampartner-Nummer (auch eingebettet in Shop-/Registrierungs-Links)
  IF lk IN ('teampartner_nummer', 'team_partner_number') THEN RETURN pg_temp.fake_partner_no(n); END IF;
  IF lk ~ '^(shop_|pm_reg_link)' THEN
    -- nur die Partnernummer (sponsor=…), nicht die Produktnummer im Pfad
    RETURN regexp_replace(
             regexp_replace(v, '(?<!products/)\m[0-9]{6,9}\M', pg_temp.fake_partner_no(n), 'g'),
             '(sponsor=)[0-9]+', '\1' || pg_temp.fake_partner_no(n), 'g');
  END IF;

  -- Social-Profile / eigene Website
  IF lk ~ '(instagram|facebook|tiktok|linkedin|youtube|x_twitter|github|spotify|^website)' THEN
    RETURN pg_temp.fake_social(n, v);
  END IF;

  RETURN pg_temp.anon_inline(v, n);
END $$;

-- Ein Formular-Einsendungs-Objekt anonymisieren (Schlüssel bleiben erhalten).
CREATE OR REPLACE FUNCTION pg_temp.anon_form_data(d jsonb, n int) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  r record;
  out jsonb := '{}'::jsonb;
  lk text;
  sv text;
BEGIN
  IF d IS NULL OR jsonb_typeof(d) <> 'object' THEN RETURN d; END IF;
  FOR r IN SELECT key, value FROM jsonb_each(d) LOOP
    lk := lower(r.key);
    IF jsonb_typeof(r.value) <> 'string' THEN
      out := out || jsonb_build_object(r.key, r.value);
      CONTINUE;
    END IF;
    sv := r.value #>> '{}';
    IF sv = '' THEN
      out := out || jsonb_build_object(r.key, sv);
    ELSIF lk ~ 'mail' OR sv ~ '[^@\s]+@[^@\s]+\.[^@\s]+' THEN
      out := out || jsonb_build_object(r.key, 'interessent' || n || '@example.invalid');
    ELSIF lk ~ '(telefon|phone|whatsapp)' OR sv ~ '^[+0-9 ()/-]{7,}$' THEN
      out := out || jsonb_build_object(r.key, pg_temp.fake_phone(n, sv));
    ELSIF lk IN ('name', 'fullname', 'vorname', 'nachname') THEN
      out := out || jsonb_build_object(r.key, 'Max Mustermann');
    ELSIF lk IN ('teampartner_nummer', 'team_partner_number') THEN
      out := out || jsonb_build_object(r.key, pg_temp.fake_partner_no(n));
    ELSIF lk IN ('nachricht', 'message', 'wuensche') OR length(sv) > 60 THEN
      out := out || jsonb_build_object(r.key, 'Testnachricht aus der anonymisierten Testumgebung.');
    ELSE
      -- Auswahlwerte (Scores, Kontaktweg, Ziele, Sprache …) bleiben erhalten
      out := out || jsonb_build_object(r.key, sv);
    END IF;
  END LOOP;
  RETURN out;
END $$;

-- ─── Zuordnung echte Nutzer → laufende Nummer ────────────────────────────────
CREATE TEMP TABLE anon_users ON COMMIT DROP AS
SELECT u.id,
       row_number() OVER (ORDER BY u.created_at, u.id)::int AS n,
       lower(u.email) AS old_email,
       u.is_admin
FROM users u;

ALTER TABLE anon_users ADD COLUMN new_email text;
UPDATE anon_users SET new_email = CASE WHEN is_admin THEN 'admin@example.invalid'
                                       ELSE 'user' || n || '@example.invalid' END;
-- Falls es mehr als einen Admin gäbe: eindeutige Adressen
UPDATE anon_users a SET new_email = 'admin' || a.n || '@example.invalid'
WHERE a.is_admin AND a.n <> (SELECT min(n) FROM anon_users WHERE is_admin);

-- ─── Sitzungen, Tokens, Verifizierungen ──────────────────────────────────────
DELETE FROM sessions;
DELETE FROM verifications;
DELETE FROM impersonation_requests;

-- ─── users ───────────────────────────────────────────────────────────────────
UPDATE users u SET
  email                        = a.new_email,
  name                         = CASE WHEN u.is_admin THEN 'Test Admin' ELSE 'Testnutzer ' || a.n END,
  first_name                   = CASE WHEN u.first_name IS NULL THEN NULL WHEN u.is_admin THEN 'Test' ELSE 'Test' END,
  last_name                    = CASE WHEN u.last_name  IS NULL THEN NULL WHEN u.is_admin THEN 'Admin' ELSE 'Nutzer' || a.n END,
  phone                        = pg_temp.fake_phone(a.n, u.phone),
  company_name                 = CASE WHEN u.company_name IS NULL THEN NULL ELSE 'Testfirma ' || a.n END,
  website_url                  = pg_temp.fake_social(a.n, u.website_url),
  instagram                    = pg_temp.fake_social(a.n, u.instagram),
  facebook                     = pg_temp.fake_social(a.n, u.facebook),
  linkedin                     = pg_temp.fake_social(a.n, u.linkedin),
  tiktok                       = pg_temp.fake_social(a.n, u.tiktok),
  youtube                      = pg_temp.fake_social(a.n, u.youtube),
  profile_image_url            = NULL,
  image                        = NULL,
  team_partner_number          = CASE WHEN u.team_partner_number IS NULL THEN NULL ELSE pg_temp.fake_partner_no(a.n) END,
  stripe_customer_id           = CASE WHEN u.stripe_customer_id     IS NULL THEN NULL ELSE 'test_cus_'  || a.n END,
  stripe_subscription_id       = CASE WHEN u.stripe_subscription_id IS NULL THEN NULL ELSE 'test_sub_'  || a.n END,
  stripe_connect_id            = CASE WHEN u.stripe_connect_id      IS NULL THEN NULL ELSE 'test_acct_' || a.n END,
  payment_failed_invoice_id    = CASE WHEN u.payment_failed_invoice_id IS NULL THEN NULL ELSE 'test_in_' || a.n END,
  payment_fingerprints         = CASE WHEN u.payment_fingerprints IS NULL THEN NULL
                                      WHEN cardinality(u.payment_fingerprints) = 0 THEN u.payment_fingerprints
                                      ELSE ARRAY['test_fp_' || a.n] END,
  affiliate_payout_email       = CASE WHEN u.affiliate_payout_email IS NULL THEN NULL ELSE a.new_email END,
  content_consent_ip           = CASE WHEN u.content_consent_ip IS NULL THEN NULL ELSE '127.0.0.1' END,
  content_consent_ua           = CASE WHEN u.content_consent_ua IS NULL THEN NULL ELSE 'anonymisiert' END
FROM anon_users a
WHERE a.id = u.id;

-- ─── accounts: einheitliches Testpasswort, keine OAuth-Tokens ────────────────
UPDATE accounts SET
  password      = CASE WHEN provider_id = 'credential'
                       THEN 'e65962ae22133751da2c79d146d66a14:a854f01ecd4f4c7af7c00fb5eead230a202162b90d5c47dcbbf6bf361e5c88943a71afea196d811a99cf38e4e935f180700065498b6292504ed1c9a0e091cbc4'
                       ELSE NULL END,
  access_token  = NULL,
  refresh_token = NULL,
  id_token      = NULL;

-- ─── Webseiten ───────────────────────────────────────────────────────────────
-- Eigene Domains der Kunden → kundeN.example.invalid (auch in site_events.host)
CREATE TEMP TABLE anon_domains ON COMMIT DROP AS
SELECT lower(custom_domain) AS old_domain,
       'kunde' || row_number() OVER (ORDER BY lower(custom_domain)) || '.example.invalid' AS new_domain
FROM (SELECT DISTINCT custom_domain FROM user_sites WHERE custom_domain IS NOT NULL AND custom_domain <> '') d;

UPDATE site_events e SET host = d.new_domain FROM anon_domains d WHERE lower(e.host) = d.old_domain;
UPDATE site_events e SET referrer_host = d.new_domain FROM anon_domains d WHERE lower(e.referrer_host) = d.old_domain;

UPDATE user_sites s SET
  custom_domain         = d.new_domain,
  cf_custom_hostname_id = CASE WHEN s.cf_custom_hostname_id IS NULL THEN NULL ELSE 'test_cfh_' || md5(s.id::text) END
FROM anon_domains d
WHERE lower(s.custom_domain) = d.old_domain;

UPDATE user_sites SET cf_custom_hostname_id = 'test_cfh_' || md5(id::text)
WHERE cf_custom_hostname_id IS NOT NULL AND cf_custom_hostname_id NOT LIKE 'test_%';

UPDATE user_sites SET
  content_consent_ip = CASE WHEN content_consent_ip IS NULL THEN NULL ELSE '127.0.0.1' END,
  content_consent_ua = CASE WHEN content_consent_ua IS NULL THEN NULL ELSE 'anonymisiert' END;

-- Entwurfsdaten
UPDATE site_data sd SET field_value = pg_temp.anon_site_value(sd.field_key, sd.field_value, a.n)
FROM user_sites s JOIN anon_users a ON a.id = s.user_id
WHERE s.id = sd.user_site_id;

-- Veröffentlichte Daten (gleiche Schlüssel als JSON-Objekt)
UPDATE user_sites s SET published_data = (
  SELECT jsonb_object_agg(
           e.key,
           CASE WHEN jsonb_typeof(e.value) = 'string'
                THEN to_jsonb(pg_temp.anon_site_value(e.key, e.value #>> '{}', a.n))
                ELSE e.value END)
  FROM jsonb_each(s.published_data) e
)
FROM anon_users a
WHERE a.id = s.user_id
  AND s.published_data IS NOT NULL
  AND jsonb_typeof(s.published_data) = 'object'
  AND s.published_data <> '{}'::jsonb;

-- Hochgeladene Bilder: Pfade bleiben (zeigen lokal ins Leere), keine Personendaten in Spalten

-- ─── Formular-Einsendungen (Interessenten) ───────────────────────────────────
UPDATE form_submissions f SET data = pg_temp.anon_form_data(f.data, x.rn)
FROM (SELECT id, row_number() OVER (ORDER BY created_at, id)::int AS rn FROM form_submissions) x
WHERE x.id = f.id;

-- ─── Support ─────────────────────────────────────────────────────────────────
UPDATE support_conversations SET subject = CASE WHEN subject IS NULL OR subject = '' THEN subject ELSE 'Support-Anfrage' END;

UPDATE support_messages SET
  content = CASE sender_type
              WHEN 'admin'  THEN 'Antwort vom Support (anonymisiert). Danke für deine Nachricht!'
              WHEN 'system' THEN content
              ELSE 'Nachricht eines Nutzers (anonymisiert). Ich habe eine Frage zu meiner Webseite.'
            END,
  media_url = NULL,
  content_type = CASE WHEN content_type = 'image' THEN 'text' ELSE content_type END;

UPDATE support_ai_suggestions SET
  hint         = CASE WHEN hint IS NULL THEN NULL ELSE 'Hinweis (anonymisiert)' END,
  suggestion   = 'KI-Vorschlag (anonymisiert).',
  sent_content = CASE WHEN sent_content IS NULL THEN NULL ELSE 'Gesendete Antwort (anonymisiert).' END;

-- ─── E-Mail-Protokoll ────────────────────────────────────────────────────────
UPDATE email_logs l SET "to" = a.new_email FROM anon_users a WHERE lower(l."to") = a.old_email;
UPDATE email_logs SET "to" = 'empfaenger-' || left(md5(id::text), 8) || '@example.invalid'
WHERE "to" NOT LIKE '%@example.invalid';
UPDATE email_logs SET
  resend_id = CASE WHEN resend_id IS NULL THEN NULL ELSE 'test_' || left(md5(id::text), 12) END,
  subject   = regexp_replace(
                regexp_replace(
                  regexp_replace(subject, '^(Schönen Samstag|Kurze Frage|Hallo|Hi), [^☀–]*[^ ☀–]', '\1, Test'),
                  'Deine Domain \S+ ist', 'Deine Domain kunde.example.invalid ist'),
                '[^@\s]+@[^@\s]+\.[a-z]{2,}', 'empfaenger@example.invalid', 'g'),
  error_message = CASE WHEN error_message IS NULL THEN NULL ELSE regexp_replace(error_message, '[^@\s]+@[^@\s]+\.[a-z]{2,}', 'empfaenger@example.invalid', 'g') END;

-- ─── Newsletter / Warteliste ─────────────────────────────────────────────────
UPDATE newsletter_sends SET
  specific_emails  = CASE WHEN specific_emails IS NULL THEN NULL
                          WHEN jsonb_typeof(specific_emails) = 'array'
                          THEN (SELECT coalesce(jsonb_agg('empfaenger' || i || '@example.invalid'), '[]'::jsonb)
                                FROM jsonb_array_elements(specific_emails) WITH ORDINALITY t(v, i))
                          ELSE '[]'::jsonb END,
  recipient_filter = CASE WHEN recipient_filter ? 'specificEmails'
                          THEN jsonb_set(recipient_filter, '{specificEmails}',
                                 (SELECT coalesce(jsonb_agg('empfaenger' || i || '@example.invalid'), '[]'::jsonb)
                                  FROM jsonb_array_elements(CASE WHEN jsonb_typeof(recipient_filter->'specificEmails') = 'array'
                                                                 THEN recipient_filter->'specificEmails' ELSE '[]'::jsonb END)
                                       WITH ORDINALITY t(v, i)))
                          ELSE recipient_filter END;
UPDATE newsletter_sends SET recipient_filter = jsonb_set(recipient_filter, '{to}', '"admin@example.invalid"')
WHERE jsonb_typeof(recipient_filter) = 'object' AND recipient_filter ? 'to';

UPDATE waitlist w SET
  email = 'warteliste' || x.rn || '@example.invalid',
  name  = CASE WHEN w.name IS NULL THEN NULL ELSE 'Interessent ' || x.rn END,
  confirm_token = CASE WHEN w.confirm_token IS NULL THEN NULL ELSE gen_random_uuid() END
FROM (SELECT id, row_number() OVER (ORDER BY created_at, id)::int AS rn FROM waitlist) x
WHERE x.id = w.id;

UPDATE waitlist_broadcasts SET recipients = (
  SELECT coalesce(jsonb_agg(jsonb_build_object('name', NULL, 'email', 'warteliste' || i || '@example.invalid')), '[]'::jsonb)
  FROM jsonb_array_elements(CASE WHEN jsonb_typeof(recipients) = 'array' THEN recipients ELSE '[]'::jsonb END)
       WITH ORDINALITY t(v, i)
) WHERE recipients IS NOT NULL;

-- ─── Benachrichtigungen ──────────────────────────────────────────────────────
UPDATE user_notifications SET
  message = regexp_replace(coalesce(message, ''), '[^@\s]+@[^@\s]+\.[a-z]{2,}', 'kontakt@example.invalid', 'g'),
  data    = CASE WHEN data IS NULL THEN NULL ELSE '{}'::jsonb END;

-- ─── Abo-Ereignisse (Stripe) ─────────────────────────────────────────────────
UPDATE subscription_events SET
  stripe_event_id        = CASE WHEN stripe_event_id        IS NULL THEN NULL ELSE 'test_evt_' || left(md5(id::text || 'e'), 16) END,
  stripe_subscription_id = CASE WHEN stripe_subscription_id IS NULL THEN NULL ELSE 'test_sub_' || left(md5(stripe_subscription_id), 12) END,
  stripe_invoice_id      = CASE WHEN stripe_invoice_id      IS NULL THEN NULL ELSE 'test_in_'  || left(md5(stripe_invoice_id), 12) END,
  metadata = CASE WHEN metadata IS NULL OR jsonb_typeof(metadata) <> 'object' THEN metadata
                  ELSE (metadata - 'payment_method_last4' - 'last4')
                       || CASE WHEN metadata ? 'payment_method_last4' THEN '{"payment_method_last4":"4242"}'::jsonb ELSE '{}'::jsonb END
                       || CASE WHEN metadata ? 'last4' THEN '{"last4":"4242"}'::jsonb ELSE '{}'::jsonb END
             END;

-- ─── Partnerprogramm ─────────────────────────────────────────────────────────
UPDATE affiliate_commissions SET
  stripe_invoice_id  = CASE WHEN stripe_invoice_id  IS NULL THEN NULL ELSE 'test_in_'  || left(md5(stripe_invoice_id), 12) END,
  stripe_customer_id = CASE WHEN stripe_customer_id IS NULL THEN NULL ELSE 'test_cus_' || left(md5(stripe_customer_id), 12) END;

-- Gutschriften sind per Trigger unveränderlich (§ 147 AO) – nur hier lokal kurz aus.
ALTER TABLE affiliate_payouts DISABLE TRIGGER trg_affiliate_payouts_protect_credit_note;
UPDATE affiliate_payouts SET
  stripe_transfer_id    = CASE WHEN stripe_transfer_id    IS NULL THEN NULL ELSE 'test_tr_'  || left(md5(id::text), 12) END,
  stripe_balance_txn_id = CASE WHEN stripe_balance_txn_id IS NULL THEN NULL ELSE 'test_txn_' || left(md5(id::text), 12) END,
  stripe_customer_id    = CASE WHEN stripe_customer_id    IS NULL THEN NULL ELSE 'test_cus_' || left(md5(id::text), 12) END,
  tax_profile_snapshot  = CASE WHEN tax_profile_snapshot IS NULL THEN NULL ELSE jsonb_build_object(
                            'tax_status', coalesce(tax_profile_snapshot->>'tax_status', 'regelbesteuert'),
                            'full_name', 'Test Partner', 'street', 'Teststraße 1', 'zip', '12345',
                            'city', 'Teststadt', 'country', 'DE', 'tax_number', '000/000/00000', 'vat_id', 'DE000000000') END,
  notes                 = CASE WHEN notes IS NULL THEN NULL ELSE 'anonymisiert' END,
  failure_reason        = CASE WHEN failure_reason IS NULL THEN NULL ELSE 'anonymisiert' END,
  credit_note_error     = CASE WHEN credit_note_error IS NULL THEN NULL ELSE 'anonymisiert' END;
ALTER TABLE affiliate_payouts ENABLE TRIGGER trg_affiliate_payouts_protect_credit_note;

UPDATE affiliate_tax_profiles t SET
  full_name    = 'Test Partner ' || a.n,
  street       = 'Teststraße ' || a.n,
  zip          = '12345',
  city         = 'Teststadt',
  country      = 'DE',
  tax_number   = CASE WHEN t.tax_number IS NULL THEN NULL ELSE '000/000/' || lpad(a.n::text, 5, '0') END,
  vat_id       = CASE WHEN t.vat_id IS NULL THEN NULL ELSE 'DE' || lpad(a.n::text, 9, '0') END,
  consent_ip   = CASE WHEN t.consent_ip IS NULL THEN NULL ELSE '127.0.0.1' END
FROM anon_users a
WHERE a.id = t.user_id;

-- ─── Werbung & Tracking ──────────────────────────────────────────────────────
UPDATE tracking_configs SET
  meta_pixel_id        = CASE WHEN meta_pixel_id   IS NULL OR meta_pixel_id = ''   THEN meta_pixel_id   ELSE '000000000000000' END,
  meta_token_enc       = NULL,
  google_ads_id        = CASE WHEN google_ads_id   IS NULL OR google_ads_id = ''   THEN google_ads_id   ELSE 'AW-0000000000' END,
  google_lead_label    = CASE WHEN google_lead_label IS NULL OR google_lead_label = '' THEN google_lead_label ELSE 'testlabel' END,
  google_contact_label = CASE WHEN google_contact_label IS NULL OR google_contact_label = '' THEN google_contact_label ELSE 'testlabel' END,
  tiktok_pixel_id      = CASE WHEN tiktok_pixel_id IS NULL OR tiktok_pixel_id = '' THEN tiktok_pixel_id ELSE 'TESTPIXEL000' END,
  tiktok_token_enc     = NULL,
  last_send_error      = NULL;

-- ─── Erfahrungsberichte ──────────────────────────────────────────────────────
UPDATE testimonials t SET
  full_name    = 'Test Kundin ' || x.rn,
  email        = CASE WHEN t.email IS NULL THEN NULL ELSE 'bericht' || x.rn || '@example.invalid' END,
  instagram    = CASE WHEN t.instagram IS NULL OR t.instagram = '' THEN t.instagram ELSE '@testprofil' || x.rn END,
  tiktok       = CASE WHEN t.tiktok    IS NULL OR t.tiktok    = '' THEN t.tiktok    ELSE '@testprofil' || x.rn END,
  facebook     = CASE WHEN t.facebook  IS NULL OR t.facebook  = '' THEN t.facebook  ELSE 'testprofil' || x.rn END,
  text         = CASE WHEN t.text IS NULL THEN NULL ELSE 'Anonymisierter Erfahrungsbericht für die Testumgebung.' END,
  upload_token = CASE WHEN t.upload_token IS NULL THEN NULL ELSE 'test_' || md5(t.id::text) END,
  consent_ip   = CASE WHEN t.consent_ip IS NULL THEN NULL ELSE '127.0.0.1' END,
  consent_ua   = CASE WHEN t.consent_ua IS NULL THEN NULL ELSE 'anonymisiert' END
FROM (SELECT id, row_number() OVER (ORDER BY created_at, id)::int AS rn FROM testimonials) x
WHERE x.id = t.id;

-- ─── Abschluss ───────────────────────────────────────────────────────────────
UPDATE app_settings SET value = regexp_replace(value, '[^@\s"]+@[^@\s"]+\.[a-z]{2,}', 'kontakt@example.invalid', 'g')
WHERE value ~ '@';

COMMIT;

SET client_min_messages = error;
ANALYZE;
