-- Temporäre Feedback-Kampagne (anonym). Zum vollständigen Entfernen:
-- siehe docs/feedback-aktion-entfernen.md — Rückbau: DROP TABLE feedback_responses;
CREATE TABLE IF NOT EXISTS feedback_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  answers jsonb NOT NULL
);
