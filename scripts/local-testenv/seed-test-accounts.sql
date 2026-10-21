-- ─────────────────────────────────────────────────────────────────────────────
-- Interne Testkonten für die lokale Testumgebung `finestsites_dev`.
-- Läuft nach anonymize.sql (setup.sh). Idempotent: löscht und erzeugt die
-- Konten mit festen IDs neu.
--
-- Alle Konten:  Passwort  Test1234!   · E-Mail bestätigt · Benutzername gesetzt
--               · Inhalts-Einverständnis erteilt
--
--   qa-free@example.invalid       qafree       ohne Tarif (kostenlos), 1 Entwurf
--   qa-starter@example.invalid    qastarter    Starter aktiv, Limit erreicht (1/1 veröffentlicht)
--   qa-pro@example.invalid        qapro        Pro aktiv, 2 veröffentlichte Seiten, Anfragen, Support-Chat
--   qa-grace@example.invalid      qagrace      Pro, Zahlung fehlgeschlagen (past_due, Schonfrist läuft)
--   qa-partner@example.invalid    qapartner    Partner: Steuerprofil, Provisionen, Gutschrift
--   appreview@example.invalid     appreview    „App Review“-Demokonto (Pro aktiv, Beispielseite)
-- ─────────────────────────────────────────────────────────────────────────────
\set ON_ERROR_STOP on
SET client_min_messages = warning;

DO $$
BEGIN
  IF current_database() <> 'finestsites_dev' THEN
    RAISE EXCEPTION 'seed-test-accounts.sql darf nur in finestsites_dev laufen (aktuell: %)', current_database();
  END IF;
END $$;

BEGIN;

-- Feste IDs
--   Nutzer:   00000000-0000-4000-a000-0000000000N1..N6
--   Seiten:   00000000-0000-4000-b000-0000000000NN
CREATE TEMP TABLE qa_users (id uuid, email text, username text, plan text, status text, label text) ON COMMIT DROP;
INSERT INTO qa_users VALUES
  ('00000000-0000-4000-a000-000000000001', 'qa-free@example.invalid',    'qafree',    'starter', NULL,       'QA Free'),
  ('00000000-0000-4000-a000-000000000002', 'qa-starter@example.invalid', 'qastarter', 'starter', 'active',   'QA Starter'),
  ('00000000-0000-4000-a000-000000000003', 'qa-pro@example.invalid',     'qapro',     'pro',     'active',   'QA Pro'),
  ('00000000-0000-4000-a000-000000000004', 'qa-grace@example.invalid',   'qagrace',   'pro',     'past_due', 'QA Schonfrist'),
  ('00000000-0000-4000-a000-000000000005', 'qa-partner@example.invalid', 'qapartner', 'pro',     'active',   'QA Partner'),
  ('00000000-0000-4000-a000-000000000006', 'appreview@example.invalid',  'appreview', 'pro',     'active',   'App Review');

-- Aufräumen (Gutschrift-Trigger kurz aus, nur für die eigenen QA-Belege)
ALTER TABLE affiliate_payouts DISABLE TRIGGER trg_affiliate_payouts_protect_credit_note;
DELETE FROM affiliate_payouts    WHERE referrer_id IN (SELECT id FROM qa_users);
ALTER TABLE affiliate_payouts ENABLE TRIGGER trg_affiliate_payouts_protect_credit_note;
DELETE FROM affiliate_commissions WHERE referrer_id IN (SELECT id FROM qa_users) OR referee_id IN (SELECT id FROM qa_users);
DELETE FROM users WHERE id IN (SELECT id FROM qa_users) OR email IN (SELECT email FROM qa_users) OR username IN (SELECT username FROM qa_users);

