ALTER TABLE public.lal_tratativa_statuses
  ADD COLUMN IF NOT EXISTS admin_only boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS fallback_status text;

COMMENT ON COLUMN public.lal_tratativa_statuses.admin_only IS 'When true, the status is only offered to admin/master users.';
COMMENT ON COLUMN public.lal_tratativa_statuses.fallback_status IS 'Value of another status of the same client; when a non admin/master saves with this status, the fallback is stored instead.';