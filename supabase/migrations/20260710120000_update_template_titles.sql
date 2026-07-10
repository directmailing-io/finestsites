-- Update confusing template titles for lnko.me and myevnt.io
-- User feedback: absolute beginners (Laien) can't understand the current titles

UPDATE templates
SET title = 'Meine Link-Seite',
    updated_at = NOW()
WHERE domain = 'lnko.me';

UPDATE templates
SET title = 'Meine Event-Seite',
    updated_at = NOW()
WHERE domain = 'myevnt.io';