-- ─── Nutzer ──────────────────────────────────────────────────────────────────
INSERT INTO users (
  id, email, username, username_set_at, plan, billing_interval,
  stripe_customer_id, stripe_subscription_id, subscription_status, current_period_end,
  name, first_name, last_name, email_verified, team_partner_number,
  content_consent_at, content_consent_ip, content_consent_ua, content_consent_version,
  created_at, updated_at
)
SELECT q.id, q.email, q.username, now() - interval '30 days', q.plan, 'monthly',
       CASE WHEN q.status IS NULL THEN NULL ELSE 'test_cus_qa_' || q.username END,
       CASE WHEN q.status IS NULL THEN NULL ELSE 'test_sub_qa_' || q.username END,
       q.status,
       CASE WHEN q.status IS NULL THEN NULL ELSE now() + interval '20 days' END,
       q.label, 'QA', q.label, true, '9' || lpad(right(q.id::text, 6), 7, '0'),
       now() - interval '30 days', '127.0.0.1', 'seed', 'v1',
       now() - interval '30 days', now()
FROM qa_users q;

-- Schonfrist-Konto: Zahlung vor 3 Tagen fehlgeschlagen, 7 Tage online
UPDATE users SET
  payment_failed_at         = now() - interval '3 days',
  payment_failed_invoice_id = 'test_in_qa_grace',
  payment_grace_until       = now() + interval '4 days',
  payment_notice_sent_at    = now() - interval '3 days'
WHERE id = '00000000-0000-4000-a000-000000000004';

-- Partner: Verrechnung mit dem eigenen Abo, Starter-Konto wurde von ihm geworben
UPDATE users SET affiliate_onboarded = true, affiliate_payout_mode = 'credit',
                 affiliate_payout_email = email, company_name = 'QA Partner GmbH'
WHERE id = '00000000-0000-4000-a000-000000000005';
UPDATE users SET referred_by_username = 'qapartner', referral_terms = 'c2026'
WHERE id IN ('00000000-0000-4000-a000-000000000002', '00000000-0000-4000-a000-000000000003');

-- ─── Login (BetterAuth, Passwort Test1234!) ──────────────────────────────────
INSERT INTO accounts (id, account_id, provider_id, user_id, password, created_at, updated_at)
SELECT 'qa-acc-' || q.username, q.id::text, 'credential', q.id,
       'e65962ae22133751da2c79d146d66a14:a854f01ecd4f4c7af7c00fb5eead230a202162b90d5c47dcbbf6bf361e5c88943a71afea196d811a99cf38e4e935f180700065498b6292504ed1c9a0e091cbc4',
       now(), now()
FROM qa_users q;

-- ─── Webseiten (Inhalte aus einer anonymisierten Bestandsseite kopiert) ──────
CREATE TEMP TABLE qa_sites (id uuid, user_id uuid, template_id uuid, status text) ON COMMIT DROP;
INSERT INTO qa_sites VALUES
  -- Free: Linkseite als Entwurf
  ('00000000-0000-4000-b000-000000000011', '00000000-0000-4000-a000-000000000001', '21c773ae-5ecd-418e-a9b9-a978a7bdbd98', 'draft'),
  -- Starter: 1 veröffentlicht (= Limit) + 1 Entwurf
  ('00000000-0000-4000-b000-000000000021', '00000000-0000-4000-a000-000000000002', '5df9aab8-d32f-45eb-bc36-f4debc7819d2', 'published'),
  ('00000000-0000-4000-b000-000000000022', '00000000-0000-4000-a000-000000000002', 'b1d028a9-b4be-4d87-9178-9a92ebb2fb83', 'draft'),
  -- Pro: 2 veröffentlicht
  ('00000000-0000-4000-b000-000000000031', '00000000-0000-4000-a000-000000000003', '5df9aab8-d32f-45eb-bc36-f4debc7819d2', 'published'),
  ('00000000-0000-4000-b000-000000000032', '00000000-0000-4000-a000-000000000003', 'fbcf2022-2036-424a-93de-5878c5fa5b6d', 'published'),
  -- Schonfrist: 1 veröffentlicht (bleibt online, solange Schonfrist läuft)
  ('00000000-0000-4000-b000-000000000041', '00000000-0000-4000-a000-000000000004', '5df9aab8-d32f-45eb-bc36-f4debc7819d2', 'published'),
  -- Partner: Business-Seite
  ('00000000-0000-4000-b000-000000000051', '00000000-0000-4000-a000-000000000005', 'fbcf2022-2036-424a-93de-5878c5fa5b6d', 'published'),
  -- App Review: Optimalset + Vitalprofil
  ('00000000-0000-4000-b000-000000000061', '00000000-0000-4000-a000-000000000006', '5df9aab8-d32f-45eb-bc36-f4debc7819d2', 'published'),
  ('00000000-0000-4000-b000-000000000062', '00000000-0000-4000-a000-000000000006', '8a3ef41a-78fa-419d-937d-ccc7b552da1a', 'published');

