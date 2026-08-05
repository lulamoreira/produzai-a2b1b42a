-- We can't easily add a global UNIQUE constraint because existing duplicates must remain.
-- But we can add a check trigger for NEW insertions.
-- First, let's make doc_norm and doc_type mandatory if we want to enforce this strictly, 
-- but the requirement says "if possible" for existing data.

CREATE OR REPLACE FUNCTION public.check_installer_duplicate_doc()
RETURNS TRIGGER AS $$
BEGIN
  -- Only validate if documentation is provided
  IF NEW.cpf IS NOT NULL OR NEW.rg IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 
      FROM public.installation_team_members 
      WHERE id <> NEW.id -- ignore self on update
        AND (
          (NEW.cpf IS NOT NULL AND cpf = NEW.cpf) 
          OR 
          (NEW.rg IS NOT NULL AND rg = NEW.rg)
        )
    ) THEN
      RAISE EXCEPTION 'Documento já cadastrado para outro instalador.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tg_check_installer_duplicate_doc
BEFORE INSERT OR UPDATE ON public.installation_team_members
FOR EACH ROW
EXECUTE FUNCTION public.check_installer_duplicate_doc();

-- Update blocked_installers to include client_id if we want per-client blocking,
-- but the table schema currently lacks it. 
-- The user asked to "manage blocked installers in the client area".
-- Let's check if we should add client_id to blocked_installers.

ALTER TABLE public.blocked_installers ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id);

GRANT ALL ON public.blocked_installers TO authenticated;
GRANT ALL ON public.blocked_installers TO service_role;

