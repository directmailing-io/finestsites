-- Add preview_value and preview_interactive to each placeholderSchema field
-- preview_value:       admin-set demo value shown in public marketing preview
-- preview_interactive: if true, visitors can toggle/change this field in the preview sidebar
--
-- This makes placeholderSchema the single source of truth for both preview contexts:
--   1. App editor preview (blank / user data)
--   2. Marketing page preview (admin-prefilled + visitor-interactive fields)
--
-- Run for each template separately, marking the appropriate fields as interactive.

UPDATE templates
SET placeholder_schema = jsonb_set(
  placeholder_schema,
  '{fields}',
  (
    SELECT jsonb_agg(
      CASE
        WHEN field->>'key' IN ('farbthema', 'hero_variant', 'zeige_was_ersetzt', 'zeige_mit_optimalset', 'zeige_vergleich')
        THEN field
          || jsonb_build_object('preview_interactive', true)
          || jsonb_build_object('preview_value', COALESCE(
               (placeholder_schema->'preview_values'->>(field->>'key')),
               (field->>'default_value'),
               ''
             ))
        ELSE field
          || jsonb_build_object('preview_interactive', false)
          || jsonb_build_object('preview_value', COALESCE(
               (placeholder_schema->'preview_values'->>(field->>'key')),
               (field->>'default_value'),
               ''
             ))
      END
    )
    FROM jsonb_array_elements(placeholder_schema->'fields') AS field
  )
)
WHERE id = '5df9aab8-d32f-45eb-bc36-f4debc7819d2';