-- Vorlage je Template: jüngste veröffentlichte (bzw. irgendeine) Bestandsseite
CREATE TEMP TABLE qa_source ON COMMIT DROP AS
SELECT DISTINCT ON (s.template_id) s.template_id, s.id AS source_site_id, s.published_data
FROM user_sites s
WHERE s.user_id NOT IN (SELECT id FROM qa_users)
ORDER BY s.template_id, (s.status = 'published') DESC, (s.published_data IS NOT NULL) DESC, s.updated_at DESC;

INSERT INTO user_sites (id, user_id, template_id, status, published_at, created_at, updated_at,
                        content_consent_given_at, content_consent_ip, content_consent_ua, content_consent_version,
                        published_data, published_data_at)
SELECT q.id, q.user_id, q.template_id, q.status,
       CASE WHEN q.status = 'published' THEN now() - interval '10 days' END,
       now() - interval '20 days', now(),
       now() - interval '20 days', '127.0.0.1', 'seed', 'v1',
       CASE WHEN q.status = 'published' THEN src.published_data END,
       CASE WHEN q.status = 'published' AND src.published_data IS NOT NULL THEN now() - interval '10 days' END
FROM qa_sites q
LEFT JOIN qa_source src ON src.template_id = q.template_id;

INSERT INTO site_data (user_site_id, field_key, field_value, updated_at)
SELECT q.id, sd.field_key, sd.field_value, now()
FROM qa_sites q
JOIN qa_source src ON src.template_id = q.template_id
JOIN site_data sd ON sd.user_site_id = src.source_site_id;

-- Namen auf den QA-Seiten klar kennzeichnen
UPDATE site_data sd SET field_value = CASE
    WHEN sd.field_key = 'vorname'  THEN 'QA'
    WHEN sd.field_key = 'nachname' THEN u.username
    ELSE sd.field_value END
FROM user_sites s JOIN users u ON u.id = s.user_id
WHERE s.id = sd.user_site_id AND s.user_id IN (SELECT id FROM qa_users)
  AND sd.field_key IN ('vorname', 'nachname');
UPDATE user_sites s SET published_data = s.published_data
       || jsonb_build_object('vorname', 'QA', 'nachname', u.username)
FROM users u
WHERE u.id = s.user_id AND s.user_id IN (SELECT id FROM qa_users)
  AND s.published_data IS NOT NULL AND jsonb_typeof(s.published_data) = 'object';

