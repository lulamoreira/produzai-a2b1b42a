
ALTER TABLE public.campaign_schedules ADD COLUMN IF NOT EXISTS reinstall_seq integer NOT NULL DEFAULT 0;
ALTER TABLE public.campaign_schedules ADD COLUMN IF NOT EXISTS reinstall_reason text;
ALTER TABLE public.campaign_schedules ADD COLUMN IF NOT EXISTS parent_installation_id uuid REFERENCES public.campaign_schedules(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_campaign_schedules_parent ON public.campaign_schedules(parent_installation_id);
CREATE INDEX IF NOT EXISTS idx_campaign_schedules_reinstall ON public.campaign_schedules(campaign_id, store_id, reinstall_seq);

ALTER TABLE public.campaign_schedules DROP CONSTRAINT IF EXISTS campaign_schedules_campaign_id_store_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS campaign_schedules_unique_per_seq ON public.campaign_schedules(campaign_id, store_id, reinstall_seq);
