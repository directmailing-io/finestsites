-- Prüft finestsites_dev auf verbliebene echte Daten.
-- Durchsucht JEDE Text-/JSON-Spalte nach E-Mail-Adressen, die nicht auf
-- example.invalid / finestsites.io enden, sowie nach echten Stripe-IDs.
-- Bricht ab (Exit ≠ 0), wenn in einer personenbezogenen Tabelle etwas übrig ist.
\set ON_ERROR_STOP on
SET client_min_messages = notice;

DO $$
DECLARE
  r record;
  cnt bigint;
  bad int := 0;
  -- Tabellen mit redaktionellen Inhalten (Templates, Newsletter-Text): nur Hinweis
  info_tables text[] := ARRAY['templates', 'form_schemas', '_bak_lnko_schema_20261005', '_bak_schemas_20261009',
                              'template_updates'];
BEGIN
  IF current_database() <> 'finestsites_dev' THEN
    RAISE EXCEPTION 'nur in finestsites_dev';
  END IF;

  FOR r IN
    SELECT c.table_name, c.column_name, c.data_type
    FROM information_schema.columns c
    JOIN information_schema.tables t ON t.table_schema = c.table_schema AND t.table_name = c.table_name AND t.table_type = 'BASE TABLE'
    WHERE c.table_schema = 'public'
      AND c.data_type IN ('text', 'character varying', 'jsonb', 'ARRAY')
  LOOP
    -- E-Mail-Adressen außerhalb der erlaubten Domains
    EXECUTE format(
      $q$SELECT count(*) FROM %I WHERE %I::text ~* '[a-z0-9._%%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}'
           AND regexp_replace(%I::text, '[a-z0-9._%%+-]+@([a-z0-9-]+\.)*(example\.invalid|finestsites\.io|finestsites\.de)', '', 'gi')
               ~* '[a-z0-9._%%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}'$q$,
      r.table_name, r.column_name, r.column_name) INTO cnt;
    IF cnt > 0 THEN
      IF r.table_name = ANY (info_tables) THEN
        RAISE NOTICE 'Hinweis  %.%: % Zeile(n) mit E-Mail-Adresse (redaktioneller Inhalt)', r.table_name, r.column_name, cnt;
      ELSE
        RAISE WARNING 'ECHT?   %.%: % Zeile(n) mit E-Mail-Adresse', r.table_name, r.column_name, cnt;
        bad := bad + 1;
      END IF;
    END IF;

    -- Echte Stripe-IDs (Kunden, Abos, Connect, Rechnungen, Events)
    EXECUTE format(
      $q$SELECT count(*) FROM %I WHERE %I::text ~ '(^|[^A-Za-z0-9_])(cus|sub|acct|in|evt|tr|txn|pi|pm|seti|ch|re|po)_(?=[A-Za-z0-9]*[0-9])(?=[A-Za-z0-9]*[A-Z])[A-Za-z0-9]{10,}'$q$,
      r.table_name, r.column_name) INTO cnt;
    IF cnt > 0 AND NOT (r.table_name = ANY (info_tables)) THEN
      RAISE WARNING 'ECHT?   %.%: % Zeile(n) mit Stripe-ID', r.table_name, r.column_name, cnt;
      bad := bad + 1;
    END IF;
  END LOOP;

  SELECT count(*) INTO cnt FROM sessions;               IF cnt > 0 THEN RAISE WARNING 'sessions nicht leer: %', cnt; bad := bad + 1; END IF;
  SELECT count(*) INTO cnt FROM verifications;          IF cnt > 0 THEN RAISE WARNING 'verifications nicht leer: %', cnt; bad := bad + 1; END IF;
  SELECT count(*) INTO cnt FROM impersonation_requests; IF cnt > 0 THEN RAISE WARNING 'impersonation_requests nicht leer: %', cnt; bad := bad + 1; END IF;
  SELECT count(*) INTO cnt FROM accounts WHERE password IS NOT NULL
    AND password <> 'e65962ae22133751da2c79d146d66a14:a854f01ecd4f4c7af7c00fb5eead230a202162b90d5c47dcbbf6bf361e5c88943a71afea196d811a99cf38e4e935f180700065498b6292504ed1c9a0e091cbc4';
  IF cnt > 0 THEN RAISE WARNING 'accounts mit echtem Passwort-Hash: %', cnt; bad := bad + 1; END IF;
  SELECT count(*) INTO cnt FROM users WHERE email NOT LIKE '%@example.invalid';
  IF cnt > 0 THEN RAISE WARNING 'users mit echter E-Mail: %', cnt; bad := bad + 1; END IF;

  IF bad > 0 THEN
    RAISE EXCEPTION 'Anonymisierung unvollständig (% Befund(e)) – Datenbank NICHT verwenden.', bad;
  END IF;
  RAISE NOTICE 'OK: keine echten E-Mail-Adressen, Stripe-IDs, Sitzungen oder Passwort-Hashes gefunden.';
END $$;