-- ─── Anfragen (Pro-Konto) ────────────────────────────────────────────────────
INSERT INTO form_submissions (user_site_id, form_name, data, is_spam, read_at, created_at)
VALUES
  ('00000000-0000-4000-b000-000000000031', 'kontakt',
   '{"name":"Erika Test","email":"interessent-a@example.invalid","telefon":"+49 151 00000001","kontaktweg":"whatsapp","ziele":"energie, sport","hintergrund":"Präventiv","laendervorwahl":"+49"}',
   false, NULL, now() - interval '2 hours'),
  ('00000000-0000-4000-b000-000000000031', 'kontakt',
   '{"name":"Max Test","email":"interessent-b@example.invalid","telefon":"","kontaktweg":"email","ziele":"immunsystem","hintergrund":"Neugierig","laendervorwahl":"+49"}',
   false, now() - interval '1 day', now() - interval '2 days'),
  ('00000000-0000-4000-b000-000000000032', 'kontakt',
   '{"fullname":"Lena Test","telefon":"+49 151 00000003","interesse":"neu","kontaktweg":"telefon","zeit":"mehr"}',
   false, NULL, now() - interval '5 hours'),
  ('00000000-0000-4000-b000-000000000032', 'kontakt',
   '{"fullname":"Spam Bot","telefon":"000","interesse":"neu","kontaktweg":"telefon","zeit":"mehr"}',
   true, NULL, now() - interval '3 days');

-- ─── Support-Chat (Pro-Konto) ────────────────────────────────────────────────
INSERT INTO support_conversations (id, user_id, status, subject, last_message_at, unread_by_admin, unread_by_user, created_at, updated_at)
VALUES ('00000000-0000-4000-c000-000000000031', '00000000-0000-4000-a000-000000000003', 'open',
        'QA: Frage zur eigenen Domain', now() - interval '30 minutes', 1, 0, now() - interval '1 day', now());
INSERT INTO support_messages (conversation_id, sender_type, sender_id, content, content_type, created_at) VALUES
  ('00000000-0000-4000-c000-000000000031', 'user',  '00000000-0000-4000-a000-000000000003',
   'Hallo, wie verbinde ich meine eigene Domain mit meiner Seite?', 'text', now() - interval '1 day'),
  ('00000000-0000-4000-c000-000000000031', 'admin', (SELECT id FROM users WHERE is_admin ORDER BY created_at LIMIT 1),
   'Hallo! Öffne die Seite im Editor und klicke auf „Eigene Domain“. Dort steht Schritt für Schritt, was du beim Anbieter einträgst.', 'text', now() - interval '20 hours'),
  ('00000000-0000-4000-c000-000000000031', 'user',  '00000000-0000-4000-a000-000000000003',
   'Danke! Der CNAME ist eingetragen, der Status steht aber noch auf „ausstehend“.', 'text', now() - interval '30 minutes');

-- ─── Abo-Verlauf (für Rechnungen/Admin-Ansichten) ────────────────────────────
INSERT INTO subscription_events (user_id, event_type, plan, billing_interval, amount_cents, stripe_event_id, stripe_subscription_id, created_at)
SELECT q.id, 'subscription_created', q.plan, 'monthly',
       CASE q.plan WHEN 'starter' THEN 1700 WHEN 'pro' THEN 2700 ELSE 3700 END,
       'test_evt_qa_' || q.username, 'test_sub_qa_' || q.username, now() - interval '30 days'
FROM qa_users q WHERE q.status IS NOT NULL;
INSERT INTO subscription_events (user_id, event_type, plan, billing_interval, amount_cents, stripe_event_id, stripe_subscription_id, stripe_invoice_id, metadata, created_at)
VALUES ('00000000-0000-4000-a000-000000000004', 'payment_failed', 'pro', 'monthly', 2700,
        'test_evt_qa_grace_failed', 'test_sub_qa_qagrace', 'test_in_qa_grace',
        '{"attempt_count":1,"payment_method_type":"card","payment_method_last4":"0341"}', now() - interval '3 days');

-- ─── Partnerprogramm ─────────────────────────────────────────────────────────
INSERT INTO affiliate_tax_profiles (user_id, tax_status, full_name, street, zip, city, country, tax_number, vat_id,
                                    entrepreneur_confirmed, consent_at, consent_version, consent_text, consent_ip)
VALUES ('00000000-0000-4000-a000-000000000005', 'regelbesteuert', 'QA Partner GmbH', 'Teststraße 5', '12345', 'Teststadt', 'DE',
        '000/000/00005', 'DE000000005', true, now() - interval '25 days', 'v1', 'Testeinverständnis (Seed)', '127.0.0.1');

