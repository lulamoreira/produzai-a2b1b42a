ALTER TABLE public.automation_templates
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'fixed',
  ADD COLUMN IF NOT EXISTS base_field text NULL;

ALTER TABLE public.automation_templates
  DROP CONSTRAINT IF EXISTS automation_templates_kind_check;

ALTER TABLE public.automation_templates
  ADD CONSTRAINT automation_templates_kind_check
  CHECK (kind IN ('fixed', 'by_field'));