-- Markenfarbe je Konto (Phase A: sichtbar nur für Admin-Konten, 14.10.2026).
-- Hex-Wert "#RRGGBB"; NULL = keine Markenfarbe gesetzt.
ALTER TABLE users ADD COLUMN IF NOT EXISTS brand_color varchar(7);