-- Gutschrift (bereits bezahlt, per Verrechnung) mit zwei Provisionen
INSERT INTO affiliate_payouts (id, referrer_id, commission_ids, total_amount, commission_count, period_start, period_end,
                               payout_method, stripe_balance_txn_id, stripe_customer_id, status,
                               net_amount, vat_amount, gross_amount, vat_rate, tax_status, tax_profile_snapshot, line_items,
                               credit_note_number, credit_note_date, credit_note_status, created_at, paid_at, updated_at)
VALUES ('00000000-0000-4000-d000-000000000051', '00000000-0000-4000-a000-000000000005',
        ARRAY['00000000-0000-4000-e000-000000000001','00000000-0000-4000-e000-000000000002']::uuid[],
        440, 2, (now() - interval '40 days')::date, (now() - interval '10 days')::date,
        'credit', 'test_txn_qa_partner_1', 'test_cus_qa_qapartner', 'paid',
        370, 70, 440, 0.19, 'regelbesteuert',
        '{"tax_status":"regelbesteuert","full_name":"QA Partner GmbH","street":"Teststraße 5","zip":"12345","city":"Teststadt","country":"DE","tax_number":"000/000/00005","vat_id":"DE000000005"}',
        '[{"date":"2026-09-15T10:00:00.000Z","invoiceRef":"QA0001","customerRef":"K-QA01","baseNetCents":1429,"rate":0.1,"commissionCents":143,"kind":"commission"},{"date":"2026-09-20T10:00:00.000Z","invoiceRef":"QA0002","customerRef":"K-QA02","baseNetCents":2269,"rate":0.1,"commissionCents":227,"kind":"commission"}]',
        'GS-2026-90001', (now() - interval '9 days')::date, 'pending',
        now() - interval '10 days', now() - interval '9 days', now() - interval '9 days');

INSERT INTO affiliate_commissions (id, referrer_id, referee_id, stripe_invoice_id, stripe_customer_id, gross_amount, net_amount,
                                   commission_rate, commission_amount, status, available_at, paid_at, payout_id, created_at, updated_at)
VALUES
  ('00000000-0000-4000-e000-000000000001', '00000000-0000-4000-a000-000000000005', '00000000-0000-4000-a000-000000000002',
   'test_in_qa_c1', 'test_cus_qa_qastarter', 1700, 1429, 0.1, 143, 'paid', now() - interval '20 days', now() - interval '9 days',
   '00000000-0000-4000-d000-000000000051', now() - interval '36 days', now() - interval '9 days'),
  ('00000000-0000-4000-e000-000000000002', '00000000-0000-4000-a000-000000000005', '00000000-0000-4000-a000-000000000003',
   'test_in_qa_c2', 'test_cus_qa_qapro', 2700, 2269, 0.1, 227, 'paid', now() - interval '18 days', now() - interval '9 days',
   '00000000-0000-4000-d000-000000000051', now() - interval '31 days', now() - interval '9 days'),
  -- verfügbar (nächste Abrechnung)
  ('00000000-0000-4000-e000-000000000003', '00000000-0000-4000-a000-000000000005', '00000000-0000-4000-a000-000000000002',
   'test_in_qa_c3', 'test_cus_qa_qastarter', 1700, 1429, 0.1, 143, 'available', now() - interval '1 day', NULL,
   NULL, now() - interval '6 days', now() - interval '1 day'),
  -- ausstehend (Wartefrist läuft)
  ('00000000-0000-4000-e000-000000000004', '00000000-0000-4000-a000-000000000005', '00000000-0000-4000-a000-000000000003',
   'test_in_qa_c4', 'test_cus_qa_qapro', 2700, 2269, 0.1, 227, 'pending', now() + interval '12 days', NULL,
   NULL, now() - interval '1 day', now() - interval '1 day');

COMMIT;
