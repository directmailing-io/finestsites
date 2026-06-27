-- Add preview_config column for interactive editor preview on /vorlagen/[id]
ALTER TABLE templates ADD COLUMN IF NOT EXISTS preview_config JSONB DEFAULT NULL;

-- Set preview_config for Das Optimalset template (womenplus.io domain)
-- Fields match the actual placeholderSchema card_select fields exactly
UPDATE templates
SET preview_config = '{
  "theme_field_key": "farbthema",
  "editable_themes": [
    {"value": "gruen",  "label": "Grün",   "description": "Natürlich, frisch, gesund.",    "color": "#2F8650", "card_type": "color"},
    {"value": "rot",    "label": "Rot",    "description": "Kraftvoll, energiegeladen.",     "color": "#C0392B", "card_type": "color"},
    {"value": "orange", "label": "Orange", "description": "Warm, einladend, sonnig.",       "color": "#D4851C", "card_type": "color"}
  ],
  "hero_variant_field_key": "hero_variant",
  "editable_hero_variants": [
    {"value": "v1", "label": "Produkt-Hotspots",     "description": "Interaktive Tooltips zu jedem Produkt.",   "image_url": "/templates/fitline-optimalset/hero-previews/hero-v1.webp"},
    {"value": "v2", "label": "Familie in der Küche", "description": "Warmer Familien-Moment, persönlich.",      "image_url": "/templates/fitline-optimalset/hero-previews/hero-v2.webp"},
    {"value": "v3", "label": "Frau mit PowerCocktail","description": "Fokus auf eine Person beim Genuss.",      "image_url": "/templates/fitline-optimalset/hero-previews/hero-v3.webp"}
  ],
  "editable_sections": [
    {"field_key": "zeige_was_ersetzt",    "label": "Was das Optimalset ersetzt",  "emoji": "🔄", "default_value": "ja"},
    {"field_key": "zeige_mit_optimalset", "label": "Mit dem Optimalset",          "emoji": "✅", "default_value": "ja"},
    {"field_key": "zeige_vergleich",      "label": "Im direkten Vergleich",       "emoji": "📊", "default_value": "ja"}
  ],
  "default_values": {
    "farbthema": "gruen",
    "hero_variant": "v2"
  }
}'::jsonb
WHERE id = '5df9aab8-d32f-45eb-bc36-f4debc7819d2';
