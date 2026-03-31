ALTER TABLE public.campaigns
ADD COLUMN occurrence_start_date date DEFAULT NULL,
ADD COLUMN occurrence_end_date date DEFAULT NULL;