-- Add preview_config column for interactive editor preview on /vorlagen/[id]
ALTER TABLE templates ADD COLUMN IF NOT EXISTS preview_config JSONB DEFAULT NULL;

-- Set preview_config for WomenPlus template
UPDATE templates
SET preview_config = '{
  "editable_themes": [
    {"key": "lila",  "label": "Lila",  "color": "#8060b0"},
    {"key": "gruen", "label": "Grün",  "color": "#2F8650"},
    {"key": "blau",  "label": "Blau",  "color": "#2563EB"},
    {"key": "rose",  "label": "Rosé",  "color": "#E11D48"},
    {"key": "sand",  "label": "Sand",  "color": "#a16207"},
    {"key": "dark",  "label": "Dark",  "color": "#27272a"}
  ],
  "editable_sections": [
    {"key": "video",       "label": "Erklärvideo",              "emoji": "▶",  "default_on": true},
    {"key": "benefits",    "label": "Warum ich das empfehle",   "emoji": "🛡️", "default_on": true},
    {"key": "testimonial", "label": "Erfahrungsberichte",       "emoji": "💬", "default_on": true},
    {"key": "contact",     "label": "Kontaktformular",          "emoji": "📬", "default_on": true}
  ],
  "editable_header_images": [
    {"key": "none",    "label": "Keins",    "emoji": "—"},
    {"key": "blumen",  "label": "Blumen",   "emoji": "🌸"},
    {"key": "natur",   "label": "Natur",    "emoji": "🌿"},
    {"key": "stadt",   "label": "Stadt",    "emoji": "🏙️"}
  ]
}'::jsonb
WHERE id = '5df9aab8-d32f-45eb-bc36-f4debc7819d2';
