
ALTER TABLE clients ADD COLUMN IF NOT EXISTS language text DEFAULT 'pt-BR';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS preferred_language text DEFAULT 'pt-BR';
