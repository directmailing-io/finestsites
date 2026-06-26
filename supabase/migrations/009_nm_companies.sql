-- Add Network Marketing company fields
-- Users: which NM companies the user belongs to/prefers
ALTER TABLE users ADD COLUMN IF NOT EXISTS nm_companies text[] DEFAULT '{}';

-- Templates: which NM companies this template is designed for
ALTER TABLE templates ADD COLUMN IF NOT EXISTS nm_companies text[] DEFAULT '{}';

-- Templates: allrounder flag = template fits all companies
ALTER TABLE templates ADD COLUMN IF NOT EXISTS is_allrounder boolean DEFAULT false;
