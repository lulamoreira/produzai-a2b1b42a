
ALTER TABLE public.occurrences ADD COLUMN locked boolean NOT NULL DEFAULT false;
ALTER TABLE public.campaign_schedules ADD COLUMN locked boolean NOT NULL DEFAULT false;
ALTER TABLE public.permission_categories ADD COLUMN can_lock_cards boolean NOT NULL DEFAULT false;
