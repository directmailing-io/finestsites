-- Besucher-Chat: Gesprächs-Code (docs/chat/konzept.md, Abschnitt „Gesprächs-Code“).
-- Jedes Gespräch bekommt einen 8-stelligen Code (Alphabet ohne 0/O/1/I/L), mit dem der Besucher es in einem
-- anderen Browser/Gerät wieder öffnen kann. Der Betreiber sieht den Code in App/Web und kann ihn nennen.
-- Nur ergänzend: neue Spalte (NULL erlaubt) + Teil-Index; bestehende Gespräche bekommen hier einen Code.
BEGIN;

ALTER TABLE public.chat_conversations ADD COLUMN IF NOT EXISTS resume_code varchar(8);

-- Ein Code zeigt je Webseite auf genau ein Gespräch
CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_conversations_resume_code
  ON public.chat_conversations(site_id, resume_code) WHERE resume_code IS NOT NULL;

-- Bestehende Gespräche (nur demo) nachziehen; gleiches Alphabet wie src/lib/chat/service.ts
DO $$
DECLARE
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  r record;
  code text;
  i int;
BEGIN
  FOR r IN SELECT id FROM public.chat_conversations WHERE resume_code IS NULL LOOP
    LOOP
      code := '';
      FOR i IN 1..8 LOOP
        code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
      END LOOP;
      BEGIN
        UPDATE public.chat_conversations SET resume_code = code WHERE id = r.id;
        EXIT;
      EXCEPTION WHEN unique_violation THEN
        -- sehr unwahrscheinlich: neu würfeln
      END;
    END LOOP;
  END LOOP;
END $$;

COMMIT;
