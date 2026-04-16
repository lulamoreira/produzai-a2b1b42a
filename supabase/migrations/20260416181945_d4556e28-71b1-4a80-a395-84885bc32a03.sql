-- Create store_portal_motivos table
CREATE TABLE store_portal_motivos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  descricao text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(client_id, descricao)
);
ALTER TABLE store_portal_motivos DISABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON store_portal_motivos TO authenticated;
GRANT SELECT ON store_portal_motivos TO anon;

-- Add new columns to store_occurrence_reports
ALTER TABLE store_occurrence_reports
  ADD COLUMN IF NOT EXISTS reporter_type text NOT NULL DEFAULT 'lojista',
  ADD COLUMN IF NOT EXISTS motive_id uuid REFERENCES store_portal_motivos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS expected_resolution_date timestamptz,
  ADD COLUMN IF NOT EXISTS needs_reinstallation boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS resolution_photo_urls text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS tratativa_status text NOT NULL DEFAULT 'aberta',
  ADD COLUMN IF NOT EXISTS tratativa_notes text,
  ADD COLUMN IF NOT EXISTS resolved_by_user_id uuid;

-- Trigger to auto-set resolved_at based on tratativa_status
CREATE OR REPLACE FUNCTION set_occurrence_resolved_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.tratativa_status = 'resolvida' AND (OLD.tratativa_status IS DISTINCT FROM 'resolvida') THEN
    NEW.resolved_at = now();
  END IF;
  IF NEW.tratativa_status <> 'resolvida' THEN
    NEW.resolved_at = NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_occurrence_resolved_at ON store_occurrence_reports;
CREATE TRIGGER trigger_occurrence_resolved_at
  BEFORE UPDATE ON store_occurrence_reports
  FOR EACH ROW EXECUTE FUNCTION set_occurrence_resolved_at();